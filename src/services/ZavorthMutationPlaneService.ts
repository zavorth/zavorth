import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type {
  ZavorthApprovalDescriptor,
  ZavorthMutationDomain,
  ZavorthMutationPlan,
  ZavorthMutationRiskLevel,
  ZavorthMutationStatus,
  ZavorthReadinessGate,
  ZavorthResourceImpact,
  ZavorthRetentionPolicy,
} from '../contracts/ZavorthMutationPlaneContract.js';

const DEFAULT_PLAN_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_APPROVAL_SCOPES: ZavorthApprovalDescriptor['availableScopes'] = ['once', 'session', 'host'];

export type CreateZavorthMutationPlanInput = {
  domain: ZavorthMutationDomain;
  actionId: string;
  title: string;
  summary: string;
  requestedBy?: string | null;
  sourceSurface?: string | null;
  riskLevel?: ZavorthMutationRiskLevel;
  approvalRequired?: boolean;
  approvalReason?: string | null;
  resourceImpact?: Partial<ZavorthResourceImpact> | null;
  readinessGates?: ZavorthReadinessGate[];
  retentionPolicy?: Partial<ZavorthRetentionPolicy> | null;
  validationPlan?: string[];
  rollbackPlan?: string[];
  payload?: Record<string, unknown>;
  ttlMs?: number | null;
};

export type ZavorthMutationPlanListOptions = {
  limit?: number;
  includeExpired?: boolean;
};

type MutationPlaneRuntime = {
  plansDir?: string;
  now?: () => Date;
  mkdirSync?: typeof fs.mkdirSync;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  readdirSync?: typeof fs.readdirSync;
  unlinkSync?: typeof fs.unlinkSync;
};

export class ZavorthMutationPlaneService {
  private readonly plansDir: string;
  private readonly now: () => Date;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly unlinkSync: typeof fs.unlinkSync;

  constructor(runtime: MutationPlaneRuntime = {}) {
    this.plansDir = runtime.plansDir || path.resolve(config.projectRoot, 'data', 'runtime', 'mutation-plans');
    this.now = runtime.now || (() => new Date());
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.unlinkSync = runtime.unlinkSync || fs.unlinkSync.bind(fs);
  }

  public createPlan(input: CreateZavorthMutationPlanInput): ZavorthMutationPlan {
    const now = this.now();
    const ttlMs = this.normalizeTtl(input.ttlMs);
    const payload = this.redactSecrets(input.payload || {});
    const resourceImpact = this.normalizeResourceImpact(input.resourceImpact);
    const retentionPolicy = this.normalizeRetentionPolicy(input.retentionPolicy);
    const approvalRequired = input.approvalRequired === true;
    const hashPayload = {
      domain: input.domain,
      actionId: input.actionId,
      payload,
      resourceImpact,
      validationPlan: Array.isArray(input.validationPlan) ? input.validationPlan : [],
      rollbackPlan: Array.isArray(input.rollbackPlan) ? input.rollbackPlan : [],
    };
    const payloadHash = this.hash(hashPayload);
    const plan: ZavorthMutationPlan = {
      id: this.buildPlanId(input.domain, input.actionId, payloadHash, now),
      domain: input.domain,
      actionId: this.cleanText(input.actionId, 'mutation'),
      title: this.cleanText(input.title, input.actionId),
      summary: this.cleanText(input.summary, 'Plano de mutacao Zavorth.'),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      payloadHash,
      status: approvalRequired ? 'waiting_approval' : 'draft',
      requestedBy: this.nullableText(input.requestedBy),
      sourceSurface: this.nullableText(input.sourceSurface),
      riskLevel: input.riskLevel || (approvalRequired ? 'medium' : 'low'),
      approval: {
        required: approvalRequired,
        status: approvalRequired ? 'pending' : 'not_required',
        defaultScope: 'once',
        availableScopes: [...DEFAULT_APPROVAL_SCOPES],
        permissionId: null,
        requestedBy: this.nullableText(input.requestedBy),
        reason: this.cleanText(input.approvalReason, this.cleanText(input.summary, 'Approval requerido.')),
      },
      resourceImpact,
      readinessGates: Array.isArray(input.readinessGates) ? input.readinessGates : [],
      retentionPolicy,
      validationPlan: Array.isArray(input.validationPlan) ? input.validationPlan : [],
      rollbackPlan: Array.isArray(input.rollbackPlan) ? input.rollbackPlan : [],
      payload,
      audit: [
        {
          at: now.toISOString(),
          event: 'plan.created',
          message: approvalRequired ? 'Plano criado aguardando approval.' : 'Plano criado em draft.',
        },
      ],
    };
    this.writePlan(plan);
    return plan;
  }

