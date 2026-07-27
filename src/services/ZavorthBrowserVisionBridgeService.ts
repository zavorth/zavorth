import {
  ZAVORTH_BROWSER_VISION_BRIDGE_CONTRACT_VERSION,
  type ZavorthBrowserEvidenceSource,
  type ZavorthBrowserPlannedActionKind,
  type ZavorthBrowserVisionAction,
  type ZavorthBrowserVisionBridgeSnapshot,
  type ZavorthBrowserVisionInput,
  type ZavorthBrowserVisionPlanStep,
  type ZavorthBrowserVisionReceipt,
  type ZavorthBrowserVisionStatus,
} from '../contracts/ZavorthBrowserVisionBridgeContract.js';
import { ZavorthVisionControlPlaneService } from './ZavorthVisionControlPlaneService.js';

import crypto from 'node:crypto';
import { assertPublicHttpTargetAllowed } from '../ai-gateway/lib/security/egressGuard.js';
import {
  createSurfaceResponse,
  type SurfaceReceiptStatus,
  type SurfaceResponse,
  type SurfaceResponseAction,
} from '../domain/surface/application/surface-response/index.js';

import type { ZavorthVisionPolicyDecision } from '../contracts/ZavorthVisionControlPlaneContract.js';
import {
  RuntimeBrowserSidecarService,
  type RuntimeBrowserSidecarResponse,
} from './RuntimeBrowserSidecarService.js';

import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

type BrowserSidecarLike = Pick<RuntimeBrowserSidecarService, 'execute' | 'isConfigured'>;

type BrowserBridgeDeps = {
  sidecar?: BrowserSidecarLike | null;
  vision?: ZavorthVisionControlPlaneService;
  egressGuard?: (url: string, allowPrivateEgress: boolean) => Promise<URL>;
};

type EvidenceBundle = {
  source: ZavorthBrowserEvidenceSource;
  text: string;
  pdf: boolean;
};

const MUTATING_ACTIONS = new Set<ZavorthBrowserPlannedActionKind>(['click', 'fill', 'submit']);
const DEFAULT_TIMEOUT_MS = 30_000;

export class ZavorthBrowserVisionBridgeService {
  private readonly sidecar: BrowserSidecarLike;
  private readonly vision: ZavorthVisionControlPlaneService;
  private readonly egressGuard: (url: string, allowPrivateEgress: boolean) => Promise<URL>;

  constructor(deps: BrowserBridgeDeps = {}) {
    this.sidecar = deps.sidecar === undefined ? new RuntimeBrowserSidecarService() : deps.sidecar || disabledSidecar();
    this.vision = deps.vision || new ZavorthVisionControlPlaneService();
    this.egressGuard = deps.egressGuard || defaultEgressGuard;
  }

