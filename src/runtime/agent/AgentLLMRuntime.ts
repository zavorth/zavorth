/**
 * Agent LLM Runtime.
 * Unified, high-performance orchestration runtime managing adapter execution, circuit breaker protection, dynamic fallbacks, and cost estimation.
 */

import { AdapterRegistry } from '../../adapters/llm/AdapterRegistry.js';
import { OpenAICompatibleAdapter } from '../../adapters/llm/providers/OpenAICompatibleAdapter.js';
import { AnthropicAdapter } from '../../adapters/llm/providers/AnthropicAdapter.js';
import { GoogleGenAiAdapter } from '../../adapters/llm/providers/GoogleGenAiAdapter.js';
import { ProviderHotPathCircuitBreaker } from '../../services/llm/ProviderHotPathCircuitBreaker.js';
import { DynamicCostEstimator } from '../../services/pricing/DynamicCostEstimator.js';
import { DynamicModelCatalogService } from '../../services/providers/catalog/DynamicModelCatalogService.js';
import { asErrorLike } from '../../utils/errorLike.js';
import type {
  LLMAdapter,
  ChatMessage,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
} from '../../adapters/llm/LLMAdapterContract.js';

export interface AgentLLMRuntimeOptions {
  registry?: AdapterRegistry;
  circuitBreaker?: ProviderHotPathCircuitBreaker;
  fallbackAdapters?: string[];
}

export class AgentLLMRuntime {
  private readonly registry: AdapterRegistry;
  private readonly circuitBreaker: ProviderHotPathCircuitBreaker;
  private readonly fallbackAdapters: string[];

  constructor(options: AgentLLMRuntimeOptions = {}) {
    this.registry = options.registry || this.buildDefaultRegistry();
    this.circuitBreaker = options.circuitBreaker || new ProviderHotPathCircuitBreaker();
    this.fallbackAdapters = options.fallbackAdapters || ['anthropic', 'openai', 'google', 'openai-compatible'];
  }

  private buildDefaultRegistry(): AdapterRegistry {
    const reg = new AdapterRegistry();
    reg.register(new AnthropicAdapter());
    reg.register(new OpenAICompatibleAdapter({ id: 'openai', name: 'OpenAI Engine' }));
    reg.register(new GoogleGenAiAdapter());
    reg.register(new OpenAICompatibleAdapter({ id: 'openai-compatible', name: 'OpenAI-Compatible Generic Engine' }));
    return reg;
  }

  /**
   * Returns the underlying adapter registry.
   */
  public getRegistry(): AdapterRegistry {
    return this.registry;
  }

  /**
   * Executes a robust non-streaming completion with circuit breaker and dynamic fallback cascading.
   */
  public async complete(messages: ChatMessage[], options: CompletionOptions): Promise<CompletionResult> {
    const primaryAdapter = this.registry.resolveAdapterForModel(options.model);
    const candidateAdapters: LLMAdapter[] = [];

    if (primaryAdapter) {
      candidateAdapters.push(primaryAdapter);
    }

    for (const fbId of this.fallbackAdapters) {
      const fbAdapter = this.registry.get(fbId);
      if (fbAdapter && !candidateAdapters.includes(fbAdapter)) {
        candidateAdapters.push(fbAdapter);
      }
    }

    let lastError: Error | null = null;

    for (const adapter of candidateAdapters) {
      const isAllowed = this.circuitBreaker.canAttempt(adapter.id);
      if (!isAllowed) {
        continue;
      }

      try {
        const result = await adapter.complete(messages, options);
        this.circuitBreaker.recordSuccess(adapter.id);
        return result;
      } catch (error: unknown) {
        const err = asErrorLike(error);
        lastError = error instanceof Error ? err : new Error(String(error));
        this.circuitBreaker.recordFailure(adapter.id, lastError.message);
      }
    }

    throw new Error(
      `[AgentLLMRuntime] All candidate LLM adapters failed. Last error: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Streams completion tokens with live fallback resolution.
   */
  public async *streamComplete(messages: ChatMessage[], options: CompletionOptions): AsyncIterable<StreamChunk> {
    const adapter = this.registry.resolveAdapterForModel(options.model);
    if (!adapter) {
      throw new Error(`[AgentLLMRuntime] No suitable adapter registered for model "${options.model}".`);
    }

    const isAllowed = this.circuitBreaker.canAttempt(adapter.id);
    if (!isAllowed) {
      throw new Error(`[AgentLLMRuntime] Circuit breaker open for adapter "${adapter.id}".`);
    }

    try {
      for await (const chunk of adapter.streamComplete(messages, options)) {
        yield chunk;
      }
      this.circuitBreaker.recordSuccess(adapter.id);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      this.circuitBreaker.recordFailure(adapter.id, err.message);
      throw error;
    }
  }

  /**
   * Returns registered models across all active adapters and dynamic catalogs.
   */
  public listAvailableModels(): string[] {
    return DynamicModelCatalogService.listModels().map((m) => m.id);
  }
}
