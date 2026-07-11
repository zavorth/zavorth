/**
 * Single product catalog for provider/channel selection.
 * Desktop onboarding, Desktop settings, and Control settings must share this list.
 * Never invents a default vendor for the user.
 */

export type UserSelectionProviderOption = {
  id: string;
  label: string;
  /** Suggested primary models (user may type any id). */
  models: string[];
  /** Maps onboarding legacy id when different (e.g. google → gemini). */
  onboardingId?: string;
};

export type UserSelectionChannelOption = {
  id: string;
  label: string;
  /** Optional product surfaces that always make sense. */
  surface?: 'local' | 'external';
};

/** Canonical provider options for product UI (not full mesh catalog). */
export const USER_SELECTION_PROVIDERS: UserSelectionProviderOption[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1'],
    onboardingId: 'openai',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-latest'],
    onboardingId: 'anthropic',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    onboardingId: 'google',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    models: ['openrouter/auto'],
    onboardingId: 'openrouter',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    models: ['llama3.2', 'qwen2.5'],
    onboardingId: 'ollama',
  },
  {
    id: 'xai',
    label: 'xAI',
    models: ['grok-2'],
    onboardingId: 'xai',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    models: ['deepseek-chat'],
    onboardingId: 'deepseek',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    models: ['mistral-large-latest'],
    onboardingId: 'mistral',
  },
  {
    id: 'groq',
    label: 'Groq',
    models: ['llama-3.3-70b-versatile'],
    onboardingId: 'groq',
  },
  {
    id: 'custom-openai-compatible',
    label: 'Custom (OpenAI-compatible)',
    models: [],
    onboardingId: 'custom',
  },
];

/** Canonical primary-channel options for product UI. */
export const USER_SELECTION_CHANNELS: UserSelectionChannelOption[] = [
  { id: 'desktop', label: 'Desktop', surface: 'local' },
  { id: 'cli', label: 'CLI / Code', surface: 'local' },
  { id: 'control', label: 'Control', surface: 'local' },
  { id: 'discord', label: 'Discord', surface: 'external' },
  { id: 'slack', label: 'Slack', surface: 'external' },
  { id: 'telegram', label: 'Telegram', surface: 'external' },
  { id: 'whatsapp', label: 'WhatsApp', surface: 'external' },
];

export function listUserSelectionProviders(): UserSelectionProviderOption[] {
  return USER_SELECTION_PROVIDERS.slice();
}

export function listUserSelectionChannels(): UserSelectionChannelOption[] {
  return USER_SELECTION_CHANNELS.slice();
}

export function findUserSelectionProvider(id: string | null | undefined): UserSelectionProviderOption | null {
  const normalized = String(id || '').trim().toLowerCase();
  if (!normalized) return null;
  return (
    USER_SELECTION_PROVIDERS.find(
      (entry) => entry.id === normalized || entry.onboardingId === normalized,
    ) || null
  );
}

/** Map onboarding provider id → runtime preference provider id. */
export function onboardingProviderToRuntimeId(onboardingId: string): string {
  const found = USER_SELECTION_PROVIDERS.find((entry) => entry.onboardingId === onboardingId);
  if (found) return found.id;
  const byId = findUserSelectionProvider(onboardingId);
  return byId?.id || onboardingId;
}

/** Map runtime provider id → onboarding option id when present. */
export function runtimeProviderToOnboardingId(providerId: string): string {
  const found = findUserSelectionProvider(providerId);
  return found?.onboardingId || found?.id || providerId;
}
