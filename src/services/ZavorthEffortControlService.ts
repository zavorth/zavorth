import {
  ZAVORTH_EFFORT_CONTROL_CONTRACT_VERSION,
  type ZavorthEffortControlInput,
  type ZavorthEffortControlSnapshot,
  type ZavorthEffortLevel,
  type ZavorthEffortModelClass,
  type ZavorthInternalEffort,
} from '../contracts/ZavorthEffortControlContract.js';

export type ZavorthEffortControlRuntime = {
  now?: () => Date;
};

type EffortProfile = {
  internalEffort: ZavorthInternalEffort;
  workerModelClass: ZavorthEffortModelClass;
  synthesisModelClass: ZavorthEffortModelClass;
  defaultMaxCents: number;
  approvalRequiredAboveCents: number;
  maxSubagents: number;
  maxToolCalls: number;
  maxContextWindows: number;
  dynamicWorkflowsRecommended: boolean;
  agentTeamsRecommended: boolean;
  subagentsRecommended: boolean;
  routeReason: string;
};

const EFFORT_PROFILES: Record<ZavorthEffortLevel, EffortProfile> = {
  low: {
    internalEffort: 'light',
    workerModelClass: 'cheap',
    synthesisModelClass: 'standard',
    defaultMaxCents: 10,
    approvalRequiredAboveCents: 10,
    maxSubagents: 1,
    maxToolCalls: 6,
    maxContextWindows: 1,
    dynamicWorkflowsRecommended: false,
    agentTeamsRecommended: false,
    subagentsRecommended: false,
    routeReason: 'Use low effort for short answers, summaries and cheap first passes.',
  },
  standard: {
    internalEffort: 'standard',
    workerModelClass: 'cheap',
    synthesisModelClass: 'standard',
    defaultMaxCents: 25,
    approvalRequiredAboveCents: 25,
    maxSubagents: 4,
    maxToolCalls: 20,
    maxContextWindows: 4,
    dynamicWorkflowsRecommended: false,
    agentTeamsRecommended: false,
    subagentsRecommended: true,
    routeReason: 'Use standard effort for normal daily tasks with bounded tool use.',
  },
  high: {
    internalEffort: 'heavy',
    workerModelClass: 'standard',
    synthesisModelClass: 'premium',
    defaultMaxCents: 75,
    approvalRequiredAboveCents: 25,
    maxSubagents: 12,
    maxToolCalls: 60,
    maxContextWindows: 12,
    dynamicWorkflowsRecommended: false,
    agentTeamsRecommended: true,
    subagentsRecommended: true,
    routeReason: 'Use high effort for deeper review, coding and multi-step synthesis.',
  },
  'ultra-code': {
    internalEffort: 'heavy',
    workerModelClass: 'cheap',
    synthesisModelClass: 'premium',
    defaultMaxCents: 150,
    approvalRequiredAboveCents: 25,
    maxSubagents: 30,
    maxToolCalls: 120,
    maxContextWindows: 30,
    dynamicWorkflowsRecommended: true,
    agentTeamsRecommended: true,
    subagentsRecommended: true,
    routeReason: 'Use ultra-code for wide repository work: cheap fanout, governed synthesis and explicit budget.',
  },
};

export class ZavorthEffortControlService {
  private readonly now: () => Date;

