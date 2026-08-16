/**
 * Anthropic Claude Pure Wire Adapter for Zavorth.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  LLMAdapter,
  AdapterCapabilities,
  Message,
  CompleteOptions,
  Completion,
  StreamChunk,
  ModelInfo,
  ValidationResult,
} from '../LLMAdapter.js';

export interface AnthropicAdapterConfig {
  apiKey?: string;
  baseURL?: string;
  defaultModel?: string;
}

export class AnthropicAdapter implements LLMAdapter {
  public readonly name: string = 'anthropic';
  public readonly capabilities: AdapterCapabilities = {
    streaming: true,
    toolCalling: true,
    vision: true,
    reasoning: true,
    jsonMode: false,
  };

  private client: Anthropic | null = null;
  private defaultModel: string = 'claude-3-7-sonnet-20250219';

  constructor(config: AnthropicAdapterConfig = {}) {
    this.defaultModel = config.defaultModel || 'claude-3-7-sonnet-20250219';
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({
        apiKey,
        baseURL: config.baseURL,
      });
    }
  }

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('AnthropicAdapter requires ANTHROPIC_API_KEY or explicit configuration.');
      }
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  public async complete(messages: Message[], options: CompleteOptions = {}): Promise<Completion> {
    const client = this.getClient();
    const model = options.model || this.defaultModel;

    const systemMessage = messages.find(m => m.role === 'system')?.content;
    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: m.content,
      }));

    const response = await client.messages.create({
      model,
      system: systemMessage,
      messages: conversationMessages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature,
    });

    const textContent = response.content
      .filter(c => c.type === 'text')
      .map(c => (c as { type: 'text'; text: string }).text)
      .join('\n');

    return {
      id: response.id,
      model: response.model,
      content: textContent,
      finishReason: response.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  public async *streamComplete(messages: Message[], options: CompleteOptions = {}): AsyncIterable<StreamChunk> {
    const client = this.getClient();
    const model = options.model || this.defaultModel;

    const systemMessage = messages.find(m => m.role === 'system')?.content;
    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: m.content,
      }));

    const stream = await client.messages.create({
      model,
      system: systemMessage,
      messages: conversationMessages,
      max_tokens: options.maxTokens || 4096,
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { delta: event.delta.text };
      }
    }
  }

  public async listModels(): Promise<ModelInfo[]> {
    return [
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet (Hybrid Reasoning)', supportsStreaming: true, supportsTools: true },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', supportsStreaming: true, supportsTools: true },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', supportsStreaming: true, supportsTools: true },
    ];
  }

  public async validateConfig(): Promise<ValidationResult> {
    const start = Date.now();
    try {
      const client = this.getClient();
      await client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return { valid: true, latencyMs: Date.now() - start };
    } catch (e: any) {
      return { valid: false, error: e.message, latencyMs: Date.now() - start };
    }
  }

  public async initialize(config?: Record<string, unknown>): Promise<void> {
    if (config) {
      this.client = new Anthropic({
        apiKey: (config.apiKey as string) || process.env.ANTHROPIC_API_KEY,
        baseURL: config.baseUrl as string,
      });
    }
  }

  public async shutdown(): Promise<void> {
    this.client = null;
  }
}
