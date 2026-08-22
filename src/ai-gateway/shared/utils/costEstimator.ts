/**
 * Cost Estimator — Dynamic pre-flight cost estimation for LLM requests.
 * Uses DynamicCostEstimator to calculate exact token-based costs from models.json schema.
 *
 * @module shared/utils/costEstimator
 */

import { DynamicCostEstimator } from '../../../../services/pricing/DynamicCostEstimator.js';

export interface CostEstimateParams {
  model: string;
  inputTokens: number;
  maxOutputTokens?: number;
  pricingOverrides?: { input?: number; output?: number; cache_read?: number; cache_write?: number };
}

export interface CostEstimateResult {
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

/**
 * Rough token estimation from text.
 * Uses ~4 chars per token approximation (GPT-family average).
 */
export function estimateTokens(text?: string | null): number {
  if (!text || typeof text !== 'string') return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimate input tokens from a chat completion request body.
 */
export function estimateInputTokens(body: unknown): number {
  if (!body) return 0;
  let total = 0;

  if (body.system) total += estimateTokens(body.system);

  if (Array.isArray(body.messages)) {
    for (const msg of body.messages) {
      if (typeof msg.content === 'string') {
        total += estimateTokens(msg.content);
      } else if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'text' && typeof part.text === 'string') {
            total += estimateTokens(part.text);
          }
        }
      }
      total += 4;
    }
  }

  return total;
}

/**
 * Estimate the cost of a request given a model.
 */
export function estimateCost(params: CostEstimateParams): CostEstimateResult {
  const { model, inputTokens, maxOutputTokens = 1000, pricingOverrides } = params;

  const result = DynamicCostEstimator.calculate({
    modelId: model,
    inputTokens,
    outputTokens: maxOutputTokens,
    pricingOverrides,
  });

  const inputCost = Number(((inputTokens * result.rates.input) / 1_000_000).toFixed(6));
  const outputCost = Number(((maxOutputTokens * result.rates.output) / 1_000_000).toFixed(6));

  return {
    model,
    inputTokens,
    outputTokens: maxOutputTokens,
    inputCost,
    outputCost,
    totalCost: result.totalCostUsd,
  };
}

/**
 * Format a cost value for display.
 */
export function formatCost(usd: number): string {
  if (usd <= 0) return '$0.00';
  if (usd < 0.01) return `$${(usd * 100).toFixed(4)}¢`;
  return `$${usd.toFixed(4)}`;
}

/**
 * Quick pre-flight estimate: given a request body and model, return estimated cost.
 */
export function preflightEstimate(body: unknown, model: string, pricingOverrides?: unknown) {
  const inputTokens = estimateInputTokens(body);
  const maxOutput = body.max_tokens || body.maxOutputTokens || 1000;
  const result = estimateCost({ model, inputTokens, maxOutputTokens: maxOutput, pricingOverrides });

  return {
    ...result,
    formatted: formatCost(result.totalCost),
  };
}
