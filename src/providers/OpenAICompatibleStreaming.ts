import type { LlmResponse, LlmStreamEvent, ToolCall } from './ILlmProvider.js';
import { logger } from '../logger.js';

type OpenAICompatibleStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: unknown;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string | null;
  }>;
};

type ToolCallAccumulator = {
  index: number;
  id: string;
  name: string;
  argumentsText: string;
};

export async function* streamOpenAICompatibleCompletion(
  stream: AsyncIterable<OpenAICompatibleStreamChunk>,
  metadata?: Record<string, unknown>,
): AsyncIterable<LlmStreamEvent> {
  const streamMetadata = {
    ...(metadata || {}),
    providerNativeTokenStreaming: true,
    providerNativeStreamSource: 'openai-compatible-chat-completions',
  };
  const toolCalls = new Map<number, ToolCallAccumulator>();
  let accumulated = '';
  let chunkIndex = 0;
  let finishReason = 'stop';

  yield {
    type: 'start',
    accumulated: '',
    done: false,
    metadata: streamMetadata,
  };

  for await (const chunk of stream) {
    for (const choice of chunk.choices || []) {
      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
      }
      const delta = choice.delta || {};
      const contentDelta = normalizeContentDelta(delta.content);
      if (contentDelta) {
        accumulated += contentDelta;
        chunkIndex += 1;
        yield {
          type: 'delta',
          delta: contentDelta,
          accumulated,
          chunkIndex,
          done: false,
          metadata: streamMetadata,
        };
      }

      for (const rawToolCall of delta.tool_calls || []) {
        const index = Number.isFinite(rawToolCall.index) ? Number(rawToolCall.index) : toolCalls.size;
        const existing = toolCalls.get(index) || {
          index,
          id: rawToolCall.id || `call_${index}`,
          name: '',
          argumentsText: '',
        };
        if (rawToolCall.id) {
          existing.id = rawToolCall.id;
        }
        if (rawToolCall.function?.name) {
          existing.name += rawToolCall.function.name;
        }
        if (rawToolCall.function?.arguments) {
          existing.argumentsText += rawToolCall.function.arguments;
        }
        toolCalls.set(index, existing);
        yield {
          type: 'tool_call_delta',
          toolCallDelta: {
            index,
            id: existing.id,
            name: existing.name || undefined,
            argumentsDelta: rawToolCall.function?.arguments,
            arguments: existing.argumentsText || undefined,
          },
          accumulated,
          done: false,
          metadata: streamMetadata,
        };
      }
    }
  }

  const response: LlmResponse = {
    content: accumulated || null,
    toolCalls: buildToolCalls(toolCalls),
    finishReason,
    metadata: streamMetadata,
  };

  yield {
    type: 'done',
    accumulated,
    response,
    done: true,
    metadata: streamMetadata,
  };
}

function normalizeContentDelta(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && 'text' in part) {
        return String((part as { text?: unknown }).text || '');
      }
      return '';
    }).join('');
  }
  return '';
}

function buildToolCalls(toolCalls: Map<number, ToolCallAccumulator>): ToolCall[] {
  return Array.from(toolCalls.values())
    .sort((a, b) => a.index - b.index)
    .filter((toolCall) => toolCall.name)
    .map((toolCall) => ({
      id: toolCall.id,
      name: toolCall.name,
      arguments: parseToolArguments(toolCall.argumentsText),
    }));
}

function parseToolArguments(rawValue: string): Record<string, unknown> {
  const normalized = String(rawValue || '').trim();
  if (!normalized) {
    return {};
  }

  try {
    const parsed = JSON.parse(normalized);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch (error) {
    logger.warn('[Open A I Compatible Streaming] JSON parse failed', error);
    return { raw: normalized };
  }
}
