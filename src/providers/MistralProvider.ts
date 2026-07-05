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

export class MistralProvider implements ILlmProvider {
  public readonly name = 'mistral';
  private client: OpenAI;

  constructor() {
    if (!config.mistralApiKey) {
      throw new Error('MISTRAL_API_KEY not configured in .env');
    }

    this.client = new OpenAI({
      apiKey: config.mistralApiKey,
      baseURL: 'https://api.mistral.ai/v1',
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
    const mistralNativeTools = this.buildMistralNativeTools(options);

    const mergedTools = [...(openaiTools || []), ...mistralNativeTools];

    const response = await this.client.chat.completions.create({
      model: options?.modelName || config.mistralModel,
      messages: openaiMessages,
      tools: mergedTools.length > 0 ? mergedTools : undefined,
      tool_choice: mergedTools.length > 0 ? 'auto' : undefined,
      ...nativeToolPayload.extraBody,
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
        provider: 'mistral',
        nativeTools: mistralNativeTools.map((t) => (t as OpenAI.ChatCompletionFunctionTool).function?.name || 'unknown'),
      },
    };
  }

  private buildMistralNativeTools(options?: ProviderChatOptions): OpenAI.ChatCompletionTool[] {
    const requested = options?.providerNativeTools || [];
    const nativeTools: OpenAI.ChatCompletionTool[] = [];

    for (const request of requested) {
      if (request.name === 'provider_code_execution') {
        nativeTools.push({
          type: 'function',
          function: {
            name: 'code_execution',
            description: 'Execute code in a sandboxed environment.',
            parameters: {
              type: 'object',
              properties: {
                code: { type: 'string', description: 'Code to execute.' },
                language: { type: 'string', description: 'Programming language.' },
              },
              required: ['code'],
            },
          },
        });
      }
    }

    return nativeTools;
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
