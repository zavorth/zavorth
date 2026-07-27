import { AuthProvider, ResolvedCredentials } from './types.js';

export class ApiKeyAuth implements AuthProvider {
  readonly authType = 'apiKey';

  private readonly envKey: string;

  constructor(envKey: string) {
    this.envKey = envKey;
  }

  async resolveCredentials(env: Record<string, string | undefined>): Promise<ResolvedCredentials> {
    const apiKey = env[this.envKey];
    if (!apiKey) {
      throw new Error(`Missing API key in environment variable: ${this.envKey}`);
    }
    return { apiKey };
  }

  buildHeaders(credentials: ResolvedCredentials): Record<string, string> {
    if (!credentials.apiKey) {
      throw new Error('API key is required');
    }
    return {
      Authorization: `Bearer ${credentials.apiKey}`,
    };
  }

  buildRequestInit(credentials: ResolvedCredentials): RequestInit {
    return {
      headers: this.buildHeaders(credentials),
    };
  }
}
