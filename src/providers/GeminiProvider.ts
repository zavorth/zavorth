import {
  Content,
  FunctionDeclaration,
  GoogleGenerativeAI,
  RequestOptions,
  SchemaType,
} from '@google/generative-ai';
import { config } from '../config/index.js';
import {
  ChatMessage,
  ILlmProvider,
  LlmResponse,
  ProviderChatOptions,
  ToolCall,
  ToolDefinition,
} from './ILlmProvider.js';
import { safeFetch } from '../security/SafeFetchService.js';

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

    let lastError: any;
    let result: any;

    for (let attempt = 0; attempt < this.clients.length; attempt += 1) {
      const clientIndex = (this.currentClientIndex + attempt) % this.clients.length;
      const currentClient = this.clients[clientIndex];

      try {
        const model = currentClient.getGenerativeModel({
          model: modelName,
          tools: this.buildGeminiTools(tools, options),
        }, this.requestOptions);

        result = await model.generateContent({
          contents,
          systemInstruction: systemInstruction || undefined,
        });

        if (attempt > 0) {
          console.log(
            `[Gemini Failover] Requisicao bem-sucedida usando a chave secundaria (${clientIndex + 1}/${this.clients.length}).`,
          );
        }
        this.currentClientIndex = clientIndex;
        break;
      } catch (error: any) {
        lastError = error;
        console.warn(
          `[Gemini] Erro usando a chave ${clientIndex + 1}: ${error?.message || error}`,
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
      // Cloudflare AI Gateway forwards the raw Gemini REST payload, which expects
      // the REST field name instead of the SDK camelCase variant.
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

        const responseBody = await response.json().catch(() => null);

        if (!response.ok) {
          const errorText =
            responseBody?.error?.message ||
            responseBody?.message ||
            `HTTP ${response.status}`;
          throw new Error(`[Cloudflare AI Gateway] ${errorText}`);
        }

        if (attempt > 0) {
          console.log(
            `[Gemini Failover] Requisicao via Cloudflare AI Gateway bem-sucedida usando a chave secundaria (${keyIndex + 1}/${keys.length}).`,
          );
        }

        this.currentClientIndex = keyIndex;
        return this.parseGatewayResponse(responseBody);
      } catch (error: any) {
        lastError = error;
        console.warn(
          `[Gemini via Cloudflare AI Gateway] Erro usando a chave ${keyIndex + 1}: ${error?.message || error}`,
        );
      }
    }

    throw lastError || new Error('Falha desconhecida no Cloudflare AI Gateway para Gemini');
  }

  private parseGatewayResponse(responseBody: any, options?: ProviderChatOptions): LlmResponse {
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

  private buildGeminiTools(tools?: ToolDefinition[], options?: ProviderChatOptions): any[] | undefined {
    const output: any[] = [];
    if (tools && tools.length > 0) {
      output.push({ functionDeclarations: tools.map((tool) => this.convertTool(tool)) });
    }
    if (this.shouldEnableGoogleSearch(options)) {
      output.push({ googleSearch: {} });
    }
    if (this.shouldEnableCodeExecution(options)) {
      output.push({ codeExecution: {} });
    }
    return output.length > 0 ? output : undefined;
  }

  private buildGeminiRestNativeTools(tools?: ToolDefinition[], options?: ProviderChatOptions): any[] {
    const output: any[] = [];
    if (tools && tools.length > 0) {
      output.push({ function_declarations: tools.map((tool) => this.convertTool(tool)) });
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

  private buildProviderNativeMetadata(candidate: any, options?: ProviderChatOptions): Record<string, unknown> | undefined {
    const requested = options?.providerNativeTools || [];
    const activated = requested
      .filter((tool) => {
        if (tool.name === 'google_search') return this.shouldEnableGoogleSearch(options);
        if (tool.name === 'code_execution' || tool.name === 'provider_code_execution') return this.shouldEnableCodeExecution(options);
        return false;
      })
      .map((tool) => tool.name);
    const groundingMetadata = candidate?.groundingMetadata;
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

  private extractCitations(metadata: any): Array<{ title: string; url: string }> {
    const chunks = Array.isArray(metadata?.groundingChunks) ? metadata.groundingChunks : [];
    return chunks
      .map((chunk: any) => chunk?.web)
      .filter((web: any) => web?.uri)
      .map((web: any) => ({
        title: String(web.title || web.uri),
        url: String(web.uri),
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
        // Dashboard controls: Se a tool response trouxer inlineData (screenshot/visão),
        // emite como mensagem 'user' complementar imediatamente após para que
        // o Gemini enxergue a imagem no contexto.
        if (message.inlineData && message.inlineData.length > 0) {
          const visionParts: any[] = [
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
      const parts: any[] = [];

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

  private convertSchema(schema: Record<string, unknown>): Record<string, unknown> {
    const type = String(schema.type || 'string');
    const converted: Record<string, unknown> = {
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
