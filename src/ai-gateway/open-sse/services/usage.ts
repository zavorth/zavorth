export interface UsageRecord {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: number;
}

export interface ProviderUsageResult {
  quotas?: Record<string, unknown>;
  plan?: unknown;
  message?: string;
}

export interface ProviderConnectionLike {
  provider: string;
  authType?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  providerSpecificData?: Record<string, unknown>;
}

const usageRecords: UsageRecord[] = [];

export function recordUsage(record: UsageRecord): void {
  usageRecords.push(record);
  if (usageRecords.length > 10_000) {
    usageRecords.splice(0, usageRecords.length - 10_000);
  }
}

export function getUsageRecordsForProvider(provider: string): UsageRecord[] {
  return usageRecords.filter((r) => r.provider === provider);
}

export function getTotalUsage(): { totalTokens: number; totalCost: number } {
  return usageRecords.reduce(
    (acc, r) => ({ totalTokens: acc.totalTokens + r.totalTokens, totalCost: acc.totalCost + r.cost }),
    { totalTokens: 0, totalCost: 0 }
  );
}

export async function getUsageForProvider(
  connection: ProviderConnectionLike
): Promise<ProviderUsageResult> {
  if (!connection) return {};
  const providerSpecificData =
    connection.providerSpecificData && typeof connection.providerSpecificData === "object"
      ? connection.providerSpecificData
      : {};
  const quotas = (providerSpecificData as { quotas?: unknown }).quotas;
  if (quotas && typeof quotas === "object" && !Array.isArray(quotas)) {
    return {
      quotas: quotas as Record<string, unknown>,
      plan: (providerSpecificData as { plan?: unknown }).plan,
      message: typeof (providerSpecificData as { message?: unknown }).message === "string"
        ? (providerSpecificData as { message?: string }).message
        : null,
    };
  }
  return {};
}
