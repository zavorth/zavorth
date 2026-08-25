import type { RequestOptions } from '@google/generative-ai';

import { config } from '../config/index.js';

import {
  ChatMessage,
  ILlmProvider,
  LlmResponse,
  LlmStreamEvent,
  ProviderChatOptions,
  ToolDefinition,
} from './ILlmProvider.js';
import { GeminiTransport } from './transports/GeminiTransport.js';

export class GeminiProvider implements ILlmProvider {
  public readonly name = 'gemini';

  private readonly transport: GeminiTransport;

  constructor() {
    const keys =
      config.geminiApiKeys && config.geminiApiKeys.length > 0
        ? config.geminiApiKeys
        : [config.geminiApiKey].filter(Boolean);

    if (keys.length === 0) {
      throw new Error('No GEMINI_API_KEY configurada no .env');
    }

    this.transport = new GeminiTransport(keys, config.geminiModel, this.buildRequestOptions());
  }

  public chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): Promise<LlmResponse> {
    return this.transport.chat(messages, tools, options);
  }

  public streamChat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): AsyncIterable<LlmStreamEvent> {
    return this.transport.streamChat(messages, tools, options);
  }

  private buildRequestOptions(): RequestOptions | undefined {
    const requestOptions: RequestOptions = {};

    if (config.geminiApiBaseUrl) {
      requestOptions.baseUrl = config.geminiApiBaseUrl;
    }

    if (config.geminiApiVersion) {
      requestOptions.apiVersion = config.geminiApiVersion;
    }

    if (config.geminiApiClient) {
      requestOptions.apiClient = config.geminiApiClient;
    }

    if (config.geminiCustomHeaders && Object.keys(config.geminiCustomHeaders).length > 0) {
      requestOptions.customHeaders = config.geminiCustomHeaders;
    }

    return Object.keys(requestOptions).length > 0 ? requestOptions : undefined;
  }
}
