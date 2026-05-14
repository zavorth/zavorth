import type {
  SessionCleanupReceipt,
  SessionGarbageCollectorPolicy,
  SessionOwnerKind,
  SessionOwnershipRecord,
} from './SessionOwnershipContract.js';
import { SessionRegistryService } from './SessionRegistryService.js';

type SessionGarbageCollectorOptions = {
  registry: SessionRegistryService;
  now?: () => Date;
  policy?: Partial<SessionGarbageCollectorPolicy>;
  terminateSession?: (record: SessionOwnershipRecord) => void | Promise<void>;
};

export type SessionGarbageCollectorSweepInput = {
  now?: Date | string | null;
  activeOwnerRefs?: Iterable<string> | null;
  dryRun?: boolean;
};

export type SessionGarbageCollectorSweepResult = {
  checked: number;
  kept: SessionOwnershipRecord[];
  orphaned: SessionOwnershipRecord[];
  reaped: SessionOwnershipRecord[];
  receipts: SessionCleanupReceipt[];
};

const DEFAULT_PROTECTED_KINDS: SessionOwnerKind[] = ['live_terminal', 'standalone'];

export class SessionGarbageCollector {
  private readonly registry: SessionRegistryService;
  private readonly now: () => Date;
  private readonly policy: SessionGarbageCollectorPolicy;
  private readonly terminateSession: (record: SessionOwnershipRecord) => void | Promise<void>;

  constructor(options: SessionGarbageCollectorOptions) {
    this.registry = options.registry;
    this.now = options.now || (() => new Date());
    this.policy = {
      orphanAfterMs: Math.max(0, options.policy?.orphanAfterMs ?? 5 * 60 * 1000),
      reapAfterMs: Math.max(0, options.policy?.reapAfterMs ?? 60 * 1000),
      protectedKinds: options.policy?.protectedKinds || DEFAULT_PROTECTED_KINDS,
    };
    this.terminateSession = options.terminateSession || (() => undefined);
  }

  public async sweep(input: SessionGarbageCollectorSweepInput = {}): Promise<SessionGarbageCollectorSweepResult> {
    const nowIso = this.resolveNow(input.now);
    const activeOwnerRefs = input.activeOwnerRefs
      ? new Set(Array.from(input.activeOwnerRefs).map((entry) => String(entry || '').trim()).filter(Boolean))
      : null;
    const result: SessionGarbageCollectorSweepResult = {
      checked: 0,
      kept: [],
      orphaned: [],
      reaped: [],
      receipts: [],
    };

    for (const record of this.registry.listSessions()) {
      result.checked += 1;
      if (record.status === 'reaped' || record.status === 'released') {
        result.kept.push(record);
        continue;
      }

      if (record.status === 'orphaned') {
        await this.reapIfAllowed(record, nowIso, input.dryRun === true, result);
        continue;
      }

      const orphanReason = this.resolveOrphanReason(record, nowIso, activeOwnerRefs);
      if (!orphanReason) {
        result.kept.push(record);
        continue;
      }

      if (input.dryRun === true) {
        result.orphaned.push(record);
        result.receipts.push(this.registry.buildReceipt('marked_orphan', record, orphanReason, nowIso, { dryRun: true }));
        continue;
      }

      const orphaned = this.registry.markOrphan(record.sessionId, orphanReason, nowIso);
      if (orphaned) {
        result.orphaned.push(orphaned);
        result.receipts.push(this.registry.buildReceipt('marked_orphan', orphaned, orphanReason, nowIso));
      }
    }

    return result;
  }

  private async reapIfAllowed(
    record: SessionOwnershipRecord,
    nowIso: string,
    dryRun: boolean,
    result: SessionGarbageCollectorSweepResult,
  ): Promise<void> {
    if (this.isProtected(record)) {
      result.kept.push(record);
      return;
    }
    const orphanedAt = record.orphanedAt || record.updatedAt;
    if (ageMs(nowIso, orphanedAt) < this.policy.reapAfterMs) {
      result.kept.push(record);
      return;
    }
    if (dryRun) {
      result.reaped.push(record);
      result.receipts.push(this.registry.buildReceipt('reaped', record, 'orphan_reap_policy', nowIso, { dryRun: true }));
      return;
    }

    await this.terminateSession(record);
    const reaped = this.registry.markReaped(record.sessionId, 'orphan_reap_policy', nowIso);
    if (reaped) {
      result.reaped.push(reaped);
      result.receipts.push(this.registry.buildReceipt('reaped', reaped, 'orphan_reap_policy', nowIso));
    }
  }

  private resolveOrphanReason(
    record: SessionOwnershipRecord,
    nowIso: string,
    activeOwnerRefs: Set<string> | null,
  ): string | null {
    if (this.isProtected(record)) {
      return null;
    }
    if (activeOwnerRefs) {
      return activeOwnerRefs.has(record.ownerRef) ? null : 'owner_not_active';
    }
    if (ageMs(nowIso, record.lastSeenAt) >= this.policy.orphanAfterMs) {
      return 'owner_stale';
    }
    return null;
  }

  private isProtected(record: SessionOwnershipRecord): boolean {
    return this.policy.protectedKinds.includes(record.kind);
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

function ageMs(nowIso: string, thenIso: string): number {
  const now = new Date(nowIso).getTime();
  const then = new Date(thenIso).getTime();
  if (Number.isNaN(now) || Number.isNaN(then)) {
    return 0;
  }
  return Math.max(0, now - then);
}

function toValidDate(input: Date, fallback: Date): Date {
  return Number.isNaN(input.getTime()) ? fallback : input;
}
