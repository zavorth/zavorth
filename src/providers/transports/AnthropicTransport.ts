import type Anthropic from '@anthropic-ai/sdk';
import type {
  ChatMessage,
  LlmResponse,
  LlmStreamEvent,
  ProviderChatOptions,
  ToolDefinition,
  ToolCall,
} from '../ILlmProvider.js';
import type { TransportAdapter } from './TransportAdapter.js';
import {
  extractSystemPrompt,
  toAnthropicMessages,
  toAnthropicTool,
  asRecord,
} from '../utils/anthropicConversion.js';
import { buildAnthropicThinkingHint } from '../reasoningEffortPayload.js';
import { isProviderAbortError } from '../ProviderAbort.js';
import { logger } from '../../logger.js';
import { errorMessage } from '../../utils/errorLike.js';

type AnthropicStreamEvent = {
  type: string;
  delta?: { text?: string; thinking?: string; type?: string; stop_reason?: string | null; partial_json?: string };
  content_block?: { type?: string; name?: string; id?: string; input?: unknown };
  index?: number;
};

export class AnthropicTransport implements TransportAdapter {
  public readonly name = 'anthropic';

  private clients: Anthropic[];
  private currentClientIndex = 0;

  constructor(apiKeys: string[], private defaultModel: string) {
    if (apiKeys.length === 0) {
      throw new Error('At least one Anthropic API key is required');
    }
    this.clients = apiKeys.map((key) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AnthropicSdk = require('@anthropic-ai/sdk').default;
      return new AnthropicSdk({ apiKey: key });
    });
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
        const systemPrompt = extractSystemPrompt(messages);
        const thinkingHint = buildAnthropicThinkingHint(options);

        const requestParams: Record<string, unknown> = {
          model: options?.modelName || this.defaultModel,
          max_tokens: 8192,
          messages: toAnthropicMessages(messages),
          ...(systemPrompt ? { system: systemPrompt } : {}),
          ...(tools && tools.length > 0 ? { tools: tools.map(toAnthropicTool) } : {}),
        };

        if (thinkingHint) {
          requestParams.thinking = thinkingHint;
          requestParams.max_tokens = Math.max(8192, thinkingHint.budget_tokens + 1024);
        }

        const response = await client.messages.create(
          requestParams as never,
          options?.signal ? { signal: options.signal } : undefined,
        );

        if (attempt > 0) {
          logger.info(`[Anthropic Transport] Failover succeeded with key ${clientIndex + 1}/${this.clients.length}`);
        }
        this.currentClientIndex = clientIndex;

        return parseAnthropicResponse(response);
      } catch (error: unknown) {
        if (isProviderAbortError(error, options?.signal)) {
          throw error;
        }
        lastError = error;
        logger.warn(`[Anthropic Transport] Request failed with key ${clientIndex + 1}: ${errorMessage(error)}`);
      }
    }
    throw lastError || new Error('Anthropic transport: all keys exhausted');
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
        const systemPrompt = extractSystemPrompt(messages);
        const thinkingHint = buildAnthropicThinkingHint(options);

        const requestParams: Record<string, unknown> = {
          model: options?.modelName || this.defaultModel,
          max_tokens: 8192,
          messages: toAnthropicMessages(messages),
          stream: true,
          ...(systemPrompt ? { system: systemPrompt } : {}),
          ...(tools && tools.length > 0 ? { tools: tools.map(toAnthropicTool) } : {}),
        };

        if (thinkingHint) {
          requestParams.thinking = thinkingHint;
          requestParams.max_tokens = Math.max(8192, thinkingHint.budget_tokens + 1024);
        }

        const stream = await client.messages.stream(
          requestParams as never,
          options?.signal ? { signal: options.signal } : undefined,
        );

        if (attempt > 0) {
          logger.info(`[Anthropic Transport] Stream failover succeeded with key ${clientIndex + 1}/${this.clients.length}`);
        }
        this.currentClientIndex = clientIndex;
        yield* this.processStream(stream as AsyncIterable<AnthropicStreamEvent>);
        return;
      } catch (error: unknown) {
        if (isProviderAbortError(error, options?.signal)) {
          throw error;
        }
        lastError = error;
        logger.warn(`[Anthropic Transport] Stream failed with key ${clientIndex + 1}: ${errorMessage(error)}`);
      }
    }
    throw lastError || new Error('Anthropic transport: all keys exhausted (stream)');
  }

  private async *processStream(stream: AsyncIterable<AnthropicStreamEvent>): AsyncIterable<LlmStreamEvent> {
    let accumulated = '';
    let chunkIndex = 0;
    let finishReason = 'stop';
    const toolCalls: Array<{ id: string; name: string; inputJson: string }> = [];
    let activeToolIndex = -1;

    yield { type: 'start', accumulated: '', done: false };

    for await (const event of stream) {
      if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
        activeToolIndex = toolCalls.length;
        toolCalls.push({
          id: event.content_block.id || `tool_${Date.now()}`,
          name: event.content_block.name || 'unknown',
          inputJson: '',
        });
        yield {
          type: 'tool_call_delta',
          toolCallDelta: {
            index: activeToolIndex,
            id: toolCalls[activeToolIndex].id,
            name: toolCalls[activeToolIndex].name,
          },
          accumulated,
          done: false,
        };
      }

      if (event.type === 'content_block_delta') {
        if (event.delta?.type === 'text_delta' && event.delta.text) {
          accumulated += event.delta.text;
          chunkIndex += 1;
          yield { type: 'delta', delta: event.delta.text, accumulated, chunkIndex, done: false };
        }
        if (event.delta?.type === 'input_json_delta' && event.delta.partial_json && activeToolIndex >= 0) {
          toolCalls[activeToolIndex].inputJson += event.delta.partial_json;
          yield {
            type: 'tool_call_delta',
            toolCallDelta: {
              index: activeToolIndex,
              id: toolCalls[activeToolIndex].id,
              argumentsDelta: event.delta.partial_json,
              arguments: toolCalls[activeToolIndex].inputJson,
            },
            accumulated,
            done: false,
          };
        }
      }

      if (event.type === 'message_delta' && event.delta?.stop_reason) {
        finishReason = event.delta.stop_reason;
      }
    }

    const response: LlmResponse = {
      content: accumulated || null,
      toolCalls: toolCalls
        .filter((tc) => tc.name)
        .map((tc) => ({
          id: tc.id,
          name: tc.name,
          arguments: parseJsonSafe(tc.inputJson),
        })),
      finishReason,
    };
    yield { type: 'done', accumulated, response, done: true };
  }
}

function parseAnthropicResponse(response: unknown): LlmResponse {
  const responseRecord = asRecord(response) || {};
  const contentBlocks = Array.isArray(responseRecord.content) ? responseRecord.content : [];
  const text = contentBlocks
    .map((block) => {
      const rec = asRecord(block);
      return rec?.type === 'text' ? String(rec.text || '') : '';
    })
    .filter(Boolean)
    .join('\n');

  const toolCalls: ToolCall[] = contentBlocks.flatMap((block) => {
    const rec = asRecord(block);
    if (rec?.type !== 'tool_use') return [];
    return [{
      id: String(rec.id || `tool_${Date.now()}`),
      name: String(rec.name || 'unknown_tool'),
      arguments: asRecord(rec.input) || {},
    }];
  });

  return {
    content: text || null,
    toolCalls,
    finishReason: String(responseRecord.stop_reason || 'stop'),
  };
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
