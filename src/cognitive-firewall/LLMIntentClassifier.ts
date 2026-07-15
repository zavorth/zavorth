import { asErrorLike } from '../utils/errorLike';
/**
 * LLMIntentClassifier — optional second opinion for free-text cost routing.
 *
 * Free-text capability choice is model-owned. This classifier must not map words to
 * tool categories. Prefer the zero-token IntentClassifier; enable this only when an
 * async path needs LLM language coverage.
 */

import type { ILlmProvider, ChatMessage } from '../providers/ILlmProvider.js';
import { ProviderFactory } from '../providers/ProviderFactory.js';
import type { IntentCategory, IntentClassification } from './IntentClassifier.js';

export interface LLMIntentClassifierOptions {
  /** LLM provider name (defaults to user's configured provider) */
  providerName?: string;
  /** Cache TTL in ms (default: 5 minutes) */
  cacheTtlMs?: number;
  /** Max cache entries (default: 1000) */
  maxCacheEntries?: number;
  /** Enable debug logging */
  debug?: boolean;
}

interface CacheEntry {
  classification: IntentClassification;
  timestamp: number;
}

const INTENT_CLASSIFICATION_PROMPT = `You classify free-text messages for routing cost only.

Return ONLY one of two categories:
- conversation: short social acknowledgement (hi, thanks, ok, bye) with no task
- full_toolset: anything that might need tools, knowledge, research, files, code, or multi-step work

Do NOT invent other categories. Capability choice belongs to the main agent model.

Respond with ONLY a JSON object (no markdown):
{
  "category": "conversation" | "full_toolset",
  "confidence": <0.0-1.0>,
  "reason": "<brief explanation>"
}

Examples:
- "hi" → {"category":"conversation","confidence":0.95,"reason":"Greeting"}
- "thanks" → {"category":"conversation","confidence":0.95,"reason":"Acknowledgement"}
- "create a file called test.ts" → {"category":"full_toolset","confidence":0.9,"reason":"Task may need tools"}
- "what's the weather today?" → {"category":"full_toolset","confidence":0.9,"reason":"May need search"}
- "olá, como vai?" → {"category":"conversation","confidence":0.9,"reason":"Social greeting"}

Classify this message:`;

export class LLMIntentClassifier {
  private provider: ILlmProvider | null = null;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly cacheTtlMs: number;
  private readonly maxCacheEntries: number;
  private readonly debug: boolean;
  private readonly providerName: string;

  constructor(options: LLMIntentClassifierOptions = {}) {
    this.providerName = options.providerName || 'default';
    this.cacheTtlMs = options.cacheTtlMs ?? 5 * 60 * 1000;
    this.maxCacheEntries = options.maxCacheEntries ?? 1000;
    this.debug = options.debug ?? false;
  }

  public async classify(userMessage: string): Promise<IntentClassification> {
    const cacheKey = this.getCacheKey(userMessage);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      if (this.debug) {
        console.log('[LLMIntentClassifier] Cache hit for:', userMessage.substring(0, 50));
      }
      return cached.classification;
    }

    try {
      const provider = this.getProvider();
      const classification = await this.classifyWithLLM(provider, userMessage);

      this.cache.set(cacheKey, {
        classification,
        timestamp: Date.now(),
      });
      this.evictOldEntries();

      if (this.debug) {
        console.log(
          `[LLMIntentClassifier] Classified "${userMessage.substring(0, 50)}" as ${classification.category} (${classification.confidence})`,
        );
      }

      return classification;
    } catch (error: unknown) {
      console.error('[LLMIntentClassifier] LLM classification failed, returning full_toolset:', error);
      return this.ambiguousResult('LLM classification failed; free text stays model-owned.');
    }
  }

  private async classifyWithLLM(provider: ILlmProvider, userMessage: string): Promise<IntentClassification> {
    const messages: ChatMessage[] = [
      { role: 'system', content: INTENT_CLASSIFICATION_PROMPT },
      { role: 'user', content: userMessage },
    ];

    const response = await provider.chat(messages);
    const content = String(response.content || '').trim();
    return this.parseClassification(content);
  }

  private parseClassification(content: string): IntentClassification {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.ambiguousResult('Unparseable LLM response.');
      }
      const parsed = JSON.parse(jsonMatch[0]) as {
        category?: string;
        confidence?: number;
        reason?: string;
      };
      const raw = String(parsed.category || '')
        .toLowerCase()
        .trim();
      const category: IntentCategory = raw === 'conversation' ? 'conversation' : 'full_toolset';
      const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5));
      return {
        category,
        confidence,
        reason: String(parsed.reason || 'LLM free-text cost routing hint.'),
        isHardDecision: false,
        downgradedBy: [],
        secondPass: {
          source: 'ContextualIntentSecondPass',
          stage: 7,
          mode: 'local-contextual',
          verdict: category === 'full_toolset' ? 'left-ambiguous' : 'confirmed',
          originalCategory: category,
          finalCategory: category,
          confidenceDelta: 0,
          signals: ['llm-cost-routing-only'],
        },
      };
    } catch (error: unknown) {
      console.error('[LLMIntentClassifier] Failed to parse LLM response:', content);
      return this.ambiguousResult(`Parse error: ${asErrorLike(error).message}`);
    }
  }

  private ambiguousResult(reason: string): IntentClassification {
    return {
      category: 'full_toolset',
      confidence: 0.3,
      reason,
      isHardDecision: false,
      downgradedBy: [],
      secondPass: {
        source: 'ContextualIntentSecondPass',
        stage: 7,
        mode: 'local-contextual',
        verdict: 'left-ambiguous',
        originalCategory: 'full_toolset',
        finalCategory: 'full_toolset',
        confidenceDelta: 0,
        signals: ['llm-fallback-full-toolset'],
      },
    };
  }

  private getProvider(): ILlmProvider {
    if (!this.provider) {
      this.provider = ProviderFactory.create(this.providerName);
    }
    return this.provider;
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public getCacheStats(): { size: number; maxEntries: number; ttlMs: number } {
    return {
      size: this.cache.size,
      maxEntries: this.maxCacheEntries,
      ttlMs: this.cacheTtlMs,
    };
  }

  private getCacheKey(message: string): string {
    return String(message || '')
      .trim()
      .toLowerCase()
      .slice(0, 500);
  }

  private evictOldEntries(): void {
    if (this.cache.size <= this.maxCacheEntries) return;
    const sorted = Array.from(this.cache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = sorted.slice(0, sorted.length - this.maxCacheEntries);
    for (const [key] of toRemove) {
      this.cache.delete(key);
    }
  }
}
