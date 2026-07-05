import { logger } from '../logger.js';
export type ZavorthXaiDoctorSnapshot = {
  contractVersion: 'xai-provider-doctor/1';
  generatedAt: string;
  provider: 'xai';
  configured: boolean;
  liveChecked: boolean;
  liveReady: boolean;
  baseUrl: string;
  model: string;
  credentialEnv: 'XAI_API_KEY' | 'XAI_OAUTH_TOKEN';
  authMode: 'api_key' | 'oauth' | 'missing';
  capabilities: {
    chat: true;
    streaming: true;
    nativeSearch: true;
    toolUse: true;
    oauth: true;
  };
  status: 'ready' | 'missing_env' | 'live_failed';
  error?: string;
};

export type ZavorthXaiSearchSnapshot = {
  contractVersion: 'xai-provider-search/1';
  generatedAt: string;
  provider: 'xai';
  query: string;
  live: boolean;
  status: 'preview' | 'ready' | 'blocked' | 'failed';
  lines: string[];
  receipt: {
    credentialSerialized: false;
    nativeSearchRequested: boolean;
    model: string;
    baseUrl: string;
    authMode: 'api_key' | 'oauth' | 'missing';
  };
};

type ServiceOptions = {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

export class ZavorthXaiRuntimeService {
  private readonly env: NodeJS.ProcessEnv;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(options: ServiceOptions = {}) {
    this.env = options.env || process.env;
    this.fetchImpl = options.fetchImpl || fetch;
    this.now = options.now || (() => new Date());
  }

  public doctor(input: { live?: boolean } = {}): ZavorthXaiDoctorSnapshot {
    const credential = this.credential();
    const configured = Boolean(credential.token);
    return {
      contractVersion: 'xai-provider-doctor/1',
      generatedAt: this.timestamp(),
      provider: 'xai',
      configured,
      liveChecked: Boolean(input.live),
      liveReady: configured && !input.live ? true : false,
      baseUrl: this.baseUrl(),
      model: this.model(),
      credentialEnv: credential.envName,
      authMode: credential.mode,
      capabilities: {
        chat: true,
        streaming: true,
        nativeSearch: true,
        toolUse: true,
        oauth: true,
      },
      status: configured ? 'ready' : 'missing_env',
    };
  }

  public async liveDoctor(): Promise<ZavorthXaiDoctorSnapshot> {
    const base = this.doctor({ live: true });
    if (!base.configured) return base;
    try {
      const response = await this.fetchImpl(`${base.baseUrl.replace(/\/+$/u, '')}/models`, {
        headers: { Authorization: `Bearer ${this.credential().token}` },
      });
      return {
        ...base,
        liveReady: response.ok,
        status: response.ok ? 'ready' : 'live_failed',
        ...(response.ok ? {} : { error: `http-${response.status}` }),
      };
    } catch (error) {
    logger.warn('[Zavorth Xai Runtime] network request failed', error);
    return {
        ...base,
        liveReady: false,
        status: 'live_failed',
        error: error instanceof Error ? error.message : String(error),
      };
  }
  }

  public async search(input: { query: string; live?: boolean }): Promise<ZavorthXaiSearchSnapshot> {
    const query = String(input.query || '').trim();
    if (!query) {
      return this.searchSnapshot(query, Boolean(input.live), 'blocked', ['Search query is required.']);
    }
    if (!input.live) {
      return this.searchSnapshot(query, false, 'preview', [
        'xAI native search preview only.',
        'Add --live from an operator surface to call the provider.',
      ]);
    }
    const credential = this.credential();
    if (!credential.token) {
      return this.searchSnapshot(query, true, 'blocked', ['Missing XAI_API_KEY or XAI_OAUTH_TOKEN.']);
    }
    try {
      const response = await this.fetchImpl(`${this.baseUrl().replace(/\/+$/u, '')}/responses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credential.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model(),
          input: query,
          tools: [{ type: 'web_search_preview' }],
        }),
      });
      if (!response.ok) {
        return this.searchSnapshot(query, true, 'failed', [`xAI search failed: http-${response.status}`]);
      }
      const payload = await response.json() as Record<string, unknown>;
      const text = extractText(payload);
      return this.searchSnapshot(query, true, 'ready', text ? [text] : ['xAI returned an empty search response.']);
    } catch (error) {
    logger.warn('[Zavorth Xai Runtime] network request failed', error);
    return this.searchSnapshot(query, true, 'failed', [error instanceof Error ? error.message : String(error)]);
  }
  }

  private searchSnapshot(
    query: string,
    live: boolean,
    status: ZavorthXaiSearchSnapshot['status'],
    lines: string[],
  ): ZavorthXaiSearchSnapshot {
    return {
      contractVersion: 'xai-provider-search/1',
      generatedAt: this.timestamp(),
      provider: 'xai',
      query,
      live,
      status,
      lines,
      receipt: {
        credentialSerialized: false,
        nativeSearchRequested: true,
        model: this.model(),
        baseUrl: this.baseUrl(),
        authMode: this.credential().mode,
      },
    };
  }

  private baseUrl(): string {
    return String(this.env.XAI_BASE_URL || 'https://api.x.ai/v1').replace(/\/+$/u, '');
  }

  private model(): string {
    return String(this.env.XAI_MODEL || 'grok-4');
  }

  private credential(): {
    mode: 'api_key' | 'oauth' | 'missing';
    envName: 'XAI_API_KEY' | 'XAI_OAUTH_TOKEN';
    token: string;
  } {
    const preferred = String(this.env.XAI_AUTH_MODE || '').trim().toLowerCase();
    const apiKey = String(this.env.XAI_API_KEY || '').trim();
    const oauthToken = String(this.env.XAI_OAUTH_TOKEN || '').trim();
    if (preferred === 'oauth') {
      return oauthToken
        ? { mode: 'oauth', envName: 'XAI_OAUTH_TOKEN', token: oauthToken }
        : { mode: 'missing', envName: 'XAI_OAUTH_TOKEN', token: '' };
    }
    if (preferred === 'api_key') {
      return apiKey
        ? { mode: 'api_key', envName: 'XAI_API_KEY', token: apiKey }
        : { mode: 'missing', envName: 'XAI_API_KEY', token: '' };
    }
    if (apiKey) return { mode: 'api_key', envName: 'XAI_API_KEY', token: apiKey };
    if (oauthToken) return { mode: 'oauth', envName: 'XAI_OAUTH_TOKEN', token: oauthToken };
    return { mode: 'missing', envName: 'XAI_API_KEY', token: '' };
  }

  private timestamp(): string {
    return this.now().toISOString();
  }
}

function extractText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === 'string') return payload.output_text;
  if (typeof payload.text === 'string') return payload.text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const entry of content) {
      if (!entry || typeof entry !== 'object') continue;
      const text = (entry as { text?: unknown }).text;
      if (typeof text === 'string') parts.push(text);
    }
  }
  return parts.join('\n').trim();
}
