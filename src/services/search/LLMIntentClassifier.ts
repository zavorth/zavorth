import type {
  ISemanticIntentClassifier,
  SemanticIntent,
  SemanticIntentClassifierInput,
  SemanticTopic,
  SemanticFreshness,
  SemanticScope,
  SemanticSourceAuthority,
} from '../../contracts/search/SemanticIntentContract.js';
import { StructuralIntentClassifier } from './StructuralIntentClassifier.js';
import { LlmRuntimeService } from '../llm/LlmRuntimeService.js';
import type { ChatMessage } from '../../providers/ILlmProvider.js';
import { asErrorLike } from '../../utils/errorLike.js';
import { logger } from '../../logger.js';

const VALID_TOPICS: ReadonlyArray<SemanticTopic> = [
  'general',
  'news',
  'consumer',
  'medical',
  'legal',
  'scientific',
  'technical',
  'finance',
  'sports',
  'entertainment',
  'public_policy',
  'ai_news',
];

const VALID_FRESHNESS: ReadonlyArray<SemanticFreshness> = [
  'realtime',
  'recent',
  'historical',
  'unknown',
];

const VALID_SCOPE: ReadonlyArray<SemanticScope> = [
  'global',
  'regional',
  'local',
  'unknown',
];

const VALID_AUTHORITY: ReadonlyArray<SemanticSourceAuthority> = [
  'any',
  'official_preferred',
  'official_required',
];

const SYSTEM_PROMPT =
  'You are a search intent classifier. Respond ONLY with a single JSON object matching this schema: ' +
  '{"topic": "<one of: general|news|consumer|medical|legal|scientific|technical|finance|sports|entertainment|public_policy|ai_news>", ' +
  '"freshness": "<one of: realtime|recent|historical|unknown>", ' +
  '"scope": "<one of: global|regional|local|unknown>", ' +
  '"sourceAuthority": "<one of: any|official_preferred|official_required>", ' +
  '"language": "<ISO 639-1 code or auto>", ' +
  '"confidence": <number between 0 and 1>}. No prose, no markdown fences.';

export interface LLMIntentClassifierOptions {
  readonly llmRuntime: LlmRuntimeService;
  readonly fallback?: ISemanticIntentClassifier;
  readonly task?: string;
  readonly maxRetries?: number;
}

export class LLMIntentClassifier implements ISemanticIntentClassifier {
  public readonly classifierId = 'llm.intent.v1';
  public readonly supportsOffline = false;

  private readonly llmRuntime: LlmRuntimeService;
  private readonly fallbackClassifier: ISemanticIntentClassifier;
  private readonly task: string;
  private readonly maxRetries: number;

  constructor(options: LLMIntentClassifierOptions) {
    this.llmRuntime = options.llmRuntime;
    this.fallbackClassifier = options.fallback ?? new StructuralIntentClassifier();
    this.task = options.task ?? 'intent_classifier';
    this.maxRetries = options.maxRetries ?? 1;
  }

  public async classify(input: SemanticIntentClassifierInput): Promise<SemanticIntent> {
    const userPrompt = this.buildUserPrompt(input);
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.llmRuntime.chat(messages, undefined, {
          providerName: this.resolveCheapProvider(),
          allowFallback: true,
        });
        const text = this.extractText(response);
        const parsed = this.parseAndValidate(text);
        if (parsed) {
          return this.mergeWithExplicitDomain(parsed, input.explicitDomain);
        }
      } catch (error: unknown) {
        const err = asErrorLike(error);
        logger.warn(
          `[LLMIntentClassifier] Attempt ${attempt + 1} failed: ${err.message || String(err)}`,
        );
      }
    }

    logger.warn('[LLMIntentClassifier] All LLM attempts failed, falling back to structural classifier');
    return this.fallbackClassifier.classify(input);
  }

  private buildUserPrompt(input: SemanticIntentClassifierInput): string {
    const parts: string[] = [];
    parts.push(`Query: ${JSON.stringify(input.query)}`);
    if (input.explicitDomain) {
      parts.push(`Explicit domain hint: ${JSON.stringify(input.explicitDomain)}`);
    }
    if (input.mode) {
      parts.push(`Search mode: ${JSON.stringify(input.mode)}`);
    }
    if (input.providerHints && Object.keys(input.providerHints).length > 0) {
      parts.push(`Provider hints: ${JSON.stringify(input.providerHints)}`);
    }
    parts.push('Classify and respond with JSON only.');
    return parts.join('\n');
  }

  private extractText(response: { content?: string | null }): string {
    if (typeof response.content === 'string') return response.content;
    return '';
  }

  private parseAndValidate(raw: string): SemanticIntent | null {
    const text = this.stripMarkdownFences(raw);
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

    const topic = this.coerceEnum(obj.topic, VALID_TOPICS, 'general');
    const freshness = this.coerceEnum(obj.freshness, VALID_FRESHNESS, 'unknown');
    const scope = this.coerceEnum(obj.scope, VALID_SCOPE, 'unknown');
    const sourceAuthority = this.coerceEnum(obj.sourceAuthority, VALID_AUTHORITY, 'any');
    const languageRaw = obj.language;
    const language = typeof languageRaw === 'string' && languageRaw.length > 0
      ? languageRaw
      : 'auto';
    const confidenceRaw = Number(obj.confidence);
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.max(0, Math.min(1, confidenceRaw))
      : 0.5;

    return {
      topic,
      freshness,
      scope,
      sourceAuthority,
      language,
      confidence,
    };
  }

  private coerceEnum<T extends string>(
    value: unknown,
    allowed: ReadonlyArray<T>,
    fallback: T,
  ): T {
    if (typeof value === 'string' && (allowed as ReadonlyArray<string>).includes(value)) {
      return value as T;
    }
    return fallback;
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

  private mergeWithExplicitDomain(
    intent: SemanticIntent,
    explicitDomain?: string | null,
  ): SemanticIntent {
    if (!explicitDomain) return intent;
    const mapped = this.mapDomainToTopic(explicitDomain);
    if (mapped === 'general' || intent.topic !== 'general') {
      return intent;
    }
    return { ...intent, topic: mapped, confidence: Math.max(intent.confidence, 0.85) };
  }

  private mapDomainToTopic(domain: string): SemanticTopic {
    switch (domain) {
      case 'medical':
      case 'legal':
      case 'scientific':
      case 'finance':
      case 'consumer':
      case 'technical':
      case 'public_policy':
      case 'ai_news':
        return domain;
      default:
        return 'general';
    }
  }
}
