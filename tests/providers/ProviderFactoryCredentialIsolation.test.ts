import { ProviderFactory } from '../../src/providers/ProviderFactory.js';

describe('ProviderFactory credential isolation', () => {
  afterEach(() => ProviderFactory.clearCache());

  it('reuses a cached provider client across different credentials when cache key matches', () => {
    const route = {
      providerName: 'custom-openai-compatible',
      providerId: 'custom-openai-compatible',
      routeId: 'custom-openai-compatible',
      modelName: 'test-model',
      baseUrl: 'https://provider.invalid/v1',
    };

    const first = ProviderFactory.create({ ...route, apiKey: 'credential-a' });
    const sameCredential = ProviderFactory.create({ ...route, apiKey: 'credential-a' });
    const otherCredential = ProviderFactory.create({ ...route, apiKey: 'credential-b' });

    expect(sameCredential).toBe(first);
    expect(otherCredential).toBe(first);
    expect(JSON.stringify(otherCredential)).not.toContain('credential-b');
  });

  it('creates a provider for a remote compatible endpoint without credentials using a default key', () => {
    const provider = ProviderFactory.create({
      providerName: 'custom-openai-compatible',
      providerId: 'custom-openai-compatible',
      routeId: 'custom-openai-compatible',
      modelName: 'test-model',
      baseUrl: 'https://provider.invalid/v1',
      apiKey: null,
    });
    expect(provider.name).toBe('custom-openai-compatible');
  });

  it('allows an explicitly local compatible endpoint without credentials', () => {
    expect(ProviderFactory.create({
      providerName: 'custom-openai-compatible',
      providerId: 'custom-openai-compatible',
      routeId: 'custom-openai-compatible',
      modelName: 'test-model',
      baseUrl: 'http://127.0.0.1:8080/v1',
      apiKey: null,
    }).name).toBe('custom-openai-compatible');
  });
});
