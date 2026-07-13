/**
 * Phase 2: pick a cheaper hop from the **user** provider stack for background work.
 * Never invents product catalog models.
 */

import {
  resolveUserStackProviderChain,
  type UserStackProviderHop,
} from './UserStackProviderChain.js';
import {
  resolveUserProviderSelection,
  type UserProviderSelection,
} from '../UserSelectionResolver.js';

export type CheapUserStackPick = {
  providerName: string | null;
  modelName: string | null;
  source: string;
  reason: string;
};

/** Lower = cheaper heuristic (no live price API required). */
const PROVIDER_CHEAPNESS: Record<string, number> = {
  ollama: 0,
  lmstudio: 1,
  vllm: 2,
  'custom-openai-compatible': 3,
  local: 3,
  groq: 4,
  deepseek: 5,
  gemini: 6,
  google: 6,
  mistral: 7,
  xai: 8,
  openrouter: 9,
  cerebras: 10,
  openai: 20,
  anthropic: 22,
};

export type ResolveCheapUserStackInput = {
  projectRoot?: string;
  env?: NodeJS.ProcessEnv;
  selection?: UserProviderSelection | null;
  /**
   * When true (default), honor ZAVORTH_BACKGROUND_MODEL if it matches the user stack
   * (or if the stack is empty — env is still user config).
   */
  preferEnvBackground?: boolean;
};

/**
 * Choose the cheapest hop on the user's stack for background / fast routes.
 */
export function resolveCheapUserStackHop(
  input: ResolveCheapUserStackInput = {},
): CheapUserStackPick {
  const env = input.env || process.env;
  const selection = input.selection || resolveUserProviderSelection({
    projectRoot: input.projectRoot,
    env,
  });

  const hops = resolveUserStackProviderChain({
    selection,
    env,
    normalizeProviderName: (n) => String(n || '').trim().toLowerCase(),
  });

  const envPick = readEnvBackground(env);
  if (envPick.modelName && input.preferEnvBackground !== false) {
    if (hops.length === 0) {
      return {
        providerName: envPick.providerName,
        modelName: envPick.modelName,
        source: 'env.background',
        reason: 'Using ZAVORTH_BACKGROUND_MODEL from environment (user-configured).',
      };
    }
    const modelOnStack = hops.find((h) => h.modelName === envPick.modelName);
    const providerOnStack = envPick.providerName
      ? hops.find((h) => h.providerName === envPick.providerName)
      : null;
    if (modelOnStack || providerOnStack) {
      return {
        providerName:
          envPick.providerName
          || modelOnStack?.providerName
          || providerOnStack?.providerName
          || null,
        modelName: envPick.modelName,
        source: 'env.background.on_stack',
        reason: 'ZAVORTH_BACKGROUND_MODEL matches a hop on the user stack.',
      };
    }
    // Env points off-stack — ignore (do not invent foreign vendors).
  }

  if (hops.length === 0) {
    return {
      providerName: null,
      modelName: null,
      source: 'none',
      reason: 'No user stack hops; cannot suggest a cheap model without inventing one.',
    };
  }

  // Prefer non-primary hops for background (secondary / fallbacks).
  const candidates = hops.filter((h) => h.source !== 'primary' && h.source !== 'request');
  if (candidates.length === 0) {
    return {
      providerName: null,
      modelName: null,
      source: 'primary_only',
      reason: 'User stack has only the primary hop; keeping selected model for background work.',
    };
  }

  const ranked = [...candidates].sort((a, b) => scoreHop(a) - scoreHop(b));
  const best = ranked[0];

  return {
    providerName: best.providerName,
    modelName: best.modelName,
    source: best.source,
    reason: `Background route picks user-stack hop ${best.providerName}/${best.modelName || 'default'} (${best.source}).`,
  };
}

function scoreHop(hop: UserStackProviderHop): number {
  const providerScore = PROVIDER_CHEAPNESS[hop.providerName] ?? 15;
  const sourceBias =
    hop.source === 'secondary_model' ? 0
      : hop.source === 'user_fallback' ? 1
        : hop.source === 'options' ? 2
          : 10;
  const modelBias = hop.modelName ? 0 : 3;
  return providerScore + sourceBias + modelBias;
}

function readEnvBackground(env: NodeJS.ProcessEnv): {
  modelName: string | null;
  providerName: string | null;
} {
  const modelName = clean(env.ZAVORTH_BACKGROUND_MODEL) || clean(env.ZAVORTH_FAST_MODEL);
  const providerRaw = clean(env.ZAVORTH_BACKGROUND_PROVIDER) || clean(env.ZAVORTH_FAST_PROVIDER);
  return {
    modelName,
    providerName: providerRaw ? providerRaw.toLowerCase() : null,
  };
}

function clean(value: unknown): string | null {
  const s = String(value ?? '').trim();
  return s || null;
}
