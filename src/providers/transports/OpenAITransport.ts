import OpenAI from 'openai';
import type {
  ChatMessage,
  LlmResponse,
  LlmStreamEvent,
  ProviderChatOptions,
  ToolDefinition,
  ToolCall,
} from '../ILlmProvider.js';
import type { TransportAdapter } from './TransportAdapter.js';
import { convertChatMessagesToOpenAI, convertToolDefinitions } from '../utils/openaiConversion.js';
import { buildOpenAiReasoningEffortBody } from '../reasoningEffortPayload.js';
import { isProviderAbortError } from '../ProviderAbort.js';
import { logger } from '../../logger.js';
import { errorMessage } from '../../utils/errorLike.js';

type StreamChunk = {
  choices?: Array<{
    delta?: {
      content?: unknown;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
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

export class OpenAITransport implements TransportAdapter {
  public readonly name = 'openai';

  private clients: OpenAI[];
  private currentClientIndex = 0;

  constructor(apiKeys: string[], private defaultModel: string) {
    if (apiKeys.length === 0) {
      throw new Error('At least one OpenAI API key is required');
    }
    this.clients = apiKeys.map((key) => new OpenAI({ apiKey: key }));
  }

  public async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): Promise<LlmResponse> {
    let lastError: unknown;
    for (let attempt = 0; attempt < this.clients.length; attempt += 1) {
      const clientIndex = (this.currentClientIndex + attempt) % this.clients.length;
      const client = this.clients[clientIndex];
      try {
        const response = await client.chat.completions.create(
          {
            model: options?.modelName || this.defaultModel,
            messages: convertChatMessagesToOpenAI(messages),
            tools: convertToolDefinitions(tools),
            ...buildOpenAiReasoningEffortBody(options),
          },
          options?.signal ? { signal: options.signal } : undefined,
        );

        if (attempt > 0) {
          logger.info(`[OpenAI Transport] Failover succeeded with key ${clientIndex + 1}/${this.clients.length}`);
        }
        this.currentClientIndex = clientIndex;

        const choice = response.choices[0];
        const toolCalls: ToolCall[] = (choice.message.tool_calls || []).flatMap((tc) => {
          const fn = 'function' in tc ? tc.function : undefined;
          if (!fn) return [];
          return [{
            id: tc.id,
            name: fn.name,
            arguments: parseJsonSafe(fn.arguments),
          }];
        });

        return {
          content: choice.message.content,
          toolCalls,
          finishReason: choice.finish_reason as LlmResponse['finishReason'],
        };
      } catch (error: unknown) {
        if (isProviderAbortError(error, options?.signal)) {
          throw error;
        }
        lastError = error;
        logger.warn(`[OpenAI Transport] Request failed with key ${clientIndex + 1}: ${errorMessage(error)}`);
      }
    }
    throw lastError || new Error('OpenAI transport: all keys exhausted');
  }

  public async *streamChat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): AsyncIterable<LlmStreamEvent> {
    let lastError: unknown;
    for (let attempt = 0; attempt < this.clients.length; attempt += 1) {
      const clientIndex = (this.currentClientIndex + attempt) % this.clients.length;
      const client = this.clients[clientIndex];
      try {
        const stream = await client.chat.completions.create(
          {
            model: options?.modelName || this.defaultModel,
            messages: convertChatMessagesToOpenAI(messages),
            tools: convertToolDefinitions(tools),
            ...buildOpenAiReasoningEffortBody(options),
            stream: true,
          },
          options?.signal ? { signal: options.signal } : undefined,
        );

        if (attempt > 0) {
          logger.info(`[OpenAI Transport] Stream failover succeeded with key ${clientIndex + 1}/${this.clients.length}`);
        }
        this.currentClientIndex = clientIndex;
        yield* this.processStream(stream);
        return;
      } catch (error: unknown) {
        if (isProviderAbortError(error, options?.signal)) {
          throw error;
        }
        lastError = error;
        logger.warn(`[OpenAI Transport] Stream failed with key ${clientIndex + 1}: ${errorMessage(error)}`);
      }
    }
    throw lastError || new Error('OpenAI transport: all keys exhausted (stream)');
  }

  private async *processStream(stream: AsyncIterable<StreamChunk>): AsyncIterable<LlmStreamEvent> {
    const toolCalls = new Map<number, ToolCallAccumulator>();
    let accumulated = '';
    let chunkIndex = 0;
    let finishReason = 'stop';

    yield { type: 'start', accumulated: '', done: false };

    for await (const chunk of stream) {
      for (const choice of chunk.choices || []) {
        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
        }
        const delta = choice.delta || {};
        const textDelta = normalizeText(delta.content);
        if (textDelta) {
          accumulated += textDelta;
          chunkIndex += 1;
          yield { type: 'delta', delta: textDelta, accumulated, chunkIndex, done: false };
        }

        for (const raw of delta.tool_calls || []) {
          const index = Number.isFinite(raw.index) ? Number(raw.index) : toolCalls.size;
          const existing = toolCalls.get(index) || {
            index,
            id: raw.id || `call_${index}`,
            name: '',
            argumentsText: '',
          };
          if (raw.id) existing.id = raw.id;
          if (raw.function?.name) existing.name += raw.function.name;
          if (raw.function?.arguments) existing.argumentsText += raw.function.arguments;
          toolCalls.set(index, existing);
          yield {
            type: 'tool_call_delta',
            toolCallDelta: {
              index,
              id: existing.id,
              name: existing.name || undefined,
              argumentsDelta: raw.function?.arguments,
              arguments: existing.argumentsText || undefined,
            },
            accumulated,
            done: false,
          };
        }
      }
    }

    const response: LlmResponse = {
      content: accumulated || null,
      toolCalls: buildToolCallsFromAccumulator(toolCalls),
      finishReason,
    };
    yield { type: 'done', accumulated, response, done: true };
  }
}

function normalizeText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) return String((part as { text?: unknown }).text || '');
        return '';
      })
      .join('');
  }
  return '';
}

function buildToolCallsFromAccumulator(toolCalls: Map<number, ToolCallAccumulator>): ToolCall[] {
  return Array.from(toolCalls.values())
    .sort((a, b) => a.index - b.index)
    .filter((tc) => tc.name)
    .map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: parseJsonSafe(tc.argumentsText),
    }));
}

function parseJsonSafe(raw: string): Record<string, unknown> {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    return { value: parsed };
  } catch {
    return { raw: trimmed };
  }
}