  public async execute(input: ZavorthBrowserVisionInput = {}): Promise<ZavorthBrowserVisionBridgeSnapshot> {
    const action = normalizeAction(input.action);
    const sourceSurface = String(input.sourceSurface || 'shared-surface').trim() || 'shared-surface';
    const urlDecision = await this.validateUrl(input.url, input.allowPrivateEgress === true);
    const sidecarConfigured = this.sidecar.isConfigured();
    const receipts: ZavorthBrowserVisionReceipt[] = [];
    const actionLog: string[] = [];
    let sidecarError: string | null = null;
    let sidecarUsed = false;
    let sidecarTitle: string | null = null;
    let sidecarEvidence: string | null = null;
    let publicEgressAllowed = false;

    if (urlDecision.status === 'blocked') {
      receipts.push(receipt('egress', 'blocked', urlDecision.reason));
      return this.buildSnapshot({
        action,
        input,
        sourceSurface,
        status: 'blocked',
        targetUrl: input.url || null,
        targetOrigin: null,
        targetTitle: null,
        evidence: {
          source: 'none',
          text: urlDecision.reason,
          pdf: looksLikePdf(input.url, input.pdfText),
        },
        receipts,
        sidecarConfigured,
        sidecarUsed,
        sidecarError: null,
        actionLog,
        publicEgressAllowed,
      });
    }

    if (urlDecision.url) {
      publicEgressAllowed = true;
      receipts.push(receipt('egress', 'done', `Public browser target allowed: ${urlDecision.url.origin}.`));
    }

    if (input.live && action === 'browser.inspect') {
      if (!sidecarConfigured) {
        receipts.push(receipt('sidecar', 'skipped', 'Browser sidecar is not configured; returning a governed preview instead of live navigation.'));
      } else if (urlDecision.url) {
        const live = await this.inspectWithSidecar(urlDecision.url.toString(), input, actionLog);
        sidecarUsed = live.used;
        sidecarTitle = live.title;
        sidecarEvidence = live.evidence;
        sidecarError = live.error;
        receipts.push(receipt('sidecar', live.error ? 'blocked' : 'done', live.error || 'Browser sidecar returned structured DOM evidence.'));
      }
    }

    const evidence = this.resolveEvidence(input, sidecarEvidence);
    const planSteps = action === 'browser.plan' || action === 'browser.apply'
      ? buildPlanSteps(input, urlDecision.url?.toString() || input.url || null)
      : [];
    const mutationRequested = planSteps.some((step) => step.mutation);
    const approvalRequired = mutationRequested && !input.approvalId;
    const applyWithoutApproval = action === 'browser.apply' && approvalRequired;
    const planId = planSteps.length > 0
      ? input.planId || makePlanId(input, planSteps)
      : input.planId || null;

    if (planSteps.length > 0) {
      receipts.push(receipt(
        'plan',
        approvalRequired ? 'approval-required' : 'done',
        approvalRequired ? 'Mutating browser plan requires owner approval before click, fill or submit.'
          : 'Browser plan is read-only or already carries an approval reference.',
      ));
    }
    if (action === 'browser.apply') {
      receipts.push(receipt(
        'apply',
        applyWithoutApproval ? 'approval-required' : 'done',
        applyWithoutApproval ? 'Apply was not executed because mutating browser actions require approval.'
          : 'Apply is prepared under policy; Preview engine does not perform unapproved mutation.',
      ));
    }

    const status = resolveStatus({
      action,
      approvalRequired: applyWithoutApproval,
      sidecarConfigured,
      live: input.live === true,
      sidecarError,
      redacted: false,
    });

    return this.buildSnapshot({
      action,
      input,
      sourceSurface,
      status,
      targetUrl: urlDecision.url?.toString() || input.url || null,
      targetOrigin: urlDecision.url?.origin || safeOrigin(input.url),
      targetTitle: sidecarTitle,
      evidence,
      receipts,
      sidecarConfigured,
      sidecarUsed,
      sidecarError,
      actionLog,
      publicEgressAllowed,
      planId,
      planSteps,
      mutationRequested,
      approvalRequired,
    });
  }

