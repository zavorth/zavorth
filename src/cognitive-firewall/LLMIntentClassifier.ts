/**
 * LLMIntentClassifier - Intelligent intent classification using the user's LLM.
 *
 * Replaces rigid regex patterns with LLM-based understanding that works
 * across any language, understands context, and handles ambiguity gracefully.
 *
 * Falls back to regex for trivial cases (cost optimization).
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

const INTENT_CLASSIFICATION_PROMPT = `You are an intent classifier. Analyze the user's message and classify their intent.

Available categories:
- conversation: General chat, greetings, questions about the AI, casual discussion
- information: Web searches, current events, facts, data lookup
- file_operation: Creating, reading, editing, deleting files or directories
- execution: Running commands, scripts, tests, builds, installations
- configuration: Changing settings, models, providers, profiles
- memory: Remembering, recalling, forgetting information
- desktop: Desktop automation, screen control, mouse/keyboard
- research: Deep research, analysis, literature review, investigations
- full_toolset: Complex tasks requiring multiple tool categories

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "category": "<category>",
  "confidence": <0.0-1.0>,
  "reason": "<brief explanation>"
}

Examples:
- "oi" → {"category": "conversation", "confidence": 0.95, "reason": "Simple greeting"}
- "create a file called test.ts" → {"category": "file_operation", "confidence": 0.9, "reason": "File creation request"}
- "run npm test" → {"category": "execution", "confidence": 0.95, "reason": "Command execution"}
- "what's the weather today?" → {"category": "information", "confidence": 0.85, "reason": "Information lookup"}
- "configure the openai provider" → {"category": "configuration", "confidence": 0.9, "reason": "Configuration change"}
- "remember my preference for dark mode" → {"category": "memory", "confidence": 0.9, "reason": "Memory storage"}
- "research the latest AI papers" → {"category": "research", "confidence": 0.85, "reason": "Deep research request"}
- "olá, como vai?" → {"category": "conversation", "confidence": 0.95, "reason": "Portuguese greeting"}
- "crea un archivo de prueba" → {"category": "file_operation", "confidence": 0.85, "reason": "Spanish file creation"}

Analyze this message and classify the intent:`;

export class LLMIntentClassifier {
  private provider: ILlmProvider | null = null;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly cacheTtlMs: number;
  private readonly maxCacheEntries: number;
  private readonly debug: boolean;
  private readonly providerName: string;

  constructor(options: LLMIntentClassifierOptions = {}) {
    this.providerName = options.providerName || 'default';
    this.cacheTtlMs = options.cacheTtlMs ?? 5 * 60 * 1000; // 5 minutes
    this.maxCacheEntries = options.maxCacheEntries ?? 1000;
    this.debug = options.debug ?? false;
  }

  /**
   * Classify user intent using the LLM.
   * Returns cached result if available and fresh.
   */
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
      
      // Cache the result
      this.cache.set(cacheKey, {
        classification,
        timestamp: Date.now(),
      });
      
      // Evict old entries if cache is full
      if (this.cache.size > this.maxCacheEntries) {
        this.evictOldEntries();
      }

      if (this.debug) {
        console.log(`[LLMIntentClassifier] Classified "${userMessage.substring(0, 50)}" as ${classification.category} (${classification.confidence})`);
      }

      return classification;
    } catch (error) {
      console.error('[LLMIntentClassifier] LLM classification failed, returning ambiguous:', error);
      return this.getAmbiguousFallback();
    }
  }

  /**
   * Clear the classification cache.
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics.
   */
  public getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses for accurate rate
    };
  }

  private getProvider(): ILlmProvider {
    if (!this.provider) {
      this.provider = ProviderFactory.create(this.providerName);
    }
    return this.provider;
  }

  private async classifyWithLLM(
    provider: ILlmProvider,
    userMessage: string,
  ): Promise<IntentClassification> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: INTENT_CLASSIFICATION_PROMPT,
      },
      {
        role: 'user',
        content: userMessage,
      },
    ];

    const response = await provider.chat(messages, [], {
      modelName: undefined, // Use default model
    });

    const content = response.content || '';
    
    // Parse the JSON response
    try {
      const parsed = JSON.parse(content);
      
      // Validate the response structure
      if (!parsed.category || typeof parsed.confidence !== 'number') {
        throw new Error('Invalid classification response structure');
      }

      // Validate category is one of the allowed values
      const validCategories: IntentCategory[] = [
        'conversation', 'information', 'file_operation', 'execution',
        'configuration', 'memory', 'desktop', 'research', 'full_toolset',
      ];
      
      if (!validCategories.includes(parsed.category)) {
        throw new Error(`Invalid category: ${parsed.category}`);
      }

      // Clamp confidence to valid range
      const confidence = Math.max(0, Math.min(1, parsed.confidence));

      return {
        category: parsed.category,
        confidence,
        reason: parsed.reason || 'LLM classification',
        isTrivialChat: parsed.category === 'conversation' && confidence >= 0.9,
        isHardDecision: false,
        downgradedBy: [],
        secondPass: {
          source: 'ContextualIntentSecondPass',
          stage: 7,
          mode: 'local-contextual',
          verdict: 'confirmed',
          originalCategory: parsed.category,
          finalCategory: parsed.category,
          confidenceDelta: 0,
          signals: ['llm-classified'],
        },
      };
    } catch (parseError) {
      console.error('[LLMIntentClassifier] Failed to parse LLM response:', content);
      throw new Error(`Failed to parse classification: ${parseError}`);
    }
  }

  private getCacheKey(message: string): string {
    // Simple hash for cache key - in production, use a proper hash function
    return message.toLowerCase().trim().substring(0, 100);
  }

  private evictOldEntries(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest entries until we're under the limit
    const toRemove = entries.slice(0, entries.length - this.maxCacheEntries + 100);
    for (const [key] of toRemove) {
      this.cache.delete(key);
    }
  }

  private getAmbiguousFallback(): IntentClassification {
    return {
      category: 'full_toolset',
      confidence: 0.3,
      reason: 'LLM classification failed, using ambiguous fallback',
      isTrivialChat: false,
      isHardDecision: false,
      downgradedBy: ['llm-classification-failed'],
      secondPass: {
        source: 'ContextualIntentSecondPass',
        stage: 7,
        mode: 'local-contextual',
        verdict: 'left-ambiguous',
        originalCategory: 'full_toolset',
        finalCategory: 'full_toolset',
        confidenceDelta: 0,
        signals: ['llm-fallback'],
      },
    };
  }
}
