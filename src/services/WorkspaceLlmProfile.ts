import { config } from '../config/index.js';
import { ProviderFactory } from '../providers/ProviderFactory.js';
import type { WorkspaceTaskKind, WorkspaceTaskSubtype } from './WorkspaceTaskKind.js';

export type WorkspaceLlmStrategy = {
  providerName: string;
  modelName?: string;
  allowFallback: boolean;
  fallbackOrder: string[];
};

type ResolveWorkspaceLlmStrategyOptions = {
  configuredProviderName?: string;
  isProviderUsable?: (name: string) => boolean;
  workspaceMemory?: Record<string, any> | null | undefined;
};

export function resolveWorkspaceLlmStrategy(
  taskKind: WorkspaceTaskKind,
  taskSubtype: WorkspaceTaskSubtype,
  options: ResolveWorkspaceLlmStrategyOptions = {},
): WorkspaceLlmStrategy {
  const configured = String(options.configuredProviderName || config.llmProvider || 'gemini')
    .trim()
    .toLowerCase();
  const isProviderUsable = (name: string) => {
    const canonical = ProviderFactory.normalizeProviderName(name);
    if (!options.isProviderUsable) {
      return true;
    }
    return options.isProviderUsable(canonical)
      || (canonical === 'aigateway' && options.isProviderUsable('AIGateway'));
  };
  const learnedRecommendation = resolveLearnedWorkspaceLlmRecommendation(
    options.workspaceMemory,
    taskKind,
    taskSubtype,
  );
  const learnedProvider = ProviderFactory.normalizeProviderName(String(learnedRecommendation?.preferred_provider || ''));

  let candidates: string[] = [configured, 'aigateway', 'gemini', 'deepseek', 'qwen', 'openrouter', 'openai', 'minimax'];

  if (taskKind === 'research' && (taskSubtype === 'comparison' || taskSubtype === 'web_research')) {
    candidates = ['openrouter', 'openai', 'aigateway', 'gemini', 'minimax', configured];
  } else if (taskKind === 'research' && taskSubtype === 'summarization') {
    candidates = ['gemini', 'aigateway', 'openrouter', 'openai', 'minimax', configured];
  } else if (
    taskKind === 'code'
    && (taskSubtype === 'review' || taskSubtype === 'testing' || taskSubtype === 'debugging')
  ) {
    candidates = ['aigateway', 'openai', 'openrouter', 'minimax', 'gemini', configured];
  } else if (taskKind === 'automation') {
    candidates = ['aigateway', 'gemini', 'openai', 'minimax', configured];
  }

  const ordered = Array.from(
    new Set(candidates.map((entry) => ProviderFactory.normalizeProviderName(entry)).filter(Boolean)),
  );
  const preferredCandidates = learnedProvider
    && isProviderUsable(learnedProvider)
    && (Number(learnedRecommendation?.success_count || 0) >= 2 || learnedRecommendation?.confidence === 'high')
      ? [learnedProvider, ...ordered.filter((entry) => entry !== learnedProvider)]
      : ordered;
  const primaryProvider = preferredCandidates.find((entry) => isProviderUsable(entry)) || configured;
  const fallbackOrder = ordered.filter((entry) => entry !== primaryProvider && isProviderUsable(entry));

  return {
    providerName: primaryProvider,
    modelName:
      (primaryProvider === learnedProvider ? String(learnedRecommendation?.preferred_model || '').trim() : '')
      || resolveWorkspaceModelStrategy(primaryProvider, taskKind, taskSubtype),
    allowFallback: fallbackOrder.length > 0,
    fallbackOrder,
  };
}

export function resolveWorkspaceModelStrategy(
  providerName: string,
  taskKind: WorkspaceTaskKind,
  taskSubtype: WorkspaceTaskSubtype,
): string | undefined {
  if (taskKind === 'research' && taskSubtype === 'summarization') {
    if (providerName === 'gemini') {
      return pickModel(
        config.graphResearchSummaryModel,
        config.aiStudioModel,
        config.geminiModel,
      );
    }

    return pickModel(
      config.graphResearchSummaryModel,
      getDefaultProviderModel(providerName),
    );
  }

  if (taskKind === 'research' && (taskSubtype === 'comparison' || taskSubtype === 'web_research')) {
    return pickModel(
      config.graphResearchDeepModel,
      getDefaultProviderModel(providerName),
    );
  }

  if (
    taskKind === 'code'
    && (taskSubtype === 'review' || taskSubtype === 'testing' || taskSubtype === 'debugging')
  ) {
    return pickModel(
      config.graphCodeReasoningModel,
      getDefaultProviderModel(providerName),
    );
  }

  if (taskKind === 'automation') {
    return pickModel(
      config.graphAutomationModel,
      getDefaultProviderModel(providerName),
    );
  }

  return undefined;
}

function getDefaultProviderModel(providerName: string): string {
  switch (String(providerName || '').trim().toLowerCase()) {
    case 'aigateway':
      return config.AIGatewayModel;
    case 'gemini':
      return config.geminiModel;
    case 'deepseek':
      return config.deepseekModel;
    case 'openai':
      return config.openaiModel;
    case 'minimax':
      return config.minimaxModel;
    case 'openrouter':
      return config.openRouterModel;
    case 'opencode':
      return config.openCodeModel;
    case 'qwen':
    case 'puter':
      return config.qwenModel;
    default:
      return '';
  }
}

function pickModel(...candidates: Array<string | undefined>): string | undefined {
  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim();
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

function resolveLearnedWorkspaceLlmRecommendation(
  workspaceMemory: Record<string, any> | null | undefined,
  taskKind: WorkspaceTaskKind,
  taskSubtype: WorkspaceTaskSubtype,
): {
  kind: WorkspaceTaskKind;
  subtype: WorkspaceTaskSubtype | 'general';
  preferred_provider: string;
  preferred_model: string | null;
  success_count: number;
  confidence: 'low' | 'medium' | 'high';
} | null {
  const subtypeRecommendations = Array.isArray(workspaceMemory?.task_subtype_llm_recommendations)
    ? workspaceMemory!.task_subtype_llm_recommendations
    : [];
  const kindRecommendations = Array.isArray(workspaceMemory?.task_kind_llm_recommendations)
    ? workspaceMemory!.task_kind_llm_recommendations
    : [];

  const subtypeRecommendation = subtypeRecommendations.find((entry: any) => {
    return String(entry?.kind || '').trim().toLowerCase() === taskKind
      && String(entry?.subtype || '').trim().toLowerCase() === taskSubtype;
  });
  if (subtypeRecommendation) {
    return subtypeRecommendation;
  }

  const kindRecommendation = kindRecommendations.find((entry: any) => {
    return String(entry?.kind || '').trim().toLowerCase() === taskKind
      && String(entry?.subtype || '').trim().toLowerCase() === 'general';
  });

  return kindRecommendation || null;
}
