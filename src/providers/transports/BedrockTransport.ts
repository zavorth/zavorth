import { BedrockRuntimeClient, ConverseCommand, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import type {
  ChatMessage,
  LlmResponse,
  LlmStreamEvent,
  ProviderChatOptions,
  ToolDefinition,
  ToolCall,
} from '../ILlmProvider.js';
import type { TransportAdapter } from './TransportAdapter.js';
import { extractSystemPrompt, asRecord } from '../utils/anthropicConversion.js';
import { isProviderAbortError } from '../ProviderAbort.js';
import { logger } from '../../logger.js';
import { errorMessage } from '../../utils/errorLike.js';

interface BedrockMessage {
  role: 'user' | 'assistant';
  content: Array<{ text?: string; toolResult?: unknown; toolUse?: unknown }>;
}

export class BedrockTransport implements TransportAdapter {
  public readonly name = 'bedrock';

  private client: BedrockRuntimeClient;

  constructor(
    private region: string,
    private accessKeyId: string,
    private secretAccessKey: string,
    private defaultModel: string,
    private defaultInferenceArn?: string,
  ) {
    this.client = new BedrockRuntimeClient({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  public async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): Promise<LlmResponse> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= 1; attempt += 1) {
      try {
        const systemPrompt = extractSystemPrompt(messages);
        const requestParams: Record<string, unknown> = {
          modelId: options?.modelName || this.defaultModel,
          messages: toBedrockMessages(messages),
          inferenceConfig: { maxTokens: 8192, temperature: 0.7 },
        };

        if (systemPrompt) {
          requestParams.system = [{ text: systemPrompt }];
        }

        if (tools && tools.length > 0) {
          requestParams.toolConfig = { tools: tools.map(toBedrockTool) };
        }

        const abortSignal = options?.signal;
        const command = new ConverseCommand(requestParams as any); // eslint-disable-line @typescript-eslint/no-explicit-any
        const response = await this.client.send(command, {
          abortSignal: abortSignal as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        });

        if (attempt > 0) {
          logger.info('[Bedrock Transport] Retry succeeded');
        }

        return parseBedrockResponse(response as unknown as Record<string, unknown>);
      } catch (error: unknown) {
        if (isProviderAbortError(error, options?.signal)) {
          throw error;
        }
        lastError = error;
        logger.warn(`[Bedrock Transport] Attempt ${attempt + 1} failed: ${errorMessage(error)}`);
      }
    }
    throw lastError || new Error('Bedrock transport: request failed');
  }

  public async *streamChat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): AsyncIterable<LlmStreamEvent> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= 1; attempt += 1) {
      try {
        const systemPrompt = extractSystemPrompt(messages);
        const requestParams: Record<string, unknown> = {
          modelId: options?.modelName || this.defaultModel,
          messages: toBedrockMessages(messages),
          inferenceConfig: { maxTokens: 8192, temperature: 0.7 },
        };

        if (systemPrompt) {
          requestParams.system = [{ text: systemPrompt }];
        }

        if (tools && tools.length > 0) {
          requestParams.toolConfig = { tools: tools.map(toBedrockTool) };
        }

        const abortSignal = options?.signal;
        const command = new ConverseStreamCommand(requestParams as any); // eslint-disable-line @typescript-eslint/no-explicit-any
        const response = await this.client.send(command, {
          abortSignal: abortSignal as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        });

        if (attempt > 0) {
          logger.info('[Bedrock Transport] Stream retry succeeded');
        }

        yield* this.processStream(response as unknown as Record<string, unknown>);
        return;
      } catch (error: unknown) {
        if (isProviderAbortError(error, options?.signal)) {
          throw error;
        }
        lastError = error;
        logger.warn(`[Bedrock Transport] Stream attempt ${attempt + 1} failed: ${errorMessage(error)}`);
      }
    }
    throw lastError || new Error('Bedrock transport: stream failed');
  }

  private async *processStream(response: Record<string, unknown>): AsyncIterable<LlmStreamEvent> {
    const stream = response.body;
    if (!stream || typeof (stream as any)[Symbol.asyncIterator] !== 'function') { // eslint-disable-line @typescript-eslint/no-explicit-any
      throw new Error('Bedrock transport: no stream in response');
    }

    let accumulated = '';
    let chunkIndex = 0;
    let finishReason = 'stop';
    const toolCalls: Array<{ id: string; name: string; inputJson: string }> = [];
    let activeToolIndex = -1;

    yield { type: 'start', accumulated: '', done: false };

    for await (const event of stream as AsyncIterable<Record<string, unknown>>) {

      if (event.contentBlockStart) {
        const block = asRecord(event.contentBlockStart);
        if (block?.toolUse) {
          const toolUse = asRecord(block.toolUse);
          activeToolIndex = toolCalls.length;
          toolCalls.push({
            id: String(toolUse?.toolUseId || `tool_${Date.now()}`),
            name: String(toolUse?.name || 'unknown'),
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
      }

      if (event.contentBlockDelta) {
        const delta = asRecord(event.contentBlockDelta);
        if (delta?.text) {
          const text = String(delta.text);
          accumulated += text;
          chunkIndex += 1;
          yield { type: 'delta', delta: text, accumulated, chunkIndex, done: false };
        }
        if (delta?.toolUseInput && activeToolIndex >= 0) {
          const inputJson = JSON.stringify(delta.toolUseInput);
          toolCalls[activeToolIndex].inputJson += inputJson;
          yield {
            type: 'tool_call_delta',
            toolCallDelta: {
              index: activeToolIndex,
              id: toolCalls[activeToolIndex].id,
              argumentsDelta: inputJson,
              arguments: toolCalls[activeToolIndex].inputJson,
            },
            accumulated,
            done: false,
          };
        }
      }

      if (event.messageStop) {
        const stop = asRecord(event.messageStop);
        if (stop?.stopReason) {
          finishReason = String(stop.stopReason);
        }
      }
    }

    const responseResult: LlmResponse = {
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
    yield { type: 'done', accumulated, response: responseResult, done: true };
  }
}

function toBedrockMessages(messages: ChatMessage[]): BedrockMessage[] {
  const result: BedrockMessage[] = [];
  for (const msg of messages) {
    if (msg.role === 'system') continue;

    if (msg.role === 'tool') {
      result.push({
        role: 'user',
        content: [{
          toolResult: {
            toolUseId: msg.toolCallId || 'unknown',
            content: [{ text: msg.content || '' }],
          },
        }],
      });
      continue;
    }

    if (msg.role === 'assistant') {
      const content: BedrockMessage['content'] = [];
      if (msg.content) {
        content.push({ text: msg.content });
      }
      for (const tc of msg.toolCalls || []) {
        content.push({
          toolUse: {
            toolUseId: tc.id,
            name: tc.name,
            input: tc.arguments,
          },
        });
      }
      result.push({ role: 'assistant', content });
      continue;
    }

    result.push({
      role: 'user',
      content: [{ text: msg.content || '' }],
    });
  }
  return result;
}

function toBedrockTool(tool: ToolDefinition): Record<string, unknown> {
  return {
    toolSpec: {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.parameters,
    },
  };
}

function parseBedrockResponse(response: Record<string, unknown>): LlmResponse {
  const output = asRecord(response.output);
  const message = asRecord(output?.message);
  const content = Array.isArray(message?.content) ? message.content : [];

  let text = '';
  const toolCalls: ToolCall[] = [];

  for (const block of content) {
    const rec = asRecord(block);
    if (rec?.text) {
      text += String(rec.text);
    }
    if (rec?.toolUse) {
      const toolUse = asRecord(rec.toolUse);
      toolCalls.push({
        id: String(toolUse?.toolUseId || `tool_${Date.now()}`),
        name: String(toolUse?.name || 'unknown'),
        arguments: asRecord(toolUse?.input) || {},
      });
    }
  }

  const stopReason = asRecord(output?.stopReason);
  return {
    content: text || null,
    toolCalls,
    finishReason: String(stopReason || 'stop'),
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
