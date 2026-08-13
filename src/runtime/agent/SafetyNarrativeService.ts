import type {
  UniversalAgentRun,
  UniversalToolRiskLevel,
} from './UniversalAgentRuntimeTypes.js';

export const SAFETY_NARRATIVE_CONTRACT_VERSION = '2026-05-03.safety-narrative' as const;

export type SafetyNarrativeStatus =
  | 'clear'
  | 'explaining'
  | 'waiting-approval'
  | 'blocked'
  | 'failed';

export type SafetyNarrativeReasonKind =
  | 'approval-required'
  | 'preview-required'
  | 'workspace-policy'
  | 'trust-slider'
  | 'imported-capability-quarantine'
  | 'watch-mode-policy'
  | 'risk-review'
  | 'executor-failure'
  | 'preview-only'
  | 'unknown';

export type SafetyNarrativeReason = {
  id: string;
  kind: SafetyNarrativeReasonKind;
  title: string;
  detail: string;
  risk: UniversalToolRiskLevel;
  source: string;
  toolIds: string[];
  redactionApplied: boolean;
};

export type SafetyNarrativeAlternative = {
  id: string;
  label: string;
  detail: string;
  commandHint?: string;
  safe: true;
  requiresApproval: boolean;
};

export type SafetyNarrativeSnapshot = {
  contractVersion: typeof SAFETY_NARRATIVE_CONTRACT_VERSION;
  source: 'SafetyNarrativeService';
  generatedAt: string;
  status: SafetyNarrativeStatus;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  highRiskBlockPresent: boolean;
  summary: string;
  userMessage: string;
  reasons: SafetyNarrativeReason[];
  alternatives: SafetyNarrativeAlternative[];
  redaction: {
    pathRedactionApplied: boolean;
    secretRedactionApplied: boolean;
    sensitivePathCount: number;
    secretCount: number;
    rawSecretSerialized: false;
  };
  policy: {
    naturalLanguageDoesNotBypassPolicy: true;
    alternativesDoNotExecute: true;
    workspaceBoundaryRespected: true;
    approvalsRemainRequired: boolean;
    previewRemainsRequired: boolean;
    quarantineRemainsRequired: boolean;
  };
  receipts: Array<{
    id: string;
    kind: 'reason' | 'alternative' | 'redaction' | 'policy';
    detail: string;
  }>;
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
  };
  nextSafeAction: string;
};

export type SafetyNarrativeInput = {
  run: UniversalAgentRun;
  generatedAt?: string | null;
};

type Redactor = {
  sanitize: (value: unknown) => string;
  pathRedactionApplied: () => boolean;
  secretRedactionApplied: () => boolean;
  sensitivePathCount: () => number;
  secretCount: () => number;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((entry) => normalizeText(entry)).filter(Boolean)));
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function riskScore(risk: UniversalToolRiskLevel): number {
  if (risk === 'danger') {
    return 3;
  }
  if (risk === 'attention') {
    return 2;
  }
  if (risk === 'unknown') {
    return 1;
  }
  return 0;
}

function maxRisk(values: UniversalToolRiskLevel[]): UniversalToolRiskLevel {
  const score = Math.max(0, ...values.map(riskScore));
  if (score >= 3) {
    return 'danger';
  }
  if (score === 2) {
    return 'attention';
  }
  if (score === 1) {
    return 'unknown';
  }
  return 'safe';
}

function normalizeRisk(value: unknown): UniversalToolRiskLevel {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'safe' || raw === 'attention' || raw === 'danger' || raw === 'unknown') {
    return raw;
  }
  if (raw.includes('danger') || raw.includes('high')) {
    return 'danger';
  }
  if (raw.includes('attention') || raw.includes('warn') || raw.includes('medium')) {
    return 'attention';
  }
  if (raw.includes('safe') || raw.includes('low')) {
    return 'safe';
  }
  return 'unknown';
}

