import crypto from 'node:crypto';
import path from 'node:path';
import {
  ZAVORTH_VISION_CONTROL_PLANE_CONTRACT_VERSION,
  type ZavorthVisionArtifactRef,
  type ZavorthVisionControlPlaneAction,
  type ZavorthVisionControlPlaneInput,
  type ZavorthVisionControlPlaneSnapshot,
  type ZavorthVisionObservation,
  type ZavorthVisionPolicyDecision,
  type ZavorthVisionReceipt,
  type ZavorthVisionSensitivity,
  type ZavorthVisionTargetKind,
} from '../contracts/ZavorthVisionControlPlaneContract.js';
import {
  createSurfaceResponse,
  type SurfaceReceiptStatus,
  type SurfaceResponse,
  type SurfaceResponseAction,
} from '../domain/surface/application/surface-response/index.js';

export type ZavorthVisionControlPlaneCommandInput = ZavorthVisionControlPlaneInput;

type RedactionResult = {
  text: string;
  count: number;
  categories: string[];
};

type RedactionRule = {
  category: string;
  pattern: RegExp;
  replacement: string;
};

type PromptInjectionRule = {
  category: string;
  terms: string[];
};

const DEFAULT_RETENTION_TTL_MS = 15 * 60 * 1000;
const UNTRUSTED_TAG = 'untrusted_visual_evidence';

const REDACTION_RULES: RedactionRule[] = [
  {
    category: 'openai-style-token',
    pattern: /\bsk-[A-Za-z0-9_-]{12,}\b/g,
    replacement: '[redacted-secret]',
  },
  {
    category: 'google-api-key',
    pattern: /\bAIza[0-9A-Za-z_-]{20,}\b/g,
    replacement: '[redacted-secret]',
  },
  {
    category: 'github-token',
    pattern: /\bghp_[0-9A-Za-z_]{20,}\b/g,
    replacement: '[redacted-secret]',
  },
  {
    category: 'jwt',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b/g,
    replacement: '[redacted-secret]',
  },
  {
    category: 'bearer-token',
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/gi,
    replacement: '[redacted-secret]',
  },
  {
    category: 'named-secret',
    pattern: /\b(?:password|senha|token|secret|api[_-]?key)\s*[:=]\s*["']?[^"'\s,;]{3,}["']?/gi,
    replacement: '[redacted-secret]',
  },
  {
    category: 'email',
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: '[redacted-email]',
  },
];

const PROMPT_INJECTION_RULES: PromptInjectionRule[] = [
  {
    category: 'instruction-override',
    terms: ['ignore previous instructions', 'ignore prior instructions', 'ignore all instructions'],
  },
  {
    category: 'data-exfiltration',
    terms: ['send files', 'exfiltrate', 'upload secrets', 'send secrets'],
  },
];

