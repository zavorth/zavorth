export interface ZavorthControlProviderCockpitSnapshot {
  status: string;
}

export interface ZavorthControlIntelligenceFabricHealthSnapshot {
  status: string;
  recommendation: string;
  p95LatencyMs: number | null;
  rollbackInstruction: string;
  demoteAvailable: boolean;
  raw?: Record<string, unknown> | null;
}

export interface ZavorthControlRunObservatorySnapshot {
  diffPreviews?: Array<Record<string, unknown>>;
  intelligenceFabricHealth?: Record<string, unknown> | null;
  zavorthControlIntelligenceFabricHealth?: ZavorthControlIntelligenceFabricHealthSnapshot | null;
  [key: string]: unknown;
}
