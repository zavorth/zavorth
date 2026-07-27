import type { SwarmRole } from '../../runtime/sessions/v2/SwarmOrchestrator.js';
import type {
  SwarmV2RoleSelectionSnapshot,
  SwarmV2TokenBudgetInput,
  SwarmV2TokenBudgetSnapshot,
} from './SwarmV2Types.js';

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Math.min(max, Math.max(min, fallback));
  }
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export function clampMoney(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

export function estimateTokens(text: unknown): number {
  return Math.ceil(String(text || '').length / 4);
}

export function estimateUsd(tokens: number, modelClass: 'cheap' | 'standard' | 'premium'): number {
  const perMillion = modelClass === 'cheap' ? 0.25 : modelClass === 'premium' ? 10 : 2.5;
  return Math.round((tokens / 1_000_000) * perMillion * 10000) / 10000;
}

export function classifyTokenBudgetRisk(input: {
  estimatedLlmCalls: number;
  estimatedTotalTokens: number;
  estimatedUsd: number;
}): SwarmV2TokenBudgetSnapshot['risk'] {
  if (input.estimatedLlmCalls > 50 || input.estimatedTotalTokens > 250000 || input.estimatedUsd > 5) {
    return 'critical';
  }
  if (input.estimatedLlmCalls > 12 || input.estimatedTotalTokens > 100000 || input.estimatedUsd > 1.5) {
    return 'high';
  }
  if (input.estimatedLlmCalls > 4 || input.estimatedTotalTokens > 32000 || input.estimatedUsd > 0.35) {
    return 'medium';
  }
  return 'low';
}

export function buildTokenBudgetSnapshot(input: {
  objective: string;
  roles: SwarmRole[];
  roleSelection: SwarmV2RoleSelectionSnapshot;
  input?: SwarmV2TokenBudgetInput | null;
  benchmark: boolean;
  hasLlmRuntime: boolean;
}): SwarmV2TokenBudgetSnapshot {
  const modelClass = ['cheap', 'standard', 'premium'].includes(String(input.input?.modelClass || ''))
    ? input.input?.modelClass as 'cheap' | 'standard' | 'premium'
    : 'standard';
  const limits = {
    maxLlmCalls: clampNumber(input.input?.maxLlmCalls, 1, 100, 6),
    maxEstimatedTokens: clampNumber(input.input?.maxEstimatedTokens, 1000, 1000000, 48000),
    maxEstimatedUsd: clampMoney(input.input?.maxEstimatedUsd, 0.01, 100, 0.5),
  };
  const approved = input.input?.approved === true || input.input?.allowHighCost === true;
  const rolePromptTokens = input.roles.reduce((total, role) => (
    total
    + estimateTokens(role.systemPrompt)
    + estimateTokens(role.label)
    + estimateTokens(role.command || '')
    + estimateTokens((role.args || []).join(' '))
  ), 0);
  const objectiveTokens = estimateTokens(input.objective);
  const roleSelectionCalls = input.hasLlmRuntime && input.roleSelection.mode === 'llm' ? 1 : 0;
  const synthesisCalls = input.hasLlmRuntime ? 1 : 0;
  const roleLlmCalls = input.hasLlmRuntime
    ? input.roles.filter((role) => !role.command && !role.toolSpecId).length
    : 0;
  const estimatedLlmCalls = roleSelectionCalls + synthesisCalls + roleLlmCalls;
  const estimatedInputTokens = input.hasLlmRuntime ? objectiveTokens * Math.max(1, estimatedLlmCalls)
      + rolePromptTokens
      + input.roles.length * (input.benchmark ? 120 : 220)
    : 0;
  const estimatedOutputTokens = input.hasLlmRuntime
    ? 900 + roleLlmCalls * 700 + Math.ceil(input.roles.length * 35)
    : 0;
  const estimatedTotalTokens = estimatedInputTokens + estimatedOutputTokens;
  const estimatedUsd = estimateUsd(estimatedTotalTokens, modelClass);
  const risk = classifyTokenBudgetRisk({
    estimatedLlmCalls,
    estimatedTotalTokens,
    estimatedUsd,
  });
  const overLimit = estimatedLlmCalls > limits.maxLlmCalls
    || estimatedTotalTokens > limits.maxEstimatedTokens
    || estimatedUsd > limits.maxEstimatedUsd;
  const status: SwarmV2TokenBudgetSnapshot['status'] = !input.hasLlmRuntime ? 'passed'
    : risk === 'critical' && !approved ? 'blocked'
      : overLimit && !approved ? 'approval_required'
        : 'passed';
  const rationale = !input.hasLlmRuntime ? 'No LLM runtime is attached; this swarm uses local/tool execution and deterministic synthesis.'
    : status === 'passed'
      ? `Estimated ${estimatedLlmCalls} LLM call(s), ${estimatedTotalTokens} token(s), US$${estimatedUsd.toFixed(4)} within budget.`
      : `Estimated ${estimatedLlmCalls} LLM call(s), ${estimatedTotalTokens} token(s), US$${estimatedUsd.toFixed(4)} exceeds budget; approve explicitly or lower roles/output.`;
  return {
    enabled: true,
    status,
    risk,
    estimatedLlmCalls,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedTotalTokens,
    estimatedUsd,
    limits,
    approved,
    modelClass,
    rationale,
  };
}
