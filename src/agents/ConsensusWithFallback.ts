/**
 * ConsensusWithFallback — multi-model deliberation with progressive fallback.
 *
 * Fallback candidates come only from the caller (user stack), never from a
 * product-default model catalog.
 */

import { EventEmitter } from 'events';
import { ModelFallbackChain, type ModelCandidate, type FailureReason } from './ModelFallbackChain.js';
import { asErrorLike } from '../utils/errorLike.js';
import {
  createTimeoutSignal,
  type LlmChatPort,
} from './LlmChatPort.js';

export interface ReviewerConfig {
  provider: string;
  model: string;
  temperature?: number;
}

export interface DeliberationRequest {
  query: string;
  reviewers: ReviewerConfig[];
  synthesizer: ReviewerConfig;
  systemPrompt?: string;
  maxConcurrent?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ReviewerAssessment {
  provider: string;
  model: string;
  effectiveProvider?: string;
  effectiveModel?: string;
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
  reviewersUsed: number;
  reviewersFailed: number;
  synthesizerProvider?: string;
  synthesizerModel?: string;
}

export type FallbackResolver = (primary: ModelCandidate) => ModelCandidate[];

export type ConsensusWithFallbackOptions = {
  /** Resolve fallback models for a failed primary — must be user-owned. */
  resolveFallbacks?: FallbackResolver;
};

export class ConsensusWithFallback extends EventEmitter {
  private readonly llm: LlmChatPort;
  private readonly resolveFallbacks: FallbackResolver;

  constructor(llm: LlmChatPort, options: ConsensusWithFallbackOptions = {}) {
    super();
    if (!llm) {
      throw new Error('ConsensusWithFallback requires an LlmChatPort (inject LlmRuntimeService via createLlmRuntimeChatPort).');
    }
    this.llm = llm;
    this.resolveFallbacks = options.resolveFallbacks || (() => []);
  }

  async deliberate(request: DeliberationRequest): Promise<DeliberationResult> {
    const startTime = Date.now();
    const {
      query,
      reviewers,
      synthesizer,
      systemPrompt,
      maxConcurrent = 3,
      timeoutMs = 60_000,
      signal,
    } = request;

    const q = String(query || '').trim();
    if (!q) throw new Error('deliberate() requires a non-empty query.');
    if (!reviewers?.length) throw new Error('deliberate() requires at least one reviewer.');

    const assessments = await this.gatherWithFallback(
      q,
      reviewers,
      systemPrompt,
      maxConcurrent,
      timeoutMs,
      signal,
    );

    const synthStart = Date.now();
    const { text: synthesis, provider: synthesizerProvider, model: synthesizerModel } =
      await this.synthesizeWithFallback(
        q,
        assessments,
        synthesizer,
        systemPrompt,
        timeoutMs,
        signal,
      );
    const synthesizerLatencyMs = Date.now() - synthStart;

    const successful = assessments.filter((r) => r.success).length;
    const failed = assessments.filter((r) => !r.success).length;

    return {
      synthesis,
      assessments,
      synthesizerLatencyMs,
      totalLatencyMs: Date.now() - startTime,
      reviewersUsed: successful,
      reviewersFailed: failed,
      synthesizerProvider,
      synthesizerModel,
    };
  }