export class ZavorthVisionControlPlaneService {
  public buildSnapshot(
    input: ZavorthVisionControlPlaneInput = {},
  ): ZavorthVisionControlPlaneSnapshot {
    const action = normalizeAction(input.action);
    const targetKind = normalizeTargetKind(input.targetKind);
    const sourceSurface = String(input.sourceSurface || 'shared-surface').trim() || 'shared-surface';
    const retentionTtlMs = normalizeRetention(input.retentionTtlMs);
    const rawEvidence = joinEvidence(input.observationText, input.ocrText);
    const redacted = redactText(rawEvidence || defaultEvidenceFor(action, targetKind));
    const promptInjectionDetected = detectsPromptInjection(rawEvidence);
    const wrappedEvidence = wrapUntrusted(redacted.text);
    const sensitivity = inferSensitivity(redacted, promptInjectionDetected);
    const policyDecision = decidePolicy(redacted, promptInjectionDetected);
    const artifact = this.buildArtifactRef(input, targetKind, wrappedEvidence, retentionTtlMs);
    const observations = this.buildObservations({
      action,
      wrappedEvidence,
      hasRawEvidence: rawEvidence.trim().length > 0,
      promptInjectionDetected,
      redaction: redacted,
    });
    const receipts = this.buildReceipts(policyDecision, redacted, promptInjectionDetected, artifact.id);
    const status = policyDecision === 'allow_with_redaction' ? 'redacted' : 'ready';

    return {
      contractVersion: ZAVORTH_VISION_CONTROL_PLANE_CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
      source: 'ZavorthVisionControlPlaneService',
      status,
      action,
      target: {
        kind: targetKind,
        label: safeTargetLabel(input.targetRef, targetKind),
        sourceSurface,
      },
      sensitivity,
      summary: this.buildSummary(action, targetKind, status, redacted, promptInjectionDetected),
      observations,
      artifacts: [artifact],
      redaction: {
        applied: redacted.count > 0,
        count: redacted.count,
        categories: redacted.categories,
        mode: 'safe-default',
      },
      policy: {
        decision: policyDecision,
        profile: 'vision-readonly-gate-1',
        reason: policyDecision === 'allow_with_redaction'
          ? 'Evidence was minimized before provider use because it contained secrets or prompt injection text.'
          : 'Read-only visual reasoning is allowed; no click, type, workspace mutation or external I/O is permitted.',
        mutationAllowed: false,
        externalIoAllowed: false,
        providerPayloadMinimized: true,
      },
      receipts,
      commands: {
        status: '/vision status',
        inspect: '/vision inspect',
        explain: '/vision explain',
        nextAction: 'Preview engine - Browser Vision And Structured Web Control',
      },
      safety: {
        readOnlyOnly: true,
        noClickOrType: true,
        noWorkspaceMutation: true,
        noExternalIo: true,
        noRawImageSerialized: true,
        noRawSecretsSerialized: true,
        promptInjectionQuarantined: promptInjectionDetected,
        liveActionApplied: false,
      },
      nextSafeAction: this.nextSafeAction(action, targetKind, status),
    };
  }

  public buildSurfaceResponse(snapshot: ZavorthVisionControlPlaneSnapshot): SurfaceResponse {
    const actions = this.buildSurfaceActions(snapshot);
    const receipts = snapshot.receipts.map((receipt) => ({
      id: receipt.id,
      title: receipt.kind,
      status: mapReceiptStatus(receipt.status),
      reason: receipt.reason,
      policyProfile: snapshot.policy.profile,
      redacted: snapshot.redaction.applied,
      riskBlocked: receipt.status === 'blocked' || receipt.status === 'deny',
      createdAt: snapshot.generatedAt,
      metadata: {
        artifactRefId: receipt.artifactRefId,
        rawSecretSerialized: receipt.rawSecretSerialized,
      },
    }));

    return createSurfaceResponse({
      id: `zavorth-vision-${safeId(snapshot.action)}-${safeId(snapshot.generatedAt)}`,
      intent: 'status',
      title: 'Vision Control Plane',
      summary: snapshot.summary,
      tone: snapshot.status === 'redacted' ? 'warning' : 'success',
      blocks: [
        {
          kind: 'text',
          title: 'Leitura read-only',
          text: this.formatSnapshotText(snapshot),
        },
        {
          kind: 'table',
          table: {
            title: 'Policy',
            columns: [
              { key: 'item', label: 'Item', width: 22 },
              { key: 'value', label: 'Value', width: 42 },
            ],
            rows: [
              { item: 'decision', value: snapshot.policy.decision },
              { item: 'target', value: `${snapshot.target.kind}:${snapshot.target.label}` },
              { item: 'redaction', value: `${snapshot.redaction.count} item(s)` },
              { item: 'prompt injection', value: snapshot.safety.promptInjectionQuarantined ? 'quarantined' : 'none' },
              { item: 'mutation', value: snapshot.policy.mutationAllowed ? 'allowed' : 'blocked' },
            ],
          },
        },
        {
          kind: 'list',
          title: 'Observactions',
          items: snapshot.observations.map((entry) => `${entry.kind}: ${firstLine(entry.text, 180)}`),
        },
        ...receipts.map((receipt) => ({
          kind: 'receipt' as const,
          receipt,
        })),
      ],
      actions,
      receipts,
      metadata: {
        source: snapshot.source,
        action: snapshot.action,
        targetKind: snapshot.target.kind,
        redactionCount: snapshot.redaction.count,
        readOnlyOnly: snapshot.safety.readOnlyOnly,
        liveActionApplied: snapshot.safety.liveActionApplied,
      },
    });
  }

