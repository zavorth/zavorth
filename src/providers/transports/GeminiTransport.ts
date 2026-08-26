import {
  FunctionDeclaration,
  GenerateContentCandidate,
  GenerateContentStreamResult,
  GoogleGenerativeAI,
  RequestOptions,
  Tool,
} from '@google/generative-ai';

import {
  ChatMessage,
  LlmResponse,
  LlmStreamEvent,
  ProviderChatOptions,
  ToolCall,
  ToolDefinition,
} from '../ILlmProvider.js';

import type { TransportAdapter } from './TransportAdapter.js';
import { RotatingKeyClient, type StreamingKeyOperation } from './RotatingKeyClient.js';
import { convertGeminiMessages, convertGeminiTool } from '../utils/geminiConversion.js';
import { logger } from '../../logger.js';

interface GeminiGroundingChunk {
  web?: { uri?: string; title?: string };
}

interface GeminiGroundingMetadata {
  groundingChunks?: GeminiGroundingChunk[];
}

interface GeminiNativeTool {
  functionDeclarations?: FunctionDeclaration[];
  googleSearch?: Record<string, unknown>;
  codeExecution?: Record<string, unknown>;
}

interface GeminiStreamChunk {
  candidates?: GenerateContentCandidate[];
}

interface GeminiStreamState {
  result?: GenerateContentStreamResult;
  accumulated: string;
  chunkIndex: number;
  finishReason: string;
  toolCalls: ToolCall[];
  toolCallIds: Map<number, string>;
  finalMetadata: Record<string, unknown> | undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export class GeminiTransport implements TransportAdapter {
  public readonly name = 'gemini';

  private readonly keyRotation: RotatingKeyClient<GoogleGenerativeAI>;

  constructor(
    apiKeys: string[],
    private readonly defaultModel: string,
    private readonly requestOptions?: RequestOptions,
  ) {
    if (apiKeys.length === 0) {
      throw new Error('At least one Gemini API key is required');
    }
    this.keyRotation = new RotatingKeyClient<GoogleGenerativeAI>(
      apiKeys.map((key) => new GoogleGenerativeAI(key)),
    );
  }

  public async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): Promise<LlmResponse> {
    const systemInstruction = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n');
    const contents = convertGeminiMessages(messages.filter((message) => message.role !== 'system'));
    const modelName = options?.modelName || this.defaultModel;

    const result = await this.keyRotation.run(async (client) => {
      const model = client.getGenerativeModel({
        model: modelName,
        tools: this.buildGeminiTools(tools, options) as unknown as Tool[] | undefined,
      }, this.requestOptions);

      const request = {
        contents,
        systemInstruction: systemInstruction || undefined,
      };
      return options?.signal
        ? await model.generateContent(request, { signal: options.signal })
        : await model.generateContent(request);
    }, {
      signal: options?.signal,
      onKeyFailure: (keyNumber, _totalKeys, error) => {
        logger.warn(
          `[Gemini] Error using key ${keyNumber}: ${getErrorMessage(error)}`,
        );
      },
      onFailoverSuccess: (keyNumber, totalKeys) => {
        logger.info(
          `[Gemini Failover] Request succeeded using the secondary key (${keyNumber}/${totalKeys}).`,
        );
      },
      exhaustionError: (lastError) => lastError || new Error('Unknown Gemini failure'),
    });

    const response = result.response;
    const candidate = response.candidates?.[0];

    if (!candidate) {
      return {
        content: 'No response from model.',
        toolCalls: [],
        finishReason: 'error',
      };
    }

    const toolCalls: ToolCall[] = [];
    let textContent = '';

    for (const part of candidate.content?.parts || []) {
      if (part.text) {
        textContent += part.text;
      }
      if (part.functionCall) {
        toolCalls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: part.functionCall.name,
          arguments: (part.functionCall.args || {}) as Record<string, unknown>,
        });
      }
    }

    return {
      content: textContent || null,
      toolCalls,
      finishReason: candidate.finishReason || 'stop',
      metadata: this.buildProviderNativeMetadata(candidate, options),
    };
  }

  public async *streamChat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): AsyncIterable<LlmStreamEvent> {
    const systemInstruction = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n');
    const contents = convertGeminiMessages(messages.filter((message) => message.role !== 'system'));
    const modelName = options?.modelName || this.defaultModel;
    const streamMetadata = {
      providerNativeTokenStreaming: true,
      providerNativeStreamSource: 'gemini-generate-content-stream',
    };

    const state: GeminiStreamState = {
      accumulated: '',
      chunkIndex: 0,
      finishReason: 'stop',
      toolCalls: [],
      toolCallIds: new Map(),
      finalMetadata: undefined,
    };

    const operation: StreamingKeyOperation<GoogleGenerativeAI, GeminiStreamChunk, LlmStreamEvent> = {
      open: async (client) => {
        const model = client.getGenerativeModel({
          model: modelName,
          tools: this.buildGeminiTools(tools, options) as unknown as Tool[] | undefined,
        }, this.requestOptions);

        const request = {
          contents,
          systemInstruction: systemInstruction || undefined,
        };
        const result = await model.generateContentStream(
          request,
          options?.signal ? { signal: options.signal } : undefined,
        ) as GenerateContentStreamResult;

        state.result = result;
        state.accumulated = '';
        state.chunkIndex = 0;
        state.finishReason = 'stop';
        state.toolCalls = [];
        state.toolCallIds = new Map();
        state.finalMetadata = undefined;

        return result.stream;
      },
      prologue: () => [{
        type: 'start',
        accumulated: '',
        done: false,
        metadata: streamMetadata,
      }],
      project: (chunk) => {
        const candidate = chunk?.candidates?.[0];
        const events: LlmStreamEvent[] = [];

        if (candidate?.finishReason) {
          state.finishReason = candidate.finishReason;
        }
        state.finalMetadata = this.buildProviderNativeMetadata(candidate, options) || state.finalMetadata;
        for (const part of candidate?.content?.parts || []) {
          if (part?.text) {
            state.accumulated += part.text;
            state.chunkIndex += 1;
            events.push({
              type: 'delta',
              delta: part.text,
              accumulated: state.accumulated,
              chunkIndex: state.chunkIndex,
              done: false,
              metadata: {
                ...streamMetadata,
                ...(state.finalMetadata || {}),
              },
            });
          }
          if (part?.functionCall) {
            const toolCallId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const toolCall: ToolCall = {
              id: toolCallId,
              name: part.functionCall.name,
              arguments: (part.functionCall.args || {}) as Record<string, unknown>,
            };
            const index = state.toolCalls.length;
            state.toolCalls.push(toolCall);
            state.toolCallIds.set(index, toolCallId);
            events.push({
              type: 'tool_call_delta',
              toolCallDelta: {
                index,
                id: toolCallId,
                name: toolCall.name,
                arguments: JSON.stringify(toolCall.arguments),
              },
              accumulated: state.accumulated,
              done: false,
              metadata: {
                ...streamMetadata,
                ...(state.finalMetadata || {}),
              },
            });
          }
        }
        return events;
      },
    };

    yield* this.keyRotation.stream(operation, {
      signal: options?.signal,
      onKeyFailure: (keyNumber, _totalKeys, error) => {
        logger.warn(
          `[Gemini] Streaming error using key ${keyNumber}: ${getErrorMessage(error)}`,
        );
      },
      onFailoverSuccess: (keyNumber, totalKeys) => {
        logger.info(
          `[Gemini Failover] Streaming succeeded using the secondary key (${keyNumber}/${totalKeys}).`,
        );
      },
      exhaustionError: (lastError) => lastError || new Error('Unknown Gemini failure streaming'),
    });

    const result = state.result;
    if (!result) {
      throw new Error('Unknown Gemini failure streaming');
    }

    const finalResponse = await this.resolveGeminiStreamResponse(result, {
      accumulated: state.accumulated,
      toolCalls: state.toolCalls,
      toolCallIds: state.toolCallIds,
      finishReason: state.finishReason,
      metadata: state.finalMetadata,
      options,
    });
    yield {
      type: 'done',
      accumulated: finalResponse.content || state.accumulated,
      response: finalResponse,
      done: true,
      metadata: {
        ...streamMetadata,
        ...(finalResponse.metadata || {}),
      },
    };
  }

  private async resolveGeminiStreamResponse(
    result: GenerateContentStreamResult,
    fallback: {
      accumulated: string;
      toolCalls: ToolCall[];
      toolCallIds: Map<number, string>;
      finishReason: string;
      metadata?: Record<string, unknown>;
      options?: ProviderChatOptions;
    },
  ): Promise<LlmResponse> {
    try {
      const response = await result.response;
      const candidate = response?.candidates?.[0];
      if (!candidate) {
        return {
          content: fallback.accumulated || null,
          toolCalls: fallback.toolCalls,
          finishReason: fallback.finishReason,
          metadata: {
            providerNativeTokenStreaming: true,
            providerNativeStreamSource: 'gemini-generate-content-stream',
            ...(fallback.metadata || {}),
          },
        };
      }

      const toolCalls: ToolCall[] = [];
      let textContent = '';
      let functionCallIndex = 0;
      for (const part of candidate.content?.parts || []) {
        if (part?.text) {
          textContent += part.text;
        }
        if (part?.functionCall) {
          const cachedId = fallback.toolCallIds.get(functionCallIndex);
          toolCalls.push({
            id: cachedId || `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: part.functionCall.name,
            arguments: (part.functionCall.args || {}) as Record<string, unknown>,
          });
          functionCallIndex++;
        }
      }

      return {
        content: textContent || fallback.accumulated || null,
        toolCalls: toolCalls.length > 0 ? toolCalls : fallback.toolCalls,
        finishReason: candidate.finishReason || fallback.finishReason,
        metadata: {
          providerNativeTokenStreaming: true,
          providerNativeStreamSource: 'gemini-generate-content-stream',
          ...(fallback.metadata || {}),
          ...(this.buildProviderNativeMetadata(candidate, fallback.options) || {}),
        },
      };
    } catch (error: unknown) {
      logger.warn('[Gemini] creation failed', error);
      return {
        content: fallback.accumulated || null,
        toolCalls: fallback.toolCalls,
        finishReason: fallback.finishReason,
        metadata: {
          providerNativeTokenStreaming: true,
          providerNativeStreamSource: 'gemini-generate-content-stream',
          ...(fallback.metadata || {}),
        },
      };
    }
  }

  private buildGeminiTools(tools?: ToolDefinition[], options?: ProviderChatOptions): GeminiNativeTool[] | undefined {
    const output: GeminiNativeTool[] = [];
    if (tools && tools.length > 0) {
      output.push({ functionDeclarations: tools.map((tool) => convertGeminiTool(tool)) });
    }
    if (this.shouldEnableGoogleSearch(options)) {
      output.push({ googleSearch: {} });
    }
    if (this.shouldEnableCodeExecution(options)) {
      output.push({ codeExecution: {} });
    }
    return output.length > 0 ? output : undefined;
  }

  private shouldEnableGoogleSearch(options?: ProviderChatOptions): boolean {
    return Boolean(options?.providerNativeTools?.some((tool) => tool.name === 'google_search'));
  }

  private shouldEnableCodeExecution(options?: ProviderChatOptions): boolean {
    return Boolean(options?.providerNativeTools?.some((tool) => tool.name === 'code_execution' || tool.name === 'provider_code_execution'));
  }

  private buildProviderNativeMetadata(candidate: GenerateContentCandidate | undefined, options?: ProviderChatOptions): Record<string, unknown> | undefined {
    const requested = options?.providerNativeTools || [];
    const activated = requested
      .filter((tool) => {
        if (tool.name === 'google_search') return this.shouldEnableGoogleSearch(options);
        if (tool.name === 'code_execution' || tool.name === 'provider_code_execution') return this.shouldEnableCodeExecution(options);
        return false;
      })
      .map((tool) => tool.name);
    const groundingMetadata = candidate?.groundingMetadata as GeminiGroundingMetadata | undefined;
    if (!groundingMetadata && requested.length === 0) {
      return undefined;
    }
    const citations = groundingMetadata ? this.extractCitations(groundingMetadata) : [];
    return {
      providerNativeTools: {
        requested: requested.map((tool) => ({
          name: tool.name,
          reason: tool.reason,
          requiredEvidence: tool.requiredEvidence || 'none',
        })),
        activated,
        unsupported: requested
          .filter((tool) => !activated.includes(tool.name))
          .map((tool) => tool.name),
        googleSearch: {
          used: citations.length > 0 || Boolean(groundingMetadata),
          citationCount: citations.length,
          citations,
        },
      },
      ...(groundingMetadata ? { groundingMetadata } : {}),
    };
  }

  private extractCitations(metadata: GeminiGroundingMetadata): Array<{ title: string; url: string }> {
    const chunks = Array.isArray(metadata?.groundingChunks) ? metadata.groundingChunks : [];
    return chunks
      .filter((chunk): chunk is GeminiGroundingChunk & { web: NonNullable<GeminiGroundingChunk['web']> } => Boolean(chunk?.web?.uri))
      .map((chunk) => ({
        title: String(chunk.web.title || chunk.web.uri),
        url: String(chunk.web.uri),
      }));
  }
}