  private async gatherWithFallback(
    query: string,
    reviewers: ReviewerConfig[],
    systemPrompt: string | undefined,
    maxConcurrent: number,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<ReviewerAssessment[]> {
    const results: ReviewerAssessment[] = [];
    const queue = [...reviewers];

    const worker = async () => {
      while (queue.length > 0) {
        if (signal?.aborted) throw new Error('Consensus deliberation aborted.');
        const reviewer = queue.shift()!;
        const result = await this.runWithSingleFallback(
          reviewer,
          query,
          systemPrompt,
          timeoutMs,
          signal,
        );
        results.push(result);
        this.emit('reviewer:complete', result);
      }
    };

    const workers = Array.from(
      { length: Math.min(maxConcurrent, reviewers.length) },
      () => worker(),
    );

    await Promise.all(workers);
    return results;
  }

  private async runWithSingleFallback(
    reviewer: ReviewerConfig,
    query: string,
    systemPrompt: string | undefined,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<ReviewerAssessment> {
    const startTime = Date.now();
    const chain = this.buildFallbackChain(reviewer);

    let lastError: string | undefined;

    for (;;) {
      if (signal?.aborted) {
        return {
          provider: reviewer.provider,
          model: reviewer.model,
          assessment: '',
          latencyMs: Date.now() - startTime,
          success: false,
          error: 'Aborted',
        };
      }

      const candidate = chain.selectCandidate();
      if (!candidate) {
        return {
          provider: reviewer.provider,
          model: reviewer.model,
          assessment: '',
          latencyMs: Date.now() - startTime,
          success: false,
          error: lastError ?? 'All candidates exhausted (user stack only)',
        };
      }

      try {
        const response = await this.callModel(candidate, query, systemPrompt, timeoutMs, signal);
        chain.recordSuccess(candidate);
        return {
          provider: reviewer.provider,
          model: reviewer.model,
          effectiveProvider: candidate.provider,
          effectiveModel: candidate.model,
          assessment: response,
          latencyMs: Date.now() - startTime,
          success: true,
        };
      } catch (error: unknown) {
        const err = asErrorLike(error);
        lastError = error instanceof Error ? err.message : String(error);
        chain.recordFailure(candidate, this.classifyError(lastError));
      }
    }
  }

  private async synthesizeWithFallback(
    query: string,
    assessments: ReviewerAssessment[],
    synthesizer: ReviewerConfig,
    systemPrompt: string | undefined,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<{ text: string; provider: string; model: string }> {
    const successful = assessments.filter((r) => r.success);
    if (successful.length === 0) {
      throw new Error('No reviewer models succeeded');
    }

    if (successful.length === 1) {
      return {
        text: successful[0].assessment,
        provider: successful[0].effectiveProvider || successful[0].provider,
        model: successful[0].effectiveModel || successful[0].model,
      };
    }

    const perspectives = successful
      .map((r, i) => {
        const label = r.effectiveModel ? `${r.effectiveProvider}/${r.effectiveModel}`
          : `${r.provider}/${r.model}`;
        return `## Assessment ${i + 1} (${label})\n${r.assessment}`;
      })
      .join('\n\n');

    const synthPrompt = `You are a synthesis engine. Given a question and several independent assessments from different models, produce a single best answer.

Question: ${query}

${perspectives}

Requirements:
? Identify convergent points across assessments
? Resolve disagreements by weighing evidence quality
? Produce a complete, coherent response
? Be precise and well-structured
? Do not mention that you are synthesizing multiple models unless asked`;

    const chain = this.buildFallbackChain(synthesizer);
    let lastError: string | undefined;

    for (;;) {
      if (signal?.aborted) {
        throw new Error('Synthesizer aborted');
      }

      const candidate = chain.selectCandidate();
      if (!candidate) {
        throw new Error(`Synthesizer failed: ${lastError ?? 'All candidates exhausted (user stack only)'}`);
      }

      try {
        const response = await this.callModel(
          candidate,
          synthPrompt,
          systemPrompt || 'You synthesize multi-model assessments into one authoritative answer.',
          timeoutMs,
          signal,
        );
        chain.recordSuccess(candidate);
        return { text: response, provider: candidate.provider, model: candidate.model };
      } catch (error: unknown) {
        const err = asErrorLike(error);
        lastError = error instanceof Error ? err.message : String(error);
        chain.recordFailure(candidate, this.classifyError(lastError));
      }
    }
  }

  private buildFallbackChain(primary: ReviewerConfig): ModelFallbackChain {
    const primaryCandidate: ModelCandidate = {
      provider: primary.provider,
      model: primary.model,
    };
    const fallbacks = (this.resolveFallbacks(primaryCandidate) || [])
      .filter((c) => c.provider && c.model)
      .filter(
        (c) =>
          !(
            c.provider.toLowerCase() === primary.provider.toLowerCase()
            && c.model.toLowerCase() === primary.model.toLowerCase()
          ),
      );

    return new ModelFallbackChain({
      primary: primaryCandidate,
      fallbacks,
      cooldownMs: 300_000,
    });
  }

  private async callModel(
    candidate: ModelCandidate,
    prompt: string,
    systemPrompt: string | undefined,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<string> {
    const messages = [
      ...(systemPrompt
        ? [{ role: 'system' as const, content: systemPrompt }]
        : [{
          role: 'system' as const,
          content: 'You are an independent reviewer. Answer carefully with your own reasoning.',
        }]),
      { role: 'user' as const, content: prompt },
    ];

    return this.llm.chat(messages, {
      providerName: candidate.provider,
      modelName: candidate.model,
      allowFallback: false,
      signal: createTimeoutSignal(timeoutMs, signal),
    });
  }

  private classifyError(message: string): FailureReason {
    const lower = message.toLowerCase();
    if (lower.includes('rate_limit') || lower.includes('429')) return 'rate_limit';
    if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized')) return 'auth_error';
    if (lower.includes('billing') || lower.includes('quota')) return 'billing';
    if (lower.includes('timeout') || lower.includes('aborted')) return 'timeout';
    if (lower.includes('500') || lower.includes('502') || lower.includes('503')) return 'server_error';
    return 'unknown';
  }
}