  public buildSurfaceResponse(snapshot: ZavorthBrowserVisionBridgeSnapshot): SurfaceResponse {
    const receipts = snapshot.receipts.map((entry) => ({
      id: entry.id,
      title: entry.kind,
      status: mapReceiptStatus(entry.status),
      reason: entry.reason,
      policyProfile: snapshot.policy.profile,
      redacted: snapshot.evidence.redactionApplied,
      riskBlocked: entry.status === 'blocked',
      createdAt: snapshot.generatedAt,
      metadata: {
        rawSecretSerialized: entry.rawSecretSerialized,
      },
    }));
    const actions = this.buildActions(snapshot);
    return createSurfaceResponse({
      id: `zavorth-browser-vision-${safeId(snapshot.action)}-${safeId(snapshot.generatedAt)}`,
      intent: 'status',
      title: 'Browser Vision Bridge',
      summary: `${snapshot.status}: ${snapshot.policy.reason}`,
      tone: snapshot.status === 'blocked'
        ? 'danger'
        : snapshot.status === 'approval-required' || snapshot.status === 'redacted' || snapshot.status === 'sidecar-unconfigured'
          ? 'warning'
          : 'success',
      blocks: [
        {
          kind: 'text',
          title: 'Browser estruturado',
          text: this.formatSnapshotText(snapshot),
        },
        {
          kind: 'table',
          table: {
            title: 'Evidencia',
            columns: [
              { key: 'item', label: 'Item', width: 24 },
              { key: 'value', label: 'Value', width: 48 },
            ],
            rows: [
              { item: 'source', value: snapshot.evidence.preferredSource },
              { item: 'sidecar', value: snapshot.sidecar.used ? 'used' : snapshot.sidecar.configured ? 'available' : 'not configured' },
              { item: 'ssrf', value: snapshot.safety.ssrfGuarded ? 'guarded' : 'off' },
              { item: 'pdf', value: snapshot.evidence.pdfTreatedAsUntrusted ? 'untrusted' : 'n/a' },
              { item: 'approval', value: snapshot.plan.approvalRequired ? 'required' : 'not required' },
            ],
          },
        },
        ...buildBrowserSetupBlocks(snapshot),
        {
          kind: 'list',
          title: 'Plan',
          items: snapshot.plan.steps.length > 0
            ? snapshot.plan.steps.map((step) => `${step.kind}: ${step.label} | approval=${step.requiresApproval ? 'yes' : 'no'}`)
            : ['No mutable plan was requested.'],
        },
        ...receipts.map((entry) => ({
          kind: 'receipt' as const,
          receipt: entry,
        })),
      ],
      actions,
      receipts,
      metadata: {
        source: snapshot.source,
        action: snapshot.action,
        status: snapshot.status,
        preferredSource: snapshot.evidence.preferredSource,
        sidecarUsed: snapshot.sidecar.used,
        mutationRequested: snapshot.plan.mutationRequested,
        setupRequired: snapshot.status === 'sidecar-unconfigured',
      },
    });
  }

  public formatSnapshotText(snapshot: ZavorthBrowserVisionBridgeSnapshot): string {
    return [
      'Browser Vision Bridge',
      '',
      `Status: ${snapshot.status}`,
      `Action: ${snapshot.action}`,
      `URL: ${snapshot.target.url || 'n/d'}`,
      `Policy: ${snapshot.policy.decision}`,
      `Evidence: ${snapshot.evidence.preferredSource} | redactions=${snapshot.evidence.redactionCount}`,
      `Sidecar: configured=${snapshot.sidecar.configured} used=${snapshot.sidecar.used} isolated=${snapshot.sidecar.isolated}`,
      '',
      'Safety:',
      '- DOM/ARIA/structured text before screenshot',
      '- screenshot only when DOM is not enough',
      '- SSRF/private network blocked por default',
      '- PDF/download sempre untrusted content',
      '- click/type/submit require approval',
      '',
      'Excerpt:',
      firstLine(snapshot.evidence.excerpt, 420),
      '',
      'Commands:',
      `- ${snapshot.commands.status}`,
      `- ${snapshot.commands.inspect}`,
      `- ${snapshot.commands.plan}`,
      `- ${snapshot.commands.apply}`,
      '',
      `Next: ${snapshot.nextSafeAction}`,
    ].join('\n');
  }

