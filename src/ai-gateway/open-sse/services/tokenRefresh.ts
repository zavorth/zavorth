export type TokenRefreshResult = {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  providerSpecificData?: Record<string, unknown>;
  error?: string;
};

export function supportsTokenRefresh(_provider: string): boolean {
  return false;
}

export async function getAccessToken(
  _provider: string,
  credentials: { accessToken?: string } | null | undefined
): Promise<TokenRefreshResult> {
  return credentials?.accessToken ? { accessToken: credentials.accessToken } : {};
}

export function isUnrecoverableRefreshError(result: unknown): boolean {
  const error = typeof (result as { error?: unknown })?.error === "string"
    ? String((result as { error: string }).error)
    : "";
  return /invalid_grant|refresh_token_reused|revoked/i.test(error);
}

export async function checkAndRefreshToken<T>(_provider: string, credentials: T): Promise<T> {
  return credentials;
}
