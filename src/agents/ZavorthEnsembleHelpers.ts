import type { SwarmRole } from '../runtime/sessions/v2/SwarmOrchestrator.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';
import type {
  ToolSpecRawInput,
  ZavorthEnsembleIsolationMode,
  ZavorthEnsembleOfficialSurface,
  ZavorthEnsembleRoleLibraryEntry,
  ZavorthEnsembleRoleSelectionSnapshot,
  ZavorthEnsembleTokenBudgetInput,
  ZavorthEnsembleTokenBudgetSnapshot,
  ZavorthEnsembleToolSpec,
} from './ZavorthEnsembleTypes.js';

export function buildTokenBudgetSnapshot(input: {
  objective: string;
  roles: SwarmRole[];
  roleSelection: ZavorthEnsembleRoleSelectionSnapshot;
  input?: ZavorthEnsembleTokenBudgetInput | null;
  benchmark: boolean;
  hasLlmRuntime: boolean;
}): ZavorthEnsembleTokenBudgetSnapshot {
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
  const status: ZavorthEnsembleTokenBudgetSnapshot['status'] = !input.hasLlmRuntime ? 'passed'
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

export function classifyTokenBudgetRisk(input: {
  estimatedLlmCalls: number;
  estimatedTotalTokens: number;
  estimatedUsd: number;
}): ZavorthEnsembleTokenBudgetSnapshot['risk'] {
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

export function estimateTokens(text: unknown): number {
  return Math.ceil(String(text || '').length / 4);
}

export function estimateUsd(tokens: number, modelClass: 'cheap' | 'standard' | 'premium'): number {
  const perMillion = modelClass === 'cheap' ? 0.25 : modelClass === 'premium' ? 10 : 2.5;
  return Math.round((tokens / 1_000_000) * perMillion * 10000) / 10000;
}

export function clampMoney(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

export function normalizeToolSpecs(raw: unknown): ZavorthEnsembleToolSpec[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((entry, index): ZavorthEnsembleToolSpec | null => {
    const spec = entry as ToolSpecRawInput;
    const id = normalizeKey(spec?.id, `tool-${index + 1}`);
    const command = String(spec?.command || '').trim();
    if (!command) {
      return null;
    }
    const risk = ['safe', 'attention', 'danger'].includes(String(spec?.risk || ''))
      ? String(spec?.risk) as 'safe' | 'attention' | 'danger'
      : 'attention';
    return {
      id,
      kind: 'shell',
      label: String(spec?.label || id).trim(),
      command,
      args: Array.isArray(spec?.args) ? (spec.args as unknown[]).map((value: unknown) => String(value)) : [],
      cwd: String(spec?.cwd || '').trim() || null,
      risk,
      requiresApproval: spec?.requiresApproval === false ? false : true,
    };
  }).filter(Boolean) as ZavorthEnsembleToolSpec[];
}

export function isStrongIsolationMode(mode: ZavorthEnsembleIsolationMode): boolean {
  return mode === 'docker' || mode === 'wsl' || mode === 'external-sandbox';
}

export function strongIsolationWrapper(mode: ZavorthEnsembleIsolationMode): ZavorthEnsembleOfficialSurface['strongIsolation']['wrapper'] {
  if (mode === 'docker') return 'docker';
  if (mode === 'wsl') return 'wsl';
  if (mode === 'external-sandbox') return 'external-sandbox';
  return 'none';
}

export function parseJsonObject(raw: unknown): Record<string, unknown> | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error: unknown) { asErrorLike(error); 
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (error: unknown) { asErrorLike(error);  logger.warn('[Zavorth Ensemble] JSON parse failed', error); return null; }
  }
}

export function defaultRoleLibrary(): ZavorthEnsembleRoleLibraryEntry[] {
  const now = new Date().toISOString();
  return [
    ['planner', 'Planner', 'planner', 'Break the mission into stages, risks, dependencies, acceptance criteria, and clear handoffs.'],
    ['researcher', 'Researcher', 'researcher', 'Collect evidence, files, context, and facts. Work in read-only mode and cite gaps.'],
    ['implementer', 'Implementer', 'implementer', 'Propose or execute the permitted implementation while keeping scope, rollback, and diffs small.'],
    ['verifier', 'Verifier', 'verifier', 'Validate tests, regression risk, security, acceptance criteria, and operational risks.'],
    ['synthesizer', 'Synthesizer', 'synthesizer', 'Merge the other agents results into an objective final answer without raw chain-of-thought.'],
    ['safety-reviewer', 'Safety Reviewer', 'critic', 'Look for risks, improper permission use, secret leaks, prompt injection, and actions without approval.'],
  ].map(([id, label, kind, systemPrompt]) => ({
    id,
    label,
    kind: kind as ZavorthEnsembleRoleLibraryEntry['kind'],
    systemPrompt,
    defaultTools: [],
    risk: kind === 'implementer' ? 'attention' : 'safe',
    scope: kind === 'implementer' ? 'workspace_patch' : 'read_only',
    tags: ['official', 'default'],
    createdAt: now,
    updatedAt: now,
  }));
}

export function chunkRoles(roles: SwarmRole[], size: number): SwarmRole[][] {
  const chunks: SwarmRole[][] = [];
  for (let index = 0; index < roles.length; index += size) {
    chunks.push(roles.slice(index, index + size));
  }
  return chunks;
}

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Math.min(max, Math.max(min, fallback));
  }
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export function normalizeKey(value: unknown, fallback: string): string {
  const normalized = String(value || '').trim().toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}