  public formatSnapshotText(snapshot: ZavorthVisionControlPlaneSnapshot): string {
    return [
      'Vision Control Plane',
      '',
      `Status: ${snapshot.status}`,
      `Action: ${snapshot.action}`,
      `Target: ${snapshot.target.kind} (${snapshot.target.label})`,
      `Policy: ${snapshot.policy.decision}`,
      `Redaction: ${snapshot.redaction.applied ? `${snapshot.redaction.count} item(s)` : 'none'}`,
      `Prompt injection: ${snapshot.safety.promptInjectionQuarantined ? 'quarantined' : 'none'}`,
      '',
      'Safety:',
      '- read-only only',
      '- no click or type',
      '- no workspace mutation',
      '- no external I/O',
      '- no raw image or raw secret serialization',
      '',
      'Evidence:',
      ...snapshot.observations.slice(0, 4).map((entry) => `- ${entry.kind}: ${entry.text}`),
      '',
      'Commands:',
      `- ${snapshot.commands.status}`,
      `- ${snapshot.commands.inspect}`,
      `- ${snapshot.commands.explain}`,
      '',
      `Next: ${snapshot.nextSafeAction}`,
    ].join('\n');
  }

  private buildArtifactRef(
    input: ZavorthVisionControlPlaneInput,
    targetKind: ZavorthVisionTargetKind,
    wrappedEvidence: string,
    retentionTtlMs: number,
  ): ZavorthVisionArtifactRef {
    const displayName = input.artifactPath
      ? path.basename(String(input.artifactPath))
      : `${targetKind}-visual-evidence`;
    const hash = crypto
      .createHash('sha256')
      .update([
        targetKind,
        input.artifactMime || 'text/plain',
        displayName,
        wrappedEvidence,
      ].join('\n'))
      .digest('hex');
    return {
      id: `vision-artifact-${hash.slice(0, 16)}`,
      kind: targetKind,
      mime: String(input.artifactMime || 'text/plain').trim() || 'text/plain',
      displayName,
      hash,
      rawContentStored: false,
      redactedBeforeProvider: true,
      retentionTtlMs,
    };
  }

  private buildObservations(options: {
    action: ZavorthVisionControlPlaneAction;
    wrappedEvidence: string;
    hasRawEvidence: boolean;
    promptInjectionDetected: boolean;
    redaction: RedactionResult;
  }): ZavorthVisionObservation[] {
    const observations: ZavorthVisionObservation[] = [
      {
        id: 'vision-observation-primary',
        kind: options.hasRawEvidence ? 'observation' : 'summary',
        text: options.wrappedEvidence,
        untrustedContentWrapped: true,
        rawContentStored: false,
        promptInjectionDetected: options.promptInjectionDetected,
      },
    ];
    if (options.action === 'vision.ocr') {
      observations.push({
        id: 'vision-observation-ocr',
        kind: 'ocr',
        text: options.wrappedEvidence,
        untrustedContentWrapped: true,
        rawContentStored: false,
        promptInjectionDetected: options.promptInjectionDetected,
      });
    }
    if (options.promptInjectionDetected || options.redaction.count > 0) {
      observations.push({
        id: 'vision-observation-risk',
        kind: 'risk',
        text: wrapUntrusted(
          `Risk text was quarantined. redactions=${options.redaction.count}; categories=${options.redaction.categories.join(', ') || 'none'}.`,
        ),
        untrustedContentWrapped: true,
        rawContentStored: false,
        promptInjectionDetected: options.promptInjectionDetected,
      });
    }
    return observations;
  }

