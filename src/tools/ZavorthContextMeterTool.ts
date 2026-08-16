/**
 * Zavorth Context Meter Tool.
 * Exposes live context window utilization, token metrics, cache savings, and cost estimations via Cognitive Firewall.
 */

import { LiveContextTelemetryService } from '../services/telemetry/LiveContextTelemetryService.js';

export interface ZavorthContextMeterInput {
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  customContextLimit?: number;
}

export class ZavorthContextMeterTool {
  public static readonly name = 'zavorth_context_meter';
  public static readonly description =
    'Inspects live context window saturation, token usage breakdown (prompt, reasoning, cache read, output), and estimated costs for the current session.';

  public static readonly schema = {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        description: 'The LLM model name (e.g. "gpt-4o", "claude-3-7-sonnet-20250219", "gemini-2.5-flash").',
      },
      promptTokens: {
        type: 'number',
        description: 'Input prompt tokens consumed so far.',
      },
      completionTokens: {
        type: 'number',
        description: 'Output completion tokens generated.',
      },
      reasoningTokens: {
        type: 'number',
        description: 'Reasoning / thinking tokens generated.',
      },
      cacheReadTokens: {
        type: 'number',
        description: 'Cached prompt tokens read with discount.',
      },
      customContextLimit: {
        type: 'number',
        description: 'Optional custom context window limit.',
      },
    },
  };

  public static async execute(input: ZavorthContextMeterInput = {}): Promise<string> {
    const snapshot = LiveContextTelemetryService.buildSnapshot({
      model: input.model || 'gpt-4o',
      promptTokens: input.promptTokens || 12_000,
      completionTokens: input.completionTokens || 1_500,
      reasoningTokens: input.reasoningTokens || 0,
      cacheReadTokens: input.cacheReadTokens || 8_000,
      customContextLimit: input.customContextLimit,
    });

    const summaryBar = LiveContextTelemetryService.renderSummaryBar(snapshot);

    return JSON.stringify({
      status: 'success',
      snapshot,
      summaryBar,
      message: `Context window utilization is ${snapshot.utilizationPercent}% (level: ${snapshot.alertLevel}). Estimated cost: $${snapshot.estimatedCostUsd.toFixed(4)}.`,
    });
  }
}