  private async inspectWithSidecar(
    url: string,
    input: ZavorthBrowserVisionInput,
    actionLog: string[],
  ): Promise<{ used: boolean; title: string | null; evidence: string | null; error: string | null }> {
    try {
      actionLog.push('browser_navigate');
      const navigate = await this.sidecar.execute({
        action: 'browser_navigate',
        args: { url, isolationMode: 'sidecar' },
        timeoutMs: normalizeTimeout(input.timeoutMs),
      });
      const navPayload = unwrapSidecarPayload(navigate);
      const title = getString(navPayload, ['title', 'payload.title']);

      actionLog.push('evaluate_js:document.body.innerText');
      const dom = await this.sidecar.execute({
        action: 'evaluate_js',
        args: { script: 'document.body.innerText', isolationMode: 'sidecar' },
        timeoutMs: normalizeTimeout(input.timeoutMs),
      });
      const evidence = extractTextFromSidecar(dom) || JSON.stringify(unwrapSidecarPayload(dom));
      return { used: true, title, evidence, error: null };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Browser Vision Bridge] process execution failed', error);
    return {
        used: false,
        title: null,
        evidence: null,
        error: error instanceof Error ? err.message : String(error),
      };
  }
  }

  private async validateUrl(
    rawUrl: string | null | undefined,
    allowPrivateEgress: boolean,
  ): Promise<{ status: 'none' | 'allowed' | 'blocked'; url: URL | null; reason: string }> {
    const value = String(rawUrl || '').trim();
    if (!value) {
      return { status: 'none', url: null, reason: 'No URL supplied.' };
    }
    try {
      const parsed = await this.egressGuard(value, allowPrivateEgress);
      return { status: 'allowed', url: parsed, reason: 'Public HTTP target allowed.' };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Browser Vision Bridge] network request failed', error);
    return {
        status: 'blocked',
        url: null,
        reason: error instanceof Error ? err.message : String(error),
      };
  }
  }

  private resolveEvidence(input: ZavorthBrowserVisionInput, sidecarEvidence: string | null): EvidenceBundle {
    if (sidecarEvidence) {
      return { source: 'sidecar-dom', text: sidecarEvidence, pdf: looksLikePdf(input.url, input.pdfText) };
    }
    if (input.domText) {
      return { source: 'dom', text: input.domText, pdf: looksLikePdf(input.url, input.pdfText) };
    }
    if (input.ariaText) {
      return { source: 'aria', text: input.ariaText, pdf: looksLikePdf(input.url, input.pdfText) };
    }
    if (input.pdfText) {
      return { source: 'pdf', text: input.pdfText, pdf: true };
    }
    if (input.htmlText) {
      return { source: 'dom', text: stripHtml(input.htmlText), pdf: looksLikePdf(input.url, input.pdfText) };
    }
    if (input.screenshotText) {
      return { source: 'screenshot-needed', text: input.screenshotText, pdf: looksLikePdf(input.url, input.pdfText) };
    }
    if (input.requestText) {
      return { source: 'operator-provided', text: input.requestText, pdf: looksLikePdf(input.url, input.pdfText) };
    }
    return { source: 'none', text: 'No browser DOM, ARIA, PDF or screenshot evidence supplied yet.', pdf: looksLikePdf(input.url, input.pdfText) };
  }

  private buildSnapshot(input: {
    action: ZavorthBrowserVisionAction;
    input: ZavorthBrowserVisionInput;
    sourceSurface: string;
    status: ZavorthBrowserVisionStatus;
    targetUrl: string | null;
    targetOrigin: string | null;
    targetTitle: string | null;
    evidence: EvidenceBundle;
    receipts: ZavorthBrowserVisionReceipt[];
    sidecarConfigured: boolean;
    sidecarUsed: boolean;
    sidecarError: string | null;
    actionLog: string[];
    publicEgressAllowed: boolean;
    planId?: string | null;
    planSteps?: ZavorthBrowserVisionPlanStep[];
    mutationRequested?: boolean;
    approvalRequired?: boolean;
  }): ZavorthBrowserVisionBridgeSnapshot {
    const vision = this.vision.buildSnapshot({
      action: input.evidence.source === 'pdf' ? 'vision.summarize' : 'vision.inspect',
      targetKind: 'browser',
      targetRef: input.targetUrl,
      sourceSurface: input.sourceSurface,
      actorId: input.input.actorId,
      observationText: input.evidence.text,
      artifactMime: input.evidence.pdf ? 'application/pdf' : 'text/html',
      requestedByNaturalLanguage: input.input.requestText ? true : undefined,
    });
    const redactedStatus = input.status === 'ready' && vision.status === 'redacted' ? 'redacted' : input.status;
    const mutationRequested = input.mutationRequested === true;
    const approvalRequired = input.approvalRequired === true;
    const decision = resolvePolicyDecision(redactedStatus, mutationRequested, approvalRequired, vision.policy.decision);
    const planStatus = resolvePlanStatus(input.action, input.planSteps || [], approvalRequired, input.input.approvalId);
    const policyReason = resolvePolicyReason(redactedStatus, mutationRequested, approvalRequired, input.sidecarError);
    return {
      contractVersion: ZAVORTH_BROWSER_VISION_BRIDGE_CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
      source: 'ZavorthBrowserVisionBridgeService',
      status: redactedStatus,
      action: input.action,
      target: {
        url: redactUrl(input.targetUrl),
        origin: input.targetOrigin,
        selector: input.input.selector || null,
        title: input.targetTitle,
        sourceSurface: input.sourceSurface,
      },
      sidecar: {
        configured: input.sidecarConfigured,
        used: input.sidecarUsed,
        isolated: input.sidecarUsed,
        runtime: input.sidecarUsed ? 'browser-sidecar' : 'preview-only',
        actionLog: input.actionLog,
        error: input.sidecarError,
      },
      evidence: {
        preferredSource: input.evidence.source,
        structuredDomPreferred: true,
        screenshotUsed: false,
        screenshotOnlyWhenDomInsufficient: true,
        untrustedWrapped: true,
        redactionApplied: vision.redaction.applied,
        redactionCount: vision.redaction.count,
        promptInjectionQuarantined: vision.safety.promptInjectionQuarantined,
        pdfTreatedAsUntrusted: input.evidence.pdf,
        rawDomStored: false,
        rawScreenshotStored: false,
        excerpt: vision.observations[0]?.text || '',
      },
      plan: {
        id: input.planId || null,
        status: planStatus,
        steps: input.planSteps || [],
        mutationRequested,
        approvalRequired,
        approvalId: input.input.approvalId || null,
      },
      policy: {
        decision,
        profile: 'browser-vision-gate-2',
        reason: policyReason,
        publicEgressAllowed: input.publicEgressAllowed,
        mutationAllowed: false,
        providerPayloadMinimized: true,
      },
      safety: {
        ssrfGuarded: true,
        privateNetworkBlockedByDefault: true,
        structuredDomPreferred: true,
        screenshotOnlyWhenDomInsufficient: true,
        noClickOrTypeWithoutApproval: true,
        noFormSubmitWithoutApproval: true,
        pdfIsUntrustedContent: true,
        subagentsReadOnlyMayReviewEvidence: true,
        rawSecretSerialized: false,
        liveMutationPerformed: false,
      },
      vision,
      receipts: [
        receipt('policy', decision, policyReason),
        receipt('dom', 'done', `Preferred evidence source: ${input.evidence.source}.`),
        ...(input.evidence.pdf ? [receipt('pdf', 'done', 'PDF/download evidence is wrapped as untrusted content.')] : []),
        ...input.receipts,
      ],
      commands: {
        status: '/computer browser status',
        inspect: '/vision browser inspect',
        plan: '/computer browser plan',
        apply: '/computer browser apply <plan>',
        nextAction: 'Approval gate - Desktop Computer Use Governado',
      },
      nextSafeAction: nextSafeAction(redactedStatus, mutationRequested, approvalRequired, input.sidecarConfigured),
    };
  }

  private buildActions(snapshot: ZavorthBrowserVisionBridgeSnapshot): SurfaceResponseAction[] {
    const actions: SurfaceResponseAction[] = [
      commandAction('browser-status', 'Status', snapshot.commands.status, 'primary'),
      commandAction('browser-inspect', 'Inspect', snapshot.commands.inspect, 'secondary'),
      commandAction('browser-plan', 'Plan', snapshot.commands.plan, 'secondary'),
      {
        ...commandAction('browser-apply', 'Apply', snapshot.plan.id ? `/computer browser apply ${snapshot.plan.id}` : snapshot.commands.apply, 'danger'),
        confirmationRequired: true,
        disabled: !snapshot.plan.id,
      },
    ];
    if (snapshot.status === 'sidecar-unconfigured') {
      actions.push(
        commandAction('browser-doctor-sidecars', 'Doctor browser', 'zavorth doctor sidecars --profile=desktop', 'secondary'),
        commandAction('browser-activate-sidecar', 'Ativar browser', 'zavorth capability activate browser --profile=desktop --apply', 'primary'),
      );
    }
    return actions;
  }
}

