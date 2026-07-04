import type { DesktopApiRequest } from '../global';

export const DESKTOP_ONBOARDING_STORAGE_KEY = 'zvd:onboarded';

export type DesktopOnboardingProvider = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'ollama';

export type OnboardingChecklistItem = {
  id: 'runtime' | 'provider' | 'model' | 'workspace' | 'identity' | 'trust';
  label: string;
  complete: boolean;
};

export function shouldOpenDesktopOnboarding(input: {
  storedOnboarded: string | null | undefined;
  force?: boolean;
}): boolean {
  if (input.force) return true;
  return input.storedOnboarded !== 'true';
}

export function buildProviderConnectionRequest(input: {
  type: DesktopOnboardingProvider;
  displayName: string;
  baseUrl: string;
  apiKey?: string;
}): DesktopApiRequest {
  const requiresApiKey = input.type !== 'ollama';
  return {
    method: 'POST',
    path: '/api/v2/providers',
    body: {
      type: input.type,
      displayName: input.displayName,
      baseUrl: input.baseUrl,
      requiresApiKey,
      apiKey: requiresApiKey ? input.apiKey : undefined,
      enabled: true,
    },
    timeoutMs: 20000,
  };
}

export function normalizeSelectableModels(
  capabilities: unknown,
  providerType: DesktopOnboardingProvider,
): string[] {
  const maybeProviders = capabilities && typeof capabilities === 'object'
    ? (capabilities as { providers?: { selectableModelIds?: unknown } }).providers
    : undefined;
  const ids = Array.isArray(maybeProviders?.selectableModelIds)
    ? maybeProviders.selectableModelIds
    : [];
  return ids
    .filter((id): id is string => typeof id === 'string')
    .filter(id => id.startsWith(`${providerType}:`));
}

export function buildModelRoutingRequest(input: {
  selectedModel: string;
  providerType: DesktopOnboardingProvider;
  fallbackModelIds?: string[];
}): DesktopApiRequest {
  return {
    method: 'POST',
    path: '/api/experience/runtime-state/action',
    body: {
      type: 'route-model',
      approved: true,
      sessionId: 'desktop-main',
      source: 'zavorth-desktop-onboarding',
      payload: {
        dynamicRouting: {
          modelId: input.selectedModel,
          providerId: input.providerType,
          intent: 'onboarding-picker',
          reason: 'Onboarding selection',
          fallbackModelIds: input.fallbackModelIds || [],
          risk: 'low',
        },
      },
    },
    timeoutMs: 12000,
  };
}

export function buildOnboardingChecklist(input: {
  runtimeRunning: boolean;
  providerConnected: boolean;
  modelSelected: boolean;
  workspaceSelected: boolean;
  identityConfigured: boolean;
  trustPolicyConfigured: boolean;
}): OnboardingChecklistItem[] {
  return [
    { id: 'runtime', label: 'Local runtime', complete: input.runtimeRunning },
    { id: 'provider', label: 'AI provider', complete: input.providerConnected },
    { id: 'model', label: 'Primary model', complete: input.modelSelected },
    { id: 'workspace', label: 'Workspace', complete: input.workspaceSelected },
    { id: 'identity', label: 'Agent identity', complete: input.identityConfigured },
    { id: 'trust', label: 'Trust policy', complete: input.trustPolicyConfigured },
  ];
}
