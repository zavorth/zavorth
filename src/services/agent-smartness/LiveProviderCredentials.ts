import { resolveUserProviderSelection, type UserProviderSelection } from '../UserSelectionResolver.js';
import { providerCatalogRegistry } from '../providers/catalog/ProviderCatalogRegistry.js';
import { getLiveProviderDefaults } from '../../config/index.js';

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
  gemini: getLiveProviderDefaults('gemini').model,
  openai: getLiveProviderDefaults('openai').model,
  anthropic: getLiveProviderDefaults('anthropic').model,
};

const GEMINI_FAMILY_IDS = new Set(['gemma', 'google', 'google-ai-studio', 'google-genai', 'gemini-interactions']);
const OPENAI_FAMILY_IDS = new Set(['oa', 'openai-compatible']);
const ANTHROPIC_FAMILY_IDS = new Set(['claude', 'anthropic-direct', 'anthropic-vertex', 'bedrock-claude']);

export function liveProviderFamilyFromId(
  providerId: string | null | undefined,
): LiveProviderFamily | null {
  const id = String(providerId || '').trim().toLowerCase();
  if (!id) return null;
  const catalogEntry = providerCatalogRegistry.get(id);
  if (catalogEntry) {
    if (catalogEntry.protocol === 'gemini_native') return 'gemini';
    if (catalogEntry.protocol === 'claude_native' || catalogEntry.protocol === 'anthropic') return 'anthropic';
    if (catalogEntry.id === 'openai') return 'openai';
  }
  if (GEMINI_FAMILY_IDS.has(id)) return 'gemini';
  if (ANTHROPIC_FAMILY_IDS.has(id)) return 'anthropic';
  if (OPENAI_FAMILY_IDS.has(id)) return 'openai';
  return null;
}

function keyForFamily(family: 'gemini' | 'openai' | 'anthropic', env: NodeJS.ProcessEnv): string {
  if (family === 'gemini') return String(env.GEMINI_API_KEY || env.GOOGLE_API_KEY || '').trim();
  if (family === 'openai') return String(env.OPENAI_API_KEY || '').trim();
  return String(env.ANTHROPIC_API_KEY || '').trim();
}

function availableKeyFamilies(env: NodeJS.ProcessEnv): ('gemini' | 'openai' | 'anthropic')[] {
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
        modelId: selection.modelId || getLiveProviderDefaults(selectedFamily).model,
        apiKey: '',
        selection,
        credentialSource: 'none',
        reason: `Provider "${selection.providerId}" is selected but no matching API key is configured.`,
      };
    }
    return {
      family: selectedFamily,
      providerId: selection.providerId || selectedFamily,
      modelId: selection.modelId || getLiveProviderDefaults(selectedFamily).model,
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
      modelId: getLiveProviderDefaults(family).model,
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
    reason: ambiguous ? 'Multiple provider keys present and no user provider selected. Set LLM_PROVIDER / preference or leave a single key family.'
      : 'No provider selected and no API keys found (OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY).',
  };
}
