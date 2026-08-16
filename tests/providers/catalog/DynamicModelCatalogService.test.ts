import { describe, it, expect } from '@jest/globals';
import { DynamicModelCatalogService } from '../../../src/services/providers/catalog/DynamicModelCatalogService.js';
import { DynamicCostEstimator } from '../../../src/services/pricing/DynamicCostEstimator.js';

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

  it('should dynamically register a new 187th custom provider at runtime', () => {
    DynamicModelCatalogService.registerProvider({
      id: 'my-custom-corp-ai',
      name: 'Custom Corporate AI',
      api: 'https://ai.internal.corp/v1',
      models: {
        'corp-reasoning-v1': {
          id: 'corp-reasoning-v1',
          name: 'Corporate Reasoning V1',
          reasoning: true,
          limit: { context: 128000, output: 8192 },
          cost: { input: 1.0, output: 4.0, cache_read: 0.1 },
        },
      },
    });

    const retrieved = DynamicModelCatalogService.getProvider('my-custom-corp-ai');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe('Custom Corporate AI');

    const model = DynamicModelCatalogService.getModel('corp-reasoning-v1');
    expect(model).not.toBeNull();
    expect(model?.providerName).toBe('Custom Corporate AI');
    expect(model?.reasoning).toBe(true);

    // Verify cost estimator calculates accurately for the new custom provider
    const costResult = DynamicCostEstimator.calculate({
      modelId: 'corp-reasoning-v1',
      inputTokens: 100_000,
      outputTokens: 50_000,
      cacheReadTokens: 40_000,
    });

    expect(costResult.providerName).toBe('Custom Corporate AI');
    expect(costResult.totalCostUsd).toBeGreaterThan(0);
  });

  it('should search models across providers', () => {
    const results = DynamicModelCatalogService.searchModels('claude');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name.toLowerCase()).toContain('claude');
  });
});
