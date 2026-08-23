/**
 * Cost + effort routing helpers for the AgentRun hot path.
 *
 * Owns classification and option decoration only. Does not invent a parallel
 * CostOptimizedRoutingService — consumes kernel intent / effort metadata already
 * attached to the run.
 */

import type { LlmRunOptions } from '../../services/llm/LlmRuntimeService.js';
import type { UniversalAgentRequest, UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';
import {
  ZavorthEffortControlService,
  type ZavorthEffortControlService as EffortServiceType,
} from '../../services/ZavorthEffortControlService.js';
import type {
  ZavorthEffortLevel,
  ZavorthProviderReasoningEffort,
} from '../../contracts/runtime/ZavorthEffortControlContract.js';
import { resolveCheapUserStackHop } from '../../services/llm/UserStackCostRoute.js';
import { LlmRoleRoutingService } from '../../services/llm/LlmRoleRoutingService.js';
import { resolveLlmRoleScopeId } from '../../contracts/runtime/LlmRoleRoutingContract.js';

export type AgentRunCostRouteClass = 'premium' | 'standard' | 'background';

export type AgentRunCostBudgetHint = 'minimal-context' | 'session-context' | 'workspace-context' | 'governed-runtime';

export type AgentRunCostEffortRoute = {
  class: AgentRunCostRouteClass;
  useFastModel: boolean;
  reason: string;
  effortLevel: ZavorthEffortLevel | null;
  providerReasoningEffort: ZavorthProviderReasoningEffort | null;
  suggestedModelName: string | null;
  suggestedProviderName: string | null;
  userModelPinned: boolean;
  savingsHint: string;
  /** Where the cheap hop came from (user stack / env / none). */
  cheapHopSource: string | null;
  /** Classifier cost tier produced by NaturalFirstRunClassifier, when present. */
  budgetHint: AgentRunCostBudgetHint | null;
};

const BUDGET_HINTS: readonly AgentRunCostBudgetHint[] = [
  'minimal-context',
  'session-context',
  'workspace-context',
  'governed-runtime',
];

function resolveNaturalFirstBudgetHint(run: UniversalAgentRun, request: UniversalAgentRequest): AgentRunCostBudgetHint | null {
  const meta = mergeMeta(run, request);
  const natural = recordOrNull(meta.naturalFirstRoute) || recordOrNull(meta.naturalRoute);
  const cost = recordOrNull(natural?.cost);
  const hint = normalizeText(cost?.budgetHint);
  return BUDGET_HINTS.includes(hint as AgentRunCostBudgetHint) ? (hint as AgentRunCostBudgetHint) : null;
}

export function classifyAgentRunCostEffortRoute(
  run: UniversalAgentRun,
  request: UniversalAgentRequest,
  effortService: Pick<
    EffortServiceType,
    'buildSnapshot' | 'toProviderReasoningEffort'
  > = new ZavorthEffortControlService(),
): AgentRunCostEffortRoute {
  const userModelPinned = hasUserPinnedModel(run, request);
  const useFastModel = resolveUseFastModel(run, request);
  const effortLevel = resolveEffortLevel(run, request);
  const providerReasoningEffort = effortLevel ? effortService.toProviderReasoningEffort(effortLevel) : null;
  const budgetHint = resolveNaturalFirstBudgetHint(run, request);

  let routeClass: AgentRunCostRouteClass = 'standard';
  let reason = 'Default standard route for interactive agent turns.';

  // Structured signals only (useFastModel / effortLevel / classifier budget hint).
  // Free-text never selects a cost route class by itself.
  if (useFastModel) {
    routeClass = 'background';
    reason = 'Kernel/intent marked useFastModel.';
  } else if (effortLevel === 'ultra-code' || effortLevel === 'high') {
    routeClass = 'premium';
    reason = `Effort level ${effortLevel} prefers deeper synthesis.`;
  } else if (effortLevel === 'low') {
    routeClass = 'background';
    reason = 'Low effort maps to cheap worker routing.';
  } else if (budgetHint === 'minimal-context') {
    routeClass = 'background';
    reason = 'Classifier marked this turn minimal-context; routing through the cheap hop.';
  }

  let suggested =
    routeClass === 'background' && !userModelPinned
      ? resolveBackgroundModelSuggestion()
      : {
          modelName: null as string | null,
          providerName: null as string | null,
          source: null as string | null,
          hopReason: '',
        };

  if (routeClass === 'premium' && !userModelPinned) {
    try {
      const meta = mergeMeta(run, request);
      const userId = String(meta.userId || (run.metadata as { userId?: string } | undefined)?.userId || '').trim();
      const surface = String(
        meta.surface || (run.metadata as { surface?: string } | undefined)?.surface || 'agent-run',
      ).trim();
      const scopeId = resolveLlmRoleScopeId({ userId: userId || null, surface });
      const fallbackProvider = String(meta.providerName || meta.llmProvider || '').trim() || 'gemini';
      const fallbackModel = String(meta.modelName || meta.llmModel || '').trim() || undefined;
      const resolved = new LlmRoleRoutingService().resolveRole(
        scopeId,
        { effortHigh: true, taskKind: String((request as { taskKind?: string } | undefined)?.taskKind || '') || null },
        fallbackProvider,
        fallbackModel,
        () => true,
      );
      if (resolved.role === 'strong' && (resolved.modelName || resolved.providerName)) {
        suggested = {
          modelName: resolved.modelName || null,
          providerName: resolved.providerName || null,
          source: 'llm_role_strong',
          hopReason: resolved.reason,
        };
        reason = `${reason}; ${resolved.reason}`;
      }
    } catch {
      // optional role routing
    }
  }

  return {
    class: routeClass,
    useFastModel,
    reason,
    effortLevel,
    providerReasoningEffort,
    suggestedModelName: suggested.modelName,
    suggestedProviderName: suggested.providerName,
    userModelPinned,
    cheapHopSource: suggested.source,
    budgetHint,
    savingsHint:
      routeClass === 'background' && suggested.modelName ? `Background route uses user-stack cheap hop ${suggested.providerName || 'provider'}/${suggested.modelName} (${suggested.source || 'stack'}).`
        : routeClass === 'premium' && suggested.modelName ? `Premium route may use strong role ${suggested.providerName}/${suggested.modelName}.`
          : routeClass === 'background'
            ? 'Background route active; add a secondary model or fallback providers in your selection for automatic cheap routing.'
            : 'Premium/standard route keeps the selected model.',
  };
}

export function applyCostEffortRouteToLlmOptions(base: LlmRunOptions, route: AgentRunCostEffortRoute): LlmRunOptions {
  const next: LlmRunOptions = { ...base };

  if (
    (route.class === 'background' || route.class === 'premium') &&
    !route.userModelPinned &&
    route.suggestedModelName &&
    !normalizeText(base.modelName)
  ) {
    next.modelName = route.suggestedModelName;
    if (route.suggestedProviderName && !normalizeText(base.providerName)) {
      next.providerName = route.suggestedProviderName;
    }
  }

  if (route.providerReasoningEffort) {
    next.reasoningEffort = route.providerReasoningEffort;
  } else if (route.budgetHint === 'minimal-context' && !base.reasoningEffort) {
    // Minimal-context turns never need deep synthesis; cap provider effort
    // unless the caller pinned one explicitly.
    next.reasoningEffort = 'low';
  }

  next.costRouteClass = route.class;
  next.costRouteReason = route.reason;

  return next;
}

function resolveUseFastModel(run: UniversalAgentRun, request: UniversalAgentRequest): boolean {
  const meta = mergeMeta(run, request);
  if (meta.useFastModel === true || meta.fastModelSuggested === true) return true;

  const intent = recordOrNull(meta.intentDecision) || recordOrNull(run.metadata.intentDecision);
  const hints = recordOrNull(intent?.hints);
  if (hints?.useFastModel === true || hints?.trivialChat === true) return true;

  const kernel = recordOrNull(run.metadata.agentKernelSnapshot);
  const kernelIntent = recordOrNull(kernel?.intentDecision);
  const kernelHints = recordOrNull(kernelIntent?.hints);
  if (kernelHints?.useFastModel === true || kernelHints?.trivialChat === true) return true;

  const natural = recordOrNull(meta.naturalRoute) || recordOrNull(meta.__naturalRoute);
  if (natural?.useFastModel === true) return true;

  return false;
}

function resolveEffortLevel(run: UniversalAgentRun, request: UniversalAgentRequest): ZavorthEffortLevel | null {
  const meta = mergeMeta(run, request);
  const raw = normalizeText(
    meta.effortLevel ||
      meta.effort ||
      recordOrNull(meta.effortControl)?.effectiveLevel ||
      recordOrNull(run.metadata.effortControl)?.effectiveLevel,
  );
  if (!raw) return null;
  const snapshot = new ZavorthEffortControlService().buildSnapshot({ level: raw });
  return snapshot.effectiveLevel;
}

function hasUserPinnedModel(run: UniversalAgentRun, request: UniversalAgentRequest): boolean {
  if (normalizeText(request.metadata?.modelName)) return true;
  if (normalizeText(request.metadata?.providerName)) return true;
  if (recordOrNull(request.metadata?.sessionModelRoute)?.modelName) return true;
  if (recordOrNull(run.metadata.sessionModelRoute)?.modelName) return true;
  const profileModel = normalizeText(request.modelProfile?.modelLabel);
  if (profileModel && !['current model', 'model not configured'].includes(profileModel.toLowerCase())) {
    return true;
  }
  const profileProvider = normalizeText(request.modelProfile?.providerLabel);
  if (profileProvider && !['zavorth', 'provider not configured'].includes(profileProvider.toLowerCase())) {
    return true;
  }
  // Explicit model picker selection from UI counts as a pin for this turn.
  const selected = recordOrNull(run.metadata.modelPickerSelection);
  if (selected?.source === 'user' || selected?.pinned === true) return true;
  return false;
}

/** Cheap model from user stack (secondary / fallbacks / on-stack env), never product catalog. */
function resolveBackgroundModelSuggestion(): {
  modelName: string | null;
  providerName: string | null;
  source: string | null;
  hopReason: string;
} {
  const pick = resolveCheapUserStackHop({});
  return {
    modelName: pick.modelName,
    providerName: pick.providerName,
    source: pick.source,
    hopReason: pick.reason,
  };
}

function mergeMeta(run: UniversalAgentRun, request: UniversalAgentRequest): Record<string, unknown> {
  return {
    ...run.metadata,
    ...(request.metadata || {}),
  };
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}
