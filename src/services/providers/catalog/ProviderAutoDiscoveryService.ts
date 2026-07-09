
import type { ModelCapabilityKind, ModelModality } from './ProviderCatalogContracts.js';
import type { ProviderIntegrationManifest } from './ProviderIntegrationManifest.js';
import { createMinimalProviderIntegrationManifest } from './ProviderIntegrationManifest.js';
import { OpenAiCompatibleModelDiscoveryAdapter } from './discovery/OpenAiCompatibleModelDiscoveryAdapter.js';
import { AnthropicCompatibleModelDiscoveryAdapter } from './discovery/AnthropicCompatibleModelDiscoveryAdapter.js';
import { sanitizeModelId, sanitizeProviderId, sanitizeLabel, sanitizeBaseUrl, validateProviderId, validateModelId } from './ModelIdSanitizer.js';
import { DiscoveryRateLimiter, type RateLimitConfig } from './DiscoveryRateLimiter.js';
import { DiscoveryCache, type CacheConfig } from './DiscoveryCache.js';
import { asErrorLike } from '../../../utils/errorLike.js';

export type ProviderAutoDiscoveryKind = 'openai_compatible' | 'anthropic_compatible';

export type ProviderAutoDiscoveryInput = {
  providerId: string;
  label?: string | null;
  baseUrl: string;
  apiKey?: string | null;
  kind?: ProviderAutoDiscoveryKind;
  fetchImpl?: typeof fetch;
  egressGuard?: (rawUrl: string) => Promise<unknown>;
  timeoutMs?: number;
  skipCache?: boolean;
  skipRateLimit?: boolean;
};

export type ProviderAutoDiscoveryModelInfo = {
  id: string;
  name: string;
  type: 'chat' | 'embedding' | 'image' | 'audio' | 'video';
  contextLength?: number | null;
  capabilities?: ModelCapabilityKind[];
  modalities?: ModelModality[];
};

export type ProviderAutoDiscoveryResult = {
  success: boolean;
  providerId: string;
  label: string;
  baseUrl: string;
  source: 'live_api' | 'fallback_catalog' | 'cache';
  models: ProviderAutoDiscoveryModelInfo[];
  manifest: ProviderIntegrationManifest;
  warnings: string[];
  errors: string[];
  rateLimit?: {
    remaining: number;
    resetAt: number;
  };
  cache?: {
    hit: boolean;
    stale: boolean;
  };
};

function inferCapabilities(models: ProviderAutoDiscoveryModelInfo[]): ModelCapabilityKind[] {
  const caps = new Set<ModelCapabilityKind>();
  caps.add('chat');
  caps.add('streaming');

  for (const model of models) {
    if (model.type === 'chat') {
      caps.add('chat');
    }
    if (model.capabilities) {
      for (const cap of model.capabilities) {
        caps.add(cap);
      }
    }
    if (model.modalities?.includes('image')) {
      caps.add('vision');
    }
    if (model.modalities?.includes('tool')) {
      caps.add('tool_use');
    }
  }

  return Array.from(caps);
}

function inferModalities(models: ProviderAutoDiscoveryModelInfo[]): ModelModality[] {
  const mods = new Set<ModelModality>();
  mods.add('text');

  for (const model of models) {
    if (model.modalities) {
      for (const mod of model.modalities) {
        mods.add(mod);
      }
    }
  }

  return Array.from(mods);
}

function classifyModelType(rawModel: any): 'chat' | 'embedding' | 'image' | 'audio' | 'video' {
  const id = sanitizeModelId(String(rawModel.id || rawModel.name || '')).toLowerCase();
  const ownedBy = String(rawModel.owned_by || '').toLowerCase();

  if (id.includes('embed') || id.includes('embedding') || ownedBy.includes('embedding')) {
    return 'embedding';
  }
  if (id.includes('image') || id.includes('dall-e') || id.includes('flux') || id.includes('stable')) {
    return 'image';
  }
  if (id.includes('whisper') || id.includes('tts') || id.includes('audio') || id.includes('speech')) {
    return 'audio';
  }
  if (id.includes('sora') || id.includes('video') || id.includes('veo')) {
    return 'video';
  }
  return 'chat';
}

