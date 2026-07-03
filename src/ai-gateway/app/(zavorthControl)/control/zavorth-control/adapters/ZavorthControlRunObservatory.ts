import type {
  ZavorthControlRunObservatorySnapshot,
} from '../contracts';

type AnyRecord = Record<string, any>;

type ZavorthControlIntelligenceFabricHealthSnapshot = {
  status: string;
  recommendation: string;
  p95LatencyMs: number | null;
  rollbackInstruction: string;
  demoteAvailable: boolean;
  raw: AnyRecord;
};

function record(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {};
}

function text(value: unknown, fallback = ''): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapFabricHealth(value: unknown): ZavorthControlIntelligenceFabricHealthSnapshot | null {
  const snapshot = record(value);
  if (!Object.keys(snapshot).length) {
    return null;
  }

  const summary = record(snapshot.summary);
  const rollback = record(snapshot.rollback);
  return {
    status: text(snapshot.status, 'unknown'),
    recommendation: text(snapshot.recommendation, 'observe'),
    p95LatencyMs: numberOrNull(summary.p95LatencyMs),
    rollbackInstruction: text(
      rollback.instruction,
      'Set intelligenceFabricMode=disabled at runtime or request metadata.',
    ),
    demoteAvailable: rollback.available !== false && rollback.destructive !== true,
    raw: snapshot,
  };
}

export function mapZavorthControlRunObservatory(value: unknown): ZavorthControlRunObservatorySnapshot {
  const snapshot = record(value);
  if (!Object.keys(snapshot).length) {
    return {
      generatedAt: new Date(0).toISOString(),
      query: {},
      totalRuns: 0,
      matchedRuns: 0,
      indexes: {
        runIds: [],
        traceIds: [],
        sessionIds: [],
        statuses: [],
      },
      runs: [],
      diffPreviews: [],
      intelligenceFabricHealth: {},
      extensions: {},
    };
  }

  const {
    generatedAt,
    query,
    totalRuns,
    matchedRuns,
    indexes,
    runs,
    diffPreviews: _diffPreviews,
    intelligenceFabricHealth: _intelligenceFabricHealth,
    ...extensions
  } = snapshot;
  const diffPreviews = Array.isArray(_diffPreviews) ? _diffPreviews : [];
  const normalizedRuns = Array.isArray(runs)
    ? runs.filter((entry) => entry && typeof entry === 'object')
    : [];
  const intelligenceFabricHealth = mapFabricHealth(_intelligenceFabricHealth);
  return {
    generatedAt: text(generatedAt, new Date(0).toISOString()),
    query: record(query),
    totalRuns: numberOrNull(totalRuns) ?? 0,
    matchedRuns: numberOrNull(matchedRuns) ?? normalizedRuns.length,
    indexes: record(indexes),
    runs: normalizedRuns,
    diffPreviews,
    intelligenceFabricHealth: record(_intelligenceFabricHealth),
    zavorthControlIntelligenceFabricHealth: intelligenceFabricHealth || undefined,
    extensions,
  };
}
