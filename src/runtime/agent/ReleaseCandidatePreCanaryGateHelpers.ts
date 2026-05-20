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
    return 'Fechar Release Adoption Readiness como release-adoption-ready antes do gate RC/pre-canary.';
  }
  if (status === 'needs-evidence-pack') {
    return 'Montar evidence pack com checks, artifacts, release notes, changelog, rollback e known issues.';
  }
  if (status === 'needs-ecosystem-publishing') {
    return 'Publicar matriz, docs e fixtures do ecossistema sem claim formal indevido.';
  }
  if (status === 'needs-autopilot-readiness') {
    return 'Fechar Capability Autopilot release candidate com kill switch, rollback rehearsal e default-off governance.';
  }
  if (status === 'needs-go-no-go') {
    return 'Registrar go/no-go explicito com aprovador, receipt, rollback owner e incident owner.';
  }
  if (status === 'blocked') {
    return 'Remover no-go, bloqueios de RC ou qualquer global rollout/auto-promote antes de continuar.';
  }
  return 'Pre-canary gate pronto; planejar canary real em entrega separada sem acionar rollout automaticamente.';
}
