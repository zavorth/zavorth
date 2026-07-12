import fs from 'node:fs';
import path from 'node:path';

/**
 * Single source of truth for user-chosen provider/model/channel.
 * Never invents gemini, telegram, or aigateway when the user has not chosen.
 */

export type UserProviderSelection = {
  providerId: string | null;
  modelId: string | null;
  routeId: string | null;
  familyId: string | null;
  secondaryModelId: string | null;
  fallbackProviderIds: string[];
  source: 'request' | 'env' | 'preference' | 'none';
  configured: boolean;
};

export type UserChannelSelection = {
  channelId: string | null;
  source: 'request' | 'env' | 'preference' | 'none';
  configured: boolean;
};

type ProviderPreferenceFile = {
  providerId?: string;
  modelId?: string | null;
  secondaryModelId?: string | null;
  routeId?: string | null;
  familyId?: string | null;
  fallbackProviderIds?: string[] | null;
  /** Optional governed-path metadata preserved across writers. */
  source?: string | null;
  updatedAt?: string | null;
  receiptId?: string | null;
};

type ChannelPreferenceFile = {
  channelId?: string | null;
};

function projectRootFromCwd(): string {
  return process.cwd();
}

function preferencePath(root: string, file: string): string {
  return path.join(root, 'data', 'runtime', file);
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function normalizeId(value: unknown): string | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'unconfigured' || normalized === 'none' || normalized === 'null') return null;
  return normalized;
}

function envFirst(env: NodeJS.ProcessEnv, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = normalizeId(env[key]);
    if (value) return value;
  }
  return null;
}

