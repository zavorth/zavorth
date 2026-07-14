import { logger } from '../logger.js';
import {
  Content,
  FunctionDeclaration,
  GenerateContentCandidate,
  GenerateContentResult,
  GenerateContentStreamResult,
  GoogleGenerativeAI,
  RequestOptions,
  SchemaType,
  type Schema,
} from '@google/generative-ai';
import { config } from '../config/index.js';
import { safeFetch, readSafeJsonResponse } from '../security/SafeFetchService.js';

import {
  ChatMessage,
  ILlmProvider,
  LlmResponse,
  LlmStreamEvent,
  ProviderChatOptions,
  ToolCall,
  ToolDefinition,
} from './ILlmProvider.js';

import { isProviderAbortError } from './ProviderAbort.js';
interface GeminiGroundingChunk {
  web?: { uri?: string; title?: string };
}

interface GeminiGroundingMetadata {
  groundingChunks?: GeminiGroundingChunk[];
}

interface GeminiGatewayResponse {
  candidates?: GenerateContentCandidate[];
  error?: { message?: string };
}

interface GeminiNativeTool {
  functionDeclarations?: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
  googleSearch?: Record<string, unknown>;
  codeExecution?: Record<string, unknown>;
}

interface GeminiRestNativeTool {
  function_declarations?: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
  google_search?: Record<string, unknown>;
  code_execution?: Record<string, unknown>;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export class GeminiProvider implements ILlmProvider {
  public readonly name = 'gemini';
  private clients: GoogleGenerativeAI[];
  private currentClientIndex = 0;
  private readonly requestOptions?: RequestOptions;

  constructor() {
    const keys =
      config.geminiApiKeys && config.geminiApiKeys.length > 0
        ? config.geminiApiKeys
        : [config.geminiApiKey].filter(Boolean);

    if (keys.length === 0) {
      throw new Error('Nenhuma GEMINI_API_KEY configurada no .env');
    }

    this.clients = keys.map((key) => new GoogleGenerativeAI(key));
    this.requestOptions = this.buildRequestOptions();
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
    const contents = this.convertMessages(messages.filter((message) => message.role !== 'system'));
    const modelName = options?.modelName || config.geminiModel;

    let lastError: unknown;
    let result: GenerateContentResult | undefined;

    for (let attempt = 0; attempt < this.clients.length; attempt += 1) {
      const clientIndex = (this.currentClientIndex + attempt) % this.clients.length;
      const currentClient = this.clients[clientIndex];

      try {
        const model = currentClient.getGenerativeModel({
          model: modelName,
          tools: this.buildGeminiTools(tools, options) as any,
        }, this.requestOptions);

        const request = {
          contents,
          systemInstruction: systemInstruction || undefined,
        };
        result = options?.signal
          ? await model.generateContent(request, { signal: options.signal })
          : await model.generateContent(request);

        if (attempt > 0) {
          logger.info(
            `[Gemini Failover] Requisicao bem-sucedida usando a chave secundaria (${clientIndex + 1}/${this.clients.length}).`,
          );
        }
        this.currentClientIndex = clientIndex;
        break;
      } catch (error: unknown) {if (isProviderAbortError(error, options?.signal)) {
          throw error;
        }
        lastError = error;
        logger.warn(
          `[Gemini] Erro usando a chave ${clientIndex + 1}: ${getErrorMessage(error)}`,
        );
      }
    }

    if (!result) {
      throw lastError || new Error('Falha desconhecida no Gemini');
    }

    const response = result.response;
    const candidate = response.candidates?.[0];

    if (!candidate) {
      return {
        content: 'Sem resposta do modelo.',
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
    const contents = this.convertMessages(messages.filter((message) => message.role !== 'system'));
    const modelName = options?.modelName || config.geminiModel;
    const streamMetadata = {
      providerNativeTokenStreaming: true,
      providerNativeStreamSource: 'gemini-generate-content-stream',
    };
    let lastError: unknown;

    for (let attempt = 0; attempt < this.clients.length; attempt += 1) {
      const clientIndex = (this.currentClientIndex + attempt) % this.clients.length;
      const currentClient = this.clients[clientIndex];

      try {
        const model = currentClient.getGenerativeModel({
          model: modelName,
          tools: this.buildGeminiTools(tools, options) as any,
        }, this.requestOptions);

        const request = {
          contents,
          systemInstruction: systemInstruction || undefined,
        };
        const result = await (model as any).generateContentStream(
          request,
          options?.signal ? { signal: options.signal } : undefined,
        ) as GenerateContentStreamResult;

        if (attempt > 0) {
          logger.info(
            `[Gemini Failover] Streaming bem-sucedido usando a chave secundaria (${clientIndex + 1}/${this.clients.length}).`,
          );
        }
        this.currentClientIndex = clientIndex;

        yield {
          type: 'start',
          accumulated: '',
          done: false,
          metadata: streamMetadata,
        };

        let accumulated = '';
        let chunkIndex = 0;
        let finishReason = 'stop';
        const toolCalls: ToolCall[] = [];
        let finalMetadata: Record<string, unknown> | undefined;

        for await (const chunk of result.stream) {
          const candidate = chunk?.candidates?.[0];
          if (candidate?.finishReason) {
            finishReason = candidate.finishReason;
          }
          finalMetadata = this.buildProviderNativeMetadata(candidate, options) || finalMetadata;
          for (const part of candidate?.content?.parts || []) {
            if (part?.text) {
              accumulated += part.text;
              chunkIndex += 1;
              yield {
                type: 'delta',
                delta: part.text,
                accumulated,
                chunkIndex,
                done: false,
                metadata: {
                  ...streamMetadata,
                  ...(finalMetadata || {}),
                },
              };
            }
            if (part?.functionCall) {
              const toolCall: ToolCall = {
                id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                name: part.functionCall.name,
                arguments: (part.functionCall.args || {}) as Record<string, unknown>,
              };
              toolCalls.push(toolCall);
              yield {
                type: 'tool_call_delta',
                toolCallDelta: {
                  index: toolCalls.length - 1,
                  id: toolCall.id,
                  name: toolCall.name,
                  arguments: JSON.stringify(toolCall.arguments),
                },
                accumulated,
                done: false,
                metadata: {
                  ...streamMetadata,
                  ...(finalMetadata || {}),
                },
              };
            }
          }
        }

        const finalResponse = await this.resolveGeminiStreamResponse(result, {
          accumulated,
          toolCalls,
          finishReason,
          metadata: finalMetadata,
          options,
        });
        yield {
          type: 'done',
          accumulated: finalResponse.content || accumulated,
          response: finalResponse,
          done: true,
          metadata: {
            ...streamMetadata,
            ...(finalResponse.metadata || {}),
          },
        };
        return;
      } catch (error: unknown) {if (isProviderAbortError(error, options?.signal)) {
          throw error;
        }
        lastError = error;
        logger.warn(
          `[Gemini] Erro de streaming usando a chave ${clientIndex + 1}: ${getErrorMessage(error)}`,
        );
      }
    }

    throw lastError || new Error('Falha desconhecida no Gemini streaming');
  }

  private async chatViaCloudflareAiGateway(
    modelName: string,
    contents: Content[],
    systemInstruction: string,
    tools?: ToolDefinition[],
  ): Promise<LlmResponse> {
    const keys =
      config.geminiApiKeys && config.geminiApiKeys.length > 0
        ? config.geminiApiKeys
        : [config.geminiApiKey].filter(Boolean);

    if (keys.length === 0) {
      throw new Error('Nenhuma GEMINI_API_KEY configurada no .env');
    }

    const gatewayBaseUrl = config.cloudflareAiGatewayBaseUrl || config.geminiApiBaseUrl;
    const gatewayApiVersion = config.geminiApiVersion || 'v1';

    if (!gatewayBaseUrl) {
      throw new Error('Cloudflare AI Gateway habilitado, mas sem base URL resolvida.');
    }

    const gatewayUrl =
      `${gatewayBaseUrl}/${gatewayApiVersion}/models/${encodeURIComponent(modelName)}:generateContent`;

    const payload: Record<string, unknown> = {
      contents,
    };

    if (systemInstruction) {
      payload.system_instruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    if (tools && tools.length > 0) {
      payload.tools = [{ function_declarations: tools.map((tool) => this.convertTool(tool)) }];
    }
    const providerNativeTools = this.buildGeminiRestNativeTools(tools, undefined);
    if (providerNativeTools.length > 0) {
      payload.tools = providerNativeTools;
    }

    let lastError: unknown = null;

    for (let attempt = 0; attempt < keys.length; attempt += 1) {
      const keyIndex = (this.currentClientIndex + attempt) % keys.length;
      const apiKey = keys[keyIndex];

      try {
        const headers: Record<string, string> = {
          'content-type': 'application/json',
          ...config.geminiCustomHeaders,
          'x-goog-api-key': apiKey,
        };

        const response = await safeFetch(gatewayUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        }, {
          serviceName: 'Gemini Cloudflare AI Gateway',
          allowLoopback: true,
        });

        const responseBody = await readSafeJsonResponse<GeminiGatewayResponse>(response, 'Gemini Cloudflare AI Gateway').catch(() => null);

        if (!response.ok) {
          const errorText =
            responseBody?.error?.message ||
            `HTTP ${response.status}`;
          throw new Error(`[Cloudflare AI Gateway] ${errorText}`);
        }

        if (attempt > 0) {
          logger.info(
            `[Gemini Failover] Requisicao via Cloudflare AI Gateway bem-sucedida usando a chave secundaria (${keyIndex + 1}/${keys.length}).`,
          );
        }

        this.currentClientIndex = keyIndex;
        return this.parseGatewayResponse(responseBody);
      } catch (error: unknown) {lastError = error;
        logger.warn(
          `[Gemini via Cloudflare AI Gateway] Erro usando a chave ${keyIndex + 1}: ${getErrorMessage(error)}`,
        );
      }
    }

    throw lastError || new Error('Falha desconhecida no Cloudflare AI Gateway para Gemini');
  }

  private parseGatewayResponse(responseBody: GeminiGatewayResponse | null, options?: ProviderChatOptions): LlmResponse {
    const candidate = responseBody?.candidates?.[0];

    if (!candidate) {
      return {
        content: 'Sem resposta do modelo.',
        toolCalls: [],
        finishReason: 'error',
      };
    }

    const toolCalls: ToolCall[] = [];
    let textContent = '';

    for (const part of candidate.content?.parts || []) {
      if (part?.text) {
        textContent += part.text;
      }

      if (part?.functionCall) {
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

  private async resolveGeminiStreamResponse(
    result: GenerateContentStreamResult,
    fallback: {
      accumulated: string;
      toolCalls: ToolCall[];
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
      for (const part of candidate.content?.parts || []) {
        if (part?.text) {
          textContent += part.text;
        }
        if (part?.functionCall) {
          toolCalls.push({
            id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: part.functionCall.name,
            arguments: (part.functionCall.args || {}) as Record<string, unknown>,
          });
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
    } catch (error: unknown) {logger.warn('[Gemini] creation failed', error);
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
      output.push({ functionDeclarations: tools.map((tool) => this.convertTool(tool)) as any });
    }
    if (this.shouldEnableGoogleSearch(options)) {
      output.push({ googleSearch: {} });
    }
    if (this.shouldEnableCodeExecution(options)) {
      output.push({ codeExecution: {} });
    }
    return output.length > 0 ? output : undefined;
  }

  private buildGeminiRestNativeTools(tools?: ToolDefinition[], options?: ProviderChatOptions): GeminiRestNativeTool[] {
    const output: GeminiRestNativeTool[] = [];
    if (tools && tools.length > 0) {
      output.push({ function_declarations: tools.map((tool) => this.convertTool(tool)) as any });
    }
    if (this.shouldEnableGoogleSearch(options)) {
      output.push({ google_search: {} });
    }
    if (this.shouldEnableCodeExecution(options)) {
      output.push({ code_execution: {} });
    }
    return output;
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

  private convertMessages(messages: ChatMessage[]): Content[] {
    const contents: Content[] = [];
    const toolCallNames = new Map<string, string>();

    for (const message of messages) {
      if (message.role === 'tool') {
        const toolName = message.toolName
          || (message.toolCallId ? toolCallNames.get(message.toolCallId) : '')
          || 'unknown_tool';
        contents.push({
          role: 'function',
          parts: [
            {
              functionResponse: {
                name: toolName,
                response: { result: message.content },
              },
            },
          ],
        });
        if (message.inlineData && message.inlineData.length > 0) {
          const visionParts: Content['parts'] = [
            { text: '[Imagem capturada pela ferramenta para analise visual]' },
          ];
          for (const media of message.inlineData) {
            visionParts.push({
              inlineData: {
                mimeType: media.mimeType,
                data: media.data,
              },
            });
          }
          contents.push({ role: 'user', parts: visionParts });
        }
        continue;
      }

      const role = message.role === 'assistant' ? 'model' : 'user';
      const parts: Content['parts'] = [];

      if (message.content) {
        parts.push({ text: message.content });
      }

      if (message.inlineData && message.inlineData.length > 0) {
        for (const media of message.inlineData) {
          parts.push({
            inlineData: {
              mimeType: media.mimeType,
              data: media.data,
            },
          });
        }
      }

      if (message.toolCalls && message.toolCalls.length > 0) {
        for (const toolCall of message.toolCalls) {
          toolCallNames.set(toolCall.id, toolCall.name);
          parts.push({
            functionCall: {
              name: toolCall.name,
              args: toolCall.arguments,
            },
          });
        }
      }

      contents.push({ role, parts });
    }

    return contents;
  }

  private convertTool(tool: ToolDefinition): FunctionDeclaration {
    const properties: Record<string, any> = {};

    for (const [key, param] of Object.entries(tool.parameters.properties)) {
      properties[key] = this.convertSchema(param as unknown as Record<string, unknown>);
    }

    return {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: SchemaType.OBJECT,
        properties,
        required: tool.parameters.required || [],
      },
    };
  }

  private convertSchema(schema: Record<string, unknown>): any {
    const type = String(schema.type || 'string');
    const converted: any = {
      type: this.mapSchemaType(type),
    };

    if (typeof schema.description === 'string' && schema.description.trim()) {
      converted.description = schema.description;
    }

    if (Array.isArray(schema.enum) && schema.enum.length > 0) {
      converted.enum = schema.enum;
    }

    if (type.toLowerCase() === 'array') {
      const itemSchema = schema.items && typeof schema.items === 'object'
        ? this.convertSchema(schema.items as Record<string, unknown>)
        : { type: SchemaType.STRING };
      converted.items = itemSchema;
    }

    if (type.toLowerCase() === 'object') {
      const nestedProperties = schema.properties && typeof schema.properties === 'object'
        ? Object.fromEntries(
            Object.entries(schema.properties as Record<string, unknown>).map(([key, value]) => [
              key,
              this.convertSchema(value as Record<string, unknown>),
            ]),
          )
        : {};
      converted.properties = nestedProperties;
      if (Array.isArray(schema.required) && schema.required.length > 0) {
        converted.required = schema.required;
      }
    }

    return converted;
  }

  private mapSchemaType(type: string): SchemaType {
    switch (type.toLowerCase()) {
      case 'string':
        return SchemaType.STRING;
      case 'number':
        return SchemaType.NUMBER;
      case 'integer':
        return SchemaType.INTEGER;
      case 'boolean':
        return SchemaType.BOOLEAN;
      case 'array':
        return SchemaType.ARRAY;
      default:
        return SchemaType.STRING;
    }
  }

  private buildRequestOptions(): RequestOptions | undefined {
    const requestOptions: RequestOptions = {};

    if (config.geminiApiBaseUrl) {
      requestOptions.baseUrl = config.geminiApiBaseUrl;
    }

    if (config.geminiApiVersion) {
      requestOptions.apiVersion = config.geminiApiVersion;
    }

    if (config.geminiApiClient) {
      requestOptions.apiClient = config.geminiApiClient;
    }

    if (config.geminiCustomHeaders && Object.keys(config.geminiCustomHeaders).length > 0) {
      requestOptions.customHeaders = config.geminiCustomHeaders;
    }

    return Object.keys(requestOptions).length > 0 ? requestOptions : undefined;
  }
}
