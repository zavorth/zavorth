import type {
  RegisterSessionOwnershipInput,
  SessionCleanupReceipt,
  SessionOwnershipEventKind,
  SessionOwnershipRecord,
} from './SessionOwnershipContract.js';

type SessionRegistryServiceOptions = {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
};

export class SessionRegistryService {
  private readonly ownership = new Map<string, SessionOwnershipRecord>();
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;

  constructor(options: SessionRegistryServiceOptions = {}) {
    this.now = options.now || (() => new Date());
    this.idFactory = options.idFactory || ((prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  }

  public registerSession(input: RegisterSessionOwnershipInput): SessionOwnershipRecord {
    const sessionId = normalizeText(input.sessionId);
    if (!sessionId) {
      throw new Error('sessionId obrigatorio para registrar ownership de sessao.');
    }

    const now = this.resolveNow(input.now);
    const existing = this.ownership.get(sessionId);
    const record: SessionOwnershipRecord = {
      ownershipId: existing?.ownershipId || this.idFactory('session-owner'),
      sessionId,
      ownerRef: normalizeText(input.ownerRef, this.resolveOwnerRef(input, sessionId)),
      kind: input.kind,
      surface: normalizeText(input.surface, 'session-v2'),
      status: 'active',
      runId: normalizeNullable(input.runId),
      taskId: normalizeNullable(input.taskId),
      swarmId: normalizeNullable(input.swarmId),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      lastSeenAt: now,
      orphanedAt: null,
      releasedAt: null,
      reapedAt: null,
      orphanReason: null,
      metadata: sanitizeMetadata({
        ...existing?.metadata,
        ...input.metadata,
      }),
    };

    this.ownership.set(sessionId, record);
    return cloneRecord(record);
  }

  public touchSession(sessionId: string, now?: Date | string | null): SessionOwnershipRecord | null {
    const record = this.ownership.get(normalizeText(sessionId));
    if (!record) {
      return null;
    }
    const touchedAt = this.resolveNow(now);
    record.lastSeenAt = touchedAt;
    record.updatedAt = touchedAt;
    return cloneRecord(record);
  }

  public releaseSession(sessionId: string, reason = 'owner_released', now?: Date | string | null): SessionOwnershipRecord | null {
    const record = this.ownership.get(normalizeText(sessionId));
    if (!record || record.status === 'reaped') {
      return record ? cloneRecord(record) : null;
    }
    const releasedAt = this.resolveNow(now);
    record.status = 'released';
    record.updatedAt = releasedAt;
    record.releasedAt = releasedAt;
    record.orphanReason = reason;
    return cloneRecord(record);
  }

  public markOrphan(sessionId: string, reason: string, now?: Date | string | null): SessionOwnershipRecord | null {
    const record = this.ownership.get(normalizeText(sessionId));
    if (!record || record.status === 'reaped' || record.status === 'released') {
      return record ? cloneRecord(record) : null;
    }
    const orphanedAt = this.resolveNow(now);
    record.status = 'orphaned';
    record.updatedAt = orphanedAt;
    record.orphanedAt = record.orphanedAt || orphanedAt;
    record.orphanReason = normalizeText(reason, 'orphaned');
    return cloneRecord(record);
  }

  public markReaped(sessionId: string, reason: string, now?: Date | string | null): SessionOwnershipRecord | null {
    const record = this.ownership.get(normalizeText(sessionId));
    if (!record) {
      return null;
    }
    const reapedAt = this.resolveNow(now);
    record.status = 'reaped';
    record.updatedAt = reapedAt;
    record.reapedAt = reapedAt;
    record.orphanReason = normalizeText(reason, record.orphanReason || 'reaped');
    return cloneRecord(record);
  }

  public getSession(sessionId: string): SessionOwnershipRecord | null {
    const record = this.ownership.get(normalizeText(sessionId));
    return record ? cloneRecord(record) : null;
  }

  public listSessions(): SessionOwnershipRecord[] {
    return Array.from(this.ownership.values())
      .sort((a, b) => a.sessionId.localeCompare(b.sessionId))
      .map(cloneRecord);
  }

  public buildReceipt(
    action: SessionOwnershipEventKind,
    record: SessionOwnershipRecord,
    reason: string,
    now?: Date | string | null,
    metadata: Record<string, unknown> = {},
  ): SessionCleanupReceipt {
    return {
      receiptId: this.idFactory('session-receipt'),
      action,
      sessionId: record.sessionId,
      ownershipId: record.ownershipId,
      ownerRef: record.ownerRef,
      status: record.status,
      reason: normalizeText(reason, action),
      createdAt: this.resolveNow(now),
      metadata: sanitizeMetadata(metadata),
    };
  }

  private resolveOwnerRef(input: RegisterSessionOwnershipInput, sessionId: string): string {
    const runId = normalizeNullable(input.runId);
    if (runId) {
      return `run:${runId}`;
    }
    const swarmId = normalizeNullable(input.swarmId);
    const taskId = normalizeNullable(input.taskId);
    if (swarmId && taskId) {
      return `swarm:${swarmId}:${taskId}`;
    }
    if (taskId) {
      return `task:${taskId}`;
    }
    return `${input.kind}:${sessionId}`;
  }

  private resolveNow(input?: Date | string | null): string {
    if (input instanceof Date) {
      return toValidDate(input, this.now()).toISOString();
    }
    if (typeof input === 'string' && input.trim()) {
      return toValidDate(new Date(input), this.now()).toISOString();
    }
    return this.now().toISOString();
  }
}

function normalizeText(value: unknown, fallback = ''): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function normalizeNullable(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized || null;
}

function toValidDate(input: Date, fallback: Date): Date {
  return Number.isNaN(input.getTime()) ? fallback : input;
}

function sanitizeMetadata(input: Record<string, unknown>): Record<string, unknown> {
  try {
    const parsed = JSON.parse(JSON.stringify(input || {}));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function cloneRecord(record: SessionOwnershipRecord): SessionOwnershipRecord {
  return {
    ...record,
    metadata: sanitizeMetadata(record.metadata),
  };
}