  private buildReceipts(
    decision: ZavorthVisionPolicyDecision,
    redaction: RedactionResult,
    promptInjectionDetected: boolean,
    artifactRefId: string,
  ): ZavorthVisionReceipt[] {
    return [
      {
        id: 'vision-policy-receipt',
        kind: 'policy',
        status: decision,
        reason: 'Policy Broker profile permits read-only perception only.',
        artifactRefId,
        rawSecretSerialized: false,
      },
      {
        id: 'vision-redaction-receipt',
        kind: 'redaction',
        status: 'done',
        reason: redaction.count > 0
          ? `Redacted ${redaction.count} sensitive item(s) before model use.`
          : 'No sensitive item matched the safe-default redaction rules.',
        artifactRefId,
        rawSecretSerialized: false,
      },
      {
        id: 'vision-capture-receipt',
        kind: 'capture',
        status: 'done',
        reason: 'Intent model stores references and redacted text only; live screenshot capture is deferred.',
        artifactRefId,
        rawSecretSerialized: false,
      },
      {
        id: 'vision-explain-receipt',
        kind: 'explain',
        status: promptInjectionDetected ? 'blocked' : 'done',
        reason: promptInjectionDetected ? 'Prompt-injection text was wrapped as untrusted evidence and cannot issue instructions.'
          : 'Visual evidence can be used as untrusted context for explanation.',
        artifactRefId,
        rawSecretSerialized: false,
      },
    ];
  }

  private buildSurfaceActions(snapshot: ZavorthVisionControlPlaneSnapshot): SurfaceResponseAction[] {
    return [
      commandAction('vision-status', 'Status', snapshot.commands.status, 'primary'),
      commandAction('vision-inspect', 'Inspect', snapshot.commands.inspect, 'secondary'),
      commandAction('vision-explain', 'Explain', snapshot.commands.explain, 'secondary'),
    ];
  }

  private buildSummary(
    action: ZavorthVisionControlPlaneAction,
    targetKind: ZavorthVisionTargetKind,
    status: ZavorthVisionControlPlaneSnapshot['status'],
    redaction: RedactionResult,
    promptInjectionDetected: boolean,
  ): string {
    const risk = promptInjectionDetected ? ' Prompt-injection text was quarantined.'
      : '';
    const redactionText = redaction.count > 0
      ? ` ${redaction.count} sensitive item(s) redacted.`
      : ' No sensitive text detected.';
    return `Read-only ${action} prepared for ${targetKind}. Status ${status}.${redactionText}${risk}`;
  }

  private nextSafeAction(
    action: ZavorthVisionControlPlaneAction,
    targetKind: ZavorthVisionTargetKind,
    status: ZavorthVisionControlPlaneSnapshot['status'],
  ): string {
    if (status === 'redacted') {
      return 'Use the sanitized evidence for reasoning only, or ask for explicit approval before any live action.';
    }
    if (action === 'vision.status') {
      return 'Run /vision inspect with a concrete target when the user wants visual reasoning.';
    }
    return `Keep ${targetKind} perception read-only until Preview engine+ enables governed live capture and control.`;
  }
}

function normalizeAction(action: unknown): ZavorthVisionControlPlaneAction {
  const normalized = String(action || '').trim().toLowerCase();
  if (normalized === 'status' || normalized === 'vision.status') return 'vision.status';
  if (normalized === 'explain' || normalized === 'vision.explain') return 'vision.explain';
  if (normalized === 'capture' || normalized === 'screenshot' || normalized === 'vision.capture') return 'vision.capture';
  if (normalized === 'ocr' || normalized === 'vision.ocr') return 'vision.ocr';
  if (normalized === 'redact' || normalized === 'vision.redact') return 'vision.redact';
  if (normalized === 'summarize' || normalized === 'summary' || normalized === 'vision.summarize') return 'vision.summarize';
  return 'vision.inspect';
}

