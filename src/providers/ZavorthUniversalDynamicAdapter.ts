import { sanitizedProviderFetch } from '../security/SanitizedProviderFetch.js';
import type { ChatMessage, ILlmProvider, LlmResponse, ProviderChatOptions, ToolDefinition } from './ILlmProvider.js';

export interface DynamicAdapterConfig {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  protocol: 'openai_compatible' | 'gemini_native' | 'claude_native' | 'ollama_native';
}

interface OpenAiChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream: boolean;
  max_tokens?: number;
  temperature?: number;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ZavorthUniversalDynamicAdapter implements ILlmProvider {
  public readonly name: string;
  private readonly config: DynamicAdapterConfig;

  constructor(config: DynamicAdapterConfig) {
    this.config = config;
    this.name = config.providerId;
  }

  getConfig(): DynamicAdapterConfig {
    return { ...this.config };
  }

  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  getApiKey(): string {
    return this.config.apiKey;
  }

  getDefaultModel(): string {
    return this.config.defaultModel;
  }

  getProtocol(): string {
    return this.config.protocol;
  }

  async chat(
    messages: ChatMessage[],
    _tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): Promise<LlmResponse> {
    const model = options?.modelName || this.config.defaultModel;
    const timeoutMs = options?.timeoutMs ?? 60_000;

    switch (this.config.protocol) {
      case 'openai_compatible':
      case 'ollama_native':
        return this.chatOpenAiCompatible(messages, model, timeoutMs);
      case 'gemini_native':
        return this.chatGeminiNative(messages, model, timeoutMs);
      case 'claude_native':
        return this.chatClaudeNative(messages, model, timeoutMs);
      default:
        return this.chatOpenAiCompatible(messages, model, timeoutMs);
    }
  }

  private async chatOpenAiCompatible(
    messages: ChatMessage[],
    model: string,
    timeoutMs: number,
  ): Promise<LlmResponse> {
    const endpoint = this.config.protocol === 'ollama_native'
      ? `${this.config.baseUrl}/api/chat`
      : `${this.config.baseUrl}/chat/completions`;

    const body: OpenAiChatRequest = {
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content ?? '' })),
      stream: false,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await sanitizedProviderFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const data = await res.json() as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };

      const choice = data.choices?.[0];
      const content = choice?.message?.content ?? '';
      const finishReason = choice?.finish_reason ?? 'stop';

      return {
        content,
        finishReason,
        toolCalls: [],
        tokens: {
          input: data.usage?.prompt_tokens ?? 0,
          output: data.usage?.completion_tokens ?? 0,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async chatGeminiNative(
    messages: ChatMessage[],
    model: string,
    timeoutMs: number,
  ): Promise<LlmResponse> {
    const contents: GeminiContent[] = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content ?? '' }],
    }));

    const endpoint = `${this.config.baseUrl}/models/${model}:generateContent?key=${this.config.apiKey}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await sanitizedProviderFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const data = await res.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };

      const candidate = data.candidates?.[0];
      const content = candidate?.content?.parts?.[0]?.text ?? '';
      const finishReason = candidate?.finishReason ?? 'STOP';

      return {
        content,
        finishReason,
        toolCalls: [],
        tokens: {
          input: data.usageMetadata?.promptTokenCount ?? 0,
          output: data.usageMetadata?.candidatesTokenCount ?? 0,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async chatClaudeNative(
    messages: ChatMessage[],
    model: string,
    timeoutMs: number,
  ): Promise<LlmResponse> {
    const claudeMessages: ClaudeMessage[] = messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content ?? '',
    }));

    const endpoint = `${this.config.baseUrl}/messages`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await sanitizedProviderFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: claudeMessages,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const data = await res.json() as {
        content?: Array<{ type?: string; text?: string }>;
        stop_reason?: string;
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      const content = data.content?.[0]?.text ?? '';
      const finishReason = data.stop_reason ?? 'end_turn';

      return {
        content,
        finishReason,
        toolCalls: [],
        tokens: {
          input: data.usage?.input_tokens ?? 0,
          output: data.usage?.output_tokens ?? 0,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }
}