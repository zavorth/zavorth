export interface CodexQuotaConnectionInfo {
  connectionId: string;
  accessToken?: string;
  workspaceId?: string;
}

export interface CodexQuotaInfo {
  percentUsed: number;
  utilization: number;
  remaining: number;
  resetAt?: string;
}

const registeredConnections = new Map<string, CodexQuotaConnectionInfo>();
let quotaFetcherRegistered = false;

export function registerCodexConnection(
  connectionId: string,
  info: Pick<CodexQuotaConnectionInfo, "accessToken" | "workspaceId">
): void {
  registeredConnections.set(connectionId, { connectionId, ...info });
}

export function registerCodexQuotaFetcher(): void {
  if (quotaFetcherRegistered) return;
  quotaFetcherRegistered = true;
}

export async function fetchCodexQuota(connectionId: string): Promise<CodexQuotaInfo | null> {
  const entry = registeredConnections.get(connectionId);
  if (!entry) return null;
  return { percentUsed: 0, utilization: 0, remaining: 100 };
}
