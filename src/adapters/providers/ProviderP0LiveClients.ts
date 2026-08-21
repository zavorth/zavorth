export type ProviderP0AdapterFamily =
  | 'openai-compatible'
  | 'anthropic-compatible'
  | 'gemini-rest'
  | 'local-openai-compatible';

export type ProviderP0ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ProviderP0ChatSmokeInput = {
  messages: ProviderP0ChatMessage[];
  modelName?: string | null;
};

export type ProviderP0ChatSmokeReceipt = {
  providerId: string;
  family: ProviderP0AdapterFamily;
  status: 'passed';
  modelName: string;
  contentLength: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  liveIo: true;
  secretValuesSerialized: false;
  receivedAt: string;
};

type ClientRuntime = {
  now?: () => Date;
  fetchImpl?: typeof fetch;
};

export type OpenAICompatibleProviderLiveClientConfig = {
  providerId: string;
  baseUrl: string;
  apiKey?: string | null;
  modelName: string;
  defaultHeaders?: Record<string, string>;
};

export type AnthropicCompatibleProviderLiveClientConfig = {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  anthropicVersion?: string;
};

export type GeminiRestProviderLiveClientConfig = {
  providerId: string;
  apiKey: string;
  baseUrl?: string | null;
  modelName: string;
};

export class OpenAICompatibleProviderLiveClient {
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetch | null;
  private readonly config: OpenAICompatibleProviderLiveClientConfig;
  private readonly family: ProviderP0AdapterFamily;

  constructor(
    config: OpenAICompatibleProviderLiveClientConfig,
    runtime: ClientRuntime = {},
    family: Extract<ProviderP0AdapterFamily, 'openai-compatible' | 'local-openai-compatible'> = 'openai-compatible',
  ) {
    this.config = {
      ...config,
      baseUrl: stripTrailingSlash(config.baseUrl),
    };
    this.family = family;
    this.now = runtime.now || (() => new Date());
    this.fetchImpl = runtime.fetchImpl || globalThis.fetch || null;
  }

  public isConfigured(): boolean {
    return Boolean(this.config.baseUrl && (this.family === 'local-openai-compatible' || this.config.apiKey));
  }

  public async chatSmoke(input: ProviderP0ChatSmokeInput): Promise<ProviderP0ChatSmokeReceipt> {
    if (!this.fetchImpl) {
      throw new Error(`${this.config.providerId} live smoke requires fetch in the runtime.`);
    }
    if (!this.config.baseUrl) {
      throw new Error(`${this.config.providerId} live smoke requires a base URL.`);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.config.defaultHeaders || {}),
    };
    const apiKey = String(this.config.apiKey || '').trim();
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const modelName = String(input.modelName || this.config.modelName || '').trim();
    const response = await this.fetchImpl(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelName,
        messages: normalizeMessages(input.messages),
        temperature: 0,
        max_tokens: 64,
      }),
    });

    const payload = await readJson(response);
    if (!response.ok) {
      throw new Error(`${this.config.providerId} live smoke failed: ${readError(payload, response.status)}`);
    }

    const content = String(payload?.choices?.[0]?.message?.content || '');
    const usage = payload?.usage && typeof payload.usage === 'object' ? payload.usage : {};
    return {
      providerId: this.config.providerId,
      family: this.family,
      status: 'passed',
      modelName,
      contentLength: content.length,
      promptTokens: numberOrNull(usage.prompt_tokens),
      completionTokens: numberOrNull(usage.completion_tokens),
      totalTokens: numberOrNull(usage.total_tokens),
      liveIo: true,
      secretValuesSerialized: false,
      receivedAt: this.now().toISOString(),
    };
  }
}

export class AnthropicCompatibleProviderLiveClient {
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetch | null;
  private readonly config: AnthropicCompatibleProviderLiveClientConfig;

  constructor(config: AnthropicCompatibleProviderLiveClientConfig, runtime: ClientRuntime = {}) {
    this.config = {
      ...config,
      baseUrl: stripTrailingSlash(config.baseUrl || 'https://api.anthropic.com/v1'),
      anthropicVersion: config.anthropicVersion || '2023-06-01',
    };
    this.now = runtime.now || (() => new Date());
    this.fetchImpl = runtime.fetchImpl || globalThis.fetch || null;
  }

  public isConfigured(): boolean {
    return Boolean(this.config.apiKey && this.config.baseUrl);
  }

