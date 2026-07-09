import { asErrorLike } from '../utils/errorLike.js';

/**
 * MixtureOfAgents - multi-model orchestration for consensus.
 *
 * Runs N reference models in parallel, collects their responses,
 * and uses an aggregator model to synthesize the best result.
 * Each reference model generates an "opinion" that is combined
 * by the final aggregator.
 *
 * Usage:
 *   const moa = new MixtureOfAgents({
 *     references: [
 *       { provider: 'openai', model: 'gpt-4o', temperature: 0.7 },
 *       { provider: 'anthropic', model: 'claude-sonnet-4-20250514', temperature: 0.5 },
 *     ],
 *     aggregator: { provider: 'openai', model: 'gpt-4o' },
 *   });
 *   const result = await moa.run('Explain quantum computing');
 */

export interface MoAReferenceConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface MoAConfig {
  references: MoAReferenceConfig[];
  aggregator: MoAReferenceConfig;
  maxConcurrent?: number;
  timeoutMs?: number;
  enableCache?: boolean;
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
  cacheHit: boolean;
}

interface CacheEntry {
  queryHash: string;
  result: MoAResult;
  timestamp: number;
}

// Simple hash for cache key.
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export class MixtureOfAgents {
  private readonly config: Required<MoAConfig>;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheMaxSize = 100;
  private readonly cacheMaxAgeMs = 300_000; // 5 min

  constructor(config: MoAConfig) {
    this.config = {
      references: config.references,
      aggregator: config.aggregator,
      maxConcurrent: config.maxConcurrent ?? 3,
      timeoutMs: config.timeoutMs ?? 60_000,
      enableCache: config.enableCache ?? true,
    };
  }

  /**
   * Runs the MoA pipeline for a query.
   */
  async run(
    query: string,
    options: {
      systemPrompt?: string;
      onReferenceComplete?: (result: MoAReferenceResult) => void;
    } = {},
  ): Promise<MoAResult> {
    const startTime = Date.now();

    // Check cache.
    if (this.config.enableCache) {
      const cached = this.getFromCache(query);
      if (cached) {
        return { ...cached, cacheHit: true };
      }
    }

    const referenceResults = await this.runReferences(query, options);

    const aggregatorStart = Date.now();
    const finalResponse = await this.aggregate(query, referenceResults, options);
    const aggregatorLatencyMs = Date.now() - aggregatorStart;

    const result: MoAResult = {
      finalResponse,
      referenceResults,
      aggregatorLatencyMs,
      totalLatencyMs: Date.now() - startTime,
      cacheHit: false,
    };

    // Store in cache.
    if (this.config.enableCache) {
      this.addToCache(query, result);
    }

    return result;
  }

  /**
   * Runs all reference models in parallel with limited concurrency.
   */
  private async runReferences(
    query: string,
    options: { systemPrompt?: string; onReferenceComplete?: (r: MoAReferenceResult) => void },
  ): Promise<MoAReferenceResult[]> {
    const results: MoAReferenceResult[] = [];
    const queue = [...this.config.references];

    const worker = async () => {
      while (queue.length > 0) {
        const ref = queue.shift()!;
        const result = await this.executeReference(ref, query, options.systemPrompt);
        results.push(result);
        options.onReferenceComplete?.(result);
      }
    };

    const workers = Array.from(
      { length: Math.min(this.config.maxConcurrent, this.config.references.length) },
      () => worker(),
    );

    await Promise.all(workers);
    return results;
  }

  /**
   * Runs a single reference model.
   */
  private async executeReference(
    ref: MoAReferenceConfig,
    query: string,
    systemPrompt?: string,
  ): Promise<MoAReferenceResult> {
    const startTime = Date.now();

    try {
      // Call the provider through Zavorth's internal adapter.
      const response = await this.callProvider(ref, query, systemPrompt);

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
      return {
        provider: ref.provider,
        model: ref.model,
        response: '',
        latencyMs: Date.now() - startTime,
        success: false,
        error: message,
      };
    }
  }

  /**
   * Calls an LLM provider.
   * Note: in production, this would use Zavorth's LLMRouterService.
   * This is the abstract interface.
   */
  private async callProvider(
    ref: MoAReferenceConfig,
    query: string,
    systemPrompt?: string,
  ): Promise<string> {
    const messages = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      { role: 'user' as const, content: query },
    ];

    void messages;

    throw new Error(
      `Provider ${ref.provider}/${ref.model} requires LLMRouterService integration`,
    );
  }

  /**
   * Synthesizes the reference responses through the aggregator.
   */
  private async aggregate(
    query: string,
    referenceResults: MoAReferenceResult[],
    options: { systemPrompt?: string },
  ): Promise<string> {
    const successfulResults = referenceResults.filter((r) => r.success);

    if (successfulResults.length === 0) {
      throw new Error('No reference model returned a successful response');
    }

    // Build aggregation prompt.
    const opinions = successfulResults
      .map((r, i) => `## Opinion ${i + 1} (${r.model})\n${r.response}`)
      .join('\n\n');

    const aggregatorPrompt = `You are an opinion aggregator. Given a question and several opinions from different models, synthesize the best possible answer.

Question: ${query}

${opinions}

Instructions:
- Consider the strengths of each opinion
- Resolve contradictions using evidence
- Produce a cohesive and complete answer
- Be concise but comprehensive`;

    // Call the aggregator.
    return this.callProvider(this.config.aggregator, aggregatorPrompt, options.systemPrompt);
  }

  private getFromCache(query: string): MoAResult | null {
    const hash = simpleHash(query);
    const entry = this.cache.get(hash);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.cacheMaxAgeMs) {
      this.cache.delete(hash);
      return null;
    }
    return entry.result;
  }

  private addToCache(query: string, result: MoAResult): void {
    if (this.cache.size >= this.cacheMaxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(simpleHash(query), {
      queryHash: simpleHash(query),
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Returns MoA statistics.
   */
  getStats(): {
    cacheSize: number;
    cacheHitRate: number;
    referenceCount: number;
  } {
    return {
      cacheSize: this.cache.size,
      cacheHitRate: 0, // tracked in production
      referenceCount: this.config.references.length,
    };
  }
}
