export interface ProviderShare {
  provider: string;
  requestCount: number;
  share: number;
}

export interface DiversityReport {
  totalRequests: number;
  uniqueProviders: number;
  providerShare: ProviderShare[];
  diversityScore: number;
  lastUpdatedAt: string | null;
}

const providerCounts = new Map<string, number>();
let lastUpdatedAt: string | null = null;

export function recordProviderRequest(provider: string): void {
  providerCounts.set(provider, (providerCounts.get(provider) ?? 0) + 1);
  lastUpdatedAt = new Date().toISOString();
}

export function resetDiversityReport(): void {
  providerCounts.clear();
  lastUpdatedAt = null;
}

export function getDiversityReport(): DiversityReport {
  const totalRequests = Array.from(providerCounts.values()).reduce((acc, count) => acc + count, 0);
  const uniqueProviders = providerCounts.size;

  const providerShare: ProviderShare[] = Array.from(providerCounts.entries())
    .map(([provider, requestCount]) => ({
      provider,
      requestCount,
      share: totalRequests > 0 ? requestCount / totalRequests : 0,
    }))
    .sort((a, b) => b.requestCount - a.requestCount);

  const diversityScore =
    totalRequests === 0 ? 0 : uniqueProviders > 0 ? Math.min(1, uniqueProviders / totalRequests) : 0;

  return {
    totalRequests,
    uniqueProviders,
    providerShare,
    diversityScore,
    lastUpdatedAt,
  };
}
