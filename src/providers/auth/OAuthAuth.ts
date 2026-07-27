import { readFileSync } from 'node:fs';
import { AuthProvider, ResolvedCredentials } from './types.js';

export class OAuthAuth implements AuthProvider {
  readonly authType = 'oauth';

  private readonly envKey: string;
  private readonly filePath?: string;

  constructor(envKey: string, filePath?: string) {
    this.envKey = envKey;
    this.filePath = filePath;
  }

  async resolveCredentials(env: Record<string, string | undefined>): Promise<ResolvedCredentials> {
    let token = env[this.envKey];

    if (!token && this.filePath) {
      token = readFileSync(this.filePath, 'utf-8').trim();
    }

    if (!token) {
      throw new Error(`Missing OAuth token in environment variable: ${this.envKey}`);
    }

    return { token };
  }

  buildHeaders(credentials: ResolvedCredentials): Record<string, string> {
    if (!credentials.token) {
      throw new Error('OAuth token is required');
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