function buildBrowserSetupBlocks(snapshot: ZavorthBrowserVisionBridgeSnapshot): SurfaceResponse['blocks'] {
  if (snapshot.status !== 'sidecar-unconfigured') {
    return [];
  }
  return [
    {
      kind: 'list',
      title: 'Ativar browser live',
      tone: 'warning',
      items: [
        'O request natural already tentou usar o browser live.',
        'The browser sidecar is not configured on this host yet.',
        'run: zavorth doctor sidecars --profile=desktop',
        'after run: zavorth capability activate browser --profile=desktop --apply',
        'when ficar ready, o mesmo request passa a navegar/inspecionar em modo read-only automaticamente.',
      ],
    },
  ];
}

async function defaultEgressGuard(rawUrl: string, allowPrivateEgress: boolean): Promise<URL> {
  return assertPublicHttpTargetAllowed(rawUrl, {
    allowPrivateEnvVar: allowPrivateEgress ? 'ALLOW_PRIVATE_BROWSER_VISION_TARGETS' : undefined,
    serviceName: 'Browser vision',
  });
}

function disabledSidecar(): BrowserSidecarLike {
  return {
    isConfigured: () => false,
    execute: async () => {
      throw new Error('Browser sidecar is disabled.');
    },
  };
}

function normalizeAction(value: unknown): ZavorthBrowserVisionAction {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'status' || normalized === 'browser.status') return 'browser.status';
  if (normalized === 'plan' || normalized === 'browser.plan') return 'browser.plan';
  if (normalized === 'apply' || normalized === 'browser.apply') return 'browser.apply';
  return 'browser.inspect';
}