function createRedactor(): Redactor {
  let pathCount = 0;
  let secretCount = 0;
  const secretPattern = /\b(?:api[_-]?key|token|secret|password|authorization)\s*[:=]\s*["']?[^,\s"']+/gi;
  const bearerPattern = /\b(?:sk|pk|ghp|xoxb|xoxp)-[A-Za-z0-9_-]{10,}\b/g;
  const windowsPathPattern = /[A-Za-z]:\\(?:[^\\\s"'`<>|]+\\)*[^\\\s"'`<>|]+/g;
  const unixPathPattern = /\/(?:Users|home|var|tmp|mnt|workspace|repo|project|etc)\/[^\s"'`<>|]+/g;
  return {
    sanitize(value: unknown): string {
      let text = normalizeText(value);
      text = text.replace(secretPattern, () => {
        secretCount += 1;
        return '<redacted-secret>';
      });
      text = text.replace(bearerPattern, () => {
        secretCount += 1;
        return '<redacted-secret>';
      });
      text = text.replace(windowsPathPattern, () => {
        pathCount += 1;
        return '<workspace-path>';
      });
      text = text.replace(unixPathPattern, () => {
        pathCount += 1;
        return '<workspace-path>';
      });
      return text;
    },
    pathRedactionApplied: () => pathCount > 0,
    secretRedactionApplied: () => secretCount > 0,
    sensitivePathCount: () => pathCount,
    secretCount: () => secretCount,
  };
}

function reasonRedacted(redactor: Redactor, before: string, after: string): boolean {
  return before !== after || redactor.pathRedactionApplied() || redactor.secretRedactionApplied();
}

export class SafetyNarrativeService {
  private readonly now: () => Date;

  constructor(runtime: { now?: () => Date } = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: SafetyNarrativeInput): SafetyNarrativeSnapshot {
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const redactor = createRedactor();
    const reasons = this.buildReasons(input.run, redactor);
    const alternatives = this.buildAlternatives(input.run, reasons, redactor);
    const highestRisk = maxRisk(reasons.map((reason) => reason.risk));
    const highRiskBlockPresent = reasons.some((reason) => reason.risk === 'danger')
      || input.run.status === 'waiting_approval'
      || input.run.status === 'failed';
    const approvalsRemainRequired = input.run.approvals.some((approval) => approval.status === 'pending')
      || input.run.toolExposure.tools.some((tool) => tool.requiresApproval)
      || reasons.some((reason) => reason.kind === 'approval-required');
    const previewRemainsRequired = reasons.some((reason) => reason.kind === 'preview-required' || reason.kind === 'preview-only');
    const quarantineRemainsRequired = reasons.some((reason) => reason.kind === 'imported-capability-quarantine');
    const status = this.resolveStatus(input.run, reasons);
    const summary = this.buildSummary(status, highestRisk, reasons);
    const nextSafeAction = this.nextSafeAction({
      approvalsRemainRequired,
      previewRemainsRequired,
      quarantineRemainsRequired,
      status,
    });
    const userMessage = this.buildUserMessage({
      summary,
      reasons,
      alternatives,
      nextSafeAction,
    });

    return {
      contractVersion: SAFETY_NARRATIVE_CONTRACT_VERSION,
      source: 'SafetyNarrativeService',
      generatedAt,
      status,
      identifiers: {
        runId: input.run.id,
        traceId: input.run.traceId,
        requestId: input.run.requestId,
        sessionId: input.run.sessionId,
      },
      highRiskBlockPresent,
      summary,
      userMessage,
      reasons,
      alternatives,
      redaction: {
        pathRedactionApplied: redactor.pathRedactionApplied(),
        secretRedactionApplied: redactor.secretRedactionApplied(),
        sensitivePathCount: redactor.sensitivePathCount(),
        secretCount: redactor.secretCount(),
        rawSecretSerialized: false,
      },
      policy: {
        naturalLanguageDoesNotBypassPolicy: true,
        alternativesDoNotExecute: true,
        workspaceBoundaryRespected: true,
        approvalsRemainRequired,
        previewRemainsRequired,
        quarantineRemainsRequired,
      },
      receipts: this.buildReceipts({
        reasons,
        alternatives,
        redactor,
      }),
      surface: {
        cliCommand: 'zavorth safety "<request>" --json',
        zavorthControlPath: '/zavorthControl...sector=overview',
      },
      nextSafeAction,
    };
  }

  private buildReasons(run: UniversalAgentRun, redactor: Redactor): SafetyNarrativeReason[] {
    const reasons: SafetyNarrativeReason[] = [];
    const addReason = (reason: Omit<SafetyNarrativeReason, 'detail' | 'redactionApplied'> & { detail: string }) => {
      if (reasons.some((entry) => entry.id === reason.id)) {
        return;
      }
      const detail = redactor.sanitize(reason.detail);
      reasons.push({
        ...reason,
        detail,
        redactionApplied: reasonRedacted(redactor, reason.detail, detail),
      });
    };

    const approvalToolIds = run.toolExposure.tools
      .filter((tool) => tool.requiresApproval)
      .map((tool) => tool.id);
    for (const approval of run.approvals.filter((entry) => entry.status === 'pending')) {
      addReason({
        id: `safety:approval:${approval.id}`,
        kind: 'approval-required',
        title: 'Approval required before execution',
        detail: `Bloqueei porque ${approval.reason}`,
        risk: approval.risk,
        source: 'approval-gate',
        toolIds: approvalToolIds,
      });
    }

    const blockedTools = run.toolExposure.blockedTools || [];
    for (const blockedTool of blockedTools) {
      addReason({
        id: `safety:blocked-tool:${blockedTool.id}`,
        kind: 'imported-capability-quarantine',
        title: 'Tool blocked por policy ou quarentena',
        detail: `${blockedTool.label} ficou blocked por ${blockedTool.reason}.`,
        risk: 'danger',
        source: 'ToolExposurePolicy',
        toolIds: [blockedTool.id],
      });
    }

    const trustSlider = recordOrNull(run.metadata.trustSlider);
    if (trustSlider?.blocked === true) {
      addReason({
        id: 'safety:trust-slider',
        kind: 'trust-slider',
        title: 'Trust Slider blocked execution',
        detail: normalizeText(trustSlider.reason, 'Trust Slider blocked execution by scope or permission.'),
        risk: 'danger',
        source: 'TrustSliderPolicyService',
        toolIds: approvalToolIds,
      });
    }

    const preview = recordOrNull(run.metadata.universalPreviewMode);
    const previewRisk = recordOrNull(preview?.risk);
    if (preview?.mode === 'preview-only') {
      addReason({
        id: 'safety:preview-only',
        kind: 'preview-only',
        title: 'Executor blocked by Universal Preview',
        detail: 'The request entered preview-only mode; no tool should be called in this mode.',
        risk: normalizeRisk(previewRisk?.highestRisk),
        source: 'UniversalPreviewModeService',
        toolIds: normalizeList(previewRisk?.approvalRequiredToolIds),
      });
    }
    if (previewRisk?.previewRequired === true) {
      addReason({
        id: 'safety:preview-required',
        kind: 'preview-required',
        title: 'Preview especifico required',
        detail: 'Action requires a specific preview before apply or rollback.',
        risk: normalizeRisk(previewRisk.highestRisk),
        source: 'UniversalPreviewModeService',
        toolIds: normalizeList(previewRisk.previewRequiredToolIds),
      });
    }

    const watchMode = recordOrNull(run.metadata.watchModeVisualProposal);
    if (watchMode?.blocked === true) {
      addReason({
        id: 'safety:watch-mode-policy',
        kind: 'watch-mode-policy',
        title: 'Watch Mode visual blocked',
        detail: normalizeText(watchMode.blockedReason, 'Visual Watch Mode needs allowlist and targetWindow before approval.'),
        risk: 'danger',
        source: 'AgentRunService.watch-mode',
        toolIds: normalizeList([watchMode.toolId]),
      });
    }

    const failure = recordOrNull(run.metadata.failureSemantics);
    if (failure) {
      addReason({
        id: 'safety:executor-failure',
        kind: 'executor-failure',
        title: 'Structured failure preserved safety',
        detail: normalizeText(failure.message, run.summary),
        risk: 'attention',
        source: normalizeText(failure.source, 'FailureSemanticsRegistry'),
        toolIds: approvalToolIds,
      });
    }

    const lifecycleDefense = recordOrNull(run.metadata.lifecycleDefense);
    for (const [phase, rawReview] of Object.entries(lifecycleDefense || {})) {
      const review = recordOrNull(rawReview);
      if (!review || review.blocked !== true) {
        continue;
      }
      addReason({
        id: `safety:risk-review:${phase}`,
        kind: 'risk-review',
        title: 'Risk review blocked the executor',
        detail: normalizeText(review.summary, `Risk review ${phase} blocked sensitive execution.`),
        risk: normalizeRisk(review.risk),
        source: 'AgentRunRiskHooks',
        toolIds: normalizeList(review.approvalRequiredToolIds ?? review.toolIds),
      });
    }

    if (reasons.length === 0 && run.toolExposure.tools.some((tool) => tool.requiresApproval || tool.risk === 'danger')) {
      addReason({
        id: 'safety:tool-exposure',
        kind: 'approval-required',
        title: 'Tool sensitive detectada',
        detail: 'The tool policy marked an action as sensitive; approvals remain required before execution.',
        risk: maxRisk(run.toolExposure.tools.map((tool) => tool.risk)),
        source: 'ToolExposurePolicy',
        toolIds: approvalToolIds,
      });
    }

    return reasons;
  }

  private buildAlternatives(
    run: UniversalAgentRun,
    reasons: SafetyNarrativeReason[],
    redactor: Redactor,
  ): SafetyNarrativeAlternative[] {
    const alternatives: SafetyNarrativeAlternative[] = [];
    const addAlternative = (alternative: SafetyNarrativeAlternative) => {
      if (!alternatives.some((entry) => entry.id === alternative.id)) {
        alternatives.push({
          ...alternative,
          detail: redactor.sanitize(alternative.detail),
          commandHint: alternative.commandHint ? redactor.sanitize(alternative.commandHint) : undefined,
        });
      }
    };

    if (reasons.some((reason) => reason.kind === 'approval-required' || reason.kind === 'risk-review')) {
      addAlternative({
        id: 'safety:alternative:approval',
        label: 'Pedir approval governado',
        detail: 'Review the plan and approve only the sensitive tools that are truly required.',
        commandHint: 'zavorth approvals list',
        safe: true,
        requiresApproval: true,
      });
    }
    if (reasons.some((reason) => reason.kind === 'preview-required' || reason.kind === 'preview-only')) {
      addAlternative({
        id: 'safety:alternative:preview',
        label: 'run preview before do apply',
        detail: 'Use preview to inspect plan, risk, and impact without touching files or executors.',
        commandHint: 'zavorth preview "<request>" --json',
        safe: true,
        requiresApproval: false,
      });
    }
    if (reasons.some((reason) => reason.kind === 'workspace-policy' || reason.kind === 'trust-slider')) {
      addAlternative({
        id: 'safety:alternative:workspace-patch',
        label: 'Reduce to patch inside the workspace',
        detail: 'Transform the action into a diff/patch inside the project instead of writing outside the allowed boundary.',
        safe: true,
        requiresApproval: false,
      });
    }
    if (reasons.some((reason) => reason.kind === 'imported-capability-quarantine')) {
      addAlternative({
        id: 'safety:alternative:quarantine',
        label: 'Use safe tool or review quarantine',
        detail: 'Escolha uma capability already trusted ou revise o trust report before enable a tool importada.',
        safe: true,
        requiresApproval: true,
      });
    }
    if (reasons.some((reason) => reason.kind === 'watch-mode-policy')) {
      addAlternative({
        id: 'safety:alternative:watch-mode-scope',
        label: 'Declarar alvo visual e allowlist',
        detail: 'Informe targetWindow e policy allowlisted before pedir approval para Computer Use.',
        safe: true,
        requiresApproval: true,
      });
    }
    if (alternatives.length === 0) {
      addAlternative({
        id: 'safety:alternative:read-only',
        label: 'Continuar em modo read',
        detail: 'Answer, summarize, or plan without running mutable tools.',
        safe: true,
        requiresApproval: false,
      });
    }
    if (run.status === 'failed') {
      addAlternative({
        id: 'safety:alternative:retry-small',
        label: 'Repetir with escopo smallest',
        detail: 'Separate reading, planning, and execution into smaller steps to preserve auditability.',
        safe: true,
        requiresApproval: false,
      });
    }
    return alternatives.slice(0, 6);
  }

  private resolveStatus(run: UniversalAgentRun, reasons: SafetyNarrativeReason[]): SafetyNarrativeStatus {
    if (run.status === 'waiting_approval') {
      return 'waiting-approval';
    }
    if (run.status === 'failed' && reasons.length > 0) {
      return reasons.some((reason) => reason.kind === 'executor-failure') ? 'failed' : 'blocked';
    }
    if (reasons.some((reason) => reason.kind === 'preview-only')) {
      return 'explaining';
    }
    return reasons.length > 0 ? 'explaining' : 'clear';
  }

  private buildSummary(
    status: SafetyNarrativeStatus,
    risk: UniversalToolRiskLevel,
    reasons: SafetyNarrativeReason[],
  ): string {
    if (status === 'clear') {
      return 'No block high-risk foi encontrado neste run.';
    }
    if (status === 'waiting-approval') {
      return `Safety Narrative: ${reasons.length} reason(s) explain the pending approval with risk ${risk}.`;
    }
    if (status === 'blocked') {
      return `Safety Narrative: execution blocked with ${reasons.length} readable reason(s).`;
    }
    if (status === 'failed') {
      return `Safety Narrative: failure estruturada explicada without vazar secrets.`;
    }
    return `Safety Narrative: ${reasons.length} documented safety reason(s).`;
  }

  private buildUserMessage(input: {
    summary: string;
    reasons: SafetyNarrativeReason[];
    alternatives: SafetyNarrativeAlternative[];
    nextSafeAction: string;
  }): string {
    if (input.reasons.length === 0) {
      return [
        input.summary,
        `next passo seguro: ${input.nextSafeAction}`,
      ].join('\n');
    }
    const primary = input.reasons[0];
    const lines = [
      `Blocked for safety: ${primary.title}.`,
      primary.detail,
      '',
      'Safe alternatives:',
      ...input.alternatives.slice(0, 4).map((alternative) => `- ${alternative.label}: ${alternative.detail}`),
      '',
      `next passo seguro: ${input.nextSafeAction}`,
      'Natural language does not disable approvals, preview, workspace policy, or quarantine.',
    ];
    return lines.join('\n');
  }

  private nextSafeAction(input: {
    approvalsRemainRequired: boolean;
    previewRemainsRequired: boolean;
    quarantineRemainsRequired: boolean;
    status: SafetyNarrativeStatus;
  }): string {
    if (input.quarantineRemainsRequired) {
      return 'Resolver quarentena ou escolher uma capability trusted before run.';
    }
    if (input.previewRemainsRequired) {
      return 'Generate or review a specific preview before any real apply.';
    }
    if (input.approvalsRemainRequired) {
      return 'Review the plan and explicitly approve sensitive tools.';
    }
    if (input.status === 'failed') {
      return 'Repeat with a smaller scope or turn it into a read-only plan.';
    }
    return 'Continue through the normal governed runtime.';
  }

  private buildReceipts(input: {
    reasons: SafetyNarrativeReason[];
    alternatives: SafetyNarrativeAlternative[];
    redactor: Redactor;
  }): SafetyNarrativeSnapshot['receipts'] {
    const receipts: SafetyNarrativeSnapshot['receipts'] = [
      ...input.reasons.slice(0, 8).map((reason) => ({
        id: `safety-narrative:reason:${reason.id}`,
        kind: 'reason' as const,
        detail: `${reason.kind}: ${reason.title}`,
      })),
      ...input.alternatives.slice(0, 4).map((alternative) => ({
        id: `safety-narrative:alternative:${alternative.id}`,
        kind: 'alternative' as const,
        detail: `${alternative.label}: safe=${String(alternative.safe)}`,
      })),
      {
        id: 'safety-narrative:policy',
        kind: 'policy' as const,
        detail: 'Narrative does not execute tools and does not replace approvals, preview, or workspace policy.',
      },
    ];
    if (input.redactor.pathRedactionApplied() || input.redactor.secretRedactionApplied()) {
      receipts.push({
        id: 'safety-narrative:redaction',
        kind: 'redaction',
        detail: 'Dados sensitive foram redigidos before montar a narrativa.',
      });
    }
    return receipts;
  }
}
