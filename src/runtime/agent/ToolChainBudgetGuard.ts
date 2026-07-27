import type {
  UniversalToolExposureProfile,
  UniversalToolRiskLevel,
} from './UniversalAgentRuntimeTypes.js';

export type ToolChainBudgetCall = {
  toolId: string;
  round?: number | null;
  risk?: UniversalToolRiskLevel | null;
  requiresApproval?: boolean | null;
  estimatedCostUnits?: number | null;
  metadata?: Record<string, unknown>;
};

export type ToolChainBudgetGuardInput = {
  calls?: ToolChainBudgetCall[] | null;
  toolExposure?: UniversalToolExposureProfile | null;
  metadata?: Record<string, unknown>;
};

export type ToolChainBudgetGuardOptions = {
  maxToolCalls?: number | null;
  maxToolRounds?: number | null;
  maxDangerousToolCalls?: number | null;
  maxEstimatedCostUnits?: number | null;
  requireApprovalForDangerousTools?: boolean;
};

export type ToolChainBudgetGuardDecision = {
  allowed: boolean;
  degraded: boolean;
  reason: string | null;
  summary: string;
  blockedToolIds: string[];
  metadata: Record<string, unknown>;
};

type NormalizedToolCall = {
  toolId: string;
  round: number;
  risk: UniversalToolRiskLevel;
  requiresApproval: boolean;
  estimatedCostUnits: number;
};

function normalizePositiveInteger(value: number | null | undefined, fallback: number | null): number | null {
  if (value === null) {
    return null;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : fallback;
}

function normalizeCost(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0;
}

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeRisk(value: unknown): UniversalToolRiskLevel | null {
  return value === 'safe' || value === 'attention' || value === 'danger' || value === 'unknown'
    ? value
    : null;
}

export class ToolChainBudgetGuard {
  private readonly maxToolCalls: number | null;
  private readonly maxToolRounds: number | null;
  private readonly maxDangerousToolCalls: number | null;
  private readonly maxEstimatedCostUnits: number | null;
  private readonly requireApprovalForDangerousTools: boolean;

  constructor(options: ToolChainBudgetGuardOptions = {}) {
    this.maxToolCalls = normalizePositiveInteger(options.maxToolCalls, 16);
    this.maxToolRounds = normalizePositiveInteger(options.maxToolRounds, 4);
    this.maxDangerousToolCalls = normalizePositiveInteger(options.maxDangerousToolCalls, 1);
    this.maxEstimatedCostUnits = options.maxEstimatedCostUnits === null
      ? null
      : normalizePositiveInteger(options.maxEstimatedCostUnits, null);
    this.requireApprovalForDangerousTools = options.requireApprovalForDangerousTools !== false;
  }

  public evaluate(input: ToolChainBudgetGuardInput = {}): ToolChainBudgetGuardDecision {
    const calls = this.normalizeCalls(input);
    const callCount = calls.length;
    const maxRound = calls.reduce((current, call) => Math.max(current, call.round), 0);
    const dangerousCalls = calls.filter((call) => call.risk === 'danger');
    const unapprovedDangerousCalls = dangerousCalls.filter((call) => !call.requiresApproval);
    const estimatedCostUnits = calls.reduce((total, call) => total + call.estimatedCostUnits, 0);
    const failures: Array<{ reason: string; blockedToolIds: string[] }> = [];

    if (this.maxToolCalls !== null && callCount > this.maxToolCalls) {
      failures.push({
        reason: 'tool-call-count-too-high',
        blockedToolIds: calls.map((call) => call.toolId),
      });
    }
    if (this.maxToolRounds !== null && maxRound > this.maxToolRounds) {
      failures.push({
        reason: 'tool-round-count-too-high',
        blockedToolIds: calls.map((call) => call.toolId),
      });
    }
    if (this.maxDangerousToolCalls !== null && dangerousCalls.length > this.maxDangerousToolCalls) {
      failures.push({
        reason: 'dangerous-tool-count-too-high',
        blockedToolIds: dangerousCalls.map((call) => call.toolId),
      });
    }
    if (this.requireApprovalForDangerousTools && unapprovedDangerousCalls.length > 0) {
      failures.push({
        reason: 'dangerous-tool-without-approval',
        blockedToolIds: unapprovedDangerousCalls.map((call) => call.toolId),
      });
    }
    if (
      this.maxEstimatedCostUnits !== null
      && estimatedCostUnits > this.maxEstimatedCostUnits
    ) {
      failures.push({
        reason: 'tool-chain-cost-too-high',
        blockedToolIds: calls.map((call) => call.toolId),
      });
    }

    const firstFailure = failures[0] || null;
    const allowed = !firstFailure;
    const summary = allowed ? 'Tool chain inside the minimum agent-loop budget.'
      : `Tool chain degraded before execution: ${firstFailure.reason}.`;

    return {
      allowed,
      degraded: !allowed,
      reason: firstFailure?.reason || null,
      summary,
      blockedToolIds: firstFailure?.blockedToolIds || [],
      metadata: {
        ...(input.metadata || {}),
        source: 'ToolChainBudgetGuard',
        callCount,
        maxRound,
        dangerousToolCount: dangerousCalls.length,
        unapprovedDangerousToolCount: unapprovedDangerousCalls.length,
        estimatedCostUnits,
        maxToolCalls: this.maxToolCalls,
        maxToolRounds: this.maxToolRounds,
        maxDangerousToolCalls: this.maxDangerousToolCalls,
        maxEstimatedCostUnits: this.maxEstimatedCostUnits,
        requireApprovalForDangerousTools: this.requireApprovalForDangerousTools,
        degraded: !allowed,
        reason: firstFailure?.reason || null,
        allReasons: failures.map((failure) => failure.reason),
        toolExposureGatedByToolChainBudget: false,
      },
    };
  }

  private normalizeCalls(input: ToolChainBudgetGuardInput): NormalizedToolCall[] {
    const exposureById = new Map(
      (input.toolExposure?.tools || []).map((tool) => [tool.id, tool]),
    );

    return (input.calls || [])
      .map((call, index): NormalizedToolCall => {
        const toolId = normalizeText(call?.toolId, `tool-${index + 1}`);
        const exposure = exposureById.get(toolId);
        const round = normalizePositiveInteger(call?.round, 1) || 1;
        const risk = normalizeRisk(call?.risk) || exposure?.risk || 'unknown';
        const requiresApproval = call?.requiresApproval ?? exposure?.requiresApproval ?? false;

        return {
          toolId,
          round,
          risk,
          requiresApproval,
          estimatedCostUnits: normalizeCost(call?.estimatedCostUnits),
        };
      });
  }
}
