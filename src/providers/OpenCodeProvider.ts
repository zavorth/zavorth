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

export class OpenCodeProvider implements ILlmProvider {
  public readonly name = 'opencode';
  private client: OpenAI;

  constructor() {
    if (!config.openCodeApiKey) {
      throw new Error('OPENCODE_API_KEY nao configurada no .env. Pegue sua chave em https://opencode.ai/auth');
    }

    console.log(`[OpenCode] Inicializado com modelo: ${config.openCodeModel}`);
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
      console.log(`[OpenCode] Chamando modelo: ${modelName}`);
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
      });

      const choice = response.choices[0];
      const toolCalls: ToolCall[] = extractFunctionToolCalls(choice.message.tool_calls);

      return {
        content: choice.message.content,
        toolCalls,
        finishReason: choice.finish_reason as any,
      };
    } catch (error: any) {
      console.error('[OpenCode] Erro na requisicao:', error?.message || error);
      throw error;
    }
  }
}
