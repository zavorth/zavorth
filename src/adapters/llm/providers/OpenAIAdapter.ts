/**
 * OpenAI Pure Wire Adapter for Zavorth.
 */

import OpenAI from 'openai';
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

export interface OpenAIAdapterConfig {
  apiKey?: string;
  baseURL?: string;
  organization?: string;
  defaultModel?: string;
}

export class OpenAIAdapter implements LLMAdapter {
  public readonly name: string = 'openai';
  public readonly capabilities: AdapterCapabilities = {
    streaming: true,
    toolCalling: true,
    vision: true,
    reasoning: true,
    jsonMode: true,
  };

  private client: OpenAI | null = null;
  private defaultModel: string = 'gpt-4o';

  constructor(config: OpenAIAdapterConfig = {}) {
    this.defaultModel = config.defaultModel || 'gpt-4o';
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: config.baseURL,
        organization: config.organization,
      });
    }
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAIAdapter requires OPENAI_API_KEY or explicit configuration.');
      }
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  public async complete(messages: Message[], options: CompleteOptions = {}): Promise<Completion> {
    const client = this.getClient();
    const model = options.model || this.defaultModel;

    const formattedMessages = messages.map(m => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          content: m.content,
          tool_call_id: m.toolCallId || 'call_default',
        };
      }
      return {
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      };
    });

    const response = await client.chat.completions.create({
      model,
      messages: formattedMessages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      tools: options.tools?.map(t => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters as unknown as Record<string, unknown>,
        },
      })),
    });

    const choice = response.choices[0];
    return {
      id: response.id,
      model: response.model,
      content: choice?.message?.content || '',
      finishReason: choice?.finish_reason as any || 'stop',
      toolCalls: choice?.message?.tool_calls
        ?.filter((tc: any) => tc.type === 'function' && tc.function)
        .map((tc: any) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments || '{}'),
        })),
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    };
  }

  public async *streamComplete(messages: Message[], options: CompleteOptions = {}): AsyncIterable<StreamChunk> {
    const client = this.getClient();
    const model = options.model || this.defaultModel;

    const stream = await client.chat.completions.create({
      model,
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      stream: true,
      temperature: options.temperature,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      const finishReason = chunk.choices[0]?.finish_reason as any;
      yield {
        delta,
        finishReason,
      };
    }
  }

  public async listModels(): Promise<ModelInfo[]> {
    try {
      const client = this.getClient();
      const list = await client.models.list();
      return list.data.map(m => ({
        id: m.id,
        name: m.id,
        supportsStreaming: true,
        supportsTools: true,
      }));
    } catch {
      return [
        { id: 'gpt-4o', name: 'GPT-4o', supportsStreaming: true, supportsTools: true },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', supportsStreaming: true, supportsTools: true },
        { id: 'o1', name: 'o1 Reasoning', supportsStreaming: false, supportsTools: true },
      ];
    }
  }

  public async validateConfig(): Promise<ValidationResult> {
    const start = Date.now();
    try {
      const client = this.getClient();
      await client.models.list();
      return { valid: true, latencyMs: Date.now() - start };
    } catch (e: any) {
      return { valid: false, error: e.message, latencyMs: Date.now() - start };
    }
  }

  public async initialize(config?: Record<string, unknown>): Promise<void> {
    if (config) {
      this.client = new OpenAI({
        apiKey: (config.apiKey as string) || process.env.OPENAI_API_KEY,
        baseURL: config.baseUrl as string,
      });
    }
  }

  public async shutdown(): Promise<void> {
    this.client = null;
  }
}
