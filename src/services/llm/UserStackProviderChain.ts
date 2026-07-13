/**
 * Build the LLM provider/model chain from the **user's** selection only.
 * Never invents product-default vendors.
 */

import {
  resolveUserProviderSelection,
  type UserProviderSelection,
} from '../UserSelectionResolver.js';

export type UserStackProviderHop = {
  providerName: string;
  /** Optional model pin for this hop (from provider:model fallback entries). */
  modelName: string | null;
  source: 'primary' | 'secondary_model' | 'user_fallback' | 'request' | 'options';
};

export type ResolveUserStackChainInput = {
  projectRoot?: string;
  env?: NodeJS.ProcessEnv;
  /** Explicit request provider (run options). */
  requestedProviderName?: string | null;
  /** Explicit model from request. */
  requestedModelName?: string | null;
  /** Extra fallback providers from call options (user/ops supplied). */
  optionFallbackOrder?: string[] | null;
  selection?: UserProviderSelection | null;
  normalizeProviderName?: (name: string) => string;
};

/**
 * Ordered hops: primary → optional secondary model on same provider → user fallbacks.
 */
export function resolveUserStackProviderChain(
  input: ResolveUserStackChainInput = {},
): UserStackProviderHop[] {
  const normalize = input.normalizeProviderName || ((n: string) => String(n || '').trim().toLowerCase());
  const selection = input.selection || resolveUserProviderSelection({
    projectRoot: input.projectRoot,
    env: input.env,
    requestedProviderId: input.requestedProviderName || null,
  });

  const hops: UserStackProviderHop[] = [];
  const seen = new Set<string>();

  const push = (
    providerRaw: string | null | undefined,
    modelRaw: string | null | undefined,
    source: UserStackProviderHop['source'],
  ) => {
    const providerName = normalize(String(providerRaw || '').trim());
    if (!providerName) return;
    const modelName = cleanModel(modelRaw);
    const key = `${providerName}::${modelName || '*'}`;
    if (seen.has(key)) return;
    // Also skip duplicate provider-only if we already have same provider without model pin
    // when adding another unpinned hop — still allow second hop with different model.
    seen.add(key);
    hops.push({ providerName, modelName, source });
  };

  const primaryProvider = normalize(
    String(input.requestedProviderName || selection.providerId || '').trim(),
  );
  const primaryModel = cleanModel(input.requestedModelName) || cleanModel(selection.modelId);

  if (primaryProvider) {
    push(primaryProvider, primaryModel, input.requestedProviderName ? 'request' : 'primary');
  }

  // Secondary model on the same primary provider (diversity / soft failover)
  const secondary = cleanModel(selection.secondaryModelId);
  if (primaryProvider && secondary && secondary !== primaryModel) {
    push(primaryProvider, secondary, 'secondary_model');
  }

  // Explicit option fallbacks (caller-supplied, still user/ops — not product catalog)
  for (const entry of input.optionFallbackOrder || []) {
    const parsed = parseProviderModelEntry(entry);
    if (!parsed.provider) continue;
    push(parsed.provider, parsed.model, 'options');
  }

  // User preference / env fallback list
  for (const entry of selection.fallbackProviderIds || []) {
    const parsed = parseProviderModelEntry(entry);
    if (!parsed.provider) continue;
    push(parsed.provider, parsed.model, 'user_fallback');
  }

  return hops;
}

/**
 * Unique provider order for LlmRuntime outer loop (models handled per provider).
 */
export function uniqueProvidersFromHops(hops: UserStackProviderHop[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const hop of hops) {
    if (seen.has(hop.providerName)) continue;
    seen.add(hop.providerName);
    out.push(hop.providerName);
  }
  return out;
}

/**
 * Models to try for a given provider from the hop list (primary model first).
 */
export function modelsForProvider(
  hops: UserStackProviderHop[],
  providerName: string,
  normalizeProviderName: (n: string) => string = (n) => n.toLowerCase(),
): Array<string | null> {
  const target = normalizeProviderName(providerName);
  const models: Array<string | null> = [];
  const seen = new Set<string>();
  for (const hop of hops) {
    if (normalizeProviderName(hop.providerName) !== target) continue;
    const key = hop.modelName || '*';
    if (seen.has(key)) continue;
    seen.add(key);
    models.push(hop.modelName);
  }
  return models.length > 0 ? models : [null];
}

export function parseProviderModelEntry(raw: string): {
  provider: string | null;
  model: string | null;
} {
  const text = String(raw || '').trim();
  if (!text) return { provider: null, model: null };
  // provider:model or provider/model
  const sep = text.includes(':') ? ':' : text.includes('/') ? '/' : null;
  if (!sep) {
    return { provider: text, model: null };
  }
  const idx = text.indexOf(sep);
  const provider = text.slice(0, idx).trim() || null;
  const model = text.slice(idx + 1).trim() || null;
  return { provider, model };
}

function cleanModel(value: unknown): string | null {
  const s = String(value ?? '').trim();
  if (!s || s === 'null' || s === 'undefined' || s === 'none') return null;
  return s;
}