function buildManifest(
  input: ProviderAutoDiscoveryInput,
  models: ProviderAutoDiscoveryModelInfo[],
  source: 'live_api' | 'fallback_catalog' | 'cache',
): ProviderIntegrationManifest {
  const id = sanitizeProviderId(input.providerId);
  const label = sanitizeLabel(input.label || id);
  const capabilities = inferCapabilities(models);
  const modalities = inferModalities(models);

  const defaultModel = models[0]?.id || 'default';

  return createMinimalProviderIntegrationManifest({
    id,
    label,
    vendorId: id,
    providerId: id,
    providerName: id,
    aliases: [id],
    routeKind: 'custom_compatible',
    mode: 'cloud',
    authKind: 'api_key',
    credentialRefs: [`${id.toUpperCase().replace(/-/g, '_')}_API_KEY`],
    capabilities,
    modalities,
    defaultModelName: defaultModel,
    source: source === 'live_api' ? 'runtime' : 'custom',
  });
}

export class ProviderAutoDiscoveryService {
  private readonly openaiAdapter: OpenAiCompatibleModelDiscoveryAdapter;
  private readonly anthropicAdapter: AnthropicCompatibleModelDiscoveryAdapter;
  private readonly rateLimiter: DiscoveryRateLimiter;
  private readonly cache: DiscoveryCache<ProviderAutoDiscoveryModelInfo[]>;

  constructor(runtime?: {
    openaiAdapter?: OpenAiCompatibleModelDiscoveryAdapter;
    anthropicAdapter?: AnthropicCompatibleModelDiscoveryAdapter;
    rateLimiter?: DiscoveryRateLimiter;
    cache?: DiscoveryCache<ProviderAutoDiscoveryModelInfo[]>;
    rateLimitConfig?: Partial<RateLimitConfig>;
    cacheConfig?: Partial<CacheConfig>;
  }) {
    this.openaiAdapter = runtime?.openaiAdapter || new OpenAiCompatibleModelDiscoveryAdapter();
    this.anthropicAdapter = runtime?.anthropicAdapter || new AnthropicCompatibleModelDiscoveryAdapter();
    this.rateLimiter = runtime?.rateLimiter || new DiscoveryRateLimiter(runtime?.rateLimitConfig);
    this.cache = runtime?.cache || new DiscoveryCache(runtime?.cacheConfig);
  }

  public async discover(input: ProviderAutoDiscoveryInput): Promise<ProviderAutoDiscoveryResult> {
    const id = sanitizeProviderId(input.providerId);
    const label = sanitizeLabel(input.label || id);
    const warnings: string[] = [];
    const errors: string[] = [];

    const idValidation = validateProviderId(id);
    if (!idValidation.valid) {
      return this.buildErrorResult('', '', input.baseUrl, [idValidation.error || 'Invalid provider ID']);
    }

    if (!input.baseUrl) {
      return this.buildErrorResult(id, label, '', ['Base URL is required for auto-discovery.']);
    }

    const sanitizedUrl = sanitizeBaseUrl(input.baseUrl);
    if (!sanitizedUrl) {
      return this.buildErrorResult(id, label, input.baseUrl, ['Invalid or unsafe base URL.']);
    }

    if (!input.skipCache) {
      const cacheKey = this.buildCacheKey(id, sanitizedUrl);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        const isStale = this.cache.isStale(cacheKey);
        const manifest = buildManifest(input, cached, 'cache');
        return {
          success: true,
          providerId: id,
          label,
          baseUrl: sanitizedUrl,
          source: 'cache',
          models: cached,
          manifest,
          warnings: isStale ? ['Cache data may be stale.'] : [],
          errors: [],
          cache: { hit: true, stale: isStale },
        };
      }
    }

