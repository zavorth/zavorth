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

function envFirst(...keys: string[]): string | null {
  for (const key of keys) {
    const value = normalizeId(process.env[key]);
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

export function writeChannelPreference(
  channelId: string,
  projectRoot?: string,
): UserChannelSelection {
  const root = projectRoot || projectRootFromCwd();
  const file = preferencePath(root, 'channel-selection-preferences.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const normalized = normalizeId(channelId);
  if (!normalized) {
    return { channelId: null, source: 'none', configured: false };
  }
  fs.writeFileSync(file, `${JSON.stringify({ channelId: normalized }, null, 2)}\n`, 'utf8');
  return { channelId: normalized, source: 'preference', configured: true };
}

/**
 * Resolve the provider the user has chosen. Never falls back to gemini/aigateway.
 */
export function resolveUserProviderSelection(input: {
  projectRoot?: string;
  requestedProviderId?: string | null;
  configProviderId?: string | null;
} = {}): UserProviderSelection {
  const requested = normalizeId(input.requestedProviderId);
  if (requested) {
    return completeProviderSelection(requested, input.projectRoot, 'request');
  }

  const fromEnv = envFirst('LLM_PROVIDER', 'ZAVORTH_PROVIDER', 'ZAVORTH_LLM_PROVIDER');
  if (fromEnv) {
    return completeProviderSelection(fromEnv, input.projectRoot, 'env');
  }

  const fromConfig = normalizeId(input.configProviderId);
  // Treat forced legacy defaults as "not a real user choice" if preference exists.
  const preference = readProviderPreference(input.projectRoot);
  const preferred = normalizeId(preference?.providerId);
  if (preferred) {
    return {
      providerId: preferred,
      modelId: normalizeId(preference?.modelId)
        || envFirst('ZAVORTH_MODEL_ID', 'ZAVORTH_MODEL')
        || null,
      routeId: normalizeId(preference?.routeId)
        || envFirst('ZAVORTH_MODEL_ROUTE_ID', 'ZAVORTH_MODEL_ROUTE')
        || null,
      familyId: normalizeId(preference?.familyId)
        || envFirst('ZAVORTH_MODEL_FAMILY_ID', 'ZAVORTH_MODEL_FAMILY')
        || null,
      secondaryModelId: normalizeId(preference?.secondaryModelId)
        || envFirst('ZAVORTH_SECONDARY_MODEL_ID', 'ZAVORTH_SECONDARY_MODEL')
        || null,
      fallbackProviderIds: Array.isArray(preference?.fallbackProviderIds)
        ? preference!.fallbackProviderIds!.map(normalizeId).filter(Boolean) as string[]
        : parseFallbackList(process.env.ZAVORTH_ECHO_LLM_FALLBACK_ORDER || process.env.ZAVORTH_PROVIDER_FALLBACK_ORDER),
      source: 'preference',
      configured: true,
    };
  }

  if (fromConfig && fromConfig !== 'aigateway' && fromConfig !== 'gemini') {
    return completeProviderSelection(fromConfig, input.projectRoot, 'env');
  }

  // Allow explicit aigateway/gemini only when set via env (already handled) or config
  // when preference is absent but config was intentionally set by applySelection.
  if (fromConfig) {
    return completeProviderSelection(fromConfig, input.projectRoot, 'env');
  }

  return {
    providerId: null,
    modelId: null,
    routeId: null,
    familyId: null,
    secondaryModelId: null,
    fallbackProviderIds: parseFallbackList(
      process.env.ZAVORTH_ECHO_LLM_FALLBACK_ORDER || process.env.ZAVORTH_PROVIDER_FALLBACK_ORDER,
    ),
    source: 'none',
    configured: false,
  };
}

function completeProviderSelection(
  providerId: string,
  projectRoot: string | undefined,
  source: UserProviderSelection['source'],
): UserProviderSelection {
  const preference = readProviderPreference(projectRoot);
  return {
    providerId,
    modelId: normalizeId(preference?.modelId)
      || envFirst('ZAVORTH_MODEL_ID', 'ZAVORTH_MODEL')
      || null,
    routeId: normalizeId(preference?.routeId)
      || envFirst('ZAVORTH_MODEL_ROUTE_ID', 'ZAVORTH_MODEL_ROUTE')
      || null,
    familyId: normalizeId(preference?.familyId)
      || envFirst('ZAVORTH_MODEL_FAMILY_ID', 'ZAVORTH_MODEL_FAMILY')
      || null,
    secondaryModelId: normalizeId(preference?.secondaryModelId)
      || envFirst('ZAVORTH_SECONDARY_MODEL_ID', 'ZAVORTH_SECONDARY_MODEL')
      || null,
    fallbackProviderIds: Array.isArray(preference?.fallbackProviderIds)
      ? (preference!.fallbackProviderIds!.map(normalizeId).filter(Boolean) as string[])
      : parseFallbackList(process.env.ZAVORTH_ECHO_LLM_FALLBACK_ORDER || process.env.ZAVORTH_PROVIDER_FALLBACK_ORDER),
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
} = {}): UserChannelSelection {
  const requested = normalizeId(input.requestedChannelId);
  if (requested) {
    return { channelId: requested, source: 'request', configured: true };
  }
  const fromEnv = envFirst('ZAVORTH_PRIMARY_CHANNEL', 'ZAVORTH_CHANNEL', 'DEFAULT_CHANNEL');
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
