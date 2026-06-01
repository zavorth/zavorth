export const ZAVORTH_PROVIDER_ROUTER_CONTRACT_VERSION = '2026-05-31.provider-router.v1' as const;

export type ZavorthProviderRouterStatus = 'ready' | 'degraded' | 'offline';

export type ZavorthProviderRouterApiCompatibility = 'openai' | 'anthropic' | 'custom';

export type ZavorthProviderRouterBudgetPreference = 'cheapest' | 'fastest' | 'best-quality' | 'auto';

export type ZavorthProviderRouterCompletionStatus =
  | 'completed'
  | 'failed'
  | 'fallback-used'
  | 'all-providers-exhausted';

export type ZavorthProviderRouterRateLimitState = {
  requestsRemaining: number | null;
  tokensRemaining: number | null;
  resetsAt: string | null;
  isThrottled: boolean;
};

export type ZavorthProviderRouterHealthState = {
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  averageLatencyMs: number | null;
};

export type ZavorthProviderRouterEntry = {
  providerId: string;
  label: string;
  baseUrl: string;
  apiCompatibility: ZavorthProviderRouterApiCompatibility;
  models: string[];
  costPerInputToken: number | null;
  costPerOutputToken: number | null;
  maxContextTokens: number;
  rateLimitState: ZavorthProviderRouterRateLimitState;
  healthState: ZavorthProviderRouterHealthState;
  priority: number;
  enabled: boolean;
};

export type ZavorthProviderRouterMessage = {
  role: string;
  content: string;
};

export type ZavorthProviderRouterRequest = {
  prompt: string;
  model?: string | null;
  preferredProvider?: string | null;
  maxTokens?: number | null;
  temperature?: number | null;
  systemPrompt?: string | null;
  conversationHistory?: ZavorthProviderRouterMessage[] | null;
  requestedBy?: string | null;
  budgetPreference?: ZavorthProviderRouterBudgetPreference;
};

export type ZavorthProviderRouterReceipt = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_PROVIDER_ROUTER_CONTRACT_VERSION;
  surface: 'provider-router';
  status: ZavorthProviderRouterCompletionStatus;
  selectedProvider: { providerId: string; model: string } | null;
  fallbacksAttempted: Array<{ providerId: string; reason: string }>;
  contextBudget: {
    originalTokens: number;
    compressedTokens: number;
    compressionApplied: boolean;
    truncatedMessages: number;
  };
  performance: {
    totalLatencyMs: number;
    providerLatencyMs: number;
    routingLatencyMs: number;
  };
  cost: {
    estimatedInputCost: number | null;
    estimatedOutputCost: number | null;
  };
  output: {
    text: string;
    finishReason: string | null;
    tokensUsed: { input: number | null; output: number | null };
  };
  safety: {
    noRawSecretsSerialized: boolean;
    receiptPersisted: boolean;
    allProvidersFromRegistry: boolean;
    noDirectApiKeyExposure: boolean;
  };
};

export type ZavorthProviderRouterSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_PROVIDER_ROUTER_CONTRACT_VERSION;
  surface: 'provider-router';
  status: ZavorthProviderRouterStatus;
  providers: ZavorthProviderRouterEntry[];
  summary: {
    total: number;
    enabled: number;
    throttled: number;
    healthy: number;
  };
  safety: {
    noRawProviderSecrets: true;
    snapshotIsNotLiveProof: true;
    routerCannotExposeApiKeys: true;
    receiptAlwaysGenerated: true;
  };
};

export type ZavorthProviderRouterContextBudgetReceipt = {
  originalTokens: number;
  compressedTokens: number;
  compressionApplied: boolean;
  truncatedMessages: number;
  systemPromptPreserved: boolean;
  recentMessagesPreserved: number;
  summarizedMessages: number;
};

export type ZavorthProviderRouterCompressedContext = {
  messages: ZavorthProviderRouterMessage[];
  receipt: ZavorthProviderRouterContextBudgetReceipt;
};
