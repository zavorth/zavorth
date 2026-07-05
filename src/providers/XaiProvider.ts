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

const XAI_NATIVE_TOOLS = ['web_search', 'deep_search', 'citations'] as const;

export class XaiProvider implements ILlmProvider {
  public readonly name = 'xai';
  private client: OpenAI;

  constructor() {
    if (!config.xaiApiKey) {
      throw new Error('XAI_API_KEY not configured in .env');
    }

    this.client = new OpenAI({
      apiKey: config.xaiApiKey,
      baseURL: 'https://api.x.ai/v1',
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
    const xaiNativeTools = this.buildXaiNativeTools(options);

    const mergedTools = [...(openaiTools || []), ...xaiNativeTools];

    const response = await this.client.chat.completions.create({
      model: options?.modelName || config.xaiModel,
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
        provider: 'xai',
        nativeTools: xaiNativeTools.map((t) => (t as OpenAI.ChatCompletionFunctionTool).function?.name || 'unknown'),
      },
    };
  }

  private buildXaiNativeTools(options?: ProviderChatOptions): OpenAI.ChatCompletionTool[] {
    const requested = options?.providerNativeTools || [];
    const nativeTools: OpenAI.ChatCompletionTool[] = [];

    for (const request of requested) {
      if (request.name === 'provider_web_search') {
        nativeTools.push({
          type: 'function',
          function: { name: 'web_search', description: 'Search the web for current information.', parameters: {} },
        });
        nativeTools.push({
          type: 'function',
          function: { name: 'deep_search', description: 'Perform deep research on a topic.', parameters: {} },
        });
        nativeTools.push({
          type: 'function',
          function: { name: 'citations', description: 'Retrieve citations for provided information.', parameters: {} },
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
