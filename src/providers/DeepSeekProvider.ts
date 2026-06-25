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
import { buildProviderRequestOptions } from './ProviderAbort.js';

export class DeepSeekProvider implements ILlmProvider {
  public readonly name = 'deepseek';
  private client: OpenAI;

  constructor() {
    if (!config.deepseekApiKey) {
      throw new Error('DEEPSEEK_API_KEY not configured in .env');
    }

    this.client = new OpenAI({
      apiKey: config.deepseekApiKey,
      baseURL: 'https://api.deepseek.com',
    });
  }

  public async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): Promise<LlmResponse> {
    const openaiMessages = this.convertMessages(messages);
    const nativeToolPayload = buildOpenAiCompatibleNativeToolPayload({
      providerName: this.name,
      tools,
      options,
    });
    const openaiTools = nativeToolPayload.tools;

    const response = await this.client.chat.completions.create({
      model: options?.modelName || config.deepseekModel,
      messages: openaiMessages,
      tools: openaiTools,
      tool_choice: openaiTools ? 'auto' : undefined,
      ...nativeToolPayload.extraBody,
    } as any, buildProviderRequestOptions(options) as any);

    const choice = response.choices[0];

    if (!choice) {
      return { content: 'Sem resposta do modelo.', toolCalls: [], finishReason: 'error' };
    }

    const toolCalls: ToolCall[] = extractFunctionToolCalls(choice.message.tool_calls);

    return {
      content: choice.message.content || null,
      toolCalls,
      finishReason: choice.finish_reason || 'stop',
      metadata: nativeToolPayload.metadata,
    };
  }

  private convertMessages(messages: ChatMessage[]): OpenAI.ChatCompletionMessageParam[] {
    return messages.map((message) => {
      const content = message.content || '';

      if (message.role === 'tool') {
        return {
          role: 'tool' as const,
          content,
          tool_call_id: message.toolCallId || 'unknown',
        };
      }
      if (message.role === 'assistant') {
        return {
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
        };
      }
      if (message.role === 'system') {
        return { role: 'system' as const, content };
      }
      return { role: 'user' as const, content };
    });
  }

  private convertTool(tool: ToolDefinition): OpenAI.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    };
  }
}
