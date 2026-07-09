import { logger } from '../logger.js';
import OpenAI from 'openai';
import { config } from '../config/index.js';
import { extractFunctionToolCalls } from './openaiToolCalls.js';
import {
  ChatMessage,
  ILlmProvider,
  LlmResponse,
  ProviderChatOptions,
  ToolCall,
  ToolDefinition,
} from './ILlmProvider.js';
import { buildProviderRequestOptions } from './ProviderAbort.js';

import { convertChatMessagesToOpenAI } from './openaiMessageConversion.js';
import { errorMessage } from '../utils/errorLike.js';
export class OpenCodeProvider implements ILlmProvider {

  public readonly name = 'opencode';

  private client: OpenAI;

  constructor() {
    if (!config.openCodeApiKey) {
      throw new Error('OPENCODE_API_KEY not configured in .env. Get your key at https://opencode.ai/auth');
    }

    logger.info(`[OpenCode] Inicializado com modelo: ${config.openCodeModel}`);
    this.client = new OpenAI({
      apiKey: config.openCodeApiKey,
      baseURL: 'https://opencode.ai/zen/v1',
      defaultHeaders: {
        'X-Title': 'Zavorth Bot',
      },
    });
  }

  public async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): Promise<LlmResponse> {
    const modelName = options?.modelName || config.openCodeModel;

    try {
      logger.info(`[OpenCode] Chamando modelo: ${modelName}`);
      const response = await this.client.chat.completions.create({
        model: modelName,
        messages: convertChatMessagesToOpenAI(messages),
        max_tokens: config.maxTokens,
        tools:
          tools && tools.length > 0
            ? tools.map((tool) => ({
                type: 'function',
                function: {
                  name: tool.name,
                  description: tool.description,
                  parameters: tool.parameters,
                },
              }))
            : undefined,
      } as OpenAI.ChatCompletionCreateParamsNonStreaming, buildProviderRequestOptions(options) as OpenAI.RequestOptions);

      const choice = response.choices[0];
      const toolCalls: ToolCall[] = extractFunctionToolCalls(choice.message.tool_calls);

      return {
        content: choice.message.content,
        toolCalls,
        finishReason: choice.finish_reason as LlmResponse['finishReason'],
      };
    } catch (error: unknown) {logger.error('[OpenCode] Request error:', errorMessage(error));
      throw error;
    }
  }
}
