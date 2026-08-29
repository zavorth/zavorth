import AnthropicVertex from '@anthropic-ai/vertex-sdk';
import type {
  ChatMessage,
  ILlmProvider,
  LlmResponse,
  ProviderChatOptions,
  ToolDefinition,
} from '../../providers/ILlmProvider.js';
import { parseAnthropicResponse } from './AnthropicDirectProviderAdapter.js';
import {
  extractSystemPrompt,
  toAnthropicMessages,
  toAnthropicTool,
} from '../../providers/utils/anthropicConversion.js';

export type AnthropicVertexProviderAdapterOptions = {
  projectId?: string | null;
  region?: string | null;
  modelName?: string | null;
  client?: AnthropicVertexLikeClient;
};

type AnthropicVertexLikeClient = {
  messages: {
    create(input: Record<string, unknown>, options?: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
};

export class AnthropicVertexProviderAdapter implements ILlmProvider {
  public readonly name = 'anthropic-vertex';
  private readonly projectId: string;
  private readonly region: string;
  private readonly defaultModelName: string;
  private readonly injectedClient: AnthropicVertexLikeClient | null;

  constructor(options: AnthropicVertexProviderAdapterOptions = {}) {
    this.projectId = String(
      options.projectId
        || process.env.ANTHROPIC_VERTEX_PROJECT_ID
        || process.env.GOOGLE_CLOUD_PROJECT
        || '',
    ).trim();
    this.region = String(
      options.region
        || process.env.ANTHROPIC_VERTEX_REGION
        || process.env.GOOGLE_CLOUD_LOCATION
        || 'us-east5',
    ).trim();
    this.defaultModelName = String(
      options.modelName
        || process.env.ANTHROPIC_VERTEX_MODEL
        || 'claude-sonnet-4-6',
    ).trim();
    this.injectedClient = options.client || null;
  }

  public isConfigured(): boolean {
    return Boolean(this.projectId && this.region);
  }

  public async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): Promise<LlmResponse> {
    if (!this.isConfigured() && !this.injectedClient) {
      throw new Error('Anthropic Vertex provider requires ANTHROPIC_VERTEX_PROJECT_ID or GOOGLE_CLOUD_PROJECT.');
    }

    const response = await this.client().messages.create({
      model: String(options?.modelName || this.defaultModelName),
      max_tokens: 1024,
      system: extractSystemPrompt(messages) || undefined,
      messages: toAnthropicMessages(messages),
      tools: tools && tools.length > 0
        ? tools.map(toAnthropicTool)
        : undefined,
    }, options?.signal ? { signal: options.signal } : undefined);

    return parseAnthropicResponse(response);
  }

  private client(): AnthropicVertexLikeClient {
    if (this.injectedClient) {
      return this.injectedClient;
    }

    return new AnthropicVertex({
      projectId: this.projectId,
      region: this.region,
    }) as unknown as AnthropicVertexLikeClient;
  }
}
