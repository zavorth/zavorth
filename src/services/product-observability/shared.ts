import type { WeightedCount } from './types.js';

export function normalizeOptionalString(value: unknown): string | null {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || null;
}

export function toRecord(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, any>;
}

export function formatDurationMs(value: number): string {
  const totalMs = Math.max(0, Math.round(Number(value || 0)));
  if (!totalMs) {
    return '0s';
  }
  const totalMinutes = Math.round(totalMs / 60000);
  if (totalMinutes < 1) {
    return `${Math.max(1, Math.round(totalMs / 1000))}s`;
  }
  if (totalMinutes < 60) {
    return `${totalMinutes}min`;
  }
  const hours = totalMinutes / 60;
  if (hours < 24) {
    return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
  }
  const days = hours / 24;
  return `${days.toFixed(days >= 10 ? 0 : 1)}d`;
}

export function isSince(value: string | null | undefined, since: number): boolean {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) && timestamp >= since;
}

export function bumpWeightedCount(map: Map<string, WeightedCount>, label: string, lastSeenAt: string): void {
  const key = String(label || 'unknown').trim().toLowerCase() || 'unknown';
  const existing = map.get(key) || { label: key, count: 0, last_seen_at: lastSeenAt };
  existing.count += 1;
  if (lastSeenAt > existing.last_seen_at) {
    existing.last_seen_at = lastSeenAt;
  }
  map.set(key, existing);
}

export function sortWeightedCounts(map: Map<string, WeightedCount>): WeightedCount[] {
  return Array.from(map.values()).sort((left, right) =>
    right.count - left.count || right.last_seen_at.localeCompare(left.last_seen_at),
  );
}

export function computeWeightedAverage(
  entries: Array<Record<string, any>>,
  field: 'average_approval_wait_ms' | 'average_post_approval_recovery_ms' | 'average_artifact_delivery_after_approval_ms',
): number {
  let weightedTotal = 0;
  let weight = 0;
  for (const entry of entries) {
    const value = Number(entry[field] || 0);
    const currentWeight = Math.max(1, Number(entry.total || 0));
    if (value <= 0) {
      continue;
    }
    weightedTotal += value * currentWeight;
    weight += currentWeight;
  }
  if (weight === 0) {
    return 0;
  }
  return Math.round(weightedTotal / weight);
}
