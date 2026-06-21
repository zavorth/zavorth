import { describe, it, expect } from 'vitest';
import {
  createMinimalProviderIntegrationManifest,
} from '../../../../src/services/providers/catalog/ProviderIntegrationManifest.js';
import {
  ProviderIntegrationRegistry,
} from '../../../../src/services/providers/catalog/ProviderIntegrationRegistry.js';

describe('ProviderIntegrationRegistry', () => {
  it('resolves curated, local and custom-compatible routes from canonical manifests', () => {
    const registry = new ProviderIntegrationRegistry();

    expect(registry.resolveRoute('openrouter')).toEqual(expect.objectContaining({
      matchedBy: 'routeId',
      route: expect.objectContaining({
        routeId: 'openrouter',
        routeKind: 'aggregator',
        authKind: 'api_key',
        passthroughModels: true,
      }),
    }));
    expect(registry.resolveRoute('AIGateway')).toEqual(expect.objectContaining({
      route: expect.objectContaining({
        vendorId: 'zavorth',
        providerId: 'aigateway',
        routeKind: 'custom_compatible',
        authKind: 'local_endpoint',
      }),
    }));
    expect(registry.resolveRoute('openai-compatible-acme')).toEqual(expect.objectContaining({
      matchedBy: 'prefix',
      route: expect.objectContaining({
        routeId: 'custom-openai-compatible',
        routeKind: 'custom_compatible',
      }),
    }));
    expect(registry.resolveRoute('ollama')).toEqual(expect.objectContaining({
      route: expect.objectContaining({
        routeKind: 'local_runtime',
        mode: 'local',
      }),
    }));
  });

  it('normalizes aliases without collapsing vendor, provider and route identity', () => {
    const registry = new ProviderIntegrationRegistry();

    expect(registry.resolveProvider('qw')).toEqual(expect.objectContaining({
      matchedBy: 'alias',
      manifest: expect.objectContaining({
        vendorId: 'alibaba',
        providerId: 'qwen',
      }),
      primaryRoute: expect.objectContaining({
        routeId: 'qwen',
        providerId: 'qwen',
        routeKind: 'partner',
      }),
    }));
    expect(registry.resolveRoute('puter')).toEqual(expect.objectContaining({
      matchedBy: 'alias',
      route: expect.objectContaining({
        routeId: 'qwen',
        vendorId: 'alibaba',
        providerId: 'qwen',
      }),
    }));
    expect(registry.resolveFamily('claude')).toEqual(expect.objectContaining({
      family: expect.objectContaining({
        familyId: 'claude',
        vendorId: 'anthropic',
        providerIds: expect.arrayContaining(['anthropic', 'claude']),
      }),
    }));
  });

  it('accepts a minimal manifest for long-tail providers', () => {
    const registry = new ProviderIntegrationRegistry([
      createMinimalProviderIntegrationManifest({
        id: 'acme-ai',
        label: 'Acme AI',
        vendorId: 'acme',
        aliases: ['acme', 'acme-compatible'],
        routeKind: 'custom_compatible',
        authKind: 'api_key',
        capabilities: ['chat', 'coding', 'streaming'],
        modalities: ['text'],
        credentialRefs: ['ACME_API_KEY', 'ACME_BASE_URL'],
      }),
    ]);

    const route = registry.resolveRoute('acme-compatible');

    expect(route).toEqual(expect.objectContaining({
      route: expect.objectContaining({
        routeId: 'acme-ai',
        vendorId: 'acme',
        providerId: 'acme-ai',
        credentialRefs: ['ACME_API_KEY', 'ACME_BASE_URL'],
        capabilities: expect.arrayContaining(['coding']),
      }),
    }));
    expect(registry.buildSnapshot()).toEqual(expect.objectContaining({
      manifestCount: 1,
      familyCount: 1,
      routeCount: 1,
      routeKinds: ['custom_compatible'],
    }));
  });
});
