import type { DesktopApiRequest } from '../global';
import {
  DESKTOP_ONBOARDING_PROVIDER_IDS,
  type DesktopOnboardingProviderId,
} from '../selection/userSelectionCatalog';

export const DESKTOP_ONBOARDING_STORAGE_KEY = 'zvd:onboarded';
export const DESKTOP_TRUST_MODE_KEY = 'zvd:trusted-operator-hint';
export const DESKTOP_ONBOARDING_CELEBRATE_KEY = 'zvd:celebrate-onboarding';
export const DESKTOP_AUDIENCE_STORAGE_KEY = 'zvd:experience-audience';

/** Shared with settings via userSelectionCatalog (single provider schema). */
export type DesktopOnboardingProvider = DesktopOnboardingProviderId;

export const DESKTOP_ONBOARDING_PROVIDERS = DESKTOP_ONBOARDING_PROVIDER_IDS;

/** First-run audience ids (maps 1:1 to config/profile-manifests). */
export type DesktopOnboardingAudienceId = 'personal' | 'developer' | 'business';

export type DesktopOnboardingStepId = 'audience' | 'provider' | 'trust' | 'channel' | 'first-ask';

export type DesktopOnboardingTrailStep = {
  id: DesktopOnboardingStepId;
  label: string;
  optional?: boolean;
};

export const DESKTOP_ONBOARDING_TRAIL: DesktopOnboardingTrailStep[] = [
  { id: 'audience', label: 'Audience' },
  { id: 'provider', label: 'Provider' },
  { id: 'trust', label: 'Trust' },
  { id: 'channel', label: 'Channels', optional: true },
  { id: 'first-ask', label: 'First ask' },
];

export type DesktopOnboardingAudienceOption = {
  id: DesktopOnboardingAudienceId;
  /** i18n key suffix under onboarding.audience.* */
  titleKey: string;
  bodyKey: string;
  /** i18n key for first-ask starter (device language). */
  starterAskKey: string;
  /** English fallback when i18n key is missing. */
  starterAsk: string;
};

export const DESKTOP_ONBOARDING_AUDIENCES: DesktopOnboardingAudienceOption[] = [
  {
    id: 'personal',
    titleKey: 'onboarding.audiencePersonalTitle',
    bodyKey: 'onboarding.audiencePersonalBody',
    starterAskKey: 'onboarding.starterPersonal',
    starterAsk:
      'In plain language, explain what this project does and suggest three useful things you can help me with today without changing any files.',
  },
  {
    id: 'developer',
    titleKey: 'onboarding.audienceDeveloperTitle',
    bodyKey: 'onboarding.audienceDeveloperBody',
    starterAskKey: 'onboarding.starterDeveloper',
    starterAsk:
      'Review this workspace for risk and propose a safe first plan I can approve step by step.',
  },
  {
    id: 'business',
    titleKey: 'onboarding.audienceBusinessTitle',
    bodyKey: 'onboarding.audienceBusinessBody',
    starterAskKey: 'onboarding.starterBusiness',
    starterAsk:
      'Summarize what this workspace is for in business terms, list the top risks that need approval, and suggest one read-only next step.',
  },
];

export const DESKTOP_ONBOARDING_STARTER_ASK =
  DESKTOP_ONBOARDING_AUDIENCES.find((entry) => entry.id === 'personal')!.starterAsk;

export function isDesktopOnboardingAudienceId(value: unknown): value is DesktopOnboardingAudienceId {
  return value === 'personal' || value === 'developer' || value === 'business';
}

export function getAudienceOption(id: DesktopOnboardingAudienceId | null | undefined): DesktopOnboardingAudienceOption {
  const normalized = isDesktopOnboardingAudienceId(id) ? id : 'personal';
  return DESKTOP_ONBOARDING_AUDIENCES.find((entry) => entry.id === normalized)
    || DESKTOP_ONBOARDING_AUDIENCES[0];
}

/**
 * Resolve starter ask text. Prefer a device-language translator when provided.
 */
export function starterAskForAudience(
  id: DesktopOnboardingAudienceId | null | undefined,
  translate?: (key: string) => string,
): string {
  const option = getAudienceOption(id);
  if (translate) {
    const localized = translate(option.starterAskKey);
    if (localized && localized !== option.starterAskKey) {
      return localized;
    }
  }
  return option.starterAsk;
}

export function setOnboardingAudience(id: DesktopOnboardingAudienceId, storage?: StorageLike): void {
  const normalized = isDesktopOnboardingAudienceId(id) ? id : 'personal';
  resolveStorage(storage)?.setItem(DESKTOP_AUDIENCE_STORAGE_KEY, normalized);
}

export function getOnboardingAudience(storage?: StorageLike): DesktopOnboardingAudienceId {
  const raw = resolveStorage(storage)?.getItem(DESKTOP_AUDIENCE_STORAGE_KEY);
  return isDesktopOnboardingAudienceId(raw) ? raw : 'personal';
}

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
