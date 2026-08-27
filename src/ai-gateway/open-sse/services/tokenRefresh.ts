export type TokenRefreshResult = {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  providerSpecificData?: Record<string, unknown>;
  error?: string;
};

export const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export function supportsTokenRefresh(provider: string): boolean {
  return ["claude", "anthropic", "codex", "github", "google", "gemini", "copilot", "iflow", "qwen"].includes(provider);
}

export async function getAccessToken(
  provider: string,
  credentials: { accessToken?: string; expiresAt?: string } | null | undefined
): Promise<TokenRefreshResult> {
  if (!credentials?.accessToken) return {};
  const expiresAt = credentials.expiresAt ? new Date(credentials.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
  if (Date.now() + TOKEN_EXPIRY_BUFFER_MS >= expiresAt) {
    return await refreshAccessToken(provider, credentials as Record<string, unknown>);
  }
  return { accessToken: credentials.accessToken };
}

export function isUnrecoverableRefreshError(result: unknown): boolean {
  const error = typeof (result as { error?: unknown })?.error === "string"
    ? String((result as { error: string }).error)
    : "";
  return /invalid_grant|refresh_token_reused|revoked/i.test(error);
}

export async function checkAndRefreshToken<T>(provider: string, credentials: T): Promise<T> {
  if (!credentials || typeof credentials !== "object") return credentials;
  const cred = credentials as Record<string, unknown>;
  if (!cred.accessToken) return credentials;
  const expiresAt = cred.expiresAt ? new Date(String(cred.expiresAt)).getTime() : Number.MAX_SAFE_INTEGER;
  if (Date.now() + TOKEN_EXPIRY_BUFFER_MS >= expiresAt) {
    const refreshed = await refreshTokenByProvider(provider, cred);
    return { ...credentials, ...refreshed } as T;
  }
  return credentials;
}

export async function refreshAccessToken(
  provider: string,
  credentials: Record<string, unknown>
): Promise<TokenRefreshResult> {
  return refreshTokenByProvider(provider, credentials);
}

export async function refreshTokenByProvider(
  provider: string,
  credentials: Record<string, unknown>
): Promise<TokenRefreshResult> {
  switch (provider) {
    case "claude":
    case "anthropic":
      return refreshClaudeOAuthToken(credentials);
    case "codex":
      return refreshCodexToken(credentials);
    case "github":
      return refreshGitHubToken(credentials);
    case "google":
    case "gemini":
      return refreshGoogleToken(credentials);
    case "copilot": {
      const refreshed = await refreshCopilotToken(credentials);
      if (!refreshed) return { error: "Copilot token refresh failed" };
      return {
        providerSpecificData: {
          ...(credentials.providerSpecificData as Record<string, unknown> | undefined),
          copilotToken: refreshed.token,
          copilotTokenExpiresAt: refreshed.expiresAt,
        },
      };
    }
    case "iflow":
      return refreshIflowToken(credentials);
    case "qwen":
      return refreshQwenToken(credentials);
    default:
      return { error: `Token refresh not supported for provider: ${provider}` };
  }
}

export function formatProviderCredentials(credentials: Record<string, unknown>): Record<string, unknown> {
  return {
    apiKey: credentials.apiKey ?? null,
    accessToken: credentials.accessToken ?? null,
    refreshToken: credentials.refreshToken ?? null,
    expiresAt: credentials.expiresAt ?? null,
    projectId: credentials.projectId ?? null,
    providerSpecificData: credentials.providerSpecificData ?? {},
  };
}

export async function getAllAccessTokens(): Promise<Record<string, TokenRefreshResult>> {
  return {};
}

export async function refreshClaudeOAuthToken(credentials: Record<string, unknown>): Promise<TokenRefreshResult> {
  if (!credentials.refreshToken) return { error: 'No refresh token for Claude' };
  return { error: 'Claude OAuth token refresh requires Anthropic workspace credentials — not yet supported via open-sse' };
}

export async function refreshCodexToken(credentials: Record<string, unknown>): Promise<TokenRefreshResult> {
  if (!credentials.refreshToken) return { error: 'No refresh token for Codex' };
  return { error: 'Codex token refresh requires OpenAI session credentials — not yet supported via open-sse' };
}

export async function refreshCopilotToken(
  credentials: { accessToken?: string } | Record<string, unknown>
): Promise<{ token: string; expiresAt: number } | null> {
  const accessToken = credentials?.accessToken;
  if (!accessToken) return null;
  return null;
}

export async function refreshGitHubToken(credentials: Record<string, unknown>): Promise<TokenRefreshResult> {
  if (!credentials.refreshToken) return { error: 'No refresh token for GitHub' };

  const clientId = credentials.clientId as string | undefined;
  const clientSecret = credentials.clientSecret as string | undefined;
  if (!clientId || !clientSecret) {
    return { error: 'GitHub refresh requires client_id and client_secret' };
  }

  try {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: credentials.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      return { error: `GitHub token refresh failed: HTTP ${res.status}` };
    }

    const data = await res.json() as { access_token?: string; error?: string; error_description?: string };
    if (data.error) {
      return { error: data.error_description || data.error };
    }
    if (!data.access_token) {
      return { error: 'GitHub returned no access_token' };
    }

    return {
      token: data.access_token,
      expiresAt: Date.now() + 3600_000,
    };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function refreshGoogleToken(credentials: Record<string, unknown>): Promise<TokenRefreshResult> {
  if (!credentials.refreshToken) return { error: 'No refresh token for Google' };

  const clientId = credentials.clientId as string | undefined;
  const clientSecret = credentials.clientSecret as string | undefined;
  if (!clientId || !clientSecret) {
    return { error: 'Google refresh requires client_id and client_secret' };
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: credentials.refreshToken as string,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      return { error: `Google token refresh failed: HTTP ${res.status}` };
    }

    const data = await res.json() as { access_token?: string; error?: string; error_description?: string };
    if (data.error) {
      return { error: data.error_description || data.error };
    }
    if (!data.access_token) {
      return { error: 'Google returned no access_token' };
    }

    return {
      token: data.access_token,
      expiresAt: Date.now() + 3600_000,
    };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function refreshIflowToken(credentials: Record<string, unknown>): Promise<TokenRefreshResult> {
  if (!credentials.refreshToken) return { error: 'No refresh token for iFlow' };
  return { error: 'iFlow token refresh not yet implemented' };
}

export async function refreshQwenToken(credentials: Record<string, unknown>): Promise<TokenRefreshResult> {
  if (!credentials.refreshToken) return { error: 'No refresh token for Qwen' };
  return { error: 'Qwen token refresh not yet implemented' };
}
