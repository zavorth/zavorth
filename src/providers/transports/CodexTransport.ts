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
import { isProviderAbortError } from '../ProviderAbort.js';
import { logger } from '../../logger.js';
import { errorMessage } from '../../utils/errorLike.js';

type ResponseStreamEvent = {
  type: string;
  delta?: { content?: string; summary?: string; arguments?: string };
  item?: {
    id?: string;
    type?: string;
    name?: string;
    arguments?: string;
    content?: Array<{ type?: string; text?: string }>;
    summary?: Array<{ type?: string; text?: string }>;
    status?: string;
    output?: ResponseItem[];
  };
  output_index?: number;
  content_index?: number;
};

type ResponseItem = {
  id?: string;
  type?: string;
  name?: string;
  arguments?: string;
  content?: Array<{ type?: string; text?: string }>;
  summary?: Array<{ type?: string; text?: string }>;
  role?: string;
  status?: string;
};

export class CodexTransport implements TransportAdapter {
  public readonly name = 'codex';

  private clients: OpenAI[];
  private currentClientIndex = 0;

  constructor(apiKeys: string[], private defaultModel: string) {
    if (apiKeys.length === 0) {
      throw new Error('At least one OpenAI API key is required for Codex transport');
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
        const input = buildResponsesInput(messages);
        const params: Record<string, unknown> = {
          model: options?.modelName || this.defaultModel,
          input,
          instructions: extractInstructions(messages),
        };

        if (tools && tools.length > 0) {
          params.tools = tools.map(toCodexTool);
        }

        if (options?.reasoningEffort && options.reasoningEffort !== 'none') {
          params.reasoning = { effort: mapReasoningEffort(options.reasoningEffort) };
        }

        const response = await (client as any).responses.create(
          params,
          options?.signal ? { signal: options.signal } : undefined,
        );

        if (attempt > 0) {
          logger.info(`[Codex Transport] Failover succeeded with key ${clientIndex + 1}/${this.clients.length}`);
        }
        this.currentClientIndex = clientIndex;

        return parseCodexResponse(response);
      } catch (error: unknown) {
        if (isProviderAbortError(error, options?.signal)) {
          throw error;
        }
        lastError = error;
        logger.warn(`[Codex Transport] Request failed with key ${clientIndex + 1}: ${errorMessage(error)}`);
      }
    }
    throw lastError || new Error('Codex transport: all keys exhausted');
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
        const input = buildResponsesInput(messages);
        const params: Record<string, unknown> = {
          model: options?.modelName || this.defaultModel,
          input,
          instructions: extractInstructions(messages),
          stream: true,
        };

        if (tools && tools.length > 0) {
          params.tools = tools.map(toCodexTool);
        }

        if (options?.reasoningEffort && options.reasoningEffort !== 'none') {
          params.reasoning = { effort: mapReasoningEffort(options.reasoningEffort) };
        }

        const stream = await (client as any).responses.stream(
          params,
          options?.signal ? { signal: options.signal } : undefined,
        );

