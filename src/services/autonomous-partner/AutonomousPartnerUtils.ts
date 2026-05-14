import crypto from 'crypto';
import type { ZavorthMutationRiskLevel } from '../../contracts/ZavorthMutationPlaneContract.js';
import type {
  AutonomousMissionCheckpointStatus,
  AutonomousMissionEvidence,
  AutonomousMissionEvidenceKind,
  AutonomousMissionStatus,
  ZavorthAutonomyBudget,
  ZavorthAutonomyLevel,
} from '../../contracts/AutonomousEngineeringPartnerContract.js';

export const AUTONOMY_LEVELS: ZavorthAutonomyLevel[] = [
  'assist',
  'draft',
  'supervised',
  'delegated',
  'autonomous-with-budget',
];

export function normalizeAutonomyLevel(value: unknown): ZavorthAutonomyLevel {
  const normalized = String(value || '').trim().toLowerCase();
  return AUTONOMY_LEVELS.includes(normalized as ZavorthAutonomyLevel)
    ? normalized as ZavorthAutonomyLevel
    : 'supervised';
}

export function normalizeMissionStatus(value: unknown): AutonomousMissionStatus {
  const normalized = String(value || '').trim().toLowerCase();
  if (
    normalized === 'planned'
    || normalized === 'waiting_approval'
    || normalized === 'running'
    || normalized === 'paused'
    || normalized === 'completed'
    || normalized === 'blocked'
    || normalized === 'failed'
  ) {
    return normalized;
  }
  return 'planned';
}

export function normalizeCheckpointStatus(value: unknown): AutonomousMissionCheckpointStatus {
  const normalized = String(value || '').trim().toLowerCase();
  if (
    normalized === 'pending'
    || normalized === 'passed'
    || normalized === 'warning'
    || normalized === 'blocked'
    || normalized === 'skipped'
    || normalized === 'completed'
  ) {
    return normalized;
  }
  return 'pending';
}

export function normalizeEvidenceKind(value: unknown): AutonomousMissionEvidenceKind {
  const normalized = String(value || '').trim().toLowerCase();
  if (
    normalized === 'test'
    || normalized === 'diff'
    || normalized === 'log'
    || normalized === 'artifact'
    || normalized === 'rollback'
    || normalized === 'eval'
    || normalized === 'sandbox'
    || normalized === 'approval'
    || normalized === 'checkpoint'
  ) {
    return normalized;
  }
  return 'log';
}

export function normalizeEvidenceStatus(value: unknown): AutonomousMissionEvidence['status'] {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'pending' || normalized === 'passed' || normalized === 'warning' || normalized === 'failed' || normalized === 'skipped') {
    return normalized;
  }
  return 'pending';
}

export function statusFromPosture(value: unknown): AutonomousMissionCheckpointStatus {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'healthy' || normalized === 'passed' || normalized === 'ready') {
    return 'passed';
  }
  if (normalized === 'critical' || normalized === 'failed' || normalized === 'blocked') {
    return 'blocked';
  }
  if (normalized === 'unavailable') {
    return 'warning';
  }
  return 'warning';
}

export function gateStatusToCheckpoint(value: unknown, canProceed: unknown): AutonomousMissionCheckpointStatus {
  if (canProceed === false) {
    return 'blocked';
  }
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'passed') {
    return 'passed';
  }
  if (normalized === 'blocked' || normalized === 'failed') {
    return 'blocked';
  }
  return 'warning';
}

export function normalizeBudgetScope(value: unknown, fallback: ZavorthAutonomyBudget['scope']): ZavorthAutonomyBudget['scope'] {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'run' || normalized === 'session' || normalized === 'automation' || normalized === 'host' || normalized === 'fleet') {
    return normalized;
  }
  return fallback;
}

export function normalizeRisk(value: unknown): ZavorthMutationRiskLevel {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high' || normalized === 'critical') {
    return normalized;
  }
  return 'medium';
}

export function riskRank(value: ZavorthMutationRiskLevel): number {
  return {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  }[value];
}

export function infersMutableMission(text: string): boolean {
  return /\b(fix|corrigir|patch|apply|aplicar|deploy|write|editar|instalar|install|publish|merge|hardware|automacao|automation)\b/u.test(text);
}

export function normalizeSuccessCriteria(value: unknown): string[] {
  const list = normalizeList(value);
  return list.length > 0 ? list : ['Plano aprovado pelo usuario.', 'Evidencias registradas.', 'Budget respeitado.'];
}

export function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => cleanText(entry, '')).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(/\r?\n|,/u).map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
}

export function positiveNumber(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(Math.floor(number), max));
}

export function nonNegative(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function normalizeId(value: unknown): string {
  return String(value || '').trim().replace(/[^A-Za-z0-9_.:-]+/g, '-').replace(/^-+|-+$/g, '');
}

export function buildMissionId(objective: string, now: () => Date): string {
  const hash = crypto.createHash('sha256')
    .update(`${now().toISOString()}:${objective}:${Math.random().toString(36)}`)
    .digest('hex')
    .slice(0, 10);
  return `mission-${hash}`;
}

export function buildEvidenceId(kind: unknown, now: () => Date): string {
  const hash = crypto.createHash('sha256')
    .update(`${now().toISOString()}:${kind}:${Math.random().toString(36)}`)
    .digest('hex')
    .slice(0, 10);
  return `mission-evidence-${hash}`;
}

export function buildAuditId(event: string, now: () => Date): string {
  const hash = crypto.createHash('sha256')
    .update(`${now().toISOString()}:${event}:${Math.random().toString(36)}`)
    .digest('hex')
    .slice(0, 10);
  return `mission-audit-${hash}`;
}

export function cleanText(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function nullableText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}
