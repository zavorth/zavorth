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
import { buildOpenAiCompatibleNativeToolPayload } from './ProviderNativeToolPayload.js';

export class OpenRouterProvider implements ILlmProvider {
  public readonly name = 'openrouter';
  private client: OpenAI;

  constructor() {
    if (!config.openRouterApiKey) {
      throw new Error('OPENROUTER_API_KEY nao configurada no .env');
    }

    console.log(`[OpenRouter] Inicializado com modelo: ${config.openRouterModel}`);
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
      console.log(`[OpenRouter] Chamando modelo: ${modelName}`);
      const nativeToolPayload = buildOpenAiCompatibleNativeToolPayload({
        providerName: this.name,
        tools,
        options,
      });
      const response = await this.client.chat.completions.create({
        model: modelName,
        messages: messages.map((message) => ({
          role: message.role as any,
          content: message.content as string,
          tool_call_id: message.toolCallId,
          tool_calls: message.toolCalls?.map((toolCall) => ({
            id: toolCall.id,
            type: 'function',
            function: {
              name: toolCall.name,
              arguments: JSON.stringify(toolCall.arguments),
            },
          })),
        })),
        max_tokens: config.maxTokens,
        tools: nativeToolPayload.tools,
        ...nativeToolPayload.extraBody,
      } as any);

      const choice = response.choices[0];
      const toolCalls: ToolCall[] = extractFunctionToolCalls(choice.message.tool_calls);

      return {
        content: choice.message.content,
        toolCalls,
        finishReason: choice.finish_reason as any,
        metadata: nativeToolPayload.metadata,
      };
    } catch (error: any) {
      console.error('[OpenRouter] Erro na requisicao:', error?.message || error);
      throw error;
    }
  }
}
