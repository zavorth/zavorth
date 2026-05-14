export type SubagentBudgetExceededReason = 'tool_calls' | 'wall_clock_ms' | 'output_bytes';

export interface SubagentBudget {
  maxToolCalls: number;
  maxWallClockMs: number;
  maxOutputBytes: number;
  usedToolCalls: number;
  elapsedMs: number;
  outputBytes: number;
  policyTags: string[];
  metadata: Record<string, unknown>;
}

export interface SubagentBudgetInput {
  maxToolCalls?: number | null;
  maxWallClockMs?: number | null;
  maxOutputBytes?: number | null;
  usedToolCalls?: number | null;
  elapsedMs?: number | null;
  outputBytes?: number | null;
  policyTags?: readonly string[] | null;
  metadata?: Record<string, unknown> | null;
}

export interface SubagentBudgetDecision {
  ok: boolean;
  exceeded: SubagentBudgetExceededReason | null;
  remainingToolCalls: number;
  remainingWallClockMs: number;
  remainingOutputBytes: number;
  policyTags: string[];
}

export function createSubagentBudget(input: SubagentBudgetInput = {}): SubagentBudget {
  return {
    maxToolCalls: nonNegativeInteger(input.maxToolCalls, 0),
    maxWallClockMs: nonNegativeInteger(input.maxWallClockMs, 0),
    maxOutputBytes: nonNegativeInteger(input.maxOutputBytes, 0),
    usedToolCalls: nonNegativeInteger(input.usedToolCalls, 0),
    elapsedMs: nonNegativeInteger(input.elapsedMs, 0),
    outputBytes: nonNegativeInteger(input.outputBytes, 0),
    policyTags: uniqueSorted([...(input.policyTags ?? []), 'subagent-budget']),
    metadata: input.metadata ? { ...input.metadata } : {},
  };
}

export function evaluateSubagentBudget(budget: SubagentBudget): SubagentBudgetDecision {
  const remainingToolCalls = budget.maxToolCalls - budget.usedToolCalls;
  const remainingWallClockMs = budget.maxWallClockMs - budget.elapsedMs;
  const remainingOutputBytes = budget.maxOutputBytes - budget.outputBytes;
  const exceeded =
    remainingToolCalls < 0
      ? 'tool_calls'
      : remainingWallClockMs < 0
        ? 'wall_clock_ms'
        : remainingOutputBytes < 0
          ? 'output_bytes'
          : null;

  return {
    ok: exceeded === null,
    exceeded,
    remainingToolCalls,
    remainingWallClockMs,
    remainingOutputBytes,
    policyTags: uniqueSorted([
      ...budget.policyTags,
      exceeded ? `subagent-budget:exceeded:${exceeded}` : 'subagent-budget:ok',
    ]),
  };
}

function nonNegativeInteger(value: number | null | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort();
}