  public readPlan(planId: string): ZavorthMutationPlan | null {
    const normalized = this.normalizePlanId(planId);
    if (!normalized) {
      return null;
    }
    const filePath = this.resolvePlanFile(normalized);
    if (!this.existsSync(filePath)) {
      return null;
    }
    try {
      const plan = JSON.parse(this.readFileSync(filePath, 'utf8')) as ZavorthMutationPlan;
      return this.expireIfNeeded(plan);
    } catch {
      return null;
    }
  }

  public listPlans(options: ZavorthMutationPlanListOptions = {}): ZavorthMutationPlan[] {
    this.ensurePlansDir();
    const limit = Math.max(1, Math.min(options.limit || 50, 200));
    const plans = this.readdirSync(this.plansDir)
      .filter((entry) => entry.endsWith('.json'))
      .map((entry) => this.readPlan(entry.replace(/\.json$/i, '')))
      .filter((entry): entry is ZavorthMutationPlan => Boolean(entry))
      .filter((entry) => options.includeExpired === true || entry.status !== 'expired')
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return plans.slice(0, limit);
  }

  public approvePlan(
    planId: string,
    input: { permissionId?: string | null; approvedBy?: string | null; scope?: ZavorthApprovalDescriptor['defaultScope'] } = {},
  ): ZavorthMutationPlan {
    const plan = this.requirePlan(planId);
    if (plan.status === 'expired' || plan.status === 'applied') {
      return plan;
    }
    const updated = this.appendAudit({
      ...plan,
      status: 'approved',
      approval: {
        ...plan.approval,
        status: plan.approval.required ? 'approved' : 'not_required',
        defaultScope: input.scope || plan.approval.defaultScope,
        permissionId: this.nullableText(input.permissionId) || plan.approval.permissionId,
      },
    }, 'plan.approved', `Plano aprovado${input.approvedBy ? ` por ${input.approvedBy}` : ''}.`);
    this.writePlan(updated);
    return updated;
  }

  public attachApproval(
    planId: string,
    input: { permissionId?: string | null; status?: ZavorthApprovalDescriptor['status']; reason?: string | null },
  ): ZavorthMutationPlan {
    const plan = this.requirePlan(planId);
    const updated = this.appendAudit({
      ...plan,
      approval: {
        ...plan.approval,
        permissionId: this.nullableText(input.permissionId) || plan.approval.permissionId,
        status: input.status || plan.approval.status,
        reason: this.cleanText(input.reason, plan.approval.reason),
      },
    }, 'approval.attached', 'Approval canonico associado ao plano.');
    this.writePlan(updated);
    return updated;
  }

  public markApplied(planId: string, summary: string, appliedActions: string[] = []): ZavorthMutationPlan {
    const plan = this.requirePlan(planId);
    const updated = this.appendAudit({
      ...plan,
      status: 'applied',
    }, 'plan.applied', summary, { appliedActions });
    this.writePlan(updated);
    return updated;
  }

  public markBlocked(planId: string, reason: string): ZavorthMutationPlan {
    const plan = this.requirePlan(planId);
    const updated = this.appendAudit({
      ...plan,
      status: 'blocked',
    }, 'plan.blocked', this.cleanText(reason, 'Plano bloqueado.'));
    this.writePlan(updated);
    return updated;
  }

  public pruneExpired(nowMs = this.now().getTime()): number {
    this.ensurePlansDir();
    let removed = 0;
    for (const fileName of this.readdirSync(this.plansDir).filter((entry) => entry.endsWith('.json'))) {
      const filePath = path.join(this.plansDir, fileName);
      try {
        const plan = JSON.parse(this.readFileSync(filePath, 'utf8')) as ZavorthMutationPlan;
        const expiresAtMs = Date.parse(String(plan.expiresAt || ''));
        if (Number.isFinite(expiresAtMs) && expiresAtMs < nowMs && plan.status !== 'applied') {
          this.unlinkSync(filePath);
          removed += 1;
        }
      } catch {
        // Arquivos quebrados nao podem travar o runtime; ficam para limpeza manual.
      }
    }
    return removed;
  }

  private requirePlan(planId: string): ZavorthMutationPlan {
    const plan = this.readPlan(planId);
    if (!plan) {
      throw new Error(`Mutation plan nao encontrado: ${planId || 'n/d'}.`);
    }
    return plan;
  }

