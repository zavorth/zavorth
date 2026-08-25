import type OpenAI from 'openai';
import type { ChatMessage, InlineData, ToolDefinition } from '../ILlmProvider.js';
import type { OpenAiFunctionTool } from '../ProviderNativeToolPayload.js';


export function convertChatMessagesToOpenAI(
  messages: ChatMessage[],
): OpenAI.ChatCompletionMessageParam[] {
  const result: OpenAI.ChatCompletionMessageParam[] = [];
  let pendingToolInlineData: InlineData[] = [];

  const flushToolMedia = () => {
    if (pendingToolInlineData.length === 0) {
      return;
    }
    const content = buildOpenAIUserContent({
      role: 'user',
      content: '[Media captured by tool for multimodal analysis]',
      inlineData: pendingToolInlineData,
    });
    if (Array.isArray(content)) {
      result.push({ role: 'user' as const, content: content as OpenAI.ChatCompletionContentPart[] });
    }
    pendingToolInlineData = [];
  };

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];

    if (message.role === 'tool') {
      result.push({
        role: 'tool' as const,
        content: message.content || '',
        tool_call_id: message.toolCallId || 'unknown',
      });
      if (message.inlineData?.length) {
        pendingToolInlineData.push(...message.inlineData);
      }
      if (messages[index + 1]?.role !== 'tool') {
        flushToolMedia();
      }
      continue;
    }

    flushToolMedia();

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
      content: buildOpenAIUserContent(message),
    });
  }

  flushToolMedia();
  return result;
}

export function buildOpenAIUserContent(
  message: ChatMessage,
): string | OpenAI.ChatCompletionContentPart[] {
  const textContent = message.content || '';

  if (!message.inlineData || message.inlineData.length === 0) {
    return textContent;
  }

  const content: OpenAI.ChatCompletionContentPart[] = [];

  if (textContent) {
    content.push({ type: 'text', text: textContent });
  }

  for (const item of message.inlineData) {
    if (item.mimeType.startsWith('image/')) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${item.mimeType};base64,${item.data}` },
      });
      continue;
    }
    if (item.mimeType.startsWith('audio/')) {
      content.push({
        type: 'input_audio',
        input_audio: {
          data: item.data,
          format: resolveAudioFormat(item.mimeType) as 'wav' | 'mp3',
        },
      });
    }
  }

  return content.length > 0 ? content : textContent;
}

export function convertToolDefinitions(tools?: ToolDefinition[]): OpenAiFunctionTool[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

function resolveAudioFormat(mimeType: string): string {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('ogg')) return 'ogg';
  if (normalized.includes('webm')) return 'webm';
  if (normalized.includes('mp4') || normalized.includes('m4a')) return 'mp4';
  return normalized.split('/')[1]?.split(';')[0] || 'wav';
}
