import { describe, it, expect, beforeEach } from '@jest/globals';
import { AdapterRegistry } from '../../../src/adapters/llm/AdapterRegistry.js';
import type { LLMAdapter, ChatMessage, CompletionOptions, CompletionResult, StreamChunk, ModelMetadata } from '../../../src/adapters/llm/LLMAdapterContract.js';

class MockTestAdapter implements LLMAdapter {
  constructor(public readonly id: string, public readonly name: string) {}

  async complete(_messages: ChatMessage[], options: CompletionOptions): Promise<CompletionResult> {
    return {
      content: 'Mock response',
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      model: options.model,
      provider: this.name,
      latencyMs: 15,
      costUsd: 0.0001,
    };
  }

  async *streamComplete(_messages: ChatMessage[], _options: CompletionOptions): AsyncIterable<StreamChunk> {
    yield { deltaText: 'Mock ' };
    yield { deltaText: 'stream' };
  }

  async listModels(): Promise<ModelMetadata[]> {
    return [];
  }

  async validateConfig(): Promise<{ valid: boolean; reason?: string }> {
    return { valid: true };
  }
}

describe('AdapterRegistry (Universal Agnostic LLM Registry)', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  it('should register and retrieve adapters dynamically', () => {
    const openai = new MockTestAdapter('openai', 'OpenAI Engine');
    const anthropic = new MockTestAdapter('anthropic', 'Anthropic Engine');

    registry.register(openai);
    registry.register(anthropic);

    expect(registry.has('openai')).toBe(true);
    expect(registry.has('anthropic')).toBe(true);
    expect(registry.has('unknown')).toBe(false);
    expect(registry.get('openai')?.id).toBe('openai');
    expect(registry.list().length).toBe(2);
  });

  it('resolves adapters via explicit provider hint or the generic compatible fallback', () => {
    const openai = new MockTestAdapter('openai', 'OpenAI Engine');
    const anthropic = new MockTestAdapter('anthropic', 'Anthropic Engine');
    const google = new MockTestAdapter('google', 'Google Engine');
    const generic = new MockTestAdapter('openai-compatible', 'OpenAI Compatible');

    registry.register(openai);
    registry.register(anthropic);
    registry.register(google);
    registry.register(generic);

    expect(registry.resolveAdapterForModel('gpt-4o', 'anthropic')?.id).toBe('anthropic');
    expect(registry.resolveAdapterForModel('claude-3-7-sonnet', 'openai')?.id).toBe('openai');
    expect(registry.resolveAdapterForModel('gemini-2.5-flash', 'google')?.id).toBe('google');
    expect(registry.resolveAdapterForModel('totally-unknown-model')?.id).toBe('openai-compatible');
  });

  it('does not guess providers from model-name keywords', () => {
    const openai = new MockTestAdapter('openai', 'OpenAI Engine');
    const generic = new MockTestAdapter('openai-compatible', 'OpenAI Compatible');

    registry.register(openai);
    registry.register(generic);

    expect(registry.resolveAdapterForModel('claude-sonnet-model')?.id).toBe('openai-compatible');
    expect(registry.resolveAdapterForModel('gemini-2-flash')?.id).toBe('openai-compatible');
  });
});
