import {
  OpenAICompatibleProviderLiveClient,
  type ProviderP0ChatSmokeInput,
  type ProviderP0ChatSmokeReceipt,
} from './ProviderP0LiveClients.js';export type ProviderLongTailAdapterFamily =
  | 'openai-compatible'
  | 'managed-gateway-compatible'
  | 'local-openai-compatible'
  | 'embedding-compatible';

export type ProviderLongTailEmbeddingSmokeInput = {
  input: string;
  modelName?: string | null;
};

export type ProviderLongTailEmbeddingSmokeReceipt = {
  providerId: string;
  family: Extract<ProviderLongTailAdapterFamily, 'embedding-compatible'>;
  status: 'passed';
  modelName: string;
  embeddingCount: number;
  dimensions: number | null;
  promptTokens: number | null;
  totalTokens: number | null;
  liveIo: true;
  secretValuesSerialized: false;
  receivedAt: string;
};

export type ProviderLongTailChatSmokeReceipt = Omit<ProviderP0ChatSmokeReceipt, 'family'> & {
  family: Exclude<ProviderLongTailAdapterFamily, 'embedding-compatible'>;
};

type ClientRuntime = {
  now?: () => Date;
  fetchImpl?: typeof fetch;
};

export type ProviderLongTailCompatibleClientConfig = {
  providerId: string;
  baseUrl: string;
  apiKey?: string | null;
  modelName: string;
  defaultHeaders?: Record<string, string>;
};

export type ProviderLongTailEmbeddingClientConfig = {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
};

export class ProviderLongTailCompatibleLiveClient {
  private readonly family: ProviderLongTailAdapterFamily;
  private readonly client: OpenAICompatibleProviderLiveClient;

  constructor(
    config: ProviderLongTailCompatibleClientConfig,
    runtime: ClientRuntime = {},
    family: ProviderLongTailAdapterFamily = 'openai-compatible',
  ) {
    this.family = family;
    this.client = new OpenAICompatibleProviderLiveClient(
      config,
      runtime,
      family === 'local-openai-compatible' ? 'local-openai-compatible' : 'openai-compatible',
    );
  }

  public isConfigured(): boolean {
    return this.client.isConfigured();
  }

  public async chatSmoke(input: ProviderP0ChatSmokeInput): Promise<ProviderLongTailChatSmokeReceipt> {
    const receipt = await this.client.chatSmoke(input);
    return {
      ...receipt,
      family: this.family as Exclude<ProviderLongTailAdapterFamily, 'embedding-compatible'>,
    };
  }
}

export class ProviderLongTailEmbeddingLiveClient {
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetch | null;
  private readonly config: ProviderLongTailEmbeddingClientConfig;

  constructor(config: ProviderLongTailEmbeddingClientConfig, runtime: ClientRuntime = {}) {
    this.config = {
      ...config,
      baseUrl: stripTrailingSlash(config.baseUrl),
    };
    this.now = runtime.now || (() => new Date());
    this.fetchImpl = runtime.fetchImpl || globalThis.fetch || null;
  }

  public isConfigured(): boolean {
    return Boolean(this.config.baseUrl && this.config.apiKey);
  }

  public async embeddingSmoke(input: ProviderLongTailEmbeddingSmokeInput): Promise<ProviderLongTailEmbeddingSmokeReceipt> {
    if (!this.fetchImpl) {
      throw new Error(`${this.config.providerId} embedding smoke requires fetch in the runtime.`);
    }
    if (!this.config.baseUrl) {
      throw new Error(`${this.config.providerId} embedding smoke requires a base URL.`);
    }
    if (!this.config.apiKey) {
      throw new Error(`${this.config.providerId} embedding smoke requires an API key.`);
    }

    const modelName = String(input.modelName || this.config.modelName || '').trim();
    const response = await this.fetchImpl(`${this.config.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        input: input.input,
      }),
    });
    const payload = await readJson(response);
    if (!response.ok) {
      throw new Error(`${this.config.providerId} embedding smoke failed: ${readError(payload, response.status)}`);
    }

    const firstEmbedding = payload?.data?.[0]?.embedding;
    const usage = payload?.usage && typeof payload.usage === 'object' ? payload.usage : {};
    return {
      providerId: this.config.providerId,
      family: 'embedding-compatible',
      status: 'passed',
      modelName,
      embeddingCount: Array.isArray(payload?.data) ? payload.data.length : 0,
      dimensions: Array.isArray(firstEmbedding) ? firstEmbedding.length : null,
      promptTokens: numberOrNull(usage.prompt_tokens),
      totalTokens: numberOrNull(usage.total_tokens),
      liveIo: true,
      secretValuesSerialized: false,
      receivedAt: this.now().toISOString(),
    };
  }
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
