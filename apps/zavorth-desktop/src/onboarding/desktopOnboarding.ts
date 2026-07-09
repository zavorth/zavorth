import type { DesktopApiRequest } from '../global';

export const DESKTOP_ONBOARDING_STORAGE_KEY = 'zvd:onboarded';
export const DESKTOP_TRUST_MODE_KEY = 'zvd:trusted-operator-hint';
export const DESKTOP_ONBOARDING_CELEBRATE_KEY = 'zvd:celebrate-onboarding';

export type DesktopOnboardingProvider = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'ollama';

export type DesktopOnboardingStepId = 'provider' | 'trust' | 'channel' | 'first-ask';

export type DesktopOnboardingTrailStep = {
  id: DesktopOnboardingStepId;
  label: string;
  optional?: boolean;
};

/** 4-step first-run trail (labels are defaults; UI prefers i18n). */
export const DESKTOP_ONBOARDING_TRAIL: DesktopOnboardingTrailStep[] = [
  { id: 'provider', label: 'Provider' },
  { id: 'trust', label: 'Trust' },
  { id: 'channel', label: 'Channels', optional: true },
  { id: 'first-ask', label: 'First ask' },
];

/** Safe default starter when the user finishes onboarding with "Start chatting". */
export const DESKTOP_ONBOARDING_STARTER_ASK =
  'Review this workspace for risk and propose a safe first plan I can approve step by step.';

export type OnboardingChecklistItem = {
  id: 'runtime' | 'provider' | 'model' | 'workspace' | 'identity' | 'trust';
  label: string;
  complete: boolean;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

export function markOnboardingComplete(storage?: StorageLike): void {
  resolveStorage(storage)?.setItem(DESKTOP_ONBOARDING_STORAGE_KEY, 'true');
}

export function isOnboardingComplete(storage?: StorageLike): boolean {
  return resolveStorage(storage)?.getItem(DESKTOP_ONBOARDING_STORAGE_KEY) === 'true';
}

export function setTrustedOperatorHint(enabled: boolean, storage?: StorageLike): void {
  resolveStorage(storage)?.setItem(DESKTOP_TRUST_MODE_KEY, enabled ? 'true' : 'false');
}

export function getTrustedOperatorHint(storage?: StorageLike): boolean {
  return resolveStorage(storage)?.getItem(DESKTOP_TRUST_MODE_KEY) === 'true';
}

export const DESKTOP_ONBOARDING_COMPLETE_EVENT = 'zvd:onboarding-complete';

export function markOnboardingCelebration(session?: StorageLike): void {
  const store = session ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
  store?.setItem(DESKTOP_ONBOARDING_CELEBRATE_KEY, '1');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DESKTOP_ONBOARDING_COMPLETE_EVENT));
  }
}

export function consumeOnboardingCelebration(session?: StorageLike): boolean {
  const store = session ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
  if (!store) return false;
  if (store.getItem(DESKTOP_ONBOARDING_CELEBRATE_KEY) !== '1') return false;
  store.removeItem(DESKTOP_ONBOARDING_CELEBRATE_KEY);
  return true;
}

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
