import { randomUUID } from 'node:crypto';
import type { ExecutionTiming } from './ExecutionContract.js';

export const ZAVORTH_EXECUTION_ENTITY_KINDS = [
  'intent',
  'plan',
  'execution',
  'approval',
  'run',
  'session',
  'artifact',
  'replay',
] as const;

export type ZavorthExecutionEntityKind = (typeof ZAVORTH_EXECUTION_ENTITY_KINDS)[number];

export type ZavorthExecutionLifecycleStatus =
  | 'received'
  | 'planned'
  | 'approval_required'
  | 'approved'
  | 'blocked'
  | 'running'
  | 'completed'
  | 'failed'
  | 'noop'
  | 'linked'
  | 'replayed';

export type ZavorthExecutionCorrelation = {
  traceId: string;
  runId: string;
  sessionId: string | null;
  approvalId: string | null;
  artifactId: string | null;
};

export type CanonicalRunContext = {
  traceId: string;
  runId: string;
  sessionId: string | null;
  surface: string;
  requestedBy: string;
  profile: string | null;
};

export type ExecutionLifecycleRecord = {
  kind: ZavorthExecutionEntityKind;
  id: string;
  traceId: string;
  runId: string;
  sessionId: string | null;
  approvalId: string | null;
  artifactId: string | null;
  status: ZavorthExecutionLifecycleStatus;
  summary: string;
  source: string;
  surface: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  timing?: ExecutionTiming;
  metadata: Record<string, unknown>;
};

export function createExecutionCorrelation(
  input: Partial<ZavorthExecutionCorrelation> | null | undefined = {},
): ZavorthExecutionCorrelation {
  const traceId = normalizeId(input?.traceId) || randomUUID();
  const runId = normalizeId(input?.runId) || traceId;
  return {
    traceId,
    runId,
    sessionId: normalizeNullableId(input?.sessionId),
    approvalId: normalizeNullableId(input?.approvalId),
    artifactId: normalizeNullableId(input?.artifactId),
  };
}

export function buildCanonicalRunContext(input: {
  correlation: Partial<ZavorthExecutionCorrelation> | null | undefined;
  surface: string | null | undefined;
  requestedBy: string | null | undefined;
  profile?: string | null;
  sessionId?: string | null;
}): CanonicalRunContext {
  const correlation = createExecutionCorrelation({
    ...(input.correlation || {}),
    sessionId: input.correlation?.sessionId || input.sessionId || null,
  });
  return {
    traceId: correlation.traceId,
    runId: correlation.runId,
    sessionId: correlation.sessionId,
    surface: normalizeMessage(input.surface) || 'unknown',
    requestedBy: normalizeMessage(input.requestedBy) || 'anonymous',
    profile: normalizeNullableId(input.profile),
  };
}

export function buildExecutionLifecycleRecord(input: {
  kind: ZavorthExecutionEntityKind;
  status: ZavorthExecutionLifecycleStatus;
  correlation: Partial<ZavorthExecutionCorrelation> | null | undefined;
  id?: string | null;
  summary?: string | null;
  source?: string | null;
  surface?: string | null;
  parentId?: string | null;
  at?: Date | string | null;
  timing?: ExecutionTiming | null;
  metadata?: Record<string, unknown> | null;
}): ExecutionLifecycleRecord {
  const correlation = createExecutionCorrelation(input.correlation);
  const timestamp = normalizeTimestamp(input.at);
  const record: ExecutionLifecycleRecord = {
    kind: input.kind,
    id: normalizeId(input.id) || buildExecutionLifecycleId(input.kind, correlation),
    traceId: correlation.traceId,
    runId: correlation.runId,
    sessionId: correlation.sessionId,
    approvalId: correlation.approvalId,
    artifactId: correlation.artifactId,
    status: input.status,
    summary: normalizeMessage(input.summary),
    source: normalizeMessage(input.source) || 'execution',
    surface: normalizeNullableId(input.surface),
    parentId: normalizeNullableId(input.parentId),
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: {
      ...(input.metadata || {}),
    },
  };
  if (input.timing) {
    record.timing = input.timing;
  }
  return record;
}

export function buildExecutionLifecycleId(
  kind: ZavorthExecutionEntityKind,
  correlation: ZavorthExecutionCorrelation,
): string {
  switch (kind) {
    case 'run':
      return correlation.runId;
    case 'session':
      return correlation.sessionId || `session:${correlation.runId}`;
    case 'approval':
      return correlation.approvalId || `approval:${correlation.runId}`;
    case 'artifact':
      return correlation.artifactId || `artifact:${correlation.runId}`;
    default:
      return `${kind}:${correlation.runId}`;
  }
}

function normalizeTimestamp(value: Date | string | null | undefined): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = Date.parse(String(value || ''));
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function normalizeId(value: unknown): string {
  return String(value || '').trim();
}

function normalizeNullableId(value: unknown): string | null {
  const normalized = normalizeId(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeMessage(value: unknown): string {
  return String(value || '').trim();
}
