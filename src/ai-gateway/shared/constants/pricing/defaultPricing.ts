// Default pricing rates for AI models
// All rates are in dollars per million tokens ($/1M tokens)
// Based on user-provided pricing for ZavorthBridge models and industry standards for others

import { API_KEY_PROVIDER_PRICING } from './families/apiKeyProviders';
import { FREE_TIER_PROVIDER_PRICING } from './families/freeTierProviders';
import { FRONTIER_PROVIDER_PRICING } from './families/frontierProviders';
import { OAUTH_PROVIDER_PRICING } from './families/oauthProviders';
import type { PricingRow, ProviderPricingTable, TokenUsage } from './pricingTypes';

export const DEFAULT_PRICING = {
  ...OAUTH_PROVIDER_PRICING,
  ...API_KEY_PROVIDER_PRICING,
  ...FREE_TIER_PROVIDER_PRICING,
  ...FRONTIER_PROVIDER_PRICING,
};

/**
 * Get pricing for a specific provider and model
 * @param {string} provider - Provider ID (e.g., "openai", "cc", "gemini-cli")
 * @param {string} model - Model ID
 * @returns {object|null} Pricing object or null if not found
 */
export function getPricingForModel(
  provider: string,
  model: string
): Record<string, unknown> | null {
  if (!provider || !model) return null;

  const providerPricing = (DEFAULT_PRICING as ProviderPricingTable)[provider];
  if (!providerPricing) return null;

  const modelPricing = providerPricing[model];
  if (!modelPricing || typeof modelPricing !== "object") return null;
  return modelPricing as Record<string, unknown>;
}

/**
 * Get all pricing data
 * @returns {object} All default pricing
 */
export function getDefaultPricing() {
  return DEFAULT_PRICING;
}

/**
 * Format cost for display
 * @param {number} cost - Cost in dollars
 * @returns {string} Formatted cost string
 */
export function formatCost(cost: number | null | undefined): string {
  if (cost === null || cost === undefined || isNaN(cost)) return "$0.00";
  return `$${cost.toFixed(2)}`;
}

/**
 * Calculate cost from tokens and pricing
 * @param {object} tokens - Token counts
 * @param {object} pricing - Pricing object
 * @returns {number} Cost in dollars
 */
export function calculateCostFromTokens(
  tokens: TokenUsage | null | undefined,
  pricing: PricingRow | null | undefined
): number {
  if (!tokens || !pricing) return 0;

  let cost = 0;

  // Input tokens (non-cached)
  const inputTokens = tokens.prompt_tokens || tokens.input_tokens || 0;
  const cachedTokens = tokens.cached_tokens || tokens.cache_read_input_tokens || 0;
  const nonCachedInput = Math.max(0, inputTokens - cachedTokens);

  cost += nonCachedInput * (pricing.input / 1000000);

  // Cached tokens
  if (cachedTokens > 0) {
    const cachedRate = pricing.cached || pricing.input; // Fallback to input rate
    cost += cachedTokens * (cachedRate / 1000000);
  }

  // Output tokens
  const outputTokens = tokens.completion_tokens || tokens.output_tokens || 0;
  cost += outputTokens * (pricing.output / 1000000);

  // Reasoning tokens
  const reasoningTokens = tokens.reasoning_tokens || 0;
  if (reasoningTokens > 0) {
    const reasoningRate = pricing.reasoning || pricing.output; // Fallback to output rate
    cost += reasoningTokens * (reasoningRate / 1000000);
  }

  // Cache creation tokens
  const cacheCreationTokens = tokens.cache_creation_input_tokens || 0;
  if (cacheCreationTokens > 0) {
    const cacheCreationRate = pricing.cache_creation || pricing.input; // Fallback to input rate
    cost += cacheCreationTokens * (cacheCreationRate / 1000000);
  }

  return cost;
}
