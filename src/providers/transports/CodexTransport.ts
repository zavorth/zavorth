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
import { RotatingKeyClient, type StreamingKeyOperation } from './RotatingKeyClient.js';
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

type ResponsesApi = {
  responses: {
    create: (params: Record<string, unknown>, requestOptions?: { signal?: AbortSignal }) => Promise<Record<string, unknown>>;
    stream: (params: Record<string, unknown>, requestOptions?: { signal?: AbortSignal }) => Promise<AsyncIterable<ResponseStreamEvent>>;
  };
};

export class CodexTransport implements TransportAdapter {
  public readonly name = 'codex';

  private readonly keyRotation: RotatingKeyClient<OpenAI>;

  constructor(apiKeys: string[], private defaultModel: string) {
    if (apiKeys.length === 0) {
      throw new Error('At least one OpenAI API key is required for Codex transport');
    }
    this.keyRotation = new RotatingKeyClient<OpenAI>(apiKeys.map((key) => new OpenAI({ apiKey: key })));
  }

  public async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): Promise<LlmResponse> {
    return this.keyRotation.run(async (client) => {
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

      const responsesClient = client as unknown as ResponsesApi;
      const response = await responsesClient.responses.create(
        params,
        options?.signal ? { signal: options.signal } : undefined,
      );

      return parseCodexResponse(response);
    }, {
      signal: options?.signal,
      onKeyFailure: (keyNumber, _totalKeys, error) => {
        logger.warn(`[Codex Transport] Request failed with key ${keyNumber}: ${errorMessage(error)}`);
      },
      onFailoverSuccess: (keyNumber, totalKeys) => {
        logger.info(`[Codex Transport] Failover succeeded with key ${keyNumber}/${totalKeys}`);
      },
      exhaustionError: (lastError) => lastError || new Error('Codex transport: all keys exhausted'),
    });
  }

  public async *streamChat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): AsyncIterable<LlmStreamEvent> {
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

    const operation: StreamingKeyOperation<OpenAI, ResponseStreamEvent, ResponseStreamEvent> = {
      open: async (client) => {
        const responsesClient = client as unknown as ResponsesApi;
        return responsesClient.responses.stream(
          params,
          options?.signal ? { signal: options.signal } : undefined,
        );
      },
      project: (event) => [event],
    };
    yield* this.processStream(this.keyRotation.stream(operation, {
      signal: options?.signal,
      onKeyFailure: (keyNumber, _totalKeys, error) => {
        logger.warn(`[Codex Transport] Stream failed with key ${keyNumber}: ${errorMessage(error)}`);
      },
      onFailoverSuccess: (keyNumber, totalKeys) => {
        logger.info(`[Codex Transport] Stream failover succeeded with key ${keyNumber}/${totalKeys}`);
      },
      exhaustionError: (lastError) => lastError || new Error('Codex transport: all keys exhausted (stream)'),
    }));
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
