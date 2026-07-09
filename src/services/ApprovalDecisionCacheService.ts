import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { config } from '../config/index.js';
import type { PermissionRequest } from '../contracts/PermissionRequest.js';
import { logger } from '../logger.js';
import type {
ZavorthApprovalScope,
  ZavorthMutationDomain,
  ZavorthMutationRiskLevel,
} from '../contracts/ZavorthMutationPlaneContract.js';

export type ApprovalDecisionCacheInput = {
  domain: ZavorthMutationDomain;
  actionId: string;
  workspace?: string | null;
  requestedBy?: string | null;
  sourceSurface?: string | null;
  riskLevel?: ZavorthMutationRiskLevel | null;
  approvalScope?: ZavorthApprovalScope | null;
  payload?: Record<string, unknown> | null;
};

export type ApprovalDecisionCacheEntry = {
  id: string;
  signature: string;
  domain: ZavorthMutationDomain;
  actionId: string;
  workspace: string | null;
  scope: ZavorthApprovalScope;
  riskLevel: ZavorthMutationRiskLevel | null;
  createdAt: string;
  expiresAt: string;
  decidedBy: string | null;
  permissionId: string | null;
  reason: string;
  revokedAt: string | null;
};

type ApprovalDecisionCacheDocument = {
  schemaVersion: 1;
  entries: ApprovalDecisionCacheEntry[];
};

type ApprovalDecisionCacheRuntime = {
  filePath?: string;
  now?: () => Date;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
};

const DEFAULT_TTL_MS = 60 * 60 * 1000;
const MAX_TTL_MS = 24 * 60 * 60 * 1000;
const NEVER_CACHE_ACTION = /\b(delete|remove|rm|drop|reset|push|publish|deploy|secret|credential|token|payment|trade|shell|bash|powershell)\b/i;

export class ApprovalDecisionCacheService {
  private readonly filePath: string;
  private readonly now: () => Date;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;

  constructor(runtime: ApprovalDecisionCacheRuntime = {}) {
    this.filePath = runtime.filePath || path.join(config.projectRoot, '.zavorth', 'approval-cache.json');
    this.now = runtime.now || (() => new Date());
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public find(input: ApprovalDecisionCacheInput): ApprovalDecisionCacheEntry | null {
    const signature = this.signature(input);
    const nowMs = this.now().getTime();
    const entry = this.readDocument().entries.find((candidate) =>
      candidate.signature === signature
      && !candidate.revokedAt
      && Date.parse(candidate.expiresAt) > nowMs
    );
    return entry || null;
  }

  public remember(
    input: ApprovalDecisionCacheInput,
    permission: PermissionRequest | null,
    reason: string,
    ttlMs = DEFAULT_TTL_MS,
  ): ApprovalDecisionCacheEntry | null {
    if (!this.isCacheable(input)) {
      return null;
    }
    const now = this.now();
    const boundedTtl = Math.max(30_000, Math.min(ttlMs, MAX_TTL_MS));
    const signature = this.signature(input);
    const document = this.readDocument();
    const entry: ApprovalDecisionCacheEntry = {
      id: `approval-cache-${signature.slice(0, 16)}`,
      signature,
      domain: input.domain,
      actionId: normalize(input.actionId),
      workspace: normalize(input.workspace || config.projectRoot) || null,
      scope: input.approvalScope || 'session',
      riskLevel: input.riskLevel || null,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + boundedTtl).toISOString(),
      decidedBy: permission?.decided_by || input.requestedBy || null,
      permissionId: permission?.permission_id || null,
      reason,
      revokedAt: null,
    };
    const entries = document.entries.filter((candidate) => candidate.signature !== signature);
    entries.unshift(entry);
    this.writeDocument({ schemaVersion: 1, entries: entries.slice(0, 200) });
    return entry;
  }

  public revoke(signatureOrId: string): boolean {
    const token = normalize(signatureOrId);
    const document = this.readDocument();
    let changed = false;
    const entries = document.entries.map((entry) => {
      if ((entry.id === token || entry.signature === token) && !entry.revokedAt) {
        changed = true;
        return { ...entry, revokedAt: this.now().toISOString() };
      }
      return entry;
    });
    if (changed) {
      this.writeDocument({ schemaVersion: 1, entries });
    }
    return changed;
  }

  public list(): ApprovalDecisionCacheEntry[] {
    const nowMs = this.now().getTime();
    return this.readDocument().entries.filter((entry) => !entry.revokedAt && Date.parse(entry.expiresAt) > nowMs);
  }

  public signature(input: ApprovalDecisionCacheInput): string {
    const payload = redactAndSort(input.payload || {});
    const material = JSON.stringify({
      version: 1,
      domain: input.domain,
      actionId: normalize(input.actionId),
      workspace: normalize(input.workspace || config.projectRoot),
      scope: input.approvalScope || 'once',
      riskLevel: input.riskLevel || null,
      payload,
    });
    return createHash('sha256').update(material).digest('hex');
  }

  private isCacheable(input: ApprovalDecisionCacheInput): boolean {
    const action = `${input.domain}.${input.actionId}`;
    if (input.riskLevel === 'critical' || input.riskLevel === 'high') {
      return false;
    }
    if (input.approvalScope === 'once') {
      return false;
    }
    return !NEVER_CACHE_ACTION.test(action);
  }

  private readDocument(): ApprovalDecisionCacheDocument {
    try {
      if (!this.existsSync(this.filePath)) {
        return { schemaVersion: 1, entries: [] };
      }
      const parsed = JSON.parse(String(this.readFileSync(this.filePath, 'utf8') || '{}'));
      return {
        schemaVersion: 1,
        entries: Array.isArray(parsed.entries) ? parsed.entries.map(normalizeEntry).filter(Boolean) as ApprovalDecisionCacheEntry[] : [],
      };
    } catch (error: any) {
    logger.warn('[Approval Decision Cache] JSON parse failed', error);
    return { schemaVersion: 1, entries: [] };
  }
  }

  private writeDocument(document: ApprovalDecisionCacheDocument): void {
    this.mkdirSync(path.dirname(this.filePath), { recursive: true });
    this.writeFileSync(this.filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  }
}

function normalizeEntry(value: unknown): ApprovalDecisionCacheEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as ApprovalDecisionCacheEntry;
  if (!record.signature || !record.expiresAt || !record.domain || !record.actionId) {
    return null;
  }
  return record;
}

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function redactAndSort(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactAndSort);
  }
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' && /(token|secret|key|password|credential)/i.test(value)
      ? '[redacted]'
      : value;
  }
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    result[key] = /(token|secret|key|password|credential)/i.test(key)
      ? '[redacted]'
      : redactAndSort((value as Record<string, unknown>)[key]);
  }
  return result;
}