function buildPlanSteps(
  input: ZavorthBrowserVisionInput,
  url: string | null,
): ZavorthBrowserVisionPlanStep[] {
  const text = `${input.requestText || ''} ${input.selector || ''}`.toLowerCase();
  const steps: ZavorthBrowserVisionPlanStep[] = [];
  if (url) {
    steps.push(planStep('navigate', `Open ${safePreview(url, 80)}`, null, null));
  }
  if (text.includes('pdf') || looksLikePdf(url, input.pdfText)) {
    steps.push(planStep('read_pdf', 'Read PDF as untrusted evidence', null, null));
  } else {
    steps.push(planStep('inspect', 'Inspect DOM/ARIA text before screenshot', input.selector || null, null));
  }
  if (/\b(click|button)\b/.test(text)) {
    steps.push(planStep('click', 'Click approved element', input.selector || null, null));
  }
  if (/\b(fill|type|input)\b/.test(text)) {
    steps.push(planStep('fill', 'Fill approved field', input.selector || null, safePreview(input.requestText || '', 60)));
  }
  if (/\b(submit|send)\b/.test(text)) {
    steps.push(planStep('submit', 'Submit approved form/action', input.selector || null, null));
  }
  return dedupeSteps(steps);
}

function planStep(
  kind: ZavorthBrowserPlannedActionKind,
  label: string,
  selector: string | null,
  valuePreview: string | null,
): ZavorthBrowserVisionPlanStep {
  const mutation = MUTATING_ACTIONS.has(kind);
  return {
    id: `step-${kind}`,
    kind,
    label,
    selector,
    valuePreview,
    risk: mutation ? (kind === 'submit' ? 'high' : 'medium') : 'low',
    requiresApproval: mutation,
    mutation,
  };
}

