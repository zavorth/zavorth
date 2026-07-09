import { describe, it, expect, vi } from 'vitest';
import {
  ModelCatalogAggregationService,
} from '../../../../src/services/providers/catalog/ModelCatalogAggregationService.js';
import { OpenAiCompatibleModelDiscoveryAdapter } from '../../../../src/services/providers/catalog/discovery/OpenAiCompatibleModelDiscoveryAdapter.js';

import { AnthropicCompatibleModelDiscoveryAdapter } from '../../../../src/services/providers/catalog/discovery/AnthropicCompatibleModelDiscoveryAdapter.js';

describe('ModelCatalogAggregationService', () => {
  it('aggregates live, local, custom and fallback catalog sources with explicit origin', () => {
    const service = new ModelCatalogAggregationService();

    const result = service.aggregate({
      generatedAt: '2026-05-03T12:00:00.000Z',
      includeRegistryModels: true,
      activeProviderIds: ['openai', 'acme'],
      liveCatalogs: [
        {
          providerId: 'openai',
          alias: 'openai',
          label: 'OpenAI',
          active: true,
          models: [{ id: 'gpt-live', name: 'GPT Live', source: 'live_api' }],
        },
      ],
      localCatalogs: [
        {
          providerId: 'ollama',
          alias: 'ollama',
          label: 'Ollama',
          active: false,
          models: [{ id: 'llama3.3', name: 'Llama 3.3', source: 'local_catalog' }],
        },
      ],
      customCatalogs: [
        {
          providerId: 'acme',
          alias: 'acme',
          label: 'Acme',
          active: true,
          models: [{ id: 'acme-coder', name: 'Acme Coder', custom: true }],
        },
      ],
    });

    expect(result.schemaVersion).toBe(1);
    expect(result.sources).toEqual(expect.arrayContaining([
      'provider_catalog',
      'fallback_catalog',
      'live_api',
      'local_catalog',
      'custom_model',
    ]));
    expect(result.models.find((model) => model.id === 'openai/gpt-live')).toEqual(expect.objectContaining({
      source: 'live_api',
      active: true,
      routeId: 'openai',
    }));
    expect(result.models.find((model) => model.id === 'ollama/llama3.3')).toEqual(expect.objectContaining({
      source: 'local_catalog',
      routeId: 'ollama',
    }));
    expect(result.models.find((model) => model.id === 'acme/acme-coder')).toEqual(expect.objectContaining({
      source: 'custom_model',
      custom: true,
      active: true,
    }));
    expect(result.catalogs.some((catalog) => catalog.families.some((family) => family.catalogSource === 'live_api'))).toBe(true);
  });

  it('preserves legacy grouped catalog and OpenAI list compatibility', () => {
    const service = new ModelCatalogAggregationService();
    const result = service.aggregate({
      generatedAt: '2026-05-03T12:00:00.000Z',
      includeRegistryModels: false,
      activeProviderIds: ['openai'],
      providerCatalogs: [
        {
          providerId: 'openai',
          alias: 'openai',
          label: 'OpenAI',
          models: [{ id: 'gpt-4o', name: 'GPT-5.2' }],
        },
      ],
      customCatalogs: [
        {
          providerId: 'openai',
          alias: 'openai',
          label: 'OpenAI',
          models: [{ id: 'gpt-custom', name: 'GPT Custom', custom: true }],
        },
      ],
    });

    const legacy = service.toLegacyModelsCatalog(result);
    const openAiList = service.toOpenAIModelsList(result, { timestamp: 1770000000, activeOnly: true });

    expect(legacy.openai).toEqual(expect.objectContaining({
      provider: 'OpenAI',
      active: true,
      models: expect.arrayContaining([
        expect.objectContaining({ id: 'openai/gpt-4o', custom: false, type: 'chat' }),
        expect.objectContaining({ id: 'openai/gpt-custom', custom: true, source: 'custom_model' }),
      ]),
    }));
    expect(openAiList).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'openai/gpt-4o',
        object: 'model',
        created: 1770000000,
        owned_by: 'openai',
        root: 'gpt-4o',
      }),
      expect.objectContaining({
        id: 'openai/gpt-custom',
        custom: true,
      }),
    ]));
  });
});

describe('Model catalog discovery adapters', () => {
  it('discovers OpenAI-compatible live models from the first healthy endpoint', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('/v1/models')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: 'model-a', name: 'Model A' }] }),
        } as any;
      }
      return { ok: false, status: 404, json: async () => ({}) } as any;
    });

    const result = await new OpenAiCompatibleModelDiscoveryAdapter().discover({
      providerId: 'acme',
      alias: 'acme',
      label: 'Acme',
      baseUrl: 'https://acme.example/v1',
      apiKey: 'test',
      fetchImpl: fetchImpl as any,
      egressGuard: vi.fn(async () => undefined),
    });

    expect(result.source).toBe('live_api');
    expect(result.providerCatalog).toEqual(expect.objectContaining({
      providerId: 'acme',
      source: 'live_api',
      models: [expect.objectContaining({ id: 'model-a', source: 'live_api' })],
    }));
  });

  it('discovers Anthropic-compatible live models with x-api-key support', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: 'claude-live', display_name: 'Claude Live' }] }),
    }));

    const result = await new AnthropicCompatibleModelDiscoveryAdapter().discover({
      providerId: 'anthropic-compatible-acme',
      alias: 'acme-claude',
      label: 'Acme Claude',
      baseUrl: 'https://acme.example/messages',
      apiKey: 'test',
      fetchImpl: fetchImpl as any,
      egressGuard: vi.fn(async () => undefined),
    });

    expect(result.source).toBe('live_api');
    expect(fetchImpl.mock.calls[0][1].headers['x-api-key']).toBe('test');
    expect(result.providerCatalog.models[0]).toEqual(expect.objectContaining({
      id: 'claude-live',
      source: 'live_api',
    }));
  });

  it('blocks OpenAI-compatible discovery before fetch when egress policy rejects the target', async () => {
    const fetchImpl = vi.fn();

    const result = await new OpenAiCompatibleModelDiscoveryAdapter().discover({
      providerId: 'local-metadata',
      baseUrl: 'http://169.254.169.254/v1',
      fetchImpl: fetchImpl as any,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.source).toBe('fallback_catalog');
  });

  it('blocks Anthropic-compatible discovery before fetch when egress policy rejects the target', async () => {
    const fetchImpl = vi.fn();

    const result = await new AnthropicCompatibleModelDiscoveryAdapter().discover({
      providerId: 'local-anthropic',
      baseUrl: 'http://127.0.0.1:11434/messages',
      fetchImpl: fetchImpl as any,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.source).toBe('fallback_catalog');
  });
});
