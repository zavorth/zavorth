import type {
  IRelevanceScorer,
  RelevanceScore,
  RelevanceScorerInput,
  RelevanceVerdict,
} from '../../contracts/search/SemanticIntentContract.js';
import {
  RELEVANCE_THRESHOLD_RELEVANT,
  RELEVANCE_THRESHOLD_TANGENTIAL,
} from '../../contracts/search/SemanticIntentContract.js';
import { StructuralRelevanceScorer } from './StructuralRelevanceScorer.js';
import { LlmRuntimeService } from '../llm/LlmRuntimeService.js';
import type { ChatMessage } from '../../providers/ILlmProvider.js';
import { asErrorLike } from '../../utils/errorLike.js';
import { logger } from '../../logger.js';

const SYSTEM_PROMPT =
  'You are a relevance scorer for search results. You receive a query, an intent profile, ' +
  'and one candidate item. Respond ONLY with a single JSON object matching this schema: ' +
  '{"score": <number between 0 and 1>, "verdict": "<one of: relevant|tangential|off_topic>", ' +
  '"reason": "<short explanation>"}. No prose, no markdown fences.';

export interface LLMRelevanceScorerOptions {
  readonly llmRuntime: LlmRuntimeService;
  readonly fallback?: IRelevanceScorer;
  readonly maxRetries?: number;
}

export class LLMRelevanceScorer implements IRelevanceScorer {
  public readonly scorerId = 'llm.relevance.v1';
  public readonly supportsOffline = false;

  private readonly llmRuntime: LlmRuntimeService;
  private readonly fallbackScorer: IRelevanceScorer;
  private readonly maxRetries: number;

  constructor(options: LLMRelevanceScorerOptions) {
    this.llmRuntime = options.llmRuntime;
    this.fallbackScorer = options.fallback ?? new StructuralRelevanceScorer();
    this.maxRetries = options.maxRetries ?? 1;
  }

  public async score(input: RelevanceScorerInput): Promise<RelevanceScore> {
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: this.buildUserPrompt(input) },
    ];

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.llmRuntime.chat(messages, undefined, {
          providerName: this.resolveCheapProvider(),
          allowFallback: true,
        });
        const parsed = this.parseAndValidate(response.content);
        if (parsed) return parsed;
      } catch (error: unknown) {
        const err = asErrorLike(error);
        logger.warn(
          `[LLMRelevanceScorer] Attempt ${attempt + 1} failed: ${err.message || String(err)}`,
        );
      }
    }

    logger.warn('[LLMRelevanceScorer] All LLM attempts failed, falling back to structural scorer');
    return this.fallbackScorer.score(input);
  }

  private buildUserPrompt(input: RelevanceScorerInput): string {
    const lines: string[] = [];
    lines.push(`Query: ${JSON.stringify(input.query)}`);
    lines.push(`Intent topic: ${input.intent.topic}`);
    lines.push(`Intent freshness: ${input.intent.freshness}`);
    lines.push(`Intent scope: ${input.intent.scope}`);
    lines.push(`Intent source authority: ${input.intent.sourceAuthority}`);
    lines.push(`Intent language: ${input.intent.language}`);
    lines.push('');
    lines.push(`Item title: ${JSON.stringify(input.itemTitle)}`);
    lines.push(`Item snippet: ${JSON.stringify(input.itemSnippet)}`);
    if (input.itemUrl) {
      lines.push(`Item URL: ${JSON.stringify(input.itemUrl)}`);
    }
    lines.push('');
    lines.push('Score this item. Respond with JSON only.');
    return lines.join('\n');
  }

  private parseAndValidate(raw: string | null | undefined): RelevanceScore | null {
    const text = this.stripMarkdownFences(String(raw ?? ''));
    if (!text) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start < 0 || end <= start) return null;
      try {
        parsed = JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;

    const scoreRaw = Number(obj.score);
    if (!Number.isFinite(scoreRaw)) return null;
    const score = Math.max(0, Math.min(1, scoreRaw));

    const verdictRaw = obj.verdict;
    let verdict: RelevanceVerdict;
    if (verdictRaw === 'relevant' || verdictRaw === 'tangential' || verdictRaw === 'off_topic') {
      verdict = verdictRaw;
    } else {
      verdict = this.toVerdict(score);
    }

    const reason = typeof obj.reason === 'string' ? obj.reason : 'no reason provided';

    return { score, verdict, reason };
  }

  private toVerdict(score: number): RelevanceVerdict {
    if (score >= RELEVANCE_THRESHOLD_RELEVANT) return 'relevant';
    if (score >= RELEVANCE_THRESHOLD_TANGENTIAL) return 'tangential';
    return 'off_topic';
  }

  private stripMarkdownFences(raw: string): string {
    let text = raw.trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\s*/i, '');
      text = text.replace(/\s*```$/, '');
    }
    return text.trim();
  }

  private resolveCheapProvider(): string | undefined {
    try {
      const preferred = this.llmRuntime.getPreferredProviderName();
      return preferred || undefined;
    } catch {
      return undefined;
    }
  }
}