function normalizeTargetKind(value: unknown): ZavorthVisionTargetKind {
  const normalized = String(value || '').trim().toLowerCase();
  if (['desktop', 'pc', 'computer'].includes(normalized)) return 'desktop';
  if (['browser', 'web', 'site'].includes(normalized)) return 'browser';
  if (['android', 'adb', 'phone', 'celular'].includes(normalized)) return 'android';
  if (['device', 'mobile'].includes(normalized)) return 'device';
  if (['artifact', 'file', 'image'].includes(normalized)) return 'artifact';
  return 'unknown';
}

function normalizeRetention(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_RETENTION_TTL_MS;
  }
  return Math.min(Math.floor(parsed), 24 * 60 * 60 * 1000);
}

function joinEvidence(observationText: unknown, ocrText: unknown): string {
  return [observationText, ocrText]
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .join('\n');
}

function defaultEvidenceFor(
  action: ZavorthVisionControlPlaneAction,
  targetKind: ZavorthVisionTargetKind,
): string {
  if (action === 'vision.status') {
    return `No live capture requested. ${targetKind} perception is ready in read-only mode.`;
  }
  return `No raw visual artifact was provided. ${targetKind} perception remains in read-only planning mode.`;
}

function redactText(value: string): RedactionResult {
  let text = String(value || '');
  let count = 0;
  const categories = new Set<string>();
  for (const rule of REDACTION_RULES) {
    text = text.replace(rule.pattern, () => {
      count += 1;
      categories.add(rule.category);
      return rule.replacement;
    });
  }
  return { text, count, categories: [...categories] };
}

function detectsPromptInjection(value: string): boolean {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return PROMPT_INJECTION_RULES.some((rule) => rule.terms.some((term) => normalized.includes(term)));
}

function wrapUntrusted(value: string): string {
  return `<${UNTRUSTED_TAG}>${String(value || '').trim()}</${UNTRUSTED_TAG}>`;
}

function inferSensitivity(
  redaction: RedactionResult,
  promptInjectionDetected: boolean,
): ZavorthVisionSensitivity {
  if (redaction.categories.some((category) => category !== 'email')) return 'secret';
  if (promptInjectionDetected) return 'high';
  if (redaction.count > 0) return 'medium';
  return 'low';
}

function decidePolicy(
  redaction: RedactionResult,
  promptInjectionDetected: boolean,
): ZavorthVisionPolicyDecision {
  return redaction.count > 0 || promptInjectionDetected ? 'allow_with_redaction' : 'allow_readonly';
}

function safeTargetLabel(targetRef: unknown, kind: ZavorthVisionTargetKind): string {
  const raw = String(targetRef || '').trim();
  if (!raw) return `${kind}-target`;
  const redacted = redactText(raw).text;
  return redacted
    .replace(/[^\w .:@/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || `${kind}-target`;
}

function mapReceiptStatus(status: ZavorthVisionReceipt['status']): SurfaceReceiptStatus {
  if (status === 'allow_readonly') return 'allowed';
  if (status === 'allow_with_redaction') return 'allowed_with_redaction';
  if (status === 'require_user_confirmation') return 'require_user_confirmation';
  if (status === 'require_admin_policy' || status === 'require_owner_approval') return 'require_admin_policy';
  if (status === 'deny') return 'denied';
  if (status === 'blocked') return 'blocked';
  return 'done';
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

function firstLine(value: unknown, maxLength = 160): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 3))}...` : text;
}

function safeId(value: unknown): string {
  const text = String(value || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return text || 'item';
}
