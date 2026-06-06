export interface ZavorthControlProviderCockpitSnapshot {
  status: string;
}

export interface ZavorthControlIntelligenceFabricHealthSnapshot {
  status: string;
  recommendation: string;
  p95LatencyMs: number | null;
  rollbackInstruction: string;
  demoteAvailable: boolean;
  raw?: Record<string, unknown>;
}

export interface ZavorthControlRunObservatorySnapshot {
  generatedAt?: string;
  query?: Record<string, unknown>;
  totalRuns?: number;
  matchedRuns?: number;
  indexes?: Record<string, unknown>;
  runs?: Array<Record<string, unknown>>;
  diffPreviews?: Array<Record<string, unknown>>;
  intelligenceFabricHealth?: Record<string, unknown>;
  zavorthControlIntelligenceFabricHealth?: ZavorthControlIntelligenceFabricHealthSnapshot;
  extensions?: Record<string, unknown>;
}
