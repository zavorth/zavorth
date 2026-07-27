import type {
  UniversalAgentRequest,
  UniversalAgentRun,
} from './UniversalAgentRuntimeTypes.js';

export type RunBudgetPolicyInput = {
  request: UniversalAgentRequest;
  run: UniversalAgentRun;
};

export type RunBudgetPolicyOptions = {
  maxInputChars?: number | null;
  maxRequestedTools?: number | null;
  maxExposedTools?: number | null;
  maxEstimatedCostUnits?: number | null;
  estimateCostUnits?: ((input: RunBudgetPolicyInput) => number | null | undefined) | null;
};

export type RunBudgetPolicyDecision = {
  allowed: boolean;
  degraded: boolean;
  reason: string | null;
  summary: string;
  metadata: Record<string, unknown>;
};

function normalizePositiveInteger(value: number | null | undefined, fallback: number | null): number | null {
  if (value === null) {
    return null;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : fallback;
}

function normalizeCost(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null;
}

function countRequestedTools(request: UniversalAgentRequest): number {
  return Array.from(new Set(
    (request.requestedTools || [])
      .map((tool) => String(tool || '').trim())
      .filter(Boolean),
  )).length;
}

export class RunBudgetPolicy {
  private readonly maxInputChars: number | null;
  private readonly maxRequestedTools: number | null;
  private readonly maxExposedTools: number | null;
  private readonly maxEstimatedCostUnits: number | null;
  private readonly estimateCostUnits: ((input: RunBudgetPolicyInput) => number | null | undefined) | null;

  constructor(options: RunBudgetPolicyOptions = {}) {
    this.maxInputChars = normalizePositiveInteger(options.maxInputChars, 32_000);
    this.maxRequestedTools = normalizePositiveInteger(options.maxRequestedTools, 64);
    this.maxExposedTools = normalizePositiveInteger(options.maxExposedTools, 64);
    this.maxEstimatedCostUnits = normalizeCost(options.maxEstimatedCostUnits);
    this.estimateCostUnits = options.estimateCostUnits || null;
  }

  public evaluate(input: RunBudgetPolicyInput): RunBudgetPolicyDecision {
    const inputChars = input.run.input.length;
    const requestedToolCount = countRequestedTools(input.request);
    const exposedToolCount = input.run.toolExposure.tools.length;
    const estimatedCostUnits = this.resolveEstimatedCostUnits(input);
    const failures: string[] = [];

    if (this.maxInputChars !== null && inputChars > this.maxInputChars) {
      failures.push('input-too-large');
    }
    if (this.maxRequestedTools !== null && requestedToolCount > this.maxRequestedTools) {
      failures.push('requested-tools-too-many');
    }
    if (this.maxExposedTools !== null && exposedToolCount > this.maxExposedTools) {
      failures.push('exposed-tools-too-many');
    }
    if (
      this.maxEstimatedCostUnits !== null
      && estimatedCostUnits !== null
      && estimatedCostUnits > this.maxEstimatedCostUnits
    ) {
      failures.push('estimated-cost-too-high');
    }

    const reason = failures[0] || null;
    const allowed = failures.length === 0;
    const summary = allowed ? 'Run is within the minimum agent loop budget.'
      : `Run degraded by minimum budget before the executor: ${reason}.`;

    return {
      allowed,
      degraded: !allowed,
      reason,
      summary,
      metadata: {
        source: 'RunBudgetPolicy',
        inputChars,
        requestedToolCount,
        exposedToolCount,
        estimatedCostUnits,
        maxInputChars: this.maxInputChars,
        maxRequestedTools: this.maxRequestedTools,
        maxExposedTools: this.maxExposedTools,
        maxEstimatedCostUnits: this.maxEstimatedCostUnits,
        degraded: !allowed,
        reason,
        allReasons: failures,
        toolExposureGatedByRunBudget: false,
      },
    };
  }

  private resolveEstimatedCostUnits(input: RunBudgetPolicyInput): number | null {
    const metadataCost = normalizeCost(input.request.metadata?.estimatedCostUnits);
    if (metadataCost !== null) {
      return metadataCost;
    }
    if (!this.estimateCostUnits) {
      return null;
    }
    return normalizeCost(this.estimateCostUnits(input));
  }
}
