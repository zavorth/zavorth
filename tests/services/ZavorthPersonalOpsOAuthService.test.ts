import { ZavorthPersonalOpsOAuthService } from '../../src/services/ZavorthPersonalOpsOAuthService.js';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('ZavorthPersonalOpsOAuthService', () => {
  it('builds provider-specific OAuth authorization URLs without secrets', () => {
    const service = new ZavorthPersonalOpsOAuthService();

    const google = service.buildAuthorizationUrl({
      provider: 'google',
      clientId: 'google-client-id',
      redirectUri: 'http://127.0.0.1:47177/oauth/callback',
      scopes: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/calendar.events'],
      state: 'state-123',
      codeChallenge: 'pkce-challenge',
    });
    const microsoft = service.buildAuthorizationUrl({
      provider: 'microsoft',
      clientId: 'microsoft-client-id',
      redirectUri: 'http://127.0.0.1:47177/oauth/callback',
      scopes: ['Mail.Read', 'Calendars.ReadWrite', 'Tasks.ReadWrite'],
      state: 'state-456',
    });

    expect(google.toString()).toContain('accounts.google.com/o/oauth2/v2/auth');
    expect(google.searchParams.get('access_type')).toBe('offline');
    expect(google.searchParams.get('code_challenge')).toBe('pkce-challenge');
    expect(google.searchParams.get('scope')).toContain('gmail.readonly');
    expect(microsoft.toString()).toContain('login.microsoftonline.com/common/oauth2/v2.0/authorize');
    expect(microsoft.searchParams.get('response_mode')).toBe('query');
    expect(microsoft.searchParams.get('scope')).toContain('Mail.Read');
    expect(google.toString()).not.toContain('client_secret');
    expect(microsoft.toString()).not.toContain('client_secret');
  });

  it('exchanges an OAuth code and normalizes token expiry', async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const service = new ZavorthPersonalOpsOAuthService({
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), body: String(init?.body || '') });
        return jsonResponse({
          access_token: 'access-from-code',
          refresh_token: 'refresh-from-code',
          expires_in: 3600,
          scope: 'Mail.Read Calendars.ReadWrite',
          token_type: 'Bearer',
        });
      },
      now: () => new Date('2026-06-10T16:00:00.000Z'),
    });

    const result = await service.exchangeCode({
      provider: 'microsoft',
      code: 'oauth-code',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'http://127.0.0.1:47177/oauth/callback',
      codeVerifier: 'pkce-verifier',
    });

    expect(result).toMatchObject({
      accessToken: 'access-from-code',
      refreshToken: 'refresh-from-code',
      expiresAt: '2026-06-10T17:00:00.000Z',
      tokenType: 'Bearer',
    });
    expect(calls[0].url).toContain('login.microsoftonline.com/common/oauth2/v2.0/token');
    expect(calls[0].body).toContain('grant_type=authorization_code');
    expect(calls[0].body).toContain('code_verifier=pkce-verifier');
    expect(JSON.stringify(result)).not.toContain('client-secret');
  });

  it('refreshes access tokens without exposing refresh tokens in the result', async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const service = new ZavorthPersonalOpsOAuthService({
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), body: String(init?.body || '') });
        return jsonResponse({
          access_token: 'refreshed-access',
          expires_in: 120,
          token_type: 'Bearer',
        });
      },
      now: () => new Date('2026-06-10T16:00:00.000Z'),
    });

    const result = await service.refreshAccessToken({
      provider: 'google',
      refreshToken: 'refresh-secret',
      clientId: 'google-client-id',
    });

    expect(result).toMatchObject({
      accessToken: 'refreshed-access',
      refreshToken: null,
      expiresAt: '2026-06-10T16:02:00.000Z',
    });
    expect(calls[0].url).toContain('oauth2.googleapis.com/token');
    expect(calls[0].body).toContain('grant_type=refresh_token');
    expect(calls[0].body).toContain('refresh_token=refresh-secret');
    expect(JSON.stringify(result)).not.toContain('refresh-secret');
  });

  it('fails closed for unsupported OAuth providers', () => {
    const service = new ZavorthPersonalOpsOAuthService();

    expect(() => service.buildAuthorizationUrl({
      provider: 'unknown-provider',
      clientId: 'client-id',
      redirectUri: 'http://127.0.0.1/callback',
      scopes: [],
      state: 'state',
    })).toThrow('personal_ops_oauth_provider_unsupported');
  });
});
