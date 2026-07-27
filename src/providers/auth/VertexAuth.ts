import { readFileSync } from 'node:fs';
import { AuthProvider, ResolvedCredentials } from './types.js';

export class VertexAuth implements AuthProvider {
  readonly authType = 'vertex';

  private readonly projectId: string;
  private readonly credentialsFile: string;

  constructor(projectId: string, credentialsFile: string) {
    this.projectId = projectId;
    this.credentialsFile = credentialsFile;
  }

  async resolveCredentials(env: Record<string, string | undefined>): Promise<ResolvedCredentials> {
    const projectId = env.GOOGLE_CLOUD_PROJECT || this.projectId;
    const token = env.GOOGLE_APPLICATION_CREDENTIALS
      ? readFileSync(env.GOOGLE_APPLICATION_CREDENTIALS, 'utf-8')
      : readFileSync(this.credentialsFile, 'utf-8');

    if (!projectId) {
      throw new Error('Missing Google Cloud project ID');
    }

    const parsed = JSON.parse(token);
    const accessToken = parsed.access_token || parsed.private_key;

    if (!accessToken) {
      throw new Error('Could not extract access token from Google Cloud credentials');
    }

    return {
      token: accessToken,
      projectId,
      extra: {
        serviceAccountEmail: parsed.client_email || '',
      },
    };
  }

  buildHeaders(credentials: ResolvedCredentials): Record<string, string> {
    if (!credentials.token) {
      throw new Error('Google Cloud token is required');
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
