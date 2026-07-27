import type { NaturalCapabilityDiscoverySnapshot } from './NaturalCapabilityDiscoveryService.js';
import type {
  UniversalAgentChannel,
  UniversalToolExposure,
  UniversalToolExposureProfile,
  UniversalToolRiskLevel,
} from './UniversalAgentRuntimeTypes.js';

export const UNIVERSAL_PREVIEW_MODE_CONTRACT_VERSION = '2026-05-03.universal-preview' as const;

export type UniversalPreviewModePlanStepKind =
  | 'read'
  | 'write'
  | 'shell'
  | 'network'
  | 'memory'
  | 'selfmod'
  | 'computer-use'
  | 'swarm'
  | 'approval'
  | 'unknown';

export type UniversalPreviewModePlanStep = {
  id: string;
  kind: UniversalPreviewModePlanStepKind;
  label: string;
  toolId?: string;
  risk: UniversalToolRiskLevel;
  requiresApproval: boolean;
  previewRequired: boolean;
  action: string;
  impact: string;
};

export type UniversalPreviewModeSnapshot = {
  contractVersion: typeof UNIVERSAL_PREVIEW_MODE_CONTRACT_VERSION;
  source: 'UniversalPreviewModeService';
  generatedAt: string;
  mode: 'runtime-preview' | 'preview-only';
  query: {
    text: string;
    surface: UniversalAgentChannel | 'unknown';
    requestedTools: string[];
  };
  identifiers: {
    runId?: string;
    traceId?: string;
    requestId?: string;
    sessionId?: string;
  };
  planSteps: UniversalPreviewModePlanStep[];
  toolExposure: {
    mode: UniversalToolExposureProfile['mode'];
    exposedToolIds: string[];
    blockedToolIds: string[];
  };
  risk: {
    highestRisk: UniversalToolRiskLevel;
    requiresApproval: boolean;
    previewRequired: boolean;
    approvalRequiredToolIds: string[];
    previewRequiredToolIds: string[];
  };
  safety: {
    noExecutionPerformed: true;
    naturalLanguageDoesNotBypassPolicy: true;
    workspacePolicyApplies: true;
    approvalsStillRequired: boolean;
    selfmodApplyBlocked: boolean;
    computerUseBlockedUntilApproval: boolean;
    executorBlockedInPreviewMode: boolean;
    toolsActuallyCalled: [];
  };
  receipts: Array<{
    id: string;
    kind: 'plan' | 'policy' | 'approval' | 'preview' | 'block';
    detail: string;
  }>;
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
  };
  nextSafeAction: string;
};