function dedupeSteps(steps: ZavorthBrowserVisionPlanStep[]): ZavorthBrowserVisionPlanStep[] {
  const seen = new Set<string>();
  return steps.filter((step) => {
    if (seen.has(step.kind)) return false;
    seen.add(step.kind);
    return true;
  });
}

function resolveStatus(input: {
  action: ZavorthBrowserVisionAction;
  approvalRequired: boolean;
  sidecarConfigured: boolean;
  live: boolean;
  sidecarError: string | null;
  redacted: boolean;
}): ZavorthBrowserVisionStatus {
  if (input.approvalRequired) return 'approval-required';
  if (input.sidecarError) return 'blocked';
  if (input.live && !input.sidecarConfigured && input.action === 'browser.inspect') return 'sidecar-unconfigured';
  if (input.redacted) return 'redacted';
  return 'ready';
}

function resolvePolicyDecision(
  status: ZavorthBrowserVisionStatus,
  mutationRequested: boolean,
  approvalRequired: boolean,
  visionDecision: ZavorthVisionPolicyDecision,
): ZavorthVisionPolicyDecision {
  if (status === 'blocked' || visionDecision === 'deny') return 'deny';
  if (approvalRequired || mutationRequested) return 'require_owner_approval';
  if (visionDecision === 'allow_with_redaction' || status === 'redacted') return 'allow_with_redaction';
  return 'allow_readonly';
}

function resolvePlanStatus(
  action: ZavorthBrowserVisionAction,
  steps: ZavorthBrowserVisionPlanStep[],
  approvalRequired: boolean,
  approvalId: string | null | undefined,
): ZavorthBrowserVisionBridgeSnapshot['plan']['status'] {
  if (steps.length === 0) return 'none';
  if (approvalRequired) return 'approval-required';
  if (action === 'browser.apply' && approvalId) return 'applied-preview';
  if (action === 'browser.apply') return 'blocked';
  return 'planned';
}

function resolvePolicyReason(
  status: ZavorthBrowserVisionStatus,
  mutationRequested: boolean,
  approvalRequired: boolean,
  sidecarError: string | null,
): string {
  if (sidecarError) return `Browser sidecar failed or was blocked: ${sidecarError}`;
  if (status === 'blocked') return 'Browser target was blocked by egress or policy.';
  if (approvalRequired) return 'Mutating browser actions require owner approval before click, fill or submit.';
  if (mutationRequested) return 'Mutating browser plan is prepared but mutation remains disabled until approval.';
  if (status === 'sidecar-unconfigured') return 'Live browser inspect requested, but the isolated browser sidecar is not configured.';
  return 'Read-only browser vision is allowed with DOM-first evidence and safe egress policy.';
}

function nextSafeAction(
  status: ZavorthBrowserVisionStatus,
  mutationRequested: boolean,
  approvalRequired: boolean,
  sidecarConfigured: boolean,
): string {
  if (status === 'blocked') return 'Use a public http/https target or provide DOM/PDF text as operator evidence.';
  if (approvalRequired) return 'Ask the owner to approve the browser plan before any click, fill or submit.';
  if (!sidecarConfigured) return 'Configure ZAVORTH_BROWSER_SIDECAR_URL to enable live read-only browser inspection.';
  if (mutationRequested) return 'Keep the plan in preview until explicit approval is attached.';
  return 'Use DOM/ARIA evidence for reasoning; request a plan before any browser mutation.';
}

