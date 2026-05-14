import Anthropic from '@anthropic-ai/sdk';
import type {
  ChatMessage,
  ILlmProvider,
  LlmResponse,
  ProviderChatOptions,
  ToolCall,
  ToolDefinition,
} from '../../providers/ILlmProvider.js';

export type AnthropicDirectProviderAdapterOptions = {
  apiKey?: string | null;
  baseUrl?: string | null;
  modelName?: string | null;
  anthropicVersion?: string | null;
  client?: AnthropicLikeClient;
};

type AnthropicLikeClient = {
  messages: {
    create(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
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
      system: systemPrompt(messages) || undefined,
      messages: toAnthropicMessages(messages),
      tools: tools && tools.length > 0 ? tools.map(toAnthropicTool) : undefined,
    });

    return parseAnthropicResponse(response);
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

function toAnthropicMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => {
      if (message.role === 'assistant') {
        return {
          role: 'assistant',
          content: message.content || '',
        };
      }
      if (message.role === 'tool') {
        return {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: message.toolCallId || 'unknown',
            content: message.content || '',
          }],
        };
      }
      return {
        role: 'user',
        content: message.content || '',
      };
    });
}

function toAnthropicTool(tool: ToolDefinition): Record<string, unknown> {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  };
}

function systemPrompt(messages: ChatMessage[]): string {
  return messages
    .filter((message) => message.role === 'system')
    .map((message) => String(message.content || '').trim())
    .filter(Boolean)
    .join('\n');
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
