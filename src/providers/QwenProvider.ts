import OpenAI from 'openai';
import { config } from '../config/index.js';
import { extractFunctionToolCalls } from './openaiToolCalls.js';
import { convertChatMessagesToOpenAI } from './openaiMessageConversion.js';
import {
  ChatMessage,
  ILlmProvider,
  LlmResponse,
  ProviderChatOptions,
  ToolCall,
  ToolDefinition,
} from './ILlmProvider.js';
import { buildProviderRequestOptions } from './ProviderAbort.js';

export class QwenProvider implements ILlmProvider {
  public readonly name = 'qwen';
  private client: OpenAI;

  constructor() {
    if (!config.puterAuthToken) {
      throw new Error(
        'PUTER_AUTH_TOKEN not configured in .env. To use Qwen via Puter, generate a token with "npm run puter:auth" and save it in .env.',
      );
    }

    this.client = new OpenAI({
      apiKey: config.puterAuthToken,
      baseURL: 'https://api.puter.com/puterai/openai/v1',
      timeout: 15000,
      maxRetries: 0,
    });
  }

  public async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): Promise<LlmResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.getResolvedModel(options?.modelName),
        messages: convertChatMessagesToOpenAI(messages),
        tools:
          tools && tools.length > 0
            ? tools.map((tool) => ({
                type: 'function' as const,
                function: {
                  name: tool.name,
                  description: tool.description,
                  parameters: tool.parameters,
                },
              }))
            : undefined,
        max_tokens: config.maxTokens,
      }, buildProviderRequestOptions(options) as any);

      const choice = response.choices[0];
      const toolCalls: ToolCall[] = extractFunctionToolCalls(choice?.message.tool_calls);

      return {
        content: choice?.message.content || null,
        toolCalls,
        finishReason: choice?.finish_reason || 'stop',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (/auth|token|unauthorized|forbidden|401|403/i.test(message)) {
        throw new Error(
          `Failed to query Qwen through the Puter OpenAI-compatible API: invalid authentication or permission. Check PUTER_AUTH_TOKEN. Details: ${message}`,
        );
      }

      throw new Error(`Failed to query Qwen through the Puter OpenAI-compatible API: ${message}`);
    }
  }

  private getResolvedModel(modelOverride?: string): string {
    const rawModel = String(modelOverride || config.qwenModel).trim();

    if (!rawModel) {
      return 'openrouter:qwen/qwen3.5-plus-02-15';
    }

    if (rawModel.startsWith('openrouter:')) {
      return rawModel;
    }

    if (rawModel.includes(':')) {
      return rawModel;
    }

    if (rawModel.startsWith('qwen/')) {
      return `openrouter:${rawModel}`;
    }

    return `openrouter:qwen/${rawModel}`;
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
        // ZavorthControl controls: vision passthrough for tool responses.
        if (message.inlineData && message.inlineData.length > 0) {
          const visionContent: Array<OpenAI.ChatCompletionContentPartText | OpenAI.ChatCompletionContentPartImage> = [
            { type: 'text', text: '[Imagem capturada pela ferramenta para analise visual]' },
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