  public async chatSmoke(input: ProviderP0ChatSmokeInput): Promise<ProviderP0ChatSmokeReceipt> {
    if (!this.fetchImpl) {
      throw new Error(`${this.config.providerId} live smoke requires fetch in the runtime.`);
    }
    if (!this.config.apiKey) {
      throw new Error(`${this.config.providerId} live smoke requires an API key.`);
    }

    const system = input.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n');
    const messages = input.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content,
      }));
    const modelName = String(input.modelName || this.config.modelName || '').trim();
    const response = await this.fetchImpl(`${this.config.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': this.config.anthropicVersion || '2023-06-01',
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 64,
        ...(system ? { system } : {}),
        messages,
      }),
    });

    const payload = await readJson(response);
    if (!response.ok) {
      throw new Error(`${this.config.providerId} live smoke failed: ${readError(payload, response.status)}`);
    }

    const content = Array.isArray(payload?.content)
      ? payload.content.map((part: { text: string; [key: string]: unknown }) => String(part?.text || '')).join('')
      : '';
    const usage = payload?.usage && typeof payload.usage === 'object' ? payload.usage : {};
    const inputTokens = numberOrNull(usage.input_tokens);
    const outputTokens = numberOrNull(usage.output_tokens);
    return {
      providerId: this.config.providerId,
      family: 'anthropic-compatible',
      status: 'passed',
      modelName,
      contentLength: content.length,
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      totalTokens: inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null,
      liveIo: true,
      secretValuesSerialized: false,
      receivedAt: this.now().toISOString(),
    };
  }
}

export class GeminiRestProviderLiveClient {
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetch | null;
  private readonly config: GeminiRestProviderLiveClientConfig;

  constructor(config: GeminiRestProviderLiveClientConfig, runtime: ClientRuntime = {}) {
    this.config = {
      ...config,
      baseUrl: stripTrailingSlash(config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta'),
    };
    this.now = runtime.now || (() => new Date());
    this.fetchImpl = runtime.fetchImpl || globalThis.fetch || null;
  }

  public isConfigured(): boolean {
    return Boolean(this.config.apiKey && this.config.baseUrl);
  }

  public async chatSmoke(input: ProviderP0ChatSmokeInput): Promise<ProviderP0ChatSmokeReceipt> {
    if (!this.fetchImpl) {
      throw new Error(`${this.config.providerId} live smoke requires fetch in the runtime.`);
    }
    if (!this.config.apiKey) {
      throw new Error(`${this.config.providerId} live smoke requires an API key.`);
    }

    const modelName = String(input.modelName || this.config.modelName || '').trim();
    const response = await this.fetchImpl(
      `${this.config.baseUrl}/models/${encodeURIComponent(modelName)}:generateContent...key=${encodeURIComponent(this.config.apiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: input.messages
            .filter((message) => message.role !== 'system')
            .map((message) => ({
              role: message.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: message.content }],
            })),
          system_instruction: {
            parts: [{
              text: input.messages
                .filter((message) => message.role === 'system')
                .map((message) => message.content)
                .join('\n'),
            }],
          },
        }),
      },
    );

    const payload = await readJson(response);
    if (!response.ok) {
      throw new Error(`${this.config.providerId} live smoke failed: ${readError(payload, response.status)}`);
    }

    const content = String(payload?.candidates?.[0]?.content?.parts?.[0]?.text || '');
    const usage = payload?.usageMetadata && typeof payload.usageMetadata === 'object'
      ? payload.usageMetadata
      : {};
    return {
      providerId: this.config.providerId,
      family: 'gemini-rest',
      status: 'passed',
      modelName,
      contentLength: content.length,
      promptTokens: numberOrNull(usage.promptTokenCount),
      completionTokens: numberOrNull(usage.candidatesTokenCount),
      totalTokens: numberOrNull(usage.totalTokenCount),
      liveIo: true,
      secretValuesSerialized: false,
      receivedAt: this.now().toISOString(),
    };
  }
}

function normalizeMessages(messages: ProviderP0ChatMessage[]): ProviderP0ChatMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: String(message.content || ''),
  }));
}

async function readJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch (error: unknown) {return null;
  }
}

function readError(payload: any, status: number): string {
  return String(payload?.error?.message || payload?.message || payload?.error || `HTTP ${status}`);
}

function numberOrNull(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function stripTrailingSlash(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '');
}
