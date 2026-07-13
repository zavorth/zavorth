/**
 * AgentConsensusEngine — multi-model deliberation for higher-quality synthesis.
 *
 * Fans out a query to N reviewer models, collects independent assessments,
 * then routes assessments to a synthesizer model for a unified answer.
 *
 * Requires an injected LlmChatPort (typically LlmRuntimeService).
 */

import { asErrorLike } from '../utils/errorLike.js';
import {
  createTimeoutSignal,
  type LlmChatPort,
} from './LlmChatPort.js';

export interface ReviewerConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface DeliberationConfig {
  reviewers: ReviewerConfig[];
  synthesizer: ReviewerConfig;
  maxConcurrent?: number;
  timeoutMs?: number;
  enableCache?: boolean;
  /** Required for real LLM calls. */
  llm: LlmChatPort;
}

export interface ReviewerAssessment {
  provider: string;
  model: string;
  assessment: string;
  latencyMs: number;
  success: boolean;
  error?: string;
}

export interface DeliberationResult {
  synthesis: string;
  assessments: ReviewerAssessment[];
  synthesizerLatencyMs: number;
  totalLatencyMs: number;
  cacheHit: boolean;
  reviewersUsed: number;
  reviewersFailed: number;
}

interface CacheEntry {
  queryHash: string;
  result: DeliberationResult;
  timestamp: number;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export class AgentConsensusEngine {
  private readonly config: Required<Omit<DeliberationConfig, 'llm'>> & { llm: LlmChatPort };
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheMaxSize = 100;
  private readonly cacheMaxAgeMs = 300_000;
  private cacheHits = 0;
  private cacheLookups = 0;

  constructor(config: DeliberationConfig) {
    if (!config.llm) {
      throw new Error('AgentConsensusEngine requires an LlmChatPort (inject LlmRuntimeService via createLlmRuntimeChatPort).');
    }
    if (!config.reviewers?.length) {
      throw new Error('AgentConsensusEngine requires at least one reviewer.');
    }
    if (!config.synthesizer?.provider || !config.synthesizer?.model) {
      throw new Error('AgentConsensusEngine requires a synthesizer provider/model.');
    }
    this.config = {
      reviewers: config.reviewers,
      synthesizer: config.synthesizer,
      maxConcurrent: config.maxConcurrent ?? 3,
      timeoutMs: config.timeoutMs ?? 60_000,
      enableCache: config.enableCache ?? true,
      llm: config.llm,
    };
  }

  async deliberate(
    query: string,
    options: {
      systemPrompt?: string;
      onAssessmentComplete?: (result: ReviewerAssessment) => void;
      signal?: AbortSignal;
    } = {},
  ): Promise<DeliberationResult> {
    const startTime = Date.now();
    const q = String(query || '').trim();
    if (!q) {
      throw new Error('deliberate() requires a non-empty query.');
    }

    if (this.config.enableCache) {
      this.cacheLookups += 1;
      const cached = this.getFromCache(q);
      if (cached) {
        this.cacheHits += 1;
        return { ...cached, cacheHit: true };
      }
    }

    const assessments = await this.gatherAssessments(q, options);

    const synthStart = Date.now();
    const synthesis = await this.synthesize(q, assessments, options);
    const synthesizerLatencyMs = Date.now() - synthStart;

    const reviewersUsed = assessments.filter((a) => a.success).length;
    const reviewersFailed = assessments.filter((a) => !a.success).length;

    const result: DeliberationResult = {
      synthesis,
      assessments,
      synthesizerLatencyMs,
      totalLatencyMs: Date.now() - startTime,
      cacheHit: false,
      reviewersUsed,
      reviewersFailed,
    };

    if (this.config.enableCache) this.addToCache(q, result);
    return result;
  }

  private async gatherAssessments(
    query: string,
    options: {
      systemPrompt?: string;
      onAssessmentComplete?: (r: ReviewerAssessment) => void;
      signal?: AbortSignal;
    },
  ): Promise<ReviewerAssessment[]> {
    const results: ReviewerAssessment[] = [];
    const queue = [...this.config.reviewers];

    const worker = async () => {
      while (queue.length > 0) {
        if (options.signal?.aborted) {
          throw new Error('Consensus deliberation aborted.');
        }
        const reviewer = queue.shift()!;
        const result = await this.runReviewer(reviewer, query, options.systemPrompt, options.signal);
        results.push(result);
        options.onAssessmentComplete?.(result);
      }
    };

    const workers = Array.from(
      { length: Math.min(this.config.maxConcurrent, this.config.reviewers.length) },
      () => worker(),
    );

    await Promise.all(workers);
    return results;
  }

  private async runReviewer(
    reviewer: ReviewerConfig,
    query: string,
    systemPrompt?: string,
    signal?: AbortSignal,
  ): Promise<ReviewerAssessment> {
    const startTime = Date.now();
    try {
      const response = await this.callProvider(reviewer, query, systemPrompt, signal);
      return {
        provider: reviewer.provider,
        model: reviewer.model,
        assessment: response,
        latencyMs: Date.now() - startTime,
        success: true,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      return {
        provider: reviewer.provider,
        model: reviewer.model,
        assessment: '',
        latencyMs: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? err.message : String(error),
      };
    }
  }

  private async callProvider(
    reviewer: ReviewerConfig,
    query: string,
    systemPrompt?: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const messages = [
      ...(systemPrompt
        ? [{ role: 'system' as const, content: systemPrompt }]
        : [{
          role: 'system' as const,
          content: 'You are an independent reviewer. Answer carefully with your own reasoning. Be concise but complete.',
        }]),
      { role: 'user' as const, content: query },
    ];

    return this.config.llm.chat(messages, {
      providerName: reviewer.provider,
      modelName: reviewer.model,
      allowFallback: false,
      signal: createTimeoutSignal(this.config.timeoutMs, signal),
      temperature: reviewer.temperature,
      maxTokens: reviewer.maxTokens,
    });
  }

  private async synthesize(
    query: string,
    assessments: ReviewerAssessment[],
    options: { systemPrompt?: string; signal?: AbortSignal },
  ): Promise<string> {
    const successful = assessments.filter((r) => r.success);
    if (successful.length === 0) {
      const errors = assessments.map((a) => `${a.provider}/${a.model}: ${a.error || 'failed'}`).join('; ');
      throw new Error(`No reviewer returned a successful assessment. ${errors}`);
    }

    // Single successful reviewer: still synthesize when synthesizer differs; otherwise pass through.
    if (
      successful.length === 1
      && successful[0].provider === this.config.synthesizer.provider
      && successful[0].model === this.config.synthesizer.model
    ) {
      return successful[0].assessment;
    }

    const perspectives = successful
      .map((r, i) => `## Assessment ${i + 1} (${r.provider}/${r.model})\n${r.assessment}`)
      .join('\n\n');

    const synthPrompt = `You are a synthesis engine. Given a question and several independent assessments from different models, produce a single best answer.

Question: ${query}

${perspectives}

Requirements:
- Identify convergent points across assessments
- Resolve disagreements by weighing evidence quality
- Produce a complete, coherent response
- Be precise and well-structured
- Do not mention that you are synthesizing multiple models unless asked`;

    return this.callProvider(
      this.config.synthesizer,
      synthPrompt,
      options.systemPrompt || 'You synthesize multi-model assessments into one authoritative answer.',
      options.signal,
    );
  }

  private getFromCache(query: string): DeliberationResult | null {
    const hash = simpleHash(query);
    const entry = this.cache.get(hash);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.cacheMaxAgeMs) {
      this.cache.delete(hash);
      return null;
    }
    return entry.result;
  }

  private addToCache(query: string, result: DeliberationResult): void {
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

  getStats(): { cacheSize: number; cacheHitRate: number; reviewerCount: number } {
    return {
      cacheSize: this.cache.size,
      cacheHitRate: this.cacheLookups === 0 ? 0 : this.cacheHits / this.cacheLookups,
      reviewerCount: this.config.reviewers.length,
    };
  }
}
