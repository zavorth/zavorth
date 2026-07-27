import { logger } from '../logger.js';
import OpenAI from 'openai';
import { config } from '../config/index.js';
import { extractFunctionToolCalls } from './openaiToolCalls.js';
import { convertChatMessagesToOpenAI } from './openaiMessageConversion.js';
import { ILlmProvider, ChatMessage, ToolDefinition, LlmResponse, ToolCall, ProviderChatOptions, LlmStreamEvent } from './ILlmProvider.js';
import { buildOpenAiCompatibleNativeToolPayload } from './ProviderNativeToolPayload.js';
import { buildProviderRequestOptions } from './ProviderAbort.js';
import { buildOpenAiReasoningEffortBody } from './reasoningEffortPayload.js';
import { streamOpenAICompatibleCompletion } from './OpenAICompatibleStreaming.js';
import { errorMessage } from '../utils/errorLike.js';
export type GatewayProviderOptions = {

  name?: string;

  apiKey?: string;
  baseURL?: string;
  modelName?: string | null;
  defaultHeaders?: Record<string, string>;
};

/**
 * GatewayProvider - usa um endpoint OpenAI-compatible local do AIGateway
 * para desacoplar o Zavorth de provedores individuais.
 */
export class GatewayProvider implements ILlmProvider {
  public readonly name: string;
  private client: OpenAI;
  private readonly defaultModelName: string;

  constructor(options: GatewayProviderOptions = {}) {
    this.name = options.name || 'AIGateway';
    this.defaultModelName = String(options.modelName || config.AIGatewayModel || '').trim() || 'gpt-4o';
    this.client = new OpenAI({
      apiKey: options.apiKey || config.AIGatewayApiKey || config.openaiApiKey || 'AIGateway-local',
      baseURL: options.baseURL || config.AIGatewayBaseUrl,
      defaultHeaders: options.defaultHeaders,
    });
  }

  public async chat(messages: ChatMessage[], tools?: ToolDefinition[], options?: ProviderChatOptions): Promise<LlmResponse> {
    try {
      const nativeToolPayload = buildOpenAiCompatibleNativeToolPayload({
        providerName: this.name,
        tools,
        options,
      });
      const response = await this.client.chat.completions.create({
        model: options?.modelName || this.defaultModelName,
        messages: convertChatMessagesToOpenAI(messages),
        tools: nativeToolPayload.tools,
        ...nativeToolPayload.extraBody,
        ...buildOpenAiReasoningEffortBody(options),
      } as OpenAI.ChatCompletionCreateParamsNonStreaming, buildProviderRequestOptions(options) as OpenAI.RequestOptions);

      const choice = response.choices[0];
      const toolCalls: ToolCall[] = extractFunctionToolCalls(choice.message.tool_calls);

      return {
        content: choice.message.content,
        toolCalls,
        finishReason: choice.finish_reason as LlmResponse['finishReason'],
        metadata: nativeToolPayload.metadata,
      };
    } catch (error: unknown) {logger.error('[AIGateway] Request error:', errorMessage(error));
      throw error;
    }
  }

  public async *streamChat(messages: ChatMessage[], tools?: ToolDefinition[], options?: ProviderChatOptions): AsyncIterable<LlmStreamEvent> {
    try {
      const nativeToolPayload = buildOpenAiCompatibleNativeToolPayload({
        providerName: this.name,
        tools,
        options,
      });
      const stream = await this.client.chat.completions.create({
        model: options?.modelName || this.defaultModelName,
        messages: convertChatMessagesToOpenAI(messages),
        tools: nativeToolPayload.tools,
        ...nativeToolPayload.extraBody,
        ...buildOpenAiReasoningEffortBody(options),
        stream: true,
      } as OpenAI.ChatCompletionCreateParamsStreaming, buildProviderRequestOptions(options) as OpenAI.RequestOptions);

      yield* streamOpenAICompatibleCompletion(stream, nativeToolPayload.metadata);
    } catch (error: unknown) {logger.error('❌ [AIGateway] Streaming error:', errorMessage(error));
      throw error;
    }
  }

  private convertMessages(messages: ChatMessage[]): OpenAI.ChatCompletionMessageParam[] {
    const result: OpenAI.ChatCompletionMessageParam[] = [];
    for (const message of messages) {
      if (message.role === 'tool') {
        result.push({
          role: 'tool' as const,
          content: message.content || '',
          tool_call_id: message.toolCallId || 'unknown',
        });
        // ZavorthControl controls: Vision passthrough para tool responses
        if (message.inlineData && message.inlineData.length > 0) {
          const visionContent: Array<OpenAI.ChatCompletionContentPartText | OpenAI.ChatCompletionContentPartImage> = [
            { type: 'text', text: '[Image captured by the tool for visual analysis]' },
          ];
          for (const item of message.inlineData) {
            if (item.mimeType.startsWith('image/')) {
              visionContent.push({
                type: 'image_url',
                image_url: { url: `data:${item.mimeType};base64,${item.data}` },
              });
            }
          }
          if (visionContent.length > 1) {
            result.push({ role: 'user' as const, content: visionContent });
          }
        }
        continue;
      }

      if (message.role === 'assistant') {
        result.push({
          role: 'assistant' as const,
          content: message.content || null,
          tool_calls: message.toolCalls?.map((toolCall) => ({
            id: toolCall.id,
            type: 'function' as const,
            function: {
              name: toolCall.name,
              arguments: JSON.stringify(toolCall.arguments),
            },
          })),
        });
        continue;
      }

      if (message.role === 'system') {
        result.push({
          role: 'system' as const,
          content: message.content || '',
        });
        continue;
      }

      result.push({
        role: 'user' as const,
        content: this.buildUserContent(message),
      });
    }
    return result;
  }

  private buildUserContent(
    message: ChatMessage,
  ): string | Array<OpenAI.ChatCompletionContentPartText | OpenAI.ChatCompletionContentPartImage> {
    const textContent = message.content || '';

    if (!message.inlineData || message.inlineData.length === 0) {
      return textContent;
    }

    const content: Array<OpenAI.ChatCompletionContentPartText | OpenAI.ChatCompletionContentPartImage> = [];

    if (textContent) {
      content.push({
        type: 'text',
        text: textContent,
      });
    }

    for (const item of message.inlineData) {
      if (!item.mimeType.startsWith('image/')) {
        continue;
      }

      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${item.mimeType};base64,${item.data}`,
        },
      });
    }

    return content.length > 0 ? content : textContent;
  }
}
