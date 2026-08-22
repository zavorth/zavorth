import fs from 'node:fs';
import path from 'node:path';

import { config } from '../config/index.js';
import { logger } from '../logger.js';

export const ZAVORTH_PERSISTENT_APPROVAL_POLICY_CONTRACT_VERSION =
  'zavorth-persistent-approval-policy/1' as const;

export type ZavorthPersistentApprovalRisk = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type ZavorthPersistentApprovalPolicy = {
  id: string;
  mode: 'standard' | 'break-glass';
  label: string;
  surface: string;
  enabled: boolean;
  actions: string[];
  maxRisk: ZavorthPersistentApprovalRisk;
  allowDestructivePreview: boolean;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string;
  reason: string;
  receiptId: string;
  usageCount: number;
  lastUsedAt: string | null;
  hardStops: string[];
};

export type ZavorthPersistentApprovalPolicyDocument = {
  contractVersion: typeof ZAVORTH_PERSISTENT_APPROVAL_POLICY_CONTRACT_VERSION;
  schemaVersion: 1;
  updatedAt: string;
  policies: ZavorthPersistentApprovalPolicy[];
};

export type ZavorthPersistentApprovalGrantInput = {
  surface: string;
  label?: string;
  actions?: string[];
  maxRisk?: ZavorthPersistentApprovalRisk;
  allowDestructivePreview?: boolean;
  ttlDays?: number | null;
  createdBy?: string;
  reason?: string;
};

export type ZavorthBreakGlassGrantInput = ZavorthPersistentApprovalGrantInput & {
  confirmationPhrase: string;
  secondConfirmation: string;
  acknowledgeHardStops: boolean;
  ttlHours?: number | null;
};

export type ZavorthPersistentApprovalResolveInput = {
  surface: string;
  actions: string[];
  maxRisk: ZavorthPersistentApprovalRisk;
  destructivePreview: boolean;
};

export type ZavorthPersistentApprovalResolution = {
  allowed: boolean;
  policy: ZavorthPersistentApprovalPolicy | null;
  reason: string;
  receiptId: string | null;
};

export type ZavorthPersistentApprovalPolicySnapshot = {
  contractVersion: typeof ZAVORTH_PERSISTENT_APPROVAL_POLICY_CONTRACT_VERSION;
  surface: 'persistent-approval-policy';
  generatedAt: string;
  policies: ZavorthPersistentApprovalPolicy[];
  summary: {
    total: number;
    enabled: number;
    expired: number;
    broadPolicies: number;
    breakGlassActive: number;
  };
  safety: {
    noCriticalAutoApproval: true;
    breakGlassStillHasHardStops: true;
    breakGlassRequiresDoubleConfirmation: true;
    destructivePreviewMustBeExplicit: true;
    expiresOrCanBeRevoked: true;
    receiptRequired: true;
  };
};

type Runtime = {
  now?: () => Date;
  projectRoot?: string;
  policyPath?: string;
  receiptDir?: string;
};

const RISK_ORDER: Record<ZavorthPersistentApprovalRisk, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export const ZAVORTH_BREAK_GLASS_CONFIRMATION_PHRASE =
  'I ACCEPT THE RISK AND WANT TO ENABLE BREAK GLASS MODE' as const;
export const ZAVORTH_BREAK_GLASS_SECOND_CONFIRMATION =
  'CONFIRMO ATIVAR BREAK GLASS' as const;

const BREAK_GLASS_MAX_TTL_HOURS = 24;
const BREAK_GLASS_HARD_STOPS = [
  'raw-secret-read',
  'secret-exfiltration',
  'audit-disable',
  'receipt-disable',
  'policy-disable',
  'kill-switch-disable',
  'whole-disk-delete',
  'unrestricted-shell',
  'unbounded-financial-transaction',
  'runtime-adapter-unbounded-delegation',
  'self-delete-governance',
];

