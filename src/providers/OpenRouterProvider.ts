import { logger } from '../logger.js';
import OpenAI from 'openai';
import { config } from '../config/index.js';
import { extractFunctionToolCalls } from './openaiToolCalls.js';
import {
  ChatMessage,
  ILlmProvider,
  LlmResponse,
  LlmStreamEvent,
  ProviderChatOptions,
  ToolCall,
  ToolDefinition,
} from './ILlmProvider.js';
import { buildOpenAiCompatibleNativeToolPayload } from './ProviderNativeToolPayload.js';
import { buildProviderRequestOptions } from './ProviderAbort.js';
import { streamOpenAICompatibleCompletion } from './OpenAICompatibleStreaming.js';
import { convertChatMessagesToOpenAI } from './openaiMessageConversion.js';

export class OpenRouterProvider implements ILlmProvider {
  public readonly name = 'openrouter';
  private client: OpenAI;

  constructor() {
    if (!config.openRouterApiKey) {
      throw new Error('OPENROUTER_API_KEY not configured in .env');
    }

    logger.info(`[OpenRouter] Inicializado com modelo: ${config.openRouterModel}`);
    this.client = new OpenAI({
      apiKey: config.openRouterApiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/zavorth',
        'X-Title': 'Zavorth Bot',
      },
    });
  }

  public async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): Promise<LlmResponse> {
    const modelName = options?.modelName || config.openRouterModel;

    try {
      logger.info(`[OpenRouter] Chamando modelo: ${modelName}`);
      const nativeToolPayload = buildOpenAiCompatibleNativeToolPayload({
        providerName: this.name,
        tools,
        options,
      });
      const response = await this.client.chat.completions.create({
        model: modelName,
        messages: convertChatMessagesToOpenAI(messages),
        max_tokens: config.maxTokens,
        tools: nativeToolPayload.tools,
        ...nativeToolPayload.extraBody,
      } as OpenAI.ChatCompletionCreateParamsNonStreaming, buildProviderRequestOptions(options) as OpenAI.RequestOptions);

      const choice = response.choices[0];
      const toolCalls: ToolCall[] = extractFunctionToolCalls(choice.message.tool_calls);

      return {
        content: choice.message.content,
        toolCalls,
        finishReason: choice.finish_reason as LlmResponse['finishReason'],
        metadata: nativeToolPayload.metadata,
      };
    } catch (error: any) { const err = error; const e = error;
      logger.error('[OpenRouter] Request error:', error?.message || error);
      throw error;
    }
  }

  public async *streamChat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): AsyncIterable<LlmStreamEvent> {
    const modelName = options?.modelName || config.openRouterModel;

    try {
      logger.info(`[OpenRouter] Streaming modelo: ${modelName}`);
      const nativeToolPayload = buildOpenAiCompatibleNativeToolPayload({
        providerName: this.name,
        tools,
        options,
      });
      const stream = await this.client.chat.completions.create({
        model: modelName,
        messages: convertChatMessagesToOpenAI(messages),
        max_tokens: config.maxTokens,
        tools: nativeToolPayload.tools,
        ...nativeToolPayload.extraBody,
        stream: true,
      } as OpenAI.ChatCompletionCreateParamsStreaming, buildProviderRequestOptions(options) as OpenAI.RequestOptions);

      yield* streamOpenAICompatibleCompletion(stream, nativeToolPayload.metadata);
    } catch (error: any) { const err = error; const e = error;
      logger.error('[OpenRouter] Streaming error:', error?.message || error);
      throw error;
    }
  }
}
