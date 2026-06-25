import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type {
  ChatMessage,
  ILlmProvider,
  LlmResponse,
  ProviderChatOptions,
  ToolCall,
  ToolDefinition,
} from '../../providers/ILlmProvider.js';

export type BedrockClaudeProviderAdapterOptions = {
  region?: string | null;
  modelName?: string | null;
  client?: BedrockLikeClient;
};

type BedrockLikeClient = {
  send(command: unknown, options?: Record<string, unknown>): Promise<Record<string, unknown>>;
};

export class BedrockClaudeProviderAdapter implements ILlmProvider {
  public readonly name = 'bedrock-claude';
  private readonly region: string;
  private readonly defaultModelName: string;
  private readonly injectedClient: BedrockLikeClient | null;

  constructor(options: BedrockClaudeProviderAdapterOptions = {}) {
    this.region = String(options.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || '').trim();
    this.defaultModelName = String(
      options.modelName
        || process.env.BEDROCK_CLAUDE_MODEL
        || 'anthropic.claude-3-5-sonnet-latest-20250929-v1:0',
    ).trim();
    this.injectedClient = options.client || null;
  }

  public isConfigured(): boolean {
    return Boolean(this.region);
  }

  public async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): Promise<LlmResponse> {
    if (!this.isConfigured() && !this.injectedClient) {
      throw new Error('Bedrock Claude provider requires AWS_REGION or AWS_DEFAULT_REGION.');
    }

    const commandInput = {
      modelId: String(options?.modelName || this.defaultModelName),
      system: systemPrompt(messages)
        ? [{ text: systemPrompt(messages) }]
        : undefined,
      messages: toBedrockMessages(messages),
      toolConfig: tools && tools.length > 0
        ? {
            tools: tools.map((tool) => ({
              toolSpec: {
                name: tool.name,
                description: tool.description,
                inputSchema: {
                  json: tool.parameters,
                },
              },
            })),
          }
        : undefined,
    };
    const response = await this.client().send(
      new ConverseCommand(commandInput as never),
      options?.signal ? { abortSignal: options.signal } : undefined,
    );

    return parseBedrockResponse(response);
  }

  private client(): BedrockLikeClient {
    if (this.injectedClient) {
      return this.injectedClient;
    }
    return new BedrockRuntimeClient({
      region: this.region,
    }) as BedrockLikeClient;
  }
}

function parseBedrockResponse(response: Record<string, unknown>): LlmResponse {
  const output = asRecord(response.output);
  const message = asRecord(output?.message);
  const content = Array.isArray(message?.content) ? message.content : [];
  const text = content
    .map((block) => String(asRecord(block)?.text || ''))
    .filter(Boolean)
    .join('\n');
  const toolCalls: ToolCall[] = content.flatMap((block) => {
    const toolUse = asRecord(asRecord(block)?.toolUse);
    if (!toolUse) return [];
    return [{
      id: String(toolUse.toolUseId || `tool_${Date.now()}`),
      name: String(toolUse.name || 'unknown_tool'),
      arguments: asRecord(toolUse.input) || {},
    }];
  });

  return {
    content: text || null,
    toolCalls,
    finishReason: String(response.stopReason || 'stop'),
  };
}

function toBedrockMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: [{ text: message.content || '' }],
    }));
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
