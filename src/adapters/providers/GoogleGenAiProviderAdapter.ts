import { GoogleGenAI } from '@google/genai';
import type {
  ChatMessage,
  ILlmProvider,
  LlmResponse,
  ProviderChatOptions,
  ToolCall,
  ToolDefinition,
} from '../../providers/ILlmProvider.js';

export type GoogleGenAiProviderAdapterOptions = {
  apiKey?: string | null;
  modelName?: string | null;
  vertexai?: boolean;
  project?: string | null;
  location?: string | null;
  client?: GoogleGenAiLikeClient;
};

type GoogleGenAiLikeClient = {
  models: {
    generateContent(input: Record<string, unknown>, options?: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
};

export class GoogleGenAiProviderAdapter implements ILlmProvider {
  public readonly name = 'google-genai';
  private readonly apiKey: string;
  private readonly defaultModelName: string;
  private readonly vertexai: boolean;
  private readonly project: string;
  private readonly location: string;
  private readonly injectedClient: GoogleGenAiLikeClient | null;

  constructor(options: GoogleGenAiProviderAdapterOptions = {}) {
    this.apiKey = String(options.apiKey || process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || '').trim();
    this.defaultModelName = String(options.modelName || process.env.GOOGLE_GENAI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
    this.vertexai = options.vertexai === true || process.env.GOOGLE_GENAI_VERTEXAI === 'true';
    this.project = String(options.project || process.env.GOOGLE_GENAI_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '').trim();
    this.location = String(options.location || process.env.GOOGLE_GENAI_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || 'us-central1').trim();
    this.injectedClient = options.client || null;
  }

  public isConfigured(): boolean {
    if (this.vertexai) {
      return Boolean(this.project && this.location);
    }
    return Boolean(this.apiKey);
  }

  public async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): Promise<LlmResponse> {
    if (!this.isConfigured() && !this.injectedClient) {
      throw new Error('Google GenAI provider requires GOOGLE_GENAI_API_KEY/GEMINI_API_KEY or Vertex project/location.');
    }

    const payload = {
      model: String(options?.modelName || this.defaultModelName),
      contents: toGenAiContents(messages),
      config: {
        systemInstruction: systemPrompt(messages) || undefined,
        tools: tools && tools.length > 0
          ? [{
              functionDeclarations: tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
              })),
            }]
          : undefined,
      },
    };
    const response = await this.client().models.generateContent(
      payload,
      options?.signal ? { signal: options.signal } : undefined,
    );

    return parseGoogleGenAiResponse(response);
  }

  private client(): GoogleGenAiLikeClient {
    if (this.injectedClient) {
      return this.injectedClient;
    }
    if (this.vertexai) {
      return new GoogleGenAI({
        vertexai: true,
        project: this.project,
        location: this.location,
      }) as unknown as GoogleGenAiLikeClient;
    }
    return new GoogleGenAI({
      apiKey: this.apiKey,
    }) as unknown as GoogleGenAiLikeClient;
  }
}

function parseGoogleGenAiResponse(response: Record<string, unknown>): LlmResponse {
  const candidates = Array.isArray(response.candidates) ? response.candidates : [];
  const firstCandidate = asRecord(candidates[0]);
  const content = asRecord(firstCandidate?.content);
  const parts = Array.isArray(content?.parts) ? content.parts : [];
  const text = parts
    .map((part) => String(asRecord(part)?.text || ''))
    .filter(Boolean)
    .join('\n');
  const toolCalls: ToolCall[] = parts.flatMap((part) => {
    const functionCall = asRecord(asRecord(part)?.functionCall);
    if (!functionCall) return [];
    return [{
      id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: String(functionCall.name || 'unknown_tool'),
      arguments: asRecord(functionCall.args) || {},
    }];
  });

  return {
    content: text || null,
    toolCalls,
    finishReason: String(firstCandidate?.finishReason || 'stop'),
  };
}

function toGenAiContents(messages: ChatMessage[]): Array<Record<string, unknown>> {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content || '' }],
    }));
}

function systemPrompt(messages: ChatMessage[]): string {
  return messages
    .filter((message) => message.role === 'system')
    .map((message) => String(message.content || '').trim())
    .filter(Boolean)
    .join('\n');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
