import type {
  ReleaseCandidatePreCanaryGateStatus,
  ReleaseCandidatePreCanaryGateStatusLevel,
} from './ReleaseCandidatePreCanaryGateService.js';

export type LooseRecord = Record<string, unknown>;

export function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function recordOrNull(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LooseRecord
    : null;
}

export function arrayOrEmpty<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function booleanFromRecord(record: LooseRecord | null, key: string): boolean {
  return record?.[key] === true;
}

export function statusLevel(ready: boolean, linked = true, blocked = false): ReleaseCandidatePreCanaryGateStatusLevel {
  if (blocked) {
    return 'blocked';
  }
  if (ready) {
    return 'ready';
  }
  return linked ? 'needs-action' : 'unknown';
}

export function resolveReleaseCandidateNextSafeAction(status: ReleaseCandidatePreCanaryGateStatus): string {
  if (status === 'needs-release-adoption-readiness') {
    return 'Close Release Adoption Readiness as release-adoption-ready before the RC/pre-canary gate.';
  }
  if (status === 'needs-evidence-pack') {
    return 'Build evidence pack with checks, artifacts, release notes, changelog, rollback, and known issues.';
  }
  if (status === 'needs-ecosystem-publishing') {
    return 'Publish ecosystem matrix, docs, and fixtures without improper formal claims.';
  }
  if (status === 'needs-autopilot-readiness') {
    return 'Close Capability Autopilot release candidate with kill switch, rollback rehearsal, and default-off governance.';
  }
  if (status === 'needs-go-no-go') {
    return 'Record explicit go/no-go with approver, receipt, rollback owner, and incident owner.';
  }
  if (status === 'blocked') {
    return 'Remove no-go items, RC blockers, or any global rollout/auto-promote before continuing.';
  }
  return 'Pre-canary gate ready; plan the real canary in a separate delivery without automatically triggering rollout.';
}
