import { logger } from '../logger.js';
export type ZavorthPersonalOpsOAuthProvider = 'google' | 'microsoft' | string;

export type ZavorthPersonalOpsOAuthTokenResult = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scopes: string[];
  tokenType: string;
};

export type ZavorthPersonalOpsOAuthRuntime = {
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

export type ZavorthPersonalOpsAuthorizationUrlInput = {
  provider: ZavorthPersonalOpsOAuthProvider;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  codeChallenge?: string | null;
  tenantId?: string | null;
  prompt?: string | null;
};

export type ZavorthPersonalOpsExchangeCodeInput = {
  provider: ZavorthPersonalOpsOAuthProvider;
  code: string;
  clientId: string;
  clientSecret?: string | null;
  redirectUri: string;
  codeVerifier?: string | null;
  tenantId?: string | null;
};

export type ZavorthPersonalOpsRefreshTokenInput = {
  provider: ZavorthPersonalOpsOAuthProvider;
  refreshToken: string;
  clientId: string;
  clientSecret?: string | null;
  tenantId?: string | null;
};

export class ZavorthPersonalOpsOAuthService {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  public constructor(runtime: ZavorthPersonalOpsOAuthRuntime = {}) {
    this.fetchImpl = runtime.fetchImpl || fetch;
    this.now = runtime.now || (() => new Date());
  }

  public buildAuthorizationUrl(input: ZavorthPersonalOpsAuthorizationUrlInput): URL {
    const provider = normalizeProvider(input.provider);
    const url = new URL(provider === 'microsoft'
      ? `https://login.microsoftonline.com/${safeTenant(input.tenantId)}/oauth2/v2.0/authorize`
      : 'https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', input.clientId);
    url.searchParams.set('redirect_uri', input.redirectUri);
    url.searchParams.set('scope', normalizeScopes(input.scopes).join(' '));
    url.searchParams.set('state', input.state);
    if (provider === 'google') {
      url.searchParams.set('access_type', 'offline');
      url.searchParams.set('include_granted_scopes', 'true');
      url.searchParams.set('prompt', clean(input.prompt) || 'consent');
    } else {
      url.searchParams.set('response_mode', 'query');
      if (input.prompt) {
        url.searchParams.set('prompt', input.prompt);
      }
    }
    const codeChallenge = clean(input.codeChallenge);
    if (codeChallenge) {
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
    }
    return url;
  }

  public async exchangeCode(input: ZavorthPersonalOpsExchangeCodeInput): Promise<ZavorthPersonalOpsOAuthTokenResult> {
    const provider = normalizeProvider(input.provider);
    const body = new URLSearchParams();
    body.set('grant_type', 'authorization_code');
    body.set('code', input.code);
    body.set('client_id', input.clientId);
    body.set('redirect_uri', input.redirectUri);
    appendOptional(body, 'client_secret', input.clientSecret);
    appendOptional(body, 'code_verifier', input.codeVerifier);
    const json = await this.postToken({
      provider,
      tenantId: input.tenantId,
      body,
    });
    return this.normalizeTokenResult(json);
  }

  public async refreshAccessToken(input: ZavorthPersonalOpsRefreshTokenInput): Promise<ZavorthPersonalOpsOAuthTokenResult> {
    const provider = normalizeProvider(input.provider);
    const body = new URLSearchParams();
    body.set('grant_type', 'refresh_token');
    body.set('refresh_token', input.refreshToken);
    body.set('client_id', input.clientId);
    appendOptional(body, 'client_secret', input.clientSecret);
    const json = await this.postToken({
      provider,
      tenantId: input.tenantId,
      body,
    });
    return this.normalizeTokenResult(json);
  }

  private async postToken(input: {
    provider: 'google' | 'microsoft';
    tenantId?: string | null;
    body: URLSearchParams;
  }): Promise<Record<string, unknown>> {
    const endpoint = input.provider === 'microsoft'
      ? `https://login.microsoftonline.com/${safeTenant(input.tenantId)}/oauth2/v2.0/token`
      : 'https://oauth2.googleapis.com/token';
    const response = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: input.body.toString(),
    });
    const json = await readJson(response);
    if (!response.ok) {
      throw new Error(`personal_ops_oauth_token_failed:${response.status}`);
    }
    return json;
  }

  private normalizeTokenResult(json: Record<string, unknown>): ZavorthPersonalOpsOAuthTokenResult {
    const accessToken = clean(json.access_token || json.accessToken);
    if (!accessToken) {
      throw new Error('personal_ops_oauth_access_token_missing');
    }
    const expiresIn = Number(json.expires_in || json.expiresIn || 0);
    return {
      accessToken,
      refreshToken: clean(json.refresh_token || json.refreshToken),
      expiresAt: Number.isFinite(expiresIn) && expiresIn > 0
        ? new Date(this.now().getTime() + expiresIn * 1000).toISOString()
        : null,
      scopes: normalizeScopes(String(json.scope || '').split(/\s+/)),
      tokenType: clean(json.token_type || json.tokenType) || 'Bearer',
    };
  }
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const json = await response.json() as unknown;
    return json && typeof json === 'object' && !Array.isArray(json)
      ? json as Record<string, unknown>
      : {};
  } catch (error) { logger.warn('[Zavorth Personal Ops O Auth] operation failed', error); return {}; }
}

function normalizeProvider(value: unknown): 'google' | 'microsoft' {
  const provider = String(value || '').trim().toLowerCase();
  if (provider === 'microsoft' || provider === 'msgraph' || provider === 'graph') {
    return 'microsoft';
  }
  if (provider === 'google' || provider === 'gmail') {
    return 'google';
  }
  throw new Error('personal_ops_oauth_provider_unsupported');
}

function safeTenant(value: unknown): string {
  const tenant = String(value || '').trim();
  return /^[a-z0-9_.-]+$/i.test(tenant) ? tenant : 'common';
}

function normalizeScopes(scopes: unknown[]): string[] {
  return Array.from(new Set(scopes.map((scope) => String(scope || '').trim()).filter(Boolean)));
}

function appendOptional(body: URLSearchParams, key: string, value: unknown): void {
  const normalized = clean(value);
  if (normalized) {
    body.set(key, normalized);
  }
}

function clean(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}