export type UniversalPreviewModeInput = {
  runId?: string;
  traceId?: string;
  requestId?: string;
  sessionId?: string;
  text: string;
  surface?: UniversalAgentChannel | 'unknown' | null;
  requestedTools?: string[] | null;
  toolExposure: UniversalToolExposureProfile;
  naturalCapabilityDiscovery?: NaturalCapabilityDiscoverySnapshot | null;
  metadata?: Record<string, unknown> | null;
  generatedAt?: string | null;
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

function normalizeSearchText(value: unknown): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
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

function inferStepKind(tool: UniversalToolExposure): UniversalPreviewModePlanStepKind {
  const id = tool.id.toLowerCase();
  if (id.includes('read') || id.includes('list') || id.includes('history')) {
    return 'read';
  }
  if (id.includes('write') || id.includes('filesystem') || id.includes('commit') || id.includes('deploy')) {
    return 'write';
  }
  if (id.includes('shell') || id.includes('exec') || id.includes('npm')) {
    return 'shell';
  }
  if (id.includes('network') || id.includes('web') || id.includes('fetch') || id.includes('search')) {
    return 'network';
  }
  if (id.includes('memory') || id.includes('mnemos')) {
    return 'memory';
  }
  if (id.includes('selfmod')) {
    return 'selfmod';
  }
  if (id.includes('watchmode') || id.includes('echo') || id.includes('node.invoke')) {
    return 'computer-use';
  }
  if (id.includes('swarm')) {
    return 'swarm';
  }
  return tool.requiresApproval ? 'approval' : 'unknown';
}

function impactForStep(kind: UniversalPreviewModePlanStepKind, tool: UniversalToolExposure): string {
  if (kind === 'read') {
    return 'Leitura/consulta without mutation esperada.';
  }
  if (kind === 'write') {
    return 'Can change files, local state, or artifacts.';
  }
  if (kind === 'shell') {
    return 'Can run commands in the local environment.';
  }
  if (kind === 'network') {
    return 'Can access the network or send an external query.';
  }
  if (kind === 'selfmod') {
    return tool.id === 'selfmod.preview'
      ? 'Gera proposta auditavel without aplicar changes.'
      : 'Can apply/revert changes only outside preview and with approval.';
  }
  if (kind === 'computer-use') {
    return 'Can control UI or visual environments only after scope and approval.';
  }
  if (kind === 'swarm') {
    return 'Can open subagents under approval and budget.';
  }
  return 'Impact depends on the tool policy.';
}

function isPreviewRequired(tool: UniversalToolExposure): boolean {
  return Boolean(tool.policyTags?.some((tag) => tag === 'preview-required' || tag === 'preview-first'))
    || tool.id.startsWith('selfmod.');
}

function planStepFromTool(tool: UniversalToolExposure, index: number): UniversalPreviewModePlanStep {
  const kind = inferStepKind(tool);
  const previewRequired = isPreviewRequired(tool);
  return {
    id: `universal-preview:tool:${tool.id || index}`,
    kind,
    label: tool.label || tool.id,
    toolId: tool.id,
    risk: tool.risk,
    requiresApproval: tool.requiresApproval,
    previewRequired,
    action: previewRequired ? 'Prepare governed preview before any apply.'
      : tool.requiresApproval ? 'Request approval before running.'
        : 'Can continue as a runtime-governed stage.',
    impact: impactForStep(kind, tool),
  };
}

function buildFallbackPlanStep(text: string): UniversalPreviewModePlanStep {
  return {
    id: 'universal-preview:fallback',
    kind: 'unknown',
    label: 'Respond or request clarification',
    risk: 'safe',
    requiresApproval: false,
    previewRequired: false,
    action: 'No tool was inferred; keep a direct response or ask for more scope.',
    impact: text ? 'No mutable impact expected.' : 'Empty request needs clarification.',
  };
}

export class UniversalPreviewModeService {
  private readonly now: () => Date;

  constructor(runtime: { now?: () => Date } = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public shouldUsePreviewMode(input: {
    text?: string | null;
    metadata?: Record<string, unknown> | null;
  }): boolean {
    const metadata = input.metadata || {};
    const preview = recordOrNull(metadata.universalPreviewMode)
      || recordOrNull(metadata.previewMode)
      || recordOrNull(metadata.preview);
    const responseDecision = recordOrNull(metadata.responseDecision);
    if (
      preview?.enabled === true
      || preview?.previewOnly === true
      || metadata.previewMode === true
      || metadata.dryRun === true
      || responseDecision?.previewMode === true
      || responseDecision?.dryRun === true
    ) {
      return true;
    }

    void input.text;
    return false;
  }

  public buildSnapshot(input: UniversalPreviewModeInput): UniversalPreviewModeSnapshot {
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const requestedTools = normalizeList(input.requestedTools);
    const text = normalizeText(input.text);
    const previewOnly = this.shouldUsePreviewMode({
      text,
      metadata: input.metadata,
    });
    const tools = input.toolExposure.tools || [];
    const blockedToolIds = normalizeList(input.toolExposure.blockedTools?.map((tool) => tool.id));
    const planSteps = tools.length > 0
      ? tools.map(planStepFromTool)
      : [buildFallbackPlanStep(text)];
    const highestRisk = maxRisk(planSteps.map((step) => step.risk));
    const approvalRequiredToolIds = planSteps
      .filter((step) => step.requiresApproval)
      .map((step) => step.toolId)
      .filter((toolId): toolId is string => Boolean(toolId));
    const previewRequiredToolIds = planSteps
      .filter((step) => step.previewRequired)
      .map((step) => step.toolId)
      .filter((toolId): toolId is string => Boolean(toolId));
    const selfmodApplyBlocked = planSteps.some((step) => step.toolId === 'selfmod.apply' || step.toolId === 'selfmod.rollback');
    const computerUseBlockedUntilApproval = planSteps.some((step) =>
      step.kind === 'computer-use' || step.toolId === 'watchmode.control' || step.toolId === 'echo_hands');
    const requiresApproval = approvalRequiredToolIds.length > 0;
    const previewRequired = previewRequiredToolIds.length > 0;

    return {
      contractVersion: UNIVERSAL_PREVIEW_MODE_CONTRACT_VERSION,
      source: 'UniversalPreviewModeService',
      generatedAt,
      mode: previewOnly ? 'preview-only' : 'runtime-preview',
      query: {
        text,
        surface: input.surface || 'unknown',
        requestedTools,
      },
      identifiers: {
        runId: normalizeText(input.runId) || undefined,
        traceId: normalizeText(input.traceId) || undefined,
        requestId: normalizeText(input.requestId) || undefined,
        sessionId: normalizeText(input.sessionId) || undefined,
      },
      planSteps,
      toolExposure: {
        mode: input.toolExposure.mode,
        exposedToolIds: tools.map((tool) => tool.id),
        blockedToolIds,
      },
      risk: {
        highestRisk,
        requiresApproval,
        previewRequired,
        approvalRequiredToolIds,
        previewRequiredToolIds,
      },
      safety: {
        noExecutionPerformed: true,
        naturalLanguageDoesNotBypassPolicy: true,
        workspacePolicyApplies: true,
        approvalsStillRequired: requiresApproval,
        selfmodApplyBlocked,
        computerUseBlockedUntilApproval,
        executorBlockedInPreviewMode: previewOnly,
        toolsActuallyCalled: [],
      },
      receipts: this.buildReceipts({
        planSteps,
        previewOnly,
        requiresApproval,
        previewRequired,
        blockedToolIds,
        naturalCapabilityDiscovery: input.naturalCapabilityDiscovery,
      }),
      surface: {
        cliCommand: `zavorth preview "${text || '<request>'}" --json`,
        zavorthControlPath: '/zavorthControl...sector=overview',
      },
      nextSafeAction: this.nextSafeAction({
        previewOnly,
        requiresApproval,
        previewRequired,
        blockedToolIds,
      }),
    };
  }

  private buildReceipts(input: {
    planSteps: UniversalPreviewModePlanStep[];
    previewOnly: boolean;
    requiresApproval: boolean;
    previewRequired: boolean;
    blockedToolIds: string[];
    naturalCapabilityDiscovery?: NaturalCapabilityDiscoverySnapshot | null;
  }): UniversalPreviewModeSnapshot['receipts'] {
    const receipts: UniversalPreviewModeSnapshot['receipts'] = input.planSteps.slice(0, 8).map((step) => ({
      id: `universal-preview:${step.id}`,
      kind: 'plan',
      detail: `${step.label}: ${step.action}`,
    }));
    receipts.push({
      id: 'universal-preview:policy',
      kind: 'policy',
      detail: 'Preview did not execute tools; approvals, workspace policy, and audit hooks remain mandatory.',
    });
    if (input.previewOnly) {
      receipts.push({
        id: 'universal-preview:executor-block',
        kind: 'block',
        detail: 'Executor blocked porque o request entrou em preview-only.',
      });
    }
    if (input.requiresApproval) {
      receipts.push({
        id: 'universal-preview:approval',
        kind: 'approval',
        detail: 'After leaving preview, sensitive tools still require approval.',
      });
    }
    if (input.previewRequired) {
      receipts.push({
        id: 'universal-preview:preview-required',
        kind: 'preview',
        detail: 'After leaving preview, apply/rollback still require an existing preview.',
      });
    }
    if (input.blockedToolIds.length > 0) {
      receipts.push({
        id: 'universal-preview:blocked-tools',
        kind: 'block',
        detail: `${input.blockedToolIds.length} tool(s) blocked(s) por policy/quarentena.`,
      });
    }
    if (input.naturalCapabilityDiscovery) {
      receipts.push({
        id: 'universal-preview:natural-capability-discovery',
        kind: 'plan',
        detail: `Discovery ${input.naturalCapabilityDiscovery.contractVersion} fed the plan.`,
      });
    }
    return receipts;
  }

  private nextSafeAction(input: {
    previewOnly: boolean;
    requiresApproval: boolean;
    previewRequired: boolean;
    blockedToolIds: string[];
  }): string {
    if (input.blockedToolIds.length > 0) {
      return 'Resolver bloqueios de policy/quarentena before sair do preview.';
    }
    if (input.previewRequired) {
      return 'Generate or review a specific preview before any apply.';
    }
    if (input.requiresApproval) {
      return 'review the plan and request approval before running sensitive tools.';
    }
    if (input.previewOnly) {
      return 'Confirmar escopo; se estiver correto, reenvie without preview para run.';
    }
    return 'Plan is ready to continue through the governed runtime.';
  }
}
