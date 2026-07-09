
/**
 * MoAWithFallback — Mixture of Agents with integrated fallback routing.
 *
 * Combines multi-model consensus (MoA) with progressive fallback.
 * When reference models fail, the fallback chain kicks in automatically.
 * Aggregator also benefits from fallback if the primary aggregator fails.
 *
 * Usage:
 *   const moa = new MoAWithFallback(llmRouter);
 *   const result = await moa.run({
 *     query: 'Explain quantum computing',
 *     references: [
 *       { provider: 'openai', model: 'gpt-4o' },
 *       { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
 *     ],
 *     aggregator: { provider: 'openai', model: 'gpt-4o' },
 *   });
 */

import { EventEmitter } from 'events';
import { LLMRouterService } from '../services/plugins/LLMRouterService.js';
import { ModelFallbackChain, type ModelCandidate, type FailureReason } from './ModelFallbackChain.js';
import { asErrorLike } from '../utils/errorLike.js';

export interface MoAReferenceConfig {
  provider: string;
  model: string;
  temperature?: number;
}

export interface MoARunRequest {
  query: string;
  references: MoAReferenceConfig[];
  aggregator: MoAReferenceConfig;
  systemPrompt?: string;
  maxConcurrent?: number;
  timeoutMs?: number;
}

export interface MoAReferenceResult {
  provider: string;
  model: string;
  response: string;
  latencyMs: number;
  success: boolean;
  error?: string;
}

export interface MoAResult {
  finalResponse: string;
  referenceResults: MoAReferenceResult[];
  aggregatorLatencyMs: number;
  totalLatencyMs: number;
  referencesUsed: number;
  referencesFailed: number;
}

export class MoAWithFallback extends EventEmitter {
  private readonly llmRouter: LLMRouterService;

  constructor(llmRouter: LLMRouterService) {
    super();
    this.llmRouter = llmRouter;
  }

  /**
   * Runs the MoA pipeline with fallback on each reference and the aggregator.
   */
  async run(request: MoARunRequest): Promise<MoAResult> {
    const startTime = Date.now();
    const {
      query,
      references,
      aggregator,
      systemPrompt,
      maxConcurrent = 3,
      timeoutMs = 60_000,
    } = request;

    const referenceResults = await this.runReferencesWithFallback(
      query,
      references,
      systemPrompt,
      maxConcurrent,
      timeoutMs,
    );

    const aggregatorStart = Date.now();
    const finalResponse = await this.aggregateWithFallback(
      query,
      referenceResults,
      aggregator,
      systemPrompt,
      timeoutMs,
    );
    const aggregatorLatencyMs = Date.now() - aggregatorStart;

    const successful = referenceResults.filter((r) => r.success).length;
    const failed = referenceResults.filter((r) => !r.success).length;

    return {
      finalResponse,
      referenceResults,
      aggregatorLatencyMs,
      totalLatencyMs: Date.now() - startTime,
      referencesUsed: successful,
      referencesFailed: failed,
    };
  }

  /**
   * Runs all reference models with individual fallback chains.
   */
  private async runReferencesWithFallback(
    query: string,
    references: MoAReferenceConfig[],
    systemPrompt: string | undefined,
    maxConcurrent: number,
    timeoutMs: number,
  ): Promise<MoAReferenceResult[]> {
    const results: MoAReferenceResult[] = [];
    const queue = [...references];

    const worker = async () => {
      while (queue.length > 0) {
        const ref = queue.shift()!;
        const result = await this.executeWithSingleFallback(
          ref,
          query,
          systemPrompt,
          timeoutMs,
        );
        results.push(result);
        this.emit('reference:complete', result);
      }
    };

    const workers = Array.from(
      { length: Math.min(maxConcurrent, references.length) },
      () => worker(),
    );

    await Promise.all(workers);
    return results;
  }

