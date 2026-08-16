import { describe, it, expect, beforeEach } from '@jest/globals';
import { AgentLLMRuntime } from '../../../src/runtime/agent/AgentLLMRuntime.js';
import { AdapterRegistry } from '../../../src/adapters/llm/AdapterRegistry.js';
import type { LLMAdapter, ChatMessage, CompletionOptions, CompletionResult, StreamChunk, ModelMetadata } from '../../../src/adapters/llm/LLMAdapterContract.js';

class MockFailingAdapter implements LLMAdapter {
  constructor(public readonly id: string, public readonly name: string) {}

  async complete(_messages: ChatMessage[], _options: CompletionOptions): Promise<CompletionResult> {
    throw new Error(`[${this.name}] Upstream API rate limit`);
  }

  async *streamComplete(_messages: ChatMessage[], _options: CompletionOptions): AsyncIterable<StreamChunk> {
    throw new Error(`[${this.name}] Stream error`);
  }

  async listModels(): Promise<ModelMetadata[]> {
    return [];
  }

  async validateConfig(): Promise<{ valid: boolean; reason?: string }> {
    return { valid: false };
  }
}

class MockSuccessfulAdapter implements LLMAdapter {
  constructor(public readonly id: string, public readonly name: string, public readonly text = 'Success output') {}

  async complete(_messages: ChatMessage[], options: CompletionOptions): Promise<CompletionResult> {
    return {
      content: this.text,
      finishReason: 'stop',
      usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
      model: options.model,
      provider: this.name,
      latencyMs: 40,
      costUsd: 0.0005,
    };
  }

  async *streamComplete(_messages: ChatMessage[], _options: CompletionOptions): AsyncIterable<StreamChunk> {
    yield { deltaText: 'Chunk 1 ' };
    yield { deltaText: 'Chunk 2' };
  }

  async listModels(): Promise<ModelMetadata[]> {
    return [];
  }

  async validateConfig(): Promise<{ valid: boolean; reason?: string }> {
    return { valid: true };
  }
}

describe('AgentLLMRuntime (Orchestrator, Circuit Breaker & Dynamic Fallback)', () => {
  let registry: AdapterRegistry;
  let runtime: AgentLLMRuntime;

  beforeEach(() => {
    registry = new AdapterRegistry();
    runtime = new AgentLLMRuntime({
      registry,
      fallbackAdapters: ['backup-provider'],
    });
  });

  it('should complete successfully using primary resolved adapter', async () => {
    const primary = new MockSuccessfulAdapter('openai', 'OpenAI', 'Resolved output');
    registry.register(primary);

    const res = await runtime.complete(
      [{ role: 'user', content: 'Hello' }],
      { model: 'gpt-4o' }
    );

    expect(res.content).toBe('Resolved output');
    expect(res.provider).toBe('OpenAI');
  });

  it('should automatically cascade to fallback adapter when primary adapter fails', async () => {
    const failingPrimary = new MockFailingAdapter('anthropic', 'Anthropic');
    const workingBackup = new MockSuccessfulAdapter('backup-provider', 'Backup Pro', 'Recovered by fallback');

    registry.register(failingPrimary);
    registry.register(workingBackup);

    const res = await runtime.complete(
      [{ role: 'user', content: 'Analyze code' }],
      { model: 'claude-3-7-sonnet' }
    );

    expect(res.content).toBe('Recovered by fallback');
    expect(res.provider).toBe('Backup Pro');
  });

  it('should stream chunks smoothly through active adapter', async () => {
    const primary = new MockSuccessfulAdapter('openai', 'OpenAI');
    registry.register(primary);

    const chunks: string[] = [];
    for await (const chunk of runtime.streamComplete([{ role: 'user', content: 'Hi' }], { model: 'gpt-4o' })) {
      chunks.push(chunk.deltaText);
    }

    expect(chunks.join('')).toBe('Chunk 1 Chunk 2');
  });
});
