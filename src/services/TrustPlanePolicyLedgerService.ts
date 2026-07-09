import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import type {
ZavorthApprovalScope,
  ZavorthMutationRiskLevel,
} from '../contracts/ZavorthMutationPlaneContract.js';

export type TrustPlanePolicyDomain =
  | 'mcp'
  | 'skills'
  | 'plugins'
  | 'nodes'
  | 'runtime'
  | 'watch'
  | 'automation'
  | 'hardware'
  | 'autonomous-partner'
  | 'selfmod'
  | 'capabilities';

export type TrustPlanePolicyLedgerStatus =
  | 'previewed'
  | 'applied'
  | 'blocked'
  | 'rolled_back'
  | 'noop';

export type TrustPlanePolicyDiffEntry = {
  path: string;
  before: unknown;
  after: unknown;
  summary: string;
  riskLevel: ZavorthMutationRiskLevel;
  reversible: boolean;
};

export type TrustPlanePolicyRollbackPayload = {
  domain: 'mcp' | 'skills';
  beforePolicy: unknown;
  afterPolicy: unknown;
};

export type TrustPlanePolicyLedgerEntry = {
  id: string;
  at: string;
  domain: TrustPlanePolicyDomain;
  actionId: string;
  requestedBy: string | null;
  sourceSurface: string | null;
  status: TrustPlanePolicyLedgerStatus;
  riskLevel: ZavorthMutationRiskLevel;
  approvalScope: ZavorthApprovalScope;
  planId: string | null;
  permissionId: string | null;
  summary: string;
  diff: TrustPlanePolicyDiffEntry[];
  rollback: {
    available: boolean;
    reason: string;
    payload?: TrustPlanePolicyRollbackPayload | null;
  };
  result: string | null;
};

export type TrustPlanePolicyLedgerSummary = {
  total: number;
  lastMutationAt: string | null;
  rollbackableEntries: number;
  byStatus: Record<TrustPlanePolicyLedgerStatus, number>;
  byDomain: Partial<Record<TrustPlanePolicyDomain, number>>;
  recent: TrustPlanePolicyLedgerEntry[];
};

