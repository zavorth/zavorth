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
import { ToolCallRepairService } from '../../services/llm/ToolCallRepairService.js';
import { IntraTurnCompactor } from './IntraTurnCompactor.js';
import { InterjectionQueue } from './InterjectionQueue.js';
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
    const costEstimator = (model: string, usage: any) => DynamicCostEstimator.estimateCost(model, usage);
    const toolCallRepair = (raw: string) => ToolCallRepairService.repair(raw);

    reg.register(new AnthropicAdapter({ costEstimator }));
    reg.register(new OpenAICompatibleAdapter({ id: 'openai', name: 'OpenAI Engine', costEstimator, toolCallRepair }));
    reg.register(new GoogleGenAiAdapter({ costEstimator }));
    reg.register(new OpenAICompatibleAdapter({ id: 'openai-compatible', name: 'OpenAI-Compatible Generic Engine', costEstimator, toolCallRepair }));
    return reg;
  }

  /**
   * Prepares messages by injecting pending live operator steering and applying intra-turn compaction.
   */
  public prepareMessages(messages: ChatMessage[]): ChatMessage[] {
    const prepared = [...messages];

    // 1. Inject pending mid-turn interjections if present
    if (InterjectionQueue.hasPending()) {
      const interjections = InterjectionQueue.dequeueAll();
      const steeringMessage = InterjectionQueue.formatAsMessage(interjections);
      if (steeringMessage) {
        prepared.push(steeringMessage);
      }
    }

    // 2. Apply intra-turn compaction
    const { compactedMessages } = IntraTurnCompactor.compact(prepared);
    return compactedMessages;
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
    const preparedMessages = this.prepareMessages(messages);
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

    if (candidateAdapters.length === 0) {
      const defaultAdapter = this.registry.getDefault() || this.registry.list()[0];
      if (defaultAdapter) {
        candidateAdapters.push(defaultAdapter);
      }
    }

    let lastError: Error | null = null;

    for (const adapter of candidateAdapters) {
      const isAllowed = this.circuitBreaker.canAttempt(adapter.id);
      if (!isAllowed) {
        continue;
      }

      try {
        const result = await adapter.complete(preparedMessages, options);
        this.circuitBreaker.recordSuccess(adapter.id);
        return result;
      } catch (error: unknown) {
        const err = asErrorLike(error);
        lastError = err instanceof Error ? err : new Error(err.message);
        this.circuitBreaker.recordFailure(adapter.id, lastError.message);
      }
    }

    throw new Error(
      `[AgentLLMRuntime] All candidate LLM adapters failed. Last error: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Streams completion tokens with live fallback resolution and auto-compaction.
   */
  public async *streamComplete(messages: ChatMessage[], options: CompletionOptions): AsyncIterable<StreamChunk> {
    const preparedMessages = this.prepareMessages(messages);
    let adapter = this.registry.resolveAdapterForModel(options.model);
    if (!adapter) {
      adapter = this.registry.getDefault() || this.registry.list()[0] || null;
    }
    if (!adapter) {
      throw new Error(`[AgentLLMRuntime] No suitable adapter registered for model "${options.model}".`);
    }

    const isAllowed = this.circuitBreaker.canAttempt(adapter.id);
    if (!isAllowed) {
      throw new Error(`[AgentLLMRuntime] Circuit breaker open for adapter "${adapter.id}".`);
    }

    try {
      for await (const chunk of adapter.streamComplete(preparedMessages, options)) {
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
    return DynamicModelCatalogService.listProviders().flatMap((p) => Object.keys(p.models)).map((id) => id);
  }
}
