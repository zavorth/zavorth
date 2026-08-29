import Anthropic from '@anthropic-ai/sdk';
import type {
  ChatMessage,
  ILlmProvider,
  LlmResponse,
  LlmStreamEvent,
  ProviderChatOptions,
  ToolCall,
  ToolDefinition,
} from '../../providers/ILlmProvider.js';
import {
  extractSystemPrompt,
  toAnthropicMessages,
  toAnthropicTool,
} from '../../providers/utils/anthropicConversion.js';

interface AnthropicMessageDeltaEvent {
  type: 'message_delta';
  delta: {
    stop_reason: string | null;
  };
}

interface AnthropicContentBlockDeltaEvent {
  type: 'content_block_delta';
  delta: {
    type: 'text_delta' | 'thinking_delta' | 'input_json_delta';
    text?: string;
  };
}

type AnthropicStreamEvent = AnthropicMessageDeltaEvent | AnthropicContentBlockDeltaEvent;

type AnthropicLikeClient = {
  messages: {
    create(input: Record<string, unknown>, options?: Record<string, unknown>): Promise<Record<string, unknown>>;
    create(input: { stream: true } & Record<string, unknown>, options?: Record<string, unknown>): AsyncIterable<AnthropicStreamEvent>;
  };
};

export type AnthropicDirectProviderAdapterOptions = {
  apiKey?: string | null;
  baseUrl?: string | null;
  modelName?: string | null;
  anthropicVersion?: string | null;
  client?: AnthropicLikeClient;
};

export class AnthropicDirectProviderAdapter implements ILlmProvider {
  public readonly name = 'anthropic-direct';
  private readonly apiKey: string;
  private readonly baseUrl: string | null;
  private readonly defaultModelName: string;
  private readonly anthropicVersion: string;
  private readonly injectedClient: AnthropicLikeClient | null;

  constructor(options: AnthropicDirectProviderAdapterOptions = {}) {
    this.apiKey = String(options.apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
    this.baseUrl = normalizeOptional(options.baseUrl || process.env.ANTHROPIC_BASE_URL);
    this.defaultModelName = String(options.modelName || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6').trim();
    this.anthropicVersion = String(options.anthropicVersion || process.env.ANTHROPIC_VERSION || '2023-06-01').trim();
    this.injectedClient = options.client || null;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  public async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): Promise<LlmResponse> {
    if (!this.isConfigured() && !this.injectedClient) {
      throw new Error('Anthropic direct provider requires ANTHROPIC_API_KEY.');
    }

    const response = await this.client().messages.create({
      model: String(options?.modelName || this.defaultModelName),
      max_tokens: 1024,
      system: extractSystemPrompt(messages) || undefined,
      messages: toAnthropicMessages(messages),
      tools: tools && tools.length > 0 ? tools.map(toAnthropicTool) : undefined,
    }, options?.signal ? { signal: options.signal } : undefined);

    return parseAnthropicResponse(response);
  }

  public async *streamChat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): AsyncIterable<LlmStreamEvent> {
    if (!this.isConfigured() && !this.injectedClient) {
      throw new Error('Anthropic direct provider requires ANTHROPIC_API_KEY.');
    }

    const modelName = String(options?.modelName || this.defaultModelName);
    const streamMetadata = {
      providerNativeTokenStreaming: true,
      providerNativeStreamSource: 'anthropic-messages-stream',
    };
    const stream = await this.client().messages.create({
      model: modelName,
      max_tokens: 1024,
      system: extractSystemPrompt(messages) || undefined,
      messages: toAnthropicMessages(messages),
      tools: tools && tools.length > 0 ? tools.map(toAnthropicTool) : undefined,
      stream: true,
    }, options?.signal ? { signal: options.signal } : undefined) as unknown as AsyncIterable<AnthropicStreamEvent>;

    yield {
      type: 'start',
      accumulated: '',
      done: false,
      metadata: streamMetadata,
    };

    let accumulated = '';
    let chunkIndex = 0;
    let finishReason = 'stop';

    for await (const event of stream) {
      if (event.type === 'message_delta' && event.delta?.stop_reason) {
        finishReason = String(event.delta.stop_reason || finishReason);
      }
      const deltaText = event.type === 'content_block_delta' && event.delta?.type === 'text_delta'
        ? String(event.delta.text || '')
        : '';
      if (!deltaText) {
        continue;
      }
      accumulated += deltaText;
      chunkIndex += 1;
      yield {
        type: 'delta',
        delta: deltaText,
        accumulated,
        chunkIndex,
        done: false,
        metadata: streamMetadata,
      };
    }

    yield {
      type: 'done',
      accumulated,
      done: true,
      response: {
        content: accumulated || null,
        toolCalls: [],
        finishReason,
        metadata: streamMetadata,
      },
      metadata: streamMetadata,
    };
  }

  private client(): AnthropicLikeClient {
    if (this.injectedClient) {
      return this.injectedClient;
    }

    return new Anthropic({
      apiKey: this.apiKey,
      baseURL: this.baseUrl || undefined,
      defaultHeaders: {
        'anthropic-version': this.anthropicVersion,
      },
    }) as unknown as AnthropicLikeClient;
  }
}

export function parseAnthropicResponse(response: Record<string, unknown>): LlmResponse {
  const contentBlocks = Array.isArray(response.content) ? response.content : [];
  const text = contentBlocks
    .map((block) => {
      const record = asRecord(block);
      return record?.type === 'text' ? String(record.text || '') : '';
    })
    .filter(Boolean)
    .join('\n');
  const toolCalls: ToolCall[] = contentBlocks.flatMap((block) => {
    const record = asRecord(block);
    if (record?.type !== 'tool_use') {
      return [];
    }
    return [{
      id: String(record.id || `tool_${Date.now()}`),
      name: String(record.name || 'unknown_tool'),
      arguments: asRecord(record.input) || {},
    }];
  });

  return {
    content: text || null,
    toolCalls,
    finishReason: String(response.stop_reason || 'stop'),
  };
}


function asRecord(value: unknown): Record<string, unknown> | null {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeOptional(value: unknown): string | null {
  const text = String(value || '').trim();
  return text || null;
}