  /**
   * Executes a single reference with fallback to alternative models.
   */
  private async executeWithSingleFallback(
    ref: MoAReferenceConfig,
    query: string,
    systemPrompt: string | undefined,
    timeoutMs: number,
  ): Promise<MoAReferenceResult> {
    const startTime = Date.now();

    // Build fallback chain from router
    const routing = this.llmRouter.route('chat', {
      exclude_providers: [ref.provider],
    });

    const chain = new ModelFallbackChain({
      primary: { provider: ref.provider, model: ref.model },
      fallbacks: routing.fallback_chain.map((m) => ({
        provider: routing.provider,
        model: m,
      })),
      cooldownMs: 300_000,
    });

    let lastError: string | undefined;

    while (true) {
      const candidate = chain.selectCandidate();
      if (!candidate) {
        return {
          provider: ref.provider,
          model: ref.model,
          response: '',
          latencyMs: Date.now() - startTime,
          success: false,
          error: lastError ?? 'All candidates in cooldown',
        };
      }

      try {
        const response = await this.callModel(candidate, query, systemPrompt, timeoutMs);
        chain.recordSuccess(candidate);
        return {
          provider: ref.provider,
          model: ref.model,
          response,
          latencyMs: Date.now() - startTime,
          success: true,
        };
      } catch (error: unknown) {
        const err = asErrorLike(error);
        const message = error instanceof Error ? err.message : String(error);
        lastError = message;
        const reason = this.classifyError(message);
        chain.recordFailure(candidate, reason);
      }
    }
  }

  /**
   * Aggregates reference results with fallback for the aggregator itself.
   */
  private async aggregateWithFallback(
    query: string,
    referenceResults: MoAReferenceResult[],
    aggregator: MoAReferenceConfig,
    systemPrompt: string | undefined,
    timeoutMs: number,
  ): Promise<string> {
    const successful = referenceResults.filter((r) => r.success);
    if (successful.length === 0) {
      throw new Error('No reference models succeeded');
    }

    const opinions = successful
      .map((r, i) => `## Opinion ${i + 1} (${r.model})\n${r.response}`)
      .join('\n\n');

    const aggregatorPrompt = `You are an opinion aggregator. Given a question and multiple opinions from different models, synthesize the best possible response.

Question: ${query}

${opinions}

Instructions:
- Consider the strengths of each opinion
- Resolve contradictions using evidence
- Produce a cohesive and complete response
- Be concise but comprehensive`;

    // Build fallback chain for aggregator
    const routing = this.llmRouter.route('reasoning');
    const chain = new ModelFallbackChain({
      primary: { provider: aggregator.provider, model: aggregator.model },
      fallbacks: routing.fallback_chain.map((m) => ({
        provider: routing.provider,
        model: m,
      })),
      cooldownMs: 300_000,
    });

    let lastError: string | undefined;

    while (true) {
      const candidate = chain.selectCandidate();
      if (!candidate) {
        throw new Error(`Aggregator failed: ${lastError ?? 'All candidates in cooldown'}`);
      }

      try {
        const response = await this.callModel(candidate, aggregatorPrompt, systemPrompt, timeoutMs);
        chain.recordSuccess(candidate);
        return response;
      } catch (error: unknown) {
        const err = asErrorLike(error);
        const message = error instanceof Error ? err.message : String(error);
        lastError = message;
        const reason = this.classifyError(message);
        chain.recordFailure(candidate, reason);
      }
    }
  }

  /**
   * Calls a model via the LLM router.
   * Note: In production, this would use the actual LLMRuntimeService.
   */
  private async callModel(
    candidate: ModelCandidate,
    prompt: string,
    systemPrompt: string | undefined,
    timeoutMs: number,
  ): Promise<string> {
    // Abstract interface for model calls
    // In real integration, this would use LLMRuntimeService
    throw new Error(
      `Model ${candidate.provider}/${candidate.model} requires integration with LLMRuntimeService`,
    );
  }

  private classifyError(message: string): FailureReason {
    const lower = message.toLowerCase();
    if (lower.includes('rate_limit') || lower.includes('429')) return 'rate_limit';
    if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized')) return 'auth_error';
    if (lower.includes('billing') || lower.includes('quota')) return 'billing';
    if (lower.includes('timeout')) return 'timeout';
    if (lower.includes('500') || lower.includes('502') || lower.includes('503')) return 'server_error';
    return 'unknown';
  }
}
