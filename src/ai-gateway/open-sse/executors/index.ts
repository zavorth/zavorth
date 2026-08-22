export interface ExecutorCredentials {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  providerSpecificData?: Record<string, unknown>;
  copilotToken?: string;
  copilotTokenExpiresAt?: string;
}

export interface CredentialRefreshResult {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  expiresAt?: string;
  copilotToken?: string;
  copilotTokenExpiresAt?: string;
  providerSpecificData?: Record<string, unknown>;
}

export interface ProviderExecutor {
  needsRefresh(credentials: ExecutorCredentials): boolean;
  refreshCredentials(
    credentials: ExecutorCredentials,
    logger?: Pick<Console, "log" | "warn" | "error">
  ): Promise<CredentialRefreshResult | null>;
}

function tokenExpired(expiresAt?: string): boolean {
  if (!expiresAt) return true;
  const ms = new Date(expiresAt).getTime();
  if (Number.isNaN(ms)) return true;
  return ms - Date.now() < 60_000;
}

function needsRefresh(credentials: ExecutorCredentials): boolean {
  return tokenExpired(credentials.expiresAt) || tokenExpired(credentials.copilotTokenExpiresAt);
}

async function refreshCredentials(
  credentials: ExecutorCredentials,
  logger?: Pick<Console, "log" | "warn" | "error">
): Promise<CredentialRefreshResult | null> {
  if (!credentials?.refreshToken) {
    return null;
  }
  logger?.warn?.(`[open-sse] Credential refresh is not wired for this executor`);
  return null;
}

export function getExecutor(_provider: string): ProviderExecutor {
  return { needsRefresh, refreshCredentials };
}
