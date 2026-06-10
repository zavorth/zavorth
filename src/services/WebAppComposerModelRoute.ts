export type ComposerModelRouteOverride = {
  providerName?: string;
  modelName?: string;
  allowProviderFallback?: false;
};

type RuntimeRecord = Record<string, unknown>;

function cleanRouteOverride(value: unknown): string | null {
  const text = String(value || '').trim();
  if (!text || text.length > 180) return null;
  return /^[a-z0-9][a-z0-9._:/@+-]*$/i.test(text) ? text : null;
}

function recordOrNull(value: unknown): RuntimeRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as RuntimeRecord
    : null;
}

function splitModelRef(value: string): ComposerModelRouteOverride {
  const normalized = value.trim();
  if (!normalized || ['auto', 'default', 'inherit'].includes(normalized.toLowerCase())) return {};
  if (normalized.includes('/')) {
    const [provider, ...modelParts] = normalized.split('/');
    const providerName = cleanRouteOverride(provider);
    const modelName = cleanRouteOverride(modelParts.join('/'));
    return {
      ...(providerName ? { providerName } : {}),
      ...(modelName ? { modelName } : {}),
    };
  }
  if (normalized.includes(':')) {
    const [provider, ...modelParts] = normalized.split(':');
    const providerName = cleanRouteOverride(provider);
    const modelName = cleanRouteOverride(modelParts.join(':'));
    return {
      ...(providerName ? { providerName } : {}),
      ...(modelName ? { modelName } : {}),
    };
  }
  const modelName = cleanRouteOverride(normalized);
  return modelName ? { modelName } : {};
}

export function resolveComposerModelRouteOverride(body: RuntimeRecord): ComposerModelRouteOverride {
  const metadata = recordOrNull(body.metadata) || {};
  const composerSettings = recordOrNull(body.composerSettings) || recordOrNull(metadata.composerSettings);
  const providerName = cleanRouteOverride(body.providerName || metadata.providerName);
  const modelName = cleanRouteOverride(body.modelName || metadata.modelName);
  const allowProviderFallback = body.allowProviderFallback === false || metadata.allowProviderFallback === false
    ? false
    : null;
  const composerModel = cleanRouteOverride(composerSettings?.model);
  const composerRoute = composerModel ? splitModelRef(composerModel) : {};
  return {
    ...composerRoute,
    ...(providerName ? { providerName } : {}),
    ...(modelName ? { modelName } : {}),
    ...(allowProviderFallback === false ? { allowProviderFallback: false } : {}),
  };
}
