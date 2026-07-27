import { AuthProvider, ResolvedCredentials } from './types.js';

export class DeviceCodeAuth implements AuthProvider {
  readonly authType = 'deviceCode';

  private readonly envKey: string;

  constructor(envKey: string) {
    this.envKey = envKey;
  }

  async resolveCredentials(env: Record<string, string | undefined>): Promise<ResolvedCredentials> {
    const token = env[this.envKey];
    if (!token) {
      throw new Error(`Missing device code token in environment variable: ${this.envKey}`);
    }
    return { token };
  }

  buildHeaders(credentials: ResolvedCredentials): Record<string, string> {
    if (!credentials.token) {
      throw new Error('Device code token is required');
    }
    return {
      Authorization: `Bearer ${credentials.token}`,
    };
  }

  buildRequestInit(credentials: ResolvedCredentials): RequestInit {
    return {
      headers: this.buildHeaders(credentials),
    };
  }
}
