import OpenAI from 'openai';
import { logger } from '../../logger.js';
import { extractFunctionToolCalls } from '../openaiToolCalls.js';
import { convertChatMessagesToOpenAI } from '../utils/openaiConversion.js';
import {
  ChatMessage,
  ILlmProvider,
  LlmResponse,
  LlmStreamEvent,
  ProviderChatOptions,
  ToolCall,
  ToolDefinition,
} from '../ILlmProvider.js';
import { buildOpenAiCompatibleNativeToolPayload } from '../ProviderNativeToolPayload.js';
import { buildProviderRequestOptions, isProviderAbortError } from '../ProviderAbort.js';
import { buildOpenAiReasoningEffortBody } from '../reasoningEffortPayload.js';
import { streamOpenAICompatibleCompletion } from '../OpenAICompatibleStreaming.js';
import { errorMessage } from '../../utils/errorLike.js';

export interface OpenAICompatibleProviderConfig {
  name: string;
  apiKey: string;
  baseURL: string;
  defaultModel: string;
  defaultHeaders?: Record<string, string>;
  maxTokens?: number;
}

export abstract class OpenAICompatibleProvider implements ILlmProvider {
  public readonly name: string;
  protected readonly client: OpenAI;
  protected readonly defaultModel: string;
  protected readonly maxTokens: number;

  constructor(config: OpenAICompatibleProviderConfig) {
    this.name = config.name;
    this.defaultModel = config.defaultModel;
    this.maxTokens = config.maxTokens ?? 8000;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      defaultHeaders: config.defaultHeaders,
    });
  }

  protected get extraBody(): Record<string, unknown> {
    return {};
  }

  protected get providerMetadata(): Record<string, unknown> {
    return {};
  }

  protected buildNativeTools(
    _tools?: ToolDefinition[],
    _options?: ProviderChatOptions,
  ): any[] | undefined {
    return undefined;
  }

  public async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): Promise<LlmResponse> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const nativeToolPayload = buildOpenAiCompatibleNativeToolPayload({
          providerName: this.name,
          tools,
          options,
        });
        const mergedTools = this.mergeTools(nativeToolPayload.tools, options);
        const response = await this.client.chat.completions.create({
          model: options?.modelName || this.defaultModel,
          messages: convertChatMessagesToOpenAI(messages),
          max_tokens: this.maxTokens,
          tools: mergedTools,
          tool_choice: mergedTools ? 'auto' : undefined,
          ...nativeToolPayload.extraBody,
          ...this.extraBody,
          ...buildOpenAiReasoningEffortBody(options),
        } as any, buildProviderRequestOptions(options) as any);

        const choice = response.choices[0];
        if (!choice) {
          return { content: 'No model response.', toolCalls: [], finishReason: 'error' };
        }

        const toolCalls: ToolCall[] = extractFunctionToolCalls(choice.message.tool_calls);
        return {
          content: choice.message.content || null,
          toolCalls,
          finishReason: choice.finish_reason || 'stop',
          metadata: {
            ...nativeToolPayload.metadata,
            ...this.providerMetadata,
          },
        };
      } catch (error: unknown) {
        if (isProviderAbortError(error, options?.signal)) {
          throw error;
        }
        lastError = error;
        if (attempt === 0) {
          logger.warn(`[${this.name}] Request failed, retrying: ${errorMessage(error)}`);
        }
      }
    }
    throw lastError || new Error(`${this.name} request failed`);
  }

  public async *streamChat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): AsyncIterable<LlmStreamEvent> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const nativeToolPayload = buildOpenAiCompatibleNativeToolPayload({
          providerName: this.name,
          tools,
          options,
        });
        const mergedTools = this.mergeTools(nativeToolPayload.tools, options);
        const stream = await this.client.chat.completions.create({
          model: options?.modelName || this.defaultModel,
          messages: convertChatMessagesToOpenAI(messages),
          max_tokens: this.maxTokens,
          tools: mergedTools,
          tool_choice: mergedTools ? 'auto' : undefined,
          ...nativeToolPayload.extraBody,
          ...this.extraBody,
          ...buildOpenAiReasoningEffortBody(options),
          stream: true,
        } as any, buildProviderRequestOptions(options) as any);

        yield* streamOpenAICompatibleCompletion(stream as unknown as AsyncIterable<any>, {
          ...nativeToolPayload.metadata,
          ...this.providerMetadata,
        });
        return;
      } catch (error: unknown) {
        if (isProviderAbortError(error, options?.signal)) {
          throw error;
        }
        lastError = error;
        if (attempt === 0) {
          logger.warn(`[${this.name}] Streaming failed, retrying: ${errorMessage(error)}`);
        }
      }
    }
    throw lastError || new Error(`${this.name} streaming failed`);
  }

  private mergeTools(
    functionTools: any[] | undefined,
    options?: ProviderChatOptions,
  ): any[] | undefined {
    const nativeTools = this.buildNativeTools(undefined, options);
    if (!functionTools && !nativeTools) return undefined;
    return [...(functionTools || []), ...(nativeTools || [])];
  }
}