  public constructor(runtime: ZavorthEffortControlRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: ZavorthEffortControlInput = {}): ZavorthEffortControlSnapshot {
    const requestedLevel = clean(input.level);
    const effectiveLevel = normalizeEffortLevel(requestedLevel);
    const profile = EFFORT_PROFILES[effectiveLevel];
    const requestPreview = redactText(clean(input.request));
    const maxCents = parseCents(input.maxCents) || profile.defaultMaxCents;
    const approvalReasons = [
      ...(profile.synthesisModelClass === 'premium' ? ['premium synthesis tier'] : []),
      ...(profile.maxSubagents > 16 ? ['large fanout route'] : []),
      ...(maxCents > profile.approvalRequiredAboveCents ? ['budget above quiet lane'] : []),
    ];

    return {
      contractVersion: ZAVORTH_EFFORT_CONTROL_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      requestedLevel,
      effectiveLevel,
      requestPreview,
      profile: clean(input.profile),
      runtime: {
        internalEffort: profile.internalEffort,
        operationalReasoningSummary: buildReasoningSummary(effectiveLevel),
        exposeChainOfThought: false,
      },
      routing: {
        workerModelClass: profile.workerModelClass,
        synthesisModelClass: profile.synthesisModelClass,
        dynamicWorkflowsRecommended: profile.dynamicWorkflowsRecommended,
        agentTeamsRecommended: profile.agentTeamsRecommended,
        subagentsRecommended: profile.subagentsRecommended,
        routeReason: profile.routeReason,
      },
      budget: {
        maxCents,
        approvalRequiredAboveCents: profile.approvalRequiredAboveCents,
        maxSubagents: profile.maxSubagents,
        maxToolCalls: profile.maxToolCalls,
        maxContextWindows: profile.maxContextWindows,
        stopWhenExceeded: true,
      },
      approval: {
        required: approvalReasons.length > 0,
        reasons: approvalReasons,
      },
      safety: {
        noChainOfThoughtExposure: true,
        noPolicyBypass: true,
        costGuardRequired: true,
        dynamicWorkflowBudgetRequired: true,
        liveMutationStillRequiresApproval: true,
        externalIoStillRequiresApproval: true,
        rawSecretsSerialized: false,
      },
      commandPreview: {
        effort: `zavorth effort ${effectiveLevel}${requestPreview ? ` --request "${requestPreview}"` : ''}`,
        costGuard: `zavorth model-cost${requestPreview ? ` --request "${requestPreview}"` : ''} --max-cents ${maxCents}`,
        dynamicWorkflow: `zavorth workflows${requestPreview ? ` "${requestPreview}"` : ''} --fanout ${profile.maxSubagents} --max-concurrency ${Math.min(8, profile.maxSubagents)} --worker-model ${profile.workerModelClass} --synthesis-model ${profile.synthesisModelClass} --max-cents ${maxCents}`,
        agentTeam: `zavorth agent-team preview${requestPreview ? ` "${requestPreview}"` : ''}`,
      },
    };
  }

  public renderText(snapshot: ZavorthEffortControlSnapshot): string {
    return [
      'Zavorth Effort Control',
      `level: ${snapshot.effectiveLevel}`,
      `internal effort: ${snapshot.runtime.internalEffort}`,
      `models: workers=${snapshot.routing.workerModelClass} synthesis=${snapshot.routing.synthesisModelClass}`,
      `limits: ${snapshot.budget.maxSubagents} subagent(s), ${snapshot.budget.maxToolCalls} tool call(s), ${snapshot.budget.maxContextWindows} context window(s), ${snapshot.budget.maxCents}c`,
      `approval: ${snapshot.approval.required ? snapshot.approval.reasons.join(', ') : 'not required'}`,
      `route: ${snapshot.routing.routeReason}`,
      `cost guard: ${snapshot.commandPreview.costGuard}`,
      `workflow: ${snapshot.routing.dynamicWorkflowsRecommended ? snapshot.commandPreview.dynamicWorkflow : 'not recommended for this effort level'}`,
    ].join('\n');
  }
}

function normalizeEffortLevel(value: string | null): ZavorthEffortLevel {
  const normalized = String(value || '').trim().toLowerCase().replace(/_/g, '-');
  if (normalized === 'low' || normalized === 'light' || normalized === 'fast') return 'low';
  if (normalized === 'high' || normalized === 'deep' || normalized === 'heavy') return 'high';
  if (
    normalized === 'ultra'
    || normalized === 'ultra-code'
    || normalized === 'ultracode'
    || normalized === 'max'
    || normalized === 'massive'
  ) return 'ultra-code';
  return 'standard';
}

function buildReasoningSummary(level: ZavorthEffortLevel): string {
  if (level === 'low') return 'Short planning, minimal tool use and cheap model routing.';
  if (level === 'high') return 'Deeper planning, agent-team review and premium synthesis behind approval.';
  if (level === 'ultra-code') return 'Wide parallel evidence gathering with cheap workers and governed final synthesis.';
  return 'Balanced planning, normal tool use and bounded subagent routing.';
}

function parseCents(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.round(parsed), 100_000) : null;
}

function clean(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function redactText(value: string | null): string | null {
  if (!value) return null;
  return value
    .replace(/\b(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|AIza[A-Za-z0-9_-]{12,})\b/g, '[redacted-secret]')
    .replace(/\b(token|secret|password|api[_-]?key)\s*[:=]\s*[^,\s]+/gi, '$1=[redacted]');
}
