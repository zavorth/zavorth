export interface DynamicAdapterConfig {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  protocol: 'openai_compatible' | 'gemini_native' | 'claude_native' | 'ollama_native';
}

export class ZavorthUniversalDynamicAdapter {
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
}