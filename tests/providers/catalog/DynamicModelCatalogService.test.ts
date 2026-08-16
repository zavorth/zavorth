import { describe, it, expect } from '@jest/globals';
import { DynamicModelCatalogService } from '../../../src/services/providers/catalog/DynamicModelCatalogService.js';

describe('DynamicModelCatalogService', () => {
  it('should load catalog and return providers', () => {
    const providers = DynamicModelCatalogService.getAllProviders();
    expect(providers.length).toBeGreaterThan(0);
    const providerIds = providers.map((p) => p.id.toLowerCase());
    expect(providerIds).toContain('anthropic');
    expect(providerIds).toContain('openai');
  });

  it('should retrieve a specific provider and its models', () => {
    const provider = DynamicModelCatalogService.getProvider('anthropic');
    expect(provider).not.toBeNull();
    expect(provider?.name).toBe('Anthropic');
    expect(Object.keys(provider?.models || {}).length).toBeGreaterThan(0);
  });

  it('should retrieve a model definition with limits and pricing schema', () => {
    const model = DynamicModelCatalogService.getModel('claude-3-7-sonnet-20250219') ||
                  DynamicModelCatalogService.getModel('claude-3-5-sonnet-20241022') ||
                  DynamicModelCatalogService.getModel('gpt-4o');

    expect(model).not.toBeNull();
    expect(model?.cost).toBeDefined();
    expect(model?.cost?.input).toBeGreaterThan(0);
    expect(model?.cost?.output).toBeGreaterThan(0);
  });

  it('should search models across providers', () => {
    const results = DynamicModelCatalogService.searchModels('claude');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name.toLowerCase()).toContain('claude');
  });
});