export class ZavorthPersistentApprovalPolicyService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly policyPath: string;
  private readonly receiptDir: string;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.policyPath = runtime.policyPath || path.join(this.projectRoot, 'data', 'approval-policies', 'persistent-approval-policies.json');
    this.receiptDir = runtime.receiptDir || path.join(this.projectRoot, 'data', 'approval-policies', 'receipts');
  }

  public buildSnapshot(): ZavorthPersistentApprovalPolicySnapshot {
    const document = this.readDocument();
    return {
      contractVersion: ZAVORTH_PERSISTENT_APPROVAL_POLICY_CONTRACT_VERSION,
      surface: 'persistent-approval-policy',
      generatedAt: this.now().toISOString(),
      policies: document.policies,
      summary: {
        total: document.policies.length,
        enabled: document.policies.filter((policy) => policy.enabled && !this.isExpired(policy)).length,
        expired: document.policies.filter((policy) => this.isExpired(policy)).length,
        broadPolicies: document.policies.filter((policy) => policy.actions.includes('*') || policy.maxRisk === 'high').length,
        breakGlassActive: document.policies.filter((policy) => policy.mode === 'break-glass' && policy.enabled && !this.isExpired(policy)).length,
      },
      safety: {
        noCriticalAutoApproval: true,
        breakGlassStillHasHardStops: true,
        breakGlassRequiresDoubleConfirmation: true,
        destructivePreviewMustBeExplicit: true,
        expiresOrCanBeRevoked: true,
        receiptRequired: true,
      },
    };
  }

  public grant(input: ZavorthPersistentApprovalGrantInput): ZavorthPersistentApprovalPolicy {
    const now = this.now();
    const maxRisk = normalizeRisk(input.maxRisk || 'low');
    if (maxRisk === 'critical') {
      throw new Error('Persistent auto-approval cannot be granted for critical risk.');
    }
    const actions = uniqueActions(input.actions && input.actions.length > 0 ? input.actions : ['*']);
    const id = `pap-${slugify(input.surface)}-${now.getTime()}`;
    const receiptId = `${id}.receipt`;
    const policy: ZavorthPersistentApprovalPolicy = {
      id,
      mode: 'standard',
      label: normalizeText(input.label, `Persistent approval for ${input.surface}`),
      surface: normalizeText(input.surface, 'unknown'),
      enabled: true,
      actions,
      maxRisk,
      allowDestructivePreview: input.allowDestructivePreview === true,
      expiresAt: resolveExpiry(now, input.ttlDays),
      createdAt: now.toISOString(),
      createdBy: normalizeText(input.createdBy, 'owner'),
      reason: normalizeText(input.reason, 'Owner granted reusable approval for this exact governed scope.'),
      receiptId,
      usageCount: 0,
      lastUsedAt: null,
      hardStops: [],
    };
    const document = this.readDocument();
    document.policies = [
      ...document.policies.filter((entry) => entry.id !== policy.id),
      policy,
    ];
    this.writeDocument(document);
    this.writeReceipt(policy, 'granted', 'Persistent approval policy created.');
    return policy;
  }

  public grantBreakGlass(input: ZavorthBreakGlassGrantInput): ZavorthPersistentApprovalPolicy {
    if (input.confirmationPhrase !== ZAVORTH_BREAK_GLASS_CONFIRMATION_PHRASE) {
      throw new Error('Break glass confirmation phrase does not match.');
    }
    if (input.secondConfirmation !== ZAVORTH_BREAK_GLASS_SECOND_CONFIRMATION) {
      throw new Error('Break glass second confirmation does not match.');
    }
    if (input.acknowledgeHardStops !== true) {
      throw new Error('Break glass requires hard-stop acknowledgement.');
    }
    const now = this.now();
    const maxRisk = normalizeRisk(input.maxRisk || 'high');
    if (maxRisk === 'critical') {
      throw new Error('Break glass cannot auto-approve critical risk or remove hard stops.');
    }
    const hours = Math.max(1, Math.min(BREAK_GLASS_MAX_TTL_HOURS, Math.floor(Number(input.ttlHours || BREAK_GLASS_MAX_TTL_HOURS))));
    const id = `pap-break-glass-${slugify(input.surface)}-${now.getTime()}`;
    const receiptId = `${id}.receipt`;
    const policy: ZavorthPersistentApprovalPolicy = {
      id,
      mode: 'break-glass',
      label: normalizeText(input.label, `Break glass approval for ${input.surface}`),
      surface: normalizeText(input.surface, 'unknown'),
      enabled: true,
      actions: uniqueActions(input.actions && input.actions.length > 0 ? input.actions : ['*']),
      maxRisk,
      allowDestructivePreview: input.allowDestructivePreview !== false,
      expiresAt: new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString(),
      createdAt: now.toISOString(),
      createdBy: normalizeText(input.createdBy, 'owner'),
      reason: normalizeText(input.reason, 'Owner activated governed break glass mode with hard stops.'),
      receiptId,
      usageCount: 0,
      lastUsedAt: null,
      hardStops: [...BREAK_GLASS_HARD_STOPS],
    };
    const document = this.readDocument();
    document.policies = [
      ...document.policies.filter((entry) => entry.id !== policy.id),
      policy,
    ];
    this.writeDocument(document);
    this.writeReceipt(policy, 'granted', 'Governed break glass policy created with hard stops.');
    return policy;
  }

  public revoke(policyId: string, reason = 'Owner revoked persistent approval policy.'): boolean {
    const document = this.readDocument();
    const policy = document.policies.find((entry) => entry.id === policyId);
    if (!policy) return false;
    policy.enabled = false;
    this.writeDocument(document);
    this.writeReceipt(policy, 'revoked', reason);
    return true;
  }

  public resolve(input: ZavorthPersistentApprovalResolveInput): ZavorthPersistentApprovalResolution {
    const document = this.readDocument();
    const actions = uniqueActions(input.actions);
    const requiredRisk = normalizeRisk(input.maxRisk);
    const hardStop = actions.find((action) => isHardStopAction(action));
    if (hardStop) {
      return {
        allowed: false,
        policy: null,
        reason: `Action ${hardStop} is a hard stop and cannot be auto-approved.`,
        receiptId: null,
      };
    }
    const policy = document.policies.find((entry) =>
      entry.enabled
      && !this.isExpired(entry)
      && entry.surface === input.surface
      && RISK_ORDER[entry.maxRisk] >= RISK_ORDER[requiredRisk]
      && (!input.destructivePreview || entry.allowDestructivePreview)
      && actions.every((action) => entry.actions.includes('*') || entry.actions.includes(action)),
    );
    if (!policy) {
      return {
        allowed: false,
        policy: null,
        reason: input.destructivePreview ? 'No matching persistent approval allows destructive previews for this scope.'
          : 'No matching persistent approval policy for this scope.',
        receiptId: null,
      };
    }
    policy.usageCount += 1;
    policy.lastUsedAt = this.now().toISOString();
    this.writeDocument(document);
    this.writeReceipt(policy, 'used', `Persistent approval resolved ${actions.join(', ') || 'unknown action'}.`);
    return {
      allowed: true,
      policy,
      reason: `Persistent approval policy ${policy.id} matched.`,
      receiptId: policy.receiptId,
    };
  }

  public renderText(snapshot = this.buildSnapshot()): string {
    return [
      'Zavorth Persistent Approval Policies',
      `policies=${snapshot.summary.total} enabled=${snapshot.summary.enabled} expired=${snapshot.summary.expired} breakGlass=${snapshot.summary.breakGlassActive}`,
      ...snapshot.policies.slice(0, 12).map((policy) =>
        `- ${policy.enabled ? 'ON' : 'OFF'} ${policy.id}: mode=${policy.mode} ${policy.surface} actions=${policy.actions.join(',')} risk<=${policy.maxRisk} destructivePreview=${policy.allowDestructivePreview} expires=${policy.expiresAt || 'manual-revoke'}`,
      ),
      '',
    ].join('\n');
  }

  private readDocument(): ZavorthPersistentApprovalPolicyDocument {
    if (!fs.existsSync(this.policyPath)) {
      return {
        contractVersion: ZAVORTH_PERSISTENT_APPROVAL_POLICY_CONTRACT_VERSION,
        schemaVersion: 1,
        updatedAt: this.now().toISOString(),
        policies: [],
      };
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.policyPath, 'utf8')) as ZavorthPersistentApprovalPolicyDocument;
      return {
        contractVersion: ZAVORTH_PERSISTENT_APPROVAL_POLICY_CONTRACT_VERSION,
        schemaVersion: 1,
        updatedAt: parsed.updatedAt || this.now().toISOString(),
        policies: Array.isArray(parsed.policies) ? parsed.policies.map(normalizePolicy).filter(Boolean) as ZavorthPersistentApprovalPolicy[] : [],
      };
    } catch (error: unknown) {
      logger.warn('[Zavorth Persistent Approval] parsing failed', error);
      return {
        contractVersion: ZAVORTH_PERSISTENT_APPROVAL_POLICY_CONTRACT_VERSION,
        schemaVersion: 1,
        updatedAt: this.now().toISOString(),
        policies: [],
      };
    }
  }

  private writeDocument(document: ZavorthPersistentApprovalPolicyDocument): void {
    fs.mkdirSync(path.dirname(this.policyPath), { recursive: true });
    fs.writeFileSync(this.policyPath, `${JSON.stringify({
      ...document,
      updatedAt: this.now().toISOString(),
    }, null, 2)}\n`, 'utf8');
  }

  private writeReceipt(policy: ZavorthPersistentApprovalPolicy, event: 'granted' | 'used' | 'revoked', summary: string): void {
    fs.mkdirSync(this.receiptDir, { recursive: true });
    const receipt = {
      contractVersion: ZAVORTH_PERSISTENT_APPROVAL_POLICY_CONTRACT_VERSION,
      receiptId: `${policy.id}.${event}.${this.now().getTime()}`,
      policyId: policy.id,
      event,
      surface: policy.surface,
      actions: policy.actions,
      maxRisk: policy.maxRisk,
      mode: policy.mode,
      allowDestructivePreview: policy.allowDestructivePreview,
      hardStops: policy.hardStops,
      createdAt: this.now().toISOString(),
      summary,
      safety: {
        noCriticalAutoApproval: true,
        breakGlassStillHasHardStops: true,
        policyCanBeRevoked: true,
        rawSecretsSerialized: false,
      },
    };
    fs.writeFileSync(path.join(this.receiptDir, `${receipt.receiptId}.json`), `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  }

  private isExpired(policy: ZavorthPersistentApprovalPolicy): boolean {
    return Boolean(policy.expiresAt && policy.expiresAt <= this.now().toISOString());
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePolicy(input: any): ZavorthPersistentApprovalPolicy | null {
  if (!input || typeof input !== 'object') return null;
  return {
    id: normalizeText(input.id, ''),
    mode: input.mode === 'break-glass' ? 'break-glass' : 'standard',
    label: normalizeText(input.label, 'Persistent approval policy'),
    surface: normalizeText(input.surface, ''),
    enabled: input.enabled === true,
    actions: uniqueActions(Array.isArray(input.actions) ? input.actions : []),
    maxRisk: normalizeRisk(input.maxRisk),
    allowDestructivePreview: input.allowDestructivePreview === true,
    expiresAt: typeof input.expiresAt === 'string' ? input.expiresAt : null,
    createdAt: normalizeText(input.createdAt, new Date(0).toISOString()),
    createdBy: normalizeText(input.createdBy, 'owner'),
    reason: normalizeText(input.reason, ''),
    receiptId: normalizeText(input.receiptId, `${normalizeText(input.id, 'policy')}.receipt`),
    usageCount: Number.isFinite(input.usageCount) ? Math.max(0, Math.floor(input.usageCount)) : 0,
    lastUsedAt: typeof input.lastUsedAt === 'string' ? input.lastUsedAt : null,
    hardStops: Array.isArray(input.hardStops) ? uniqueActions(input.hardStops) : [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeRisk(value: any): ZavorthPersistentApprovalRisk {
  return ['none', 'low', 'medium', 'high', 'critical'].includes(String(value))
    ? String(value) as ZavorthPersistentApprovalRisk
    : 'low';
}

function uniqueActions(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeText(value, '')).filter(Boolean)));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeText(value: any, fallback: string): string {
  const text = String(value || '').trim();
  return text || fallback;
}

function resolveExpiry(now: Date, ttlDays: number | null | undefined): string | null {
  if (ttlDays === null) return null;
  const days = Number.isFinite(ttlDays) ? Math.max(1, Math.min(365, Math.floor(Number(ttlDays)))) : 30;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function isHardStopAction(action: string): boolean {
  const normalized = normalizeText(action, '').toLowerCase();
  return BREAK_GLASS_HARD_STOPS.includes(normalized);
}

function slugify(value: string): string {
  return normalizeText(value, 'scope')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'scope';
}
