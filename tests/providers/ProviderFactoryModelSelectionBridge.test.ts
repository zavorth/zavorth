import { describe, it, expect, vi, afterEach } from 'vitest';
import type { SelectedModelProfile } from '../../src/contracts/ModelPickerContract.js';
import { ProviderFactory } from '../../src/providers/ProviderFactory.js';

function selected(overrides: Partial<SelectedModelProfile> = {}): SelectedModelProfile {
  return {
    schemaVersion: 1,
    source: 'target-selection',
    providerName: 'openai',
    providerLabel: 'OpenAI',
    modelName: 'gpt-5.2',
    modelLabel: 'gpt-5.2',
    routeId: 'openai',
    familyId: 'openai',
    vendorId: 'openai',
    providerId: 'openai',
    routeKind: 'official',
    credentialKind: 'api_key',
    credentialRef: 'OPENAI_API_KEY',
    catalogSource: 'live_api',
    readiness: 'ready',
    ready: true,
    fallbackOrder: [],
    fallbackRouteIds: [],
    capabilities: ['chat', 'coding'],
    modalities: ['text'],
    limitations: [],
    identity: {
      familyId: 'openai',
      vendorId: 'openai',
      providerId: 'openai',
      routeId: 'openai',
      routeKind: 'official',
      modelId: 'gpt-5.2',
      credentialRef: 'OPENAI_API_KEY',
      credentialKind: 'api_key',
      catalogSource: 'live_api',
    },
    explanation: [],
    ...overrides,
  };
}

describe('ProviderFactory model selection bridge', () => {
  afterEach(() => {
    ProviderFactory.clearCache();
  });

  it('preserves first-class providers instead of routing them through generic compatibility', () => {
    const target = ProviderFactory.resolveRuntimeTarget(selected({
      providerName: 'openai',
      providerId: 'openai',
      routeId: 'openai',
      routeKind: 'official',
    }));

    expect(target).toEqual(expect.objectContaining({
      providerName: 'openai',
      adapterKind: 'bespoke',
      firstClassProvider: true,
      genericCompatible: false,
    }));
  });

  it('turns long-tail OpenAI-compatible selections into a GatewayProvider runtime adapter', () => {
    const profile = selected({
      providerName: 'openai-compatible-acme',
      providerLabel: 'Acme AI',
      modelName: 'acme-chat-latest',
      modelLabel: 'acme-chat-latest',
      routeId: 'openai-compatible-acme',
      familyId: 'acme-ai',
      vendorId: 'acme',
      providerId: 'openai-compatible-acme',
      routeKind: 'custom_compatible',
      credentialRef: 'ACME_AI_API_KEY',
      catalogSource: 'fallback_catalog',
      identity: {
        familyId: 'acme-ai',
        vendorId: 'acme',
        providerId: 'openai-compatible-acme',
        routeId: 'openai-compatible-acme',
        routeKind: 'custom_compatible',
        modelId: 'acme-chat-latest',
        credentialRef: 'ACME_AI_API_KEY',
        credentialKind: 'api_key',
        catalogSource: 'fallback_catalog',
      },
      baseUrl: 'https://api.acme.example/v1',
      apiKey: 'test-acme-key',
    } as any);

    const target = ProviderFactory.resolveRuntimeTarget(profile as any);
    const provider = ProviderFactory.create(profile as any);

    expect(target).toEqual(expect.objectContaining({
      providerName: 'openai-compatible-acme',
      adapterKind: 'openai_compatible',
      baseUrl: 'https://api.acme.example/v1',
      genericCompatible: true,
    }));
    expect(provider.name).toBe('openai-compatible-acme');
  });

  it('keeps unknown legacy strings on the Gemini fallback path', () => {
    const target = ProviderFactory.resolveRuntimeTarget('totally-unknown-provider');

    expect(target).toEqual(expect.objectContaining({
      providerName: 'gemini',
      adapterKind: 'bespoke',
      genericCompatible: false,
    }));
    expect(target.explanation.join(' ')).toContain('fallback Gemini legado');
  });
});
