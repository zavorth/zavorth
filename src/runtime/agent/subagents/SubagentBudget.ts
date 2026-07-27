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

export interface SubagentBudgetUsage {
  toolCalls?: number | null;
  elapsedMs?: number | null;
  outputBytes?: number | null;
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

/**
 * Apply live usage counters. Zero max values mean "dimension not enforced".
 */
export function applySubagentBudgetUsage(
  budget: SubagentBudget,
  usage: SubagentBudgetUsage = {},
): SubagentBudget {
  return {
    ...budget,
    usedToolCalls: nonNegativeInteger(
      typeof usage.toolCalls === 'number' ? budget.usedToolCalls + usage.toolCalls
        : budget.usedToolCalls,
      budget.usedToolCalls,
    ),
    elapsedMs: nonNegativeInteger(
      typeof usage.elapsedMs === 'number' ? usage.elapsedMs : budget.elapsedMs,
      budget.elapsedMs,
    ),
    outputBytes: nonNegativeInteger(
      typeof usage.outputBytes === 'number' ? budget.outputBytes + usage.outputBytes
        : budget.outputBytes,
      budget.outputBytes,
    ),
    metadata: { ...budget.metadata },
    policyTags: [...budget.policyTags],
  };
}

export function evaluateSubagentBudget(budget: SubagentBudget): SubagentBudgetDecision {
  const remainingToolCalls = budget.maxToolCalls > 0 ? budget.maxToolCalls - budget.usedToolCalls
    : Number.POSITIVE_INFINITY;
  const remainingWallClockMs = budget.maxWallClockMs > 0 ? budget.maxWallClockMs - budget.elapsedMs
    : Number.POSITIVE_INFINITY;
  const remainingOutputBytes = budget.maxOutputBytes > 0 ? budget.maxOutputBytes - budget.outputBytes
    : Number.POSITIVE_INFINITY;

  const exceeded =
    budget.maxToolCalls > 0 && budget.usedToolCalls > budget.maxToolCalls ? 'tool_calls'
      : budget.maxWallClockMs > 0 && budget.elapsedMs > budget.maxWallClockMs ? 'wall_clock_ms'
        : budget.maxOutputBytes > 0 && budget.outputBytes > budget.maxOutputBytes ? 'output_bytes'
          : null;

  return {
    ok: exceeded === null,
    exceeded,
    remainingToolCalls: Number.isFinite(remainingToolCalls) ? remainingToolCalls : Number.MAX_SAFE_INTEGER,
    remainingWallClockMs: Number.isFinite(remainingWallClockMs) ? remainingWallClockMs : Number.MAX_SAFE_INTEGER,
    remainingOutputBytes: Number.isFinite(remainingOutputBytes) ? remainingOutputBytes : Number.MAX_SAFE_INTEGER,
    policyTags: uniqueSorted([
      ...budget.policyTags,
      exceeded ? `subagent-budget:exceeded:${exceeded}` : 'subagent-budget:ok',
    ]),
  };
}

/**
 * True when another tool call would exceed the tool-call budget.
 * Used to stop before the next round when remaining is already zero.
 */
export function wouldExceedToolCallBudget(budget: SubagentBudget, additionalCalls = 1): boolean {
  if (budget.maxToolCalls <= 0) {
    return false;
  }
  return budget.usedToolCalls + Math.max(0, additionalCalls) > budget.maxToolCalls;
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