function parseFallbackList(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(raw).split(/[,\s]+/)) {
    const id = normalizeId(part);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function readProviderPreference(projectRoot?: string): ProviderPreferenceFile | null {
  const root = projectRoot || projectRootFromCwd();
  return readJsonFile<ProviderPreferenceFile>(
    preferencePath(root, 'provider-selection-preferences.json'),
  );
}

export function readChannelPreference(projectRoot?: string): ChannelPreferenceFile | null {
  const root = projectRoot || projectRootFromCwd();
  return readJsonFile<ChannelPreferenceFile>(
    preferencePath(root, 'channel-selection-preferences.json'),
  );
}

function atomicWriteJson(file: string, payload: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmpPath = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(tmpPath, file);
}

function removePreferenceFile(file: string): void {
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch {
    // Best-effort clear: missing file already means unconfigured.
  }
}

export function writeChannelPreference(
  channelId: string,
  projectRoot?: string,
): UserChannelSelection {
  const root = projectRoot || projectRootFromCwd();
  const file = preferencePath(root, 'channel-selection-preferences.json');
  const normalized = normalizeId(channelId);
  if (!normalized) {
    // Empty / unconfigured / none must clear persisted preference so all
    // surfaces (Code, Control, Desktop) observe the same unconfigured state.
    removePreferenceFile(file);
    return { channelId: null, source: 'none', configured: false };
  }
  atomicWriteJson(file, { channelId: normalized });
  return { channelId: normalized, source: 'preference', configured: true };
}

export type WriteProviderPreferenceInput = {
  providerId: string;
  modelId?: string | null;
  secondaryModelId?: string | null;
  routeId?: string | null;
  familyId?: string | null;
  fallbackProviderIds?: string[] | null;
  projectRoot?: string;
};

/**
 * Persist user provider selection to the same preference file the runtime reads.
 * Does not invent Gemini/Telegram defaults.
 */
export function writeProviderPreference(input: WriteProviderPreferenceInput): UserProviderSelection {
  const root = input.projectRoot || projectRootFromCwd();
  const file = preferencePath(root, 'provider-selection-preferences.json');
  const providerId = normalizeId(input.providerId);
  if (!providerId) {
    // Mirror channel clear: empty / unconfigured must drop the preference file
    // so resolvers do not keep serving a prior surface's selection.
    removePreferenceFile(file);
    return {
      providerId: null,
      modelId: null,
      routeId: null,
      familyId: null,
      secondaryModelId: null,
      fallbackProviderIds: [],
      source: 'none',
      configured: false,
    };
  }

  const previous = readProviderPreference(root) || {};
  // undefined = keep previous; null/empty = clear (aligned with secondary/route).
  const next: ProviderPreferenceFile = {
    // Preserve governed-path metadata when present so dual writers do not clobber receipts.
    ...previous,
    providerId,
    modelId: input.modelId === undefined
      ? normalizeId(previous.modelId)
      : normalizeId(input.modelId),
    secondaryModelId: input.secondaryModelId === undefined
      ? normalizeId(previous.secondaryModelId)
      : normalizeId(input.secondaryModelId),
    routeId: input.routeId === undefined
      ? normalizeId(previous.routeId)
      : normalizeId(input.routeId),
    familyId: input.familyId === undefined
      ? normalizeId(previous.familyId)
      : normalizeId(input.familyId),
    fallbackProviderIds: Array.isArray(input.fallbackProviderIds)
      ? input.fallbackProviderIds.map(normalizeId).filter(Boolean) as string[]
      : Array.isArray(previous.fallbackProviderIds)
        ? previous.fallbackProviderIds.map(normalizeId).filter(Boolean) as string[]
        : [],
    updatedAt: new Date().toISOString(),
    source: typeof previous.source === 'string' && previous.source
      ? previous.source
      : 'user-selection-direct',
  };

  atomicWriteJson(file, next);

  return {
    providerId: next.providerId || providerId,
    modelId: next.modelId || null,
    routeId: next.routeId || null,
    familyId: next.familyId || null,
    secondaryModelId: next.secondaryModelId || null,
    fallbackProviderIds: next.fallbackProviderIds || [],
    source: 'preference',
    configured: true,
  };
}

/** Combined read of provider + channel selection for product UIs. */
export function resolveUserSelectionBundle(input: {
  projectRoot?: string;
  env?: NodeJS.ProcessEnv;
} = {}): {
  provider: UserProviderSelection;
  channel: UserChannelSelection;
} {
  return {
    provider: resolveUserProviderSelection({
      projectRoot: input.projectRoot,
      env: input.env,
    }),
    channel: resolveUserChannelSelection({
      projectRoot: input.projectRoot,
      env: input.env,
    }),
  };
}

/**
 * Resolve the provider the user has chosen. Never falls back to gemini/aigateway.
 */
export function resolveUserProviderSelection(input: {
  projectRoot?: string;
  requestedProviderId?: string | null;
  configProviderId?: string | null;
  env?: NodeJS.ProcessEnv;
} = {}): UserProviderSelection {
  const env = input.env || process.env;
  const requested = normalizeId(input.requestedProviderId);
  if (requested) {
    return completeProviderSelection(requested, input.projectRoot, 'request', env);
  }

  const fromEnv = envFirst(env, 'LLM_PROVIDER', 'ZAVORTH_PROVIDER', 'ZAVORTH_LLM_PROVIDER');
  if (fromEnv) {
    return completeProviderSelection(fromEnv, input.projectRoot, 'env', env);
  }

  const fromConfig = normalizeId(input.configProviderId);
  // Treat forced legacy defaults as "not a real user choice" if preference exists.
  const preference = readProviderPreference(input.projectRoot);
  const preferred = normalizeId(preference?.providerId);
  if (preferred) {
    return {
      providerId: preferred,
      modelId: normalizeId(preference?.modelId)
        || envFirst(env, 'ZAVORTH_MODEL_ID', 'ZAVORTH_MODEL')
        || null,
      routeId: normalizeId(preference?.routeId)
        || envFirst(env, 'ZAVORTH_MODEL_ROUTE_ID', 'ZAVORTH_MODEL_ROUTE')
        || null,
      familyId: normalizeId(preference?.familyId)
        || envFirst(env, 'ZAVORTH_MODEL_FAMILY_ID', 'ZAVORTH_MODEL_FAMILY')
        || null,
      secondaryModelId: normalizeId(preference?.secondaryModelId)
        || envFirst(env, 'ZAVORTH_SECONDARY_MODEL_ID', 'ZAVORTH_SECONDARY_MODEL')
        || null,
      fallbackProviderIds: Array.isArray(preference?.fallbackProviderIds)
        ? preference!.fallbackProviderIds!.map(normalizeId).filter(Boolean) as string[]
        : parseFallbackList(env.ZAVORTH_ECHO_LLM_FALLBACK_ORDER || env.ZAVORTH_PROVIDER_FALLBACK_ORDER),
      source: 'preference',
      configured: true,
    };
  }

  if (fromConfig && fromConfig !== 'aigateway' && fromConfig !== 'gemini') {
    return completeProviderSelection(fromConfig, input.projectRoot, 'env', env);
  }

  // Allow explicit aigateway/gemini only when set via env (already handled) or config
  // when preference is absent but config was intentionally set by applySelection.
  if (fromConfig) {
    return completeProviderSelection(fromConfig, input.projectRoot, 'env', env);
  }

  return {
    providerId: null,
    modelId: null,
    routeId: null,
    familyId: null,
    secondaryModelId: null,
    fallbackProviderIds: parseFallbackList(
      env.ZAVORTH_ECHO_LLM_FALLBACK_ORDER || env.ZAVORTH_PROVIDER_FALLBACK_ORDER,
    ),
    source: 'none',
    configured: false,
  };
}

function completeProviderSelection(
  providerId: string,
  projectRoot: string | undefined,
  source: UserProviderSelection['source'],
  env: NodeJS.ProcessEnv,
): UserProviderSelection {
  const preference = readProviderPreference(projectRoot);
  return {
    providerId,
    modelId: normalizeId(preference?.modelId)
      || envFirst(env, 'ZAVORTH_MODEL_ID', 'ZAVORTH_MODEL')
      || null,
    routeId: normalizeId(preference?.routeId)
      || envFirst(env, 'ZAVORTH_MODEL_ROUTE_ID', 'ZAVORTH_MODEL_ROUTE')
      || null,
    familyId: normalizeId(preference?.familyId)
      || envFirst(env, 'ZAVORTH_MODEL_FAMILY_ID', 'ZAVORTH_MODEL_FAMILY')
      || null,
    secondaryModelId: normalizeId(preference?.secondaryModelId)
      || envFirst(env, 'ZAVORTH_SECONDARY_MODEL_ID', 'ZAVORTH_SECONDARY_MODEL')
      || null,
    fallbackProviderIds: Array.isArray(preference?.fallbackProviderIds)
      ? (preference!.fallbackProviderIds!.map(normalizeId).filter(Boolean) as string[])
      : parseFallbackList(env.ZAVORTH_ECHO_LLM_FALLBACK_ORDER || env.ZAVORTH_PROVIDER_FALLBACK_ORDER),
    source,
    configured: true,
  };
}

/**
 * Resolve the channel the user has chosen. Never falls back to telegram.
 */
export function resolveUserChannelSelection(input: {
  projectRoot?: string;
  requestedChannelId?: string | null;
  env?: NodeJS.ProcessEnv;
} = {}): UserChannelSelection {
  const env = input.env || process.env;
  const requested = normalizeId(input.requestedChannelId);
  if (requested) {
    return { channelId: requested, source: 'request', configured: true };
  }
  const fromEnv = envFirst(env, 'ZAVORTH_PRIMARY_CHANNEL', 'ZAVORTH_CHANNEL', 'DEFAULT_CHANNEL');
  if (fromEnv) {
    return { channelId: fromEnv, source: 'env', configured: true };
  }
  const preference = readChannelPreference(input.projectRoot);
  const preferred = normalizeId(preference?.channelId);
  if (preferred) {
    return { channelId: preferred, source: 'preference', configured: true };
  }
  return { channelId: null, source: 'none', configured: false };
}

/** Never invent a provider id. */
export function resolveConfiguredProviderName(input?: {
  projectRoot?: string;
  requestedProviderId?: string | null;
  configProviderId?: string | null;
  fallback?: string | null;
  env?: NodeJS.ProcessEnv;
}): string | null {
  const selection = resolveUserProviderSelection(input || {});
  if (selection.providerId) return selection.providerId;
  const explicitFallback = normalizeId(input?.fallback);
  return explicitFallback;
}

export function requireConfiguredProviderName(input?: {
  projectRoot?: string;
  requestedProviderId?: string | null;
  configProviderId?: string | null;
  env?: NodeJS.ProcessEnv;
}): string {
  const name = resolveConfiguredProviderName(input);
  if (!name) {
    throw new Error(
      'No provider selected. Choose one with `zavorth providers switch` or setup, then retry.',
    );
  }
  return name;
}

export function describeUnconfiguredProvider(): string {
  return 'not configured';
}

export function describeUnconfiguredChannel(): string {
  return 'not configured';
}
