import { describe, it, expect } from '@jest/globals';
import { DynamicCostEstimator } from '../../src/services/pricing/DynamicCostEstimator.js';

describe('DynamicCostEstimator', () => {
  it('should calculate exact token costs for cloud models', () => {
    const result = DynamicCostEstimator.calculate({
      modelId: 'claude-3-7-sonnet-20250219',
      inputTokens: 10_000,
      outputTokens: 2_000,
    });

    expect(result.isFree).toBe(false);
    expect(result.totalCostUsd).toBeGreaterThan(0);
    expect(result.totalCostUsd).toBeCloseTo(0.06, 2);
  });

  it('should calculate zero cost for local / open-weights models', () => {
    const result = DynamicCostEstimator.calculate({
      modelId: 'llama3.3:latest',
      inputTokens: 50_000,
      outputTokens: 10_000,
    });

    expect(result.isFree).toBe(true);
    expect(result.totalCostUsd).toBe(0);
    expect(DynamicCostEstimator.formatUsd(result.totalCostUsd)).toBe('$0.00');
  });

  it('should respect custom pricing overrides', () => {
    const result = DynamicCostEstimator.calculate({
      modelId: 'custom-model',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      pricingOverrides: {
        input: 5.0,
        output: 20.0,
      },
    });

    expect(result.totalCostUsd).toBe(25.0);
    expect(DynamicCostEstimator.formatUsd(result.totalCostUsd)).toBe('$25.00');
  });
});
