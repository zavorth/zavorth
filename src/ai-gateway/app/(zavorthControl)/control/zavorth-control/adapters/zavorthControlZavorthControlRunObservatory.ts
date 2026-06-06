import type {
  ZavorthControlIntelligenceFabricHealthSnapshot,
  ZavorthControlRunObservatorySnapshot,
} from '../contracts/zavorthControlZavorthControlObservabilityContracts';

type AnyRecord = Record<string, any>;

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
    return {};
  }

  const diffPreviews = Array.isArray(snapshot.diffPreviews) ? snapshot.diffPreviews : [];
  const intelligenceFabricHealth = mapFabricHealth(snapshot.intelligenceFabricHealth);
  return {
    ...snapshot,
    diffPreviews,
    intelligenceFabricHealth: snapshot.intelligenceFabricHealth || null,
    zavorthControlIntelligenceFabricHealth: intelligenceFabricHealth,
  };
}
