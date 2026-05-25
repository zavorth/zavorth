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

export class OpenAIProvider implements ILlmProvider {
  public readonly name = 'openai';
  private clients: OpenAI[];
  private currentClientIndex = 0;

  constructor() {
    const keys =
      Array.isArray((config as any).openaiApiKeys) && (config as any).openaiApiKeys.length > 0
        ? (config as any).openaiApiKeys
        : [config.openaiApiKey].filter(Boolean);

    if (keys.length === 0) {
      throw new Error('OPENAI_API_KEY nao configurada no .env');
    }

    this.clients = keys.map((apiKey: string) => new OpenAI({ apiKey }));
  }

  public async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): Promise<LlmResponse> {
    let lastError: any;
    for (let attempt = 0; attempt < this.clients.length; attempt += 1) {
      const clientIndex = (this.currentClientIndex + attempt) % this.clients.length;
      const client = this.clients[clientIndex];
      try {
        const response = await client.chat.completions.create({
          model: options?.modelName || config.openaiModel,
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
        });

        if (attempt > 0) {
          console.log(`[OpenAI Failover] Request succeeded using secondary key (${clientIndex + 1}/${this.clients.length}).`);
        }
        this.currentClientIndex = clientIndex;
        const choice = response.choices[0];
        const toolCalls: ToolCall[] = extractFunctionToolCalls(choice.message.tool_calls);

        return {
          content: choice.message.content,
          toolCalls,
          finishReason: choice.finish_reason as any,
        };
      } catch (error: any) {
        lastError = error;
        console.warn(`[OpenAI] Request failed with key ${clientIndex + 1}: ${error?.message || error}`);
      }
    }

    throw lastError || new Error('Falha desconhecida no OpenAI');
  }

  private convertMessages(messages: ChatMessage[]): OpenAI.ChatCompletionMessageParam[] {
    const result: OpenAI.ChatCompletionMessageParam[] = [];
    for (const message of messages) {
      if (message.role === 'tool') {
        const toolMsg: OpenAI.ChatCompletionMessageParam = {
          role: 'tool' as const,
          content: message.content || '',
          tool_call_id: message.toolCallId || 'unknown',
        };
        result.push(toolMsg);
        // Dashboard controls: Se a tool response trouxer inlineData (screenshot/visão),
        // emite como mensagem 'user' complementar para que o modelo enxergue a imagem.
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
