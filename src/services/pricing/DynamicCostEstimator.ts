/**
 * Dynamic Token Cost Estimator.
 * Calculates exact token-based costs from dynamic model schemas without hardcoded tables.
 */

import { DynamicModelCatalogService, type ModelCost } from '../providers/catalog/DynamicModelCatalogService.js';

export interface CostCalculationParams {
  modelId: string;
  providerId?: string;
  inputTokens: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  pricingOverrides?: Partial<ModelCost>;
}

export interface CostCalculationResult {
  modelId: string;
  providerName: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  rates: ModelCost;
  totalCostUsd: number;
  isFree: boolean;
}

export class DynamicCostEstimator {
  /**
   * Calculates token cost in USD for a given model and token counts.
   */
  static calculate(params: CostCalculationParams): CostCalculationResult {
    const model = DynamicModelCatalogService.getModel(params.modelId, params.providerId);
    const providerName = model?.providerName || params.providerId || 'Unknown Provider';

    const baseRates: ModelCost = model?.cost || {
      input: 0,
      output: 0,
      cache_read: 0,
      cache_write: 0,
    };

    const effectiveRates: ModelCost = {
      input: params.pricingOverrides?.input ?? baseRates.input,
      output: params.pricingOverrides?.output ?? baseRates.output,
      cache_read: params.pricingOverrides?.cache_read ?? baseRates.cache_read ?? 0,
      cache_write: params.pricingOverrides?.cache_write ?? baseRates.cache_write ?? 0,
    };

    const inputTokens = Math.max(0, params.inputTokens || 0);
    const outputTokens = Math.max(0, params.outputTokens || 0);
    const cacheReadTokens = Math.max(0, params.cacheReadTokens || 0);
    const cacheWriteTokens = Math.max(0, params.cacheWriteTokens || 0);

    const isFree = (effectiveRates.input === 0 && effectiveRates.output === 0) || model?.open_weights === true;

    let totalCostUsd = 0;
    if (!isFree) {
      // If total input tokens includes cached tokens, deduct them so they aren't billed twice
      const uncachedInputTokens = Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens);
      const inputCost = (uncachedInputTokens * effectiveRates.input) / 1_000_000;
      const outputCost = (outputTokens * effectiveRates.output) / 1_000_000;
      const cacheReadCost = (cacheReadTokens * (effectiveRates.cache_read ?? (effectiveRates.input * 0.5))) / 1_000_000;
      const cacheWriteCost = (cacheWriteTokens * (effectiveRates.cache_write ?? (effectiveRates.input * 1.25))) / 1_000_000;
      totalCostUsd = Number((inputCost + outputCost + cacheReadCost + cacheWriteCost).toFixed(6));
    }

    return {
      modelId: params.modelId,
      providerName,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      rates: effectiveRates,
      totalCostUsd,
      isFree,
    };
  }

  /**
   * Helper to estimate numeric USD cost directly.
   */
  static estimateCost(
    modelId: string,
    tokens: {
      inputTokens?: number;
      outputTokens?: number;
      reasoningTokens?: number;
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
    } = {}
  ): number {
    return this.calculate({
      modelId,
      inputTokens: tokens.inputTokens || 0,
      outputTokens: (tokens.outputTokens || 0) + (tokens.reasoningTokens || 0),
      cacheReadTokens: tokens.cacheReadTokens || 0,
      cacheWriteTokens: tokens.cacheWriteTokens || 0,
    }).totalCostUsd;
  }

  /**
   * Helper to format USD cost string (e.g. $0.0042 or $0.00).
   */
  static formatUsd(amount: number): string {
    if (amount <= 0) return '$0.00';
    if (amount < 0.01) return `$${amount.toFixed(4)}`;
    return `$${amount.toFixed(2)}`;
  }
}
