/**
 * Desktop adapter for the monorepo selection catalog.
 * Provider/channel data lives only in UserSelectionCatalog; onboarding and
 * settings consume this adapter so their options cannot drift.
 */
import {
  USER_SELECTION_PROVIDERS,
} from '../../../../src/services/selection/UserSelectionCatalog';

export {
  USER_SELECTION_CHANNELS,
  USER_SELECTION_PROVIDERS,
  findUserSelectionProvider,
  listUserSelectionChannels,
  listUserSelectionProviders,
  onboardingProviderToRuntimeId,
  runtimeProviderToOnboardingId,
} from '../../../../src/services/selection/UserSelectionCatalog';

export type {
  UserSelectionChannelOption,
  UserSelectionProviderOption,
} from '../../../../src/services/selection/UserSelectionCatalog';

export type DesktopOnboardingProviderId =
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'xai'
  | 'deepseek'
  | 'mistral'
  | 'groq'
  | 'together'
  | 'perplexity'
  | 'cohere'
  | 'azure'
  | 'ollama'
  | 'custom';

export const DESKTOP_ONBOARDING_PROVIDER_IDS: DesktopOnboardingProviderId[] =
  USER_SELECTION_PROVIDERS.map(
    (provider) => provider.onboardingId || provider.id,
  ) as DesktopOnboardingProviderId[];