type TrustPlanePolicyLedgerRuntime = {
  ledgerFile?: string;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  appendFileSync?: typeof fs.appendFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

type AppendTrustPlanePolicyLedgerEntryInput = Omit<TrustPlanePolicyLedgerEntry, 'id' | 'at'> & {
  id?: string | null;
  at?: string | null;
};

const LEDGER_STATUSES: TrustPlanePolicyLedgerStatus[] = [
  'previewed',
  'applied',
  'blocked',
  'rolled_back',
  'noop',
];

export class TrustPlanePolicyLedgerService {
  private readonly ledgerFile: string;
  private readonly now: () => Date;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly appendFileSyncImpl: typeof fs.appendFileSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;

  constructor(runtime: TrustPlanePolicyLedgerRuntime = {}) {
    this.ledgerFile = runtime.ledgerFile || path.resolve(config.projectRoot, 'data', 'runtime', 'trust-plane-ledger.jsonl');
    this.now = runtime.now || (() => new Date());
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.appendFileSyncImpl = runtime.appendFileSync || fs.appendFileSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public append(input: AppendTrustPlanePolicyLedgerEntryInput): TrustPlanePolicyLedgerEntry {
    const entry: TrustPlanePolicyLedgerEntry = {
      id: this.cleanText(input.id, this.buildId(input)),
      at: this.cleanText(input.at, this.now().toISOString()),
      domain: this.normalizeDomain(input.domain),
      actionId: this.cleanText(input.actionId, 'trust-policy.mutate'),
      requestedBy: this.nullableText(input.requestedBy),
      sourceSurface: this.nullableText(input.sourceSurface),
      status: this.normalizeStatus(input.status),
      riskLevel: this.normalizeRiskLevel(input.riskLevel),
      approvalScope: this.normalizeApprovalScope(input.approvalScope),
      planId: this.nullableText(input.planId),
      permissionId: this.nullableText(input.permissionId),
      summary: this.cleanText(input.summary, 'Trust Plane policy mutation.'),
      diff: Array.isArray(input.diff) ? input.diff.map((entry) => this.normalizeDiff(entry)) : [],
      rollback: {
        available: input.rollback?.available === true,
        reason: this.cleanText(input.rollback?.reason, input.rollback?.available ? 'Rollback disponivel.' : 'Rollback indisponivel.'),
        payload: input.rollback?.payload || null,
      },
      result: this.nullableText(input.result),
    };
    this.mkdirSyncImpl(path.dirname(this.ledgerFile), { recursive: true });
    this.appendFileSyncImpl(this.ledgerFile, `${JSON.stringify(entry)}\n`, 'utf8');
    return entry;
  }

  public list(options: { limit?: number } = {}): TrustPlanePolicyLedgerEntry[] {
    const limit = Math.max(1, Math.min(options.limit || 50, 500));
    if (!this.existsSyncImpl(this.ledgerFile)) {
      return [];
    }
    const entries = String(this.readFileSyncImpl(this.ledgerFile, 'utf8') || '')
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => this.parseLine(line))
      .filter((entry): entry is TrustPlanePolicyLedgerEntry => Boolean(entry))
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return entries.slice(0, limit);
  }

  public summarize(limit = 8): TrustPlanePolicyLedgerSummary {
    const entries = this.list({ limit: 500 });
    const byStatus = LEDGER_STATUSES.reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {} as Record<TrustPlanePolicyLedgerStatus, number>);
    const byDomain: Partial<Record<TrustPlanePolicyDomain, number>> = {};
    for (const entry of entries) {
      byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;
      byDomain[entry.domain] = (byDomain[entry.domain] || 0) + 1;
    }
    return {
      total: entries.length,
      lastMutationAt: entries[0]?.at || null,
      rollbackableEntries: entries.filter((entry) => entry.rollback.available).length,
      byStatus,
      byDomain,
      recent: entries.slice(0, Math.max(1, Math.min(limit, 50))),
    };
  }

  private parseLine(line: string): TrustPlanePolicyLedgerEntry | null {
    try {
      const raw = JSON.parse(line) as Partial<TrustPlanePolicyLedgerEntry>;
      return {
        id: this.cleanText(raw.id, this.buildId(raw as AppendTrustPlanePolicyLedgerEntryInput)),
        at: this.cleanText(raw.at, this.now().toISOString()),
        domain: this.normalizeDomain(raw.domain),
        actionId: this.cleanText(raw.actionId, 'trust-policy.mutate'),
        requestedBy: this.nullableText(raw.requestedBy),
        sourceSurface: this.nullableText(raw.sourceSurface),
        status: this.normalizeStatus(raw.status),
        riskLevel: this.normalizeRiskLevel(raw.riskLevel),
        approvalScope: this.normalizeApprovalScope(raw.approvalScope),
        planId: this.nullableText(raw.planId),
        permissionId: this.nullableText(raw.permissionId),
        summary: this.cleanText(raw.summary, 'Trust Plane policy mutation.'),
        diff: Array.isArray(raw.diff) ? raw.diff.map((entry) => this.normalizeDiff(entry)) : [],
        rollback: {
          available: raw.rollback?.available === true,
          reason: this.cleanText(raw.rollback?.reason, raw.rollback?.available ? 'Rollback disponivel.' : 'Rollback indisponivel.'),
          payload: raw.rollback?.payload || null,
        },
        result: this.nullableText(raw.result),
      };
    } catch (error: any) { logger.warn('[Trust Plane  Ledger] load operation failed', error); return null; }
  }

  private normalizeDiff(entry: TrustPlanePolicyDiffEntry): TrustPlanePolicyDiffEntry {
    return {
      path: this.cleanText(entry?.path, 'policy'),
      before: entry?.before ?? null,
      after: entry?.after ?? null,
      summary: this.cleanText(entry?.summary, 'Policy diff.'),
      riskLevel: this.normalizeRiskLevel(entry?.riskLevel),
      reversible: entry?.reversible !== false,
    };
  }

  private buildId(input: Partial<AppendTrustPlanePolicyLedgerEntryInput>): string {
    const seed = [
      this.now().toISOString(),
      input.domain,
      input.actionId,
      input.planId,
      input.status,
      Math.random().toString(36).slice(2),
    ].join(':');
    return `trust-ledger-${crypto.createHash('sha1').update(seed).digest('hex').slice(0, 12)}`;
  }

  private normalizeDomain(value: unknown): TrustPlanePolicyDomain {
    const normalized = String(value || '').trim().toLowerCase();
    if (
      normalized === 'mcp'
      || normalized === 'skills'
      || normalized === 'plugins'
      || normalized === 'nodes'
      || normalized === 'runtime'
      || normalized === 'watch'
      || normalized === 'automation'
      || normalized === 'hardware'
      || normalized === 'autonomous-partner'
      || normalized === 'selfmod'
      || normalized === 'capabilities'
    ) {
      return normalized;
    }
    return 'runtime';
  }

  private normalizeStatus(value: unknown): TrustPlanePolicyLedgerStatus {
    const normalized = String(value || '').trim().toLowerCase();
    return LEDGER_STATUSES.includes(normalized as TrustPlanePolicyLedgerStatus)
      ? normalized as TrustPlanePolicyLedgerStatus
      : 'previewed';
  }

  private normalizeRiskLevel(value: unknown): ZavorthMutationRiskLevel {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'low' || normalized === 'medium' || normalized === 'high' || normalized === 'critical') {
      return normalized;
    }
    return 'medium';
  }

  private normalizeApprovalScope(value: unknown): ZavorthApprovalScope {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'session' || normalized === 'host') {
      return normalized;
    }
    return 'once';
  }

  private cleanText(value: unknown, fallback = ''): string {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  }

  private nullableText(value: unknown): string | null {
    const normalized = this.cleanText(value);
    return normalized || null;
  }
}