function looksLikePdf(url: string | null | undefined, pdfText: unknown): boolean {
  return Boolean(pdfText) || String(url || '').toLowerCase().split('...')[0]?.endsWith('.pdf') === true;
}

function stripHtml(value: string): string {
  return String(value || '')
    .replace(/<script[\s\S]*...<\/script>/gi, ' ')
    .replace(/<style[\s\S]*...<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function redactUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    parsed.username = parsed.username ? '[redacted]' : '';
    parsed.password = parsed.password ? '[redacted]' : '';
    return parsed.toString();
  } catch (error: unknown) {logger.warn('[Zavorth Browser Vision Bridge] parsing failed', error);
    return safePreview(value, 160);
  }
}

function safeOrigin(value: string | null | undefined): string | null {
  try {
    return new URL(String(value || '')).origin;
  } catch (error: unknown) {logger.warn('[Zavorth Browser Vision Bridge] parsing failed', error); return null; }
}

function makePlanId(input: ZavorthBrowserVisionInput, steps: ZavorthBrowserVisionPlanStep[]): string {
  const hash = crypto.createHash('sha256')
    .update(JSON.stringify({
      url: input.url || null,
      selector: input.selector || null,
      requestText: input.requestText || null,
      steps: steps.map((step) => step.kind),
    }))
    .digest('hex');
  return `browser-plan-${hash.slice(0, 16)}`;
}

function receipt(
  kind: ZavorthBrowserVisionReceipt['kind'],
  status: ZavorthBrowserVisionReceipt['status'],
  reason: string,
): ZavorthBrowserVisionReceipt {
  return {
    id: `browser-${kind}-${safeId(status)}-${hashShort(reason)}`,
    kind,
    status,
    reason,
    rawSecretSerialized: false,
  };
}

function mapReceiptStatus(status: ZavorthBrowserVisionReceipt['status']): SurfaceReceiptStatus {
  if (status === 'allow_readonly') return 'allowed';
  if (status === 'allow_with_redaction') return 'allowed_with_redaction';
  if (status === 'require_user_confirmation') return 'require_user_confirmation';
  if (status === 'require_admin_policy' || status === 'require_owner_approval' || status === 'approval-required') return 'require_admin_policy';
  if (status === 'deny') return 'denied';
  if (status === 'blocked') return 'blocked';
  if (status === 'skipped') return 'blocked';
  return 'done';
}

function unwrapSidecarPayload(response: RuntimeBrowserSidecarResponse): Record<string, unknown> {
  const value = response.payload;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}

function extractTextFromSidecar(response: RuntimeBrowserSidecarResponse): string | null {
  const payload = unwrapSidecarPayload(response);
  const direct = getString(payload, ['result.value', 'payload.result.value', 'value', 'payload.value']);
  return direct && direct.trim() ? direct : null;
}

function getString(record: Record<string, unknown>, paths: string[]): string | null {
  for (const item of paths) {
    let current: unknown = record;
    for (const part of item.split('.')) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) {
        current = null;
        break;
      }
      current = (current as Record<string, unknown>)[part];
    }
    if (typeof current === 'string' && current.trim()) {
      return current.trim();
    }
  }
  return null;
}

function normalizeTimeout(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 120_000) : DEFAULT_TIMEOUT_MS;
}

function commandAction(
  id: string,
  label: string,
  command: string,
  style: SurfaceResponseAction['style'],
): SurfaceResponseAction {
  return {
    id,
    label,
    kind: 'command',
    command,
    callbackData: command,
    style,
  };
}

function hashShort(value: unknown): string {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 8);
}

function safePreview(value: unknown, maxLength: number): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 3))}...` : text;
}

function firstLine(value: unknown, maxLength = 160): string {
  return safePreview(value, maxLength);
}

function safeId(value: unknown): string {
  const text = String(value || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return text || 'item';
}