    if (!input.skipRateLimit) {
      const rateLimitResult = this.rateLimiter.check(id);
      if (!rateLimitResult.allowed) {
        return {
          success: false,
          providerId: id,
          label,
          baseUrl: sanitizedUrl,
          source: 'fallback_catalog',
          models: [],
          manifest: buildManifest(input, [], 'fallback_catalog'),
          warnings: [],
          errors: [`Rate limit exceeded. Retry after ${rateLimitResult.retryAfterMs}ms.`],
          rateLimit: {
            remaining: 0,
            resetAt: rateLimitResult.resetAt,
          },
        };
      }

      this.rateLimiter.consume(id);
    }

    const kind = input.kind || 'openai_compatible';
    let discoveryResult: any;

    try {
      if (kind === 'anthropic_compatible') {
        discoveryResult = await this.anthropicAdapter.discover({
          providerId: id,
          label,
          baseUrl: sanitizedUrl,
          apiKey: input.apiKey,
          fetchImpl: input.fetchImpl,
          egressGuard: input.egressGuard,
        });
      } else {
        discoveryResult = await this.openaiAdapter.discover({
          providerId: id,
          label,
          baseUrl: sanitizedUrl,
          apiKey: input.apiKey,
          fetchImpl: input.fetchImpl,
          egressGuard: input.egressGuard,
          timeoutMs: input.timeoutMs,
        });
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const msg = error instanceof Error ? err.message : 'Discovery failed unexpectedly';
      errors.push(msg);
      return this.buildErrorResult(id, label, sanitizedUrl, errors);
    }

    if (discoveryResult.warning) {
      warnings.push(discoveryResult.warning);
    }

    const rawModels = discoveryResult.providerCatalog?.models || [];
    const models: ProviderAutoDiscoveryModelInfo[] = rawModels.map((m: any) => {
      const modelId = sanitizeModelId(String(m.id || m.name || ''));
      const validation = validateModelId(modelId);
      if (!validation.valid) {
        warnings.push(`Skipped invalid model ID: ${m.id}`);
        return null;
      }
      return {
        id: modelId,
        name: sanitizeLabel(String(m.name || m.id || '')),
        type: classifyModelType(m),
      };
    }).filter((m: ProviderAutoDiscoveryModelInfo | null): m is ProviderAutoDiscoveryModelInfo => m !== null);

    if (models.length === 0) {
      warnings.push('No models discovered. You may need to add models manually.');
    }

    if (!input.skipCache && models.length > 0) {
      const cacheKey = this.buildCacheKey(id, sanitizedUrl);
      this.cache.set(cacheKey, models);
    }

    const manifest = buildManifest(input, models, discoveryResult.source);
    const rateLimitState = this.rateLimiter.getState(id);

    return {
      success: discoveryResult.source === 'live_api',
      providerId: id,
      label,
      baseUrl: sanitizedUrl,
      source: discoveryResult.source,
      models,
      manifest,
      warnings,
      errors,
      rateLimit: rateLimitState ? {
        remaining: 10 - (rateLimitState.requests?.length || 0),
        resetAt: Date.now() + 60000,
      } : undefined,
      cache: { hit: false, stale: false },
    };
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public getCacheStats() {
    return this.cache.stats();
  }

  public resetRateLimit(providerId?: string): void {
    if (providerId) {
      this.rateLimiter.reset(providerId);
    } else {
      this.rateLimiter.resetAll();
    }
  }

  private buildCacheKey(providerId: string, baseUrl: string): string {
    return `${providerId}:${baseUrl}`.toLowerCase();
  }

  private buildErrorResult(
    providerId: string,
    label: string,
    baseUrl: string,
    errors: string[],
  ): ProviderAutoDiscoveryResult {
    return {
      success: false,
      providerId,
      label,
      baseUrl,
      source: 'fallback_catalog',
      models: [],
      manifest: buildManifest({ providerId, baseUrl }, [], 'fallback_catalog'),
      warnings: [],
      errors,
    };
  }
}
