/**
 * Live Context Telemetry Service.
 * Inspired by MiMo-Code context-meter and real-time session telemetry.
 * Tracks prompt tokens, cache-read savings, completion/reasoning tokens, context saturation percentage,
 * and dynamic cost estimations in real time.
 */

import { DynamicCostEstimator } from '../pricing/DynamicCostEstimator.js';

export interface ContextWindowSnapshot {
  model: string;
  maxContextLimit: number;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  utilizationRatio: number; // 0.0 to 1.0
  utilizationPercent: number; // 0 to 100
  alertLevel: 'nominal' | 'warning' | 'critical';
  estimatedCostUsd: number;
  cacheSavingsUsd: number;
  compactionRecommended: boolean;
}

export class LiveContextTelemetryService {
  private static readonly DEFAULT_CONTEXT_LIMITS: Record<string, number> = {
    'claude-3-7-sonnet-20250219': 200_000,
    'claude-3-5-sonnet-20241022': 200_000,
    'claude-3-5-haiku-20241022': 200_000,
    'gpt-4o': 128_000,
    'gpt-4o-mini': 128_000,
    'o1': 200_000,
    'o3-mini': 200_000,
    'gemini-2.5-pro': 2_000_000,
    'gemini-2.5-flash': 1_000_000,
    'gemini-2.0-flash': 1_000_000,
    'deepseek-chat': 64_000,
    'deepseek-reasoner': 64_000,
    'qwen-2.5-coder': 128_000,
  };

  /**
   * Resolves the maximum context limit for a given model.
   */
  static getModelLimit(model: string): number {
    const clean = model.toLowerCase();
    for (const [key, limit] of Object.entries(this.DEFAULT_CONTEXT_LIMITS)) {
      if (clean.includes(key.toLowerCase()) || key.toLowerCase().includes(clean)) {
        return limit;
      }
    }
    if (clean.includes('gemini')) return 1_000_000;
    if (clean.includes('claude')) return 200_000;
    return 128_000;
  }

  /**
   * Builds a real-time context window usage snapshot.
   */
  static buildSnapshot(input: {
    model: string;
    promptTokens: number;
    completionTokens?: number;
    reasoningTokens?: number;
    cacheReadTokens?: number;
    customContextLimit?: number;
  }): ContextWindowSnapshot {
    const model = input.model || 'gpt-4o';
    const limit = Math.max(1, input.customContextLimit || this.getModelLimit(model));
    const promptTokens = Math.max(0, input.promptTokens || 0);
    const completionTokens = Math.max(0, input.completionTokens || 0);
    const reasoningTokens = Math.max(0, input.reasoningTokens || 0);
    const cacheReadTokens = Math.max(0, input.cacheReadTokens || 0);

    const totalTokens = promptTokens + completionTokens;
    const utilizationRatio = Math.min(1, Math.max(0, totalTokens / limit));
    const utilizationPercent = Math.round(utilizationRatio * 1000) / 10; // 1 decimal place

    const alertLevel: ContextWindowSnapshot['alertLevel'] =
      utilizationRatio >= 0.8 ? 'critical' :
      utilizationRatio >= 0.5 ? 'warning' : 'nominal';

    const estimatedCostUsd = DynamicCostEstimator.estimateCost(model, {
      inputTokens: promptTokens,
      outputTokens: completionTokens,
      reasoningTokens,
      cacheReadTokens,
    });

    // Approximate cache discount: standard input cost vs cache read cost (approx 90% savings on cached tokens)
    const baseInputCost = DynamicCostEstimator.estimateCost(model, {
      inputTokens: cacheReadTokens,
      outputTokens: 0,
    });
    const cacheReadCost = DynamicCostEstimator.estimateCost(model, {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens,
    });
    const cacheSavingsUsd = Math.max(0, baseInputCost - cacheReadCost);

    return {
      model,
      maxContextLimit: limit,
      promptTokens,
      completionTokens,
      reasoningTokens,
      cacheReadTokens,
      totalTokens,
      utilizationRatio,
      utilizationPercent,
      alertLevel,
      estimatedCostUsd,
      cacheSavingsUsd,
      compactionRecommended: utilizationRatio >= 0.75,
    };
  }

  /**
   * Renders a clean 1-line ANSI / TUI summary bar.
   */
  static renderSummaryBar(snapshot: ContextWindowSnapshot): string {
    const formattedTotal = this.formatTokens(snapshot.totalTokens);
    const formattedLimit = this.formatTokens(snapshot.maxContextLimit);
    const cost = `$${snapshot.estimatedCostUsd.toFixed(4)}`;
    return `[Context: ${formattedTotal} / ${formattedLimit} (${snapshot.utilizationPercent}%) | Level: ${snapshot.alertLevel.toUpperCase()} | Cost: ${cost}]`;
  }

  private static formatTokens(tokens: number): string {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
    if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k`;
    return String(tokens);
  }
}
