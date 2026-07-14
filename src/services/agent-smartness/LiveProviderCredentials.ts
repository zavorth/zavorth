import { resolveUserProviderSelection, type UserProviderSelection } from '../UserSelectionResolver.js';

export type LiveProviderFamily = 'gemini' | 'openai' | 'anthropic';

export type ResolvedLiveCredentials = {
  family: LiveProviderFamily | null;
  providerId: string;
  modelId: string;
  apiKey: string;
  selection: UserProviderSelection;
  credentialSource: 'selection' | 'single-key-infer' | 'none';
  reason?: string;
};

export const DEFAULT_LIVE_PROVIDER_MODELS: Record<LiveProviderFamily, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
};

export function liveProviderFamilyFromId(
  providerId: string | null | undefined,
): LiveProviderFamily | null {
  const id = String(providerId || '').trim().toLowerCase();
  if (!id) return null;
  if (id === 'gemini' || id === 'gemma' || id === 'google' || id === 'google-ai-studio' || id.includes('gemini')) {
    return 'gemini';
  }
  if (id === 'openai' || id === 'oa' || id.startsWith('openai')) return 'openai';
  if (id === 'anthropic' || id === 'claude' || id.includes('anthropic')) return 'anthropic';
  return null;
}

function keyForFamily(family: LiveProviderFamily, env: NodeJS.ProcessEnv): string {
  if (family === 'gemini') return String(env.GEMINI_API_KEY || env.GOOGLE_API_KEY || '').trim();
  if (family === 'openai') return String(env.OPENAI_API_KEY || '').trim();
  return String(env.ANTHROPIC_API_KEY || '').trim();
}

function availableKeyFamilies(env: NodeJS.ProcessEnv): LiveProviderFamily[] {
  return (['gemini', 'openai', 'anthropic'] as const)
    .filter((family) => keyForFamily(family, env).length >= 12);
}

/** Resolve credentials without silently overriding the provider chosen by the user. */
export function resolveLiveCredentials(input: {
  projectRoot?: string;
  env?: NodeJS.ProcessEnv;
}): ResolvedLiveCredentials {
  const env = input.env || process.env;
  const selection = resolveUserProviderSelection({ projectRoot: input.projectRoot, env });
  const selectedFamily = liveProviderFamilyFromId(selection.providerId);
  const available = availableKeyFamilies(env);

  if (selectedFamily) {
    const apiKey = keyForFamily(selectedFamily, env);
    if (apiKey.length < 12) {
      return {
        family: selectedFamily,
        providerId: selection.providerId || selectedFamily,
        modelId: selection.modelId || DEFAULT_LIVE_PROVIDER_MODELS[selectedFamily],
        apiKey: '',
        selection,
        credentialSource: 'none',
        reason: `Provider "${selection.providerId}" is selected but no matching API key is configured.`,
      };
    }
    return {
      family: selectedFamily,
      providerId: selection.providerId || selectedFamily,
      modelId: selection.modelId || DEFAULT_LIVE_PROVIDER_MODELS[selectedFamily],
      apiKey,
      selection,
      credentialSource: 'selection',
    };
  }

  if (available.length === 1) {
    const family = available[0];
    return {
      family,
      providerId: family,
      modelId: DEFAULT_LIVE_PROVIDER_MODELS[family],
      apiKey: keyForFamily(family, env),
      selection,
      credentialSource: 'single-key-infer',
    };
  }

  const ambiguous = available.length > 1;
  return {
    family: null,
    providerId: 'unconfigured',
    modelId: '',
    apiKey: '',
    selection,
    credentialSource: 'none',
    reason: ambiguous
      ? 'Multiple provider keys present and no user provider selected. Set LLM_PROVIDER / preference or leave a single key family.'
      : 'No provider selected and no API keys found (OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY).',
  };
}