        if (attempt > 0) {
          logger.info(`[Codex Transport] Stream failover succeeded with key ${clientIndex + 1}/${this.clients.length}`);
        }
        this.currentClientIndex = clientIndex;
        yield* this.processStream(stream);
        return;
      } catch (error: unknown) {
        if (isProviderAbortError(error, options?.signal)) {
          throw error;
        }
        lastError = error;
        logger.warn(`[Codex Transport] Stream failed with key ${clientIndex + 1}: ${errorMessage(error)}`);
      }
    }
    throw lastError || new Error('Codex transport: all keys exhausted (stream)');
  }

  private async *processStream(stream: AsyncIterable<ResponseStreamEvent>): AsyncIterable<LlmStreamEvent> {
    let accumulated = '';
    let chunkIndex = 0;
    let finishReason = 'stop';
    const toolCalls: Array<{ id: string; name: string; argumentsText: string }> = [];
    let activeToolIndex = -1;

    yield { type: 'start', accumulated: '', done: false };

    for await (const event of stream) {
      if (event.type === 'response.output_text.delta' && event.delta?.content) {
        accumulated += event.delta.content;
        chunkIndex += 1;
        yield { type: 'delta', delta: event.delta.content, accumulated, chunkIndex, done: false };
      }

      if (event.type === 'response.output_text.done' && event.delta?.summary) {
        /* intentionally empty */
      }

      if (event.type === 'response.function_call_arguments.delta' && event.delta?.arguments) {
        if (activeToolIndex < 0) {
          activeToolIndex = toolCalls.length;
          toolCalls.push({
            id: `call_${Date.now()}_${activeToolIndex}`,
            name: '',
            argumentsText: '',
          });
        }
        toolCalls[activeToolIndex].argumentsText += event.delta.arguments;
        yield {
          type: 'tool_call_delta',
          toolCallDelta: {
            index: activeToolIndex,
            id: toolCalls[activeToolIndex].id,
            argumentsDelta: event.delta.arguments,
            arguments: toolCalls[activeToolIndex].argumentsText,
          },
          accumulated,
          done: false,
        };
      }

      if (event.type === 'response.function_call_arguments.done') {
        activeToolIndex = -1;
      }

      if (event.type === 'response.completed' && event.item) {
        const item = event.item;
        if (item.status === 'completed') finishReason = 'stop';
        if (item.status === 'failed') finishReason = 'error';

        if (item.output && Array.isArray(item.output)) {
          for (const outputItem of item.output) {
            if (outputItem.type === 'function_call') {
              toolCalls.push({
                id: outputItem.id || `call_${Date.now()}`,
                name: outputItem.name || 'unknown',
                argumentsText: outputItem.arguments || '',
              });
            }
          }
        }
      }
    }

    const response: LlmResponse = {
      content: accumulated || null,
      toolCalls: toolCalls
        .filter((tc) => tc.name || tc.argumentsText)
        .map((tc) => ({
          id: tc.id,
          name: tc.name,
          arguments: parseJsonSafe(tc.argumentsText),
        })),
      finishReason,
    };
    yield { type: 'done', accumulated, response, done: true };
  }
}

function buildResponsesInput(messages: ChatMessage[]): string {
  const nonSystem = messages.filter((m) => m.role !== 'system');
  return nonSystem
    .map((m) => {
      if (m.role === 'assistant') return `Assistant: ${m.content || ''}`;
      if (m.role === 'tool') return `Tool result (${m.toolName || 'unknown'}): ${m.content || ''}`;
      return m.content || '';
    })
    .join('\n\n');
}

function extractInstructions(messages: ChatMessage[]): string {
  return messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content || '')
    .filter(Boolean)
    .join('\n');
}

function toCodexTool(tool: ToolDefinition): Record<string, unknown> {
  return {
    type: 'function',
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  };
}

function mapReasoningEffort(effort: string): string {
  switch (effort) {
    case 'low': return 'low';
    case 'medium': return 'medium';
    case 'high': return 'high';
    case 'xhigh': return 'high';
    default: return 'medium';
  }
}

function parseCodexResponse(response: Record<string, unknown>): LlmResponse {
  const output = Array.isArray(response.output) ? response.output : [];
  let text = '';
  const toolCalls: ToolCall[] = [];

  for (const item of output) {
    const rec = item as Record<string, unknown>;
    if (rec.type === 'message' && Array.isArray(rec.content)) {
      for (const block of rec.content) {
        const b = block as Record<string, unknown>;
        if (b.type === 'output_text' && b.text) {
          text += String(b.text);
        }
      }
    }
    if (rec.type === 'function_call') {
      toolCalls.push({
        id: String(rec.id || `tool_${Date.now()}`),
        name: String(rec.name || 'unknown'),
        arguments: parseJsonSafe(String(rec.arguments || '')),
      });
    }
  }

  return {
    content: text || null,
    toolCalls,
    finishReason: String(response.status || 'completed'),
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