  private expireIfNeeded(plan: ZavorthMutationPlan): ZavorthMutationPlan {
    if (plan.status === 'applied' || plan.status === 'expired') {
      return plan;
    }
    const expiresAtMs = Date.parse(String(plan.expiresAt || ''));
    if (!Number.isFinite(expiresAtMs) || expiresAtMs >= this.now().getTime()) {
      return plan;
    }
    const expired = this.appendAudit({ ...plan, status: 'expired' }, 'plan.expired', 'TTL de 24h expirou antes do apply.');
    this.writePlan(expired);
    return expired;
  }

  private appendAudit(
    plan: ZavorthMutationPlan,
    event: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): ZavorthMutationPlan {
    const updatedAt = this.now().toISOString();
    return {
      ...plan,
      updatedAt,
      audit: [
        ...(Array.isArray(plan.audit) ? plan.audit : []),
        {
          at: updatedAt,
          event,
          message,
          ...(metadata ? { metadata } : {}),
        },
      ],
    };
  }

  private writePlan(plan: ZavorthMutationPlan): void {
    this.ensurePlansDir();
    this.writeFileSync(this.resolvePlanFile(plan.id), `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  }

  private ensurePlansDir(): void {
    this.mkdirSync(this.plansDir, { recursive: true });
  }

  private resolvePlanFile(planId: string): string {
    return path.join(this.plansDir, `${this.normalizePlanId(planId)}.json`);
  }

  private buildPlanId(domain: ZavorthMutationDomain, actionId: string, hash: string, now: Date): string {
    const prefix = `${domain}-${this.cleanText(actionId, 'mutation')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'mutation'}`;
    return `${prefix}-${now.getTime().toString(36)}-${hash.slice(0, 10)}`;
  }

  private normalizePlanId(planId: string): string {
    return String(planId || '').trim().replace(/[^a-zA-Z0-9_.:-]/g, '');
  }

  private normalizeTtl(value: number | null | undefined): number {
    const numeric = Number(value || 0);
    if (Number.isFinite(numeric) && numeric > 0) {
      return Math.min(numeric, 7 * 24 * 60 * 60 * 1000);
    }
    return DEFAULT_PLAN_TTL_MS;
  }

  private normalizeResourceImpact(input: Partial<ZavorthResourceImpact> | null | undefined): ZavorthResourceImpact {
    return {
      ramMb: Math.max(0, Math.round(Number(input?.ramMb || 0))),
      diskMb: Math.max(0, Math.round(Number(input?.diskMb || 0))),
      processCount: Math.max(0, Math.round(Number(input?.processCount || 0))),
      externalExposure: input?.externalExposure || 'none',
      recurring: input?.recurring === true,
      notes: Array.isArray(input?.notes) ? input.notes.map((entry) => this.cleanText(entry)).filter(Boolean) : [],
    };
  }

  private normalizeRetentionPolicy(input: Partial<ZavorthRetentionPolicy> | null | undefined): ZavorthRetentionPolicy {
    return {
      ttlMs: Number.isFinite(Number(input?.ttlMs)) ? Number(input?.ttlMs) : DEFAULT_PLAN_TTL_MS,
      maxBytes: Number.isFinite(Number(input?.maxBytes)) ? Number(input?.maxBytes) : null,
      cleanupOnSuccess: input?.cleanupOnSuccess === true,
      cleanupOnBoot: input?.cleanupOnBoot === true,
      notes: Array.isArray(input?.notes) ? input.notes.map((entry) => this.cleanText(entry)).filter(Boolean) : [],
    };
  }

  private hash(value: unknown): string {
    return crypto.createHash('sha256').update(this.stableStringify(value)).digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => this.stableStringify(entry)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
      return `{${Object.keys(value as Record<string, unknown>).sort().map((key) =>
        `${JSON.stringify(key)}:${this.stableStringify((value as Record<string, unknown>)[key])}`,
      ).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  private redactSecrets(value: Record<string, unknown>): Record<string, unknown> {
    const visit = (entry: unknown, key = ''): unknown => {
      if (Array.isArray(entry)) {
        return entry.map((item) => visit(item, key));
      }
      if (entry && typeof entry === 'object') {
        return Object.fromEntries(
          Object.entries(entry as Record<string, unknown>).map(([childKey, childValue]) => [childKey, visit(childValue, childKey)]),
        );
      }
      if (/(token|secret|password|pass|api[_-]?key|credential)/i.test(key) && entry !== null && entry !== undefined) {
        return '***';
      }
      return entry;
    };
    return visit(value) as Record<string, unknown>;
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
