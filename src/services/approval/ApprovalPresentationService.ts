/**
 * Unified approval presentation service (product face).
 *
 * Facade over approval-leases and loose desktop/control shapes.
 * Optionally emits Trust Loop events (kind=approval) via ProofLedgerService.
 */

import {
  APPROVAL_PRESENTATION_CONTRACT_VERSION,
  type ApprovalDecisionAction,
  type ApprovalLifecycleStage,
  type ApprovalPresentationCard,
  type ApprovalPresentationDecision,
  type ApprovalPresentationListFilter,
  type ApprovalPresentationScope,
  type ApprovalPresentationSnapshot,
} from '../../contracts/approval/ApprovalPresentationContract.js';
import type { ProofEventStatus } from '../../contracts/proof/ProofLedgerContract.js';
import type { ApprovalLease } from '../../approval-leases/ApprovalLeaseTypes.js';
import {
  ProofLedgerService,
  defaultProofLedgerJsonlPath,
} from '../proof/ProofLedgerService.js';
import {
  buildEffectsSummaryFromLease,
  formatLeaseExpiry,
  formatScopeLine,
  mapLeaseRiskToProofRisk,
  normalizePresentationRisk,
} from './approvalPresentationFormatters.js';

export type ApprovalLeaseLike = {
  leaseId?: string;
  subjectId?: string;
  workspaceId?: string;
  channelId?: string;
  toolQualifiedName?: string;
  toolName?: string;
  toolFingerprint?: string;
  riskClassAtGrant?: string;
  riskClass?: string;
  riskLevel?: string;
  allowedOperations?: string[];
  createdAt?: string;
  expiresAt?: string;
  revokedAt?: string;
  grantReason?: string;
  grantSource?: string;
  auditCorrelationId?: string;
  [key: string]: unknown;
};

export type LooseApprovalRequestInput = {
  id?: string;
  approvalId?: string;
  leaseId?: string;
  title?: string;
  summary?: string;
  risk?: string;
  riskLevel?: string;
  riskClass?: string;
  stage?: ApprovalLifecycleStage | string;
  subjectId?: string;
  workspaceId?: string;
  channelId?: string;
  toolName?: string;
  toolQualifiedName?: string;
  allowedOperations?: string[];
  expiresAt?: string | null;
  runId?: string | null;
  surface?: string;
  effectsSummary?: string[];
  decision?: Partial<ApprovalPresentationDecision> | null;
  proofEventId?: string | null;
  status?: string;
  action?: string;
  createdAt?: string;
  decidedBy?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ApprovalDecisionInput = {
  action: ApprovalDecisionAction | string;
  decidedBy?: string | null;
  reason?: string | null;
  decidedAt?: string | null;
};

export type RecordDecisionOptions = {
  proofLedger?: ProofLedgerService | null;
  /** When true and no ledger provided, create default JSONL ledger under .zavorth/ */
  emitProof?: boolean;
  surface?: string;
  source?: string;
};

export type FromLeaseExtras = {
  id?: string;
  title?: string;
  summary?: string;
  stage?: ApprovalLifecycleStage;
  surface?: string;
  runId?: string | null;
  approvalId?: string | null;
  proofEventId?: string | null;
  effectsSummary?: string[];
  decision?: Partial<ApprovalPresentationDecision>;
  metadata?: Record<string, unknown>;
};

export type ApprovalPresentationServiceOptions = {
  now?: () => Date;
  proofLedger?: ProofLedgerService | null;
  emitProofByDefault?: boolean;
  idFactory?: (prefix: string) => string;
};

export type DesktopApprovalHint = {
  id: string;
  title: string;
  summary: string;
  risk: string;
  status: 'pending' | 'approved' | 'denied' | 'deferred' | 'revoked' | 'expired' | string;
  approvalId: string | null;
  leaseId: string | null;
  stage: ApprovalLifecycleStage;
  expiresAt: string | null;
  effectsSummary: string[];
};

const TERMINAL_STAGES: ReadonlySet<ApprovalLifecycleStage> = new Set([
  'decided',
  'receipted',
  'expired',
  'revoked',
]);

export class ApprovalPresentationService {
  private readonly now: () => Date;
  private readonly proofLedger: ProofLedgerService | null;
  private readonly emitProofByDefault: boolean;
  private readonly idFactory: (prefix: string) => string;
  private sequence = 0;

  constructor(options: ApprovalPresentationServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.proofLedger = options.proofLedger ?? null;
    this.emitProofByDefault = Boolean(options.emitProofByDefault);
    this.idFactory = options.idFactory
      ?? ((prefix) => `${prefix}-${this.now().getTime().toString(36)}-${++this.sequence}`);
  }

  public fromLease(
    lease: ApprovalLease | ApprovalLeaseLike,
    extras: FromLeaseExtras = {},
  ): ApprovalPresentationCard {
    const leaseId = readNullable(lease.leaseId) || null;
    const toolName = readNullable(lease.toolQualifiedName)
      || readNullable((lease as ApprovalLeaseLike).toolName)
      || null;
    const riskSource = (lease as ApprovalLeaseLike).riskClassAtGrant
      || (lease as ApprovalLeaseLike).riskClass
      || (lease as ApprovalLeaseLike).riskLevel
      || 'unknown';
    const riskLevel = normalizePresentationRisk(String(riskSource));
    const allowedOperations = normalizeOps(lease.allowedOperations);
    const expiresAt = readNullable(lease.expiresAt);
    const revokedAt = readNullable((lease as ApprovalLeaseLike).revokedAt);
    const stage = extras.stage
      || deriveStageFromLease({ expiresAt, revokedAt, now: this.now() });

    const scope: ApprovalPresentationScope = {
      subjectId: readNullable(lease.subjectId),
      workspaceId: readNullable(lease.workspaceId),
      channelId: readNullable(lease.channelId),
      toolName,
      allowedOperations,
    };

    const effectsSummary = extras.effectsSummary
      || buildEffectsSummaryFromLease({
        toolQualifiedName: toolName,
        allowedOperations,
        riskClassAtGrant: String(riskSource),
        grantReason: readNullable((lease as ApprovalLeaseLike).grantReason) || undefined,
        workspaceId: scope.workspaceId,
        channelId: scope.channelId,
        subjectId: scope.subjectId,
        expiresAt,
      });

    const title = extras.title
      || (toolName ? `Approve ${toolName}` : 'Approval request');
    const summary = extras.summary
      || (lease as ApprovalLeaseLike).grantReason
      || formatScopeLine(scope);

    const decision = normalizeDecision(extras.decision);

    return {
      id: extras.id || leaseId || this.idFactory('appr-card'),
      stage,
      title: String(title).trim() || 'Approval request',
      summary: String(summary).trim() || 'No details.',
      riskLevel,
      scope,
      expiresAt,
      leaseId,
      approvalId: extras.approvalId ?? null,
      runId: extras.runId ?? null,
      surface: extras.surface || 'runtime',
      effectsSummary,
      decision,
      proofEventId: extras.proofEventId ?? null,
      ...(extras.metadata || (lease as ApprovalLeaseLike).auditCorrelationId
        ? {
          metadata: {
            ...(extras.metadata || {}),
            ...((lease as ApprovalLeaseLike).auditCorrelationId
              ? { auditCorrelationId: (lease as ApprovalLeaseLike).auditCorrelationId }
              : {}),
            ...((lease as ApprovalLeaseLike).grantSource
              ? { grantSource: (lease as ApprovalLeaseLike).grantSource }
              : {}),
            ...((lease as ApprovalLeaseLike).toolFingerprint
              ? { toolFingerprint: (lease as ApprovalLeaseLike).toolFingerprint }
              : {}),
          },
        }
        : {}),
    };
  }

  public fromLooseRequest(input: LooseApprovalRequestInput = {}): ApprovalPresentationCard {
    const riskLevel = normalizePresentationRisk(
      input.riskLevel || input.riskClass || input.risk || 'unknown',
    );
    const toolName = readNullable(input.toolQualifiedName) || readNullable(input.toolName);
    const allowedOperations = normalizeOps(input.allowedOperations);
    const scope: ApprovalPresentationScope = {
      subjectId: readNullable(input.subjectId),
      workspaceId: readNullable(input.workspaceId),
      channelId: readNullable(input.channelId),
      toolName,
      allowedOperations,
    };

    const approvalId = readNullable(input.approvalId) || readNullable(input.id);
    const leaseId = readNullable(input.leaseId);
    const expiresAt = input.expiresAt === undefined
      ? null
      : readNullable(input.expiresAt);

    let stage = normalizeStage(input.stage);
    if (!stage) {
      stage = deriveStageFromLoose(input, expiresAt, this.now());
    }

    const effectsSummary = Array.isArray(input.effectsSummary) && input.effectsSummary.length
      ? input.effectsSummary.map((s) => String(s))
      : buildEffectsSummaryFromLease({
        toolQualifiedName: toolName,
        allowedOperations,
        riskLevel,
        workspaceId: scope.workspaceId,
        channelId: scope.channelId,
        subjectId: scope.subjectId,
        expiresAt,
      });

    const title = String(input.title || (toolName ? `Approve ${toolName}` : 'Approval request')).trim()
      || 'Approval request';
    const summary = String(
      input.summary
      || input.action
      || formatScopeLine(scope),
    ).trim() || 'No details.';

    let decision = normalizeDecision(input.decision);
    if (!decision.action && input.status) {
      decision = {
        ...decision,
        action: statusToAction(input.status),
        decidedBy: decision.decidedBy || readNullable(input.decidedBy),
        reason: decision.reason || readNullable(input.reason),
      };
    }

    return {
      id: String(input.id || approvalId || leaseId || this.idFactory('appr-card')).trim(),
      stage,
      title,
      summary,
      riskLevel,
      scope,
      expiresAt,
      leaseId,
      approvalId,
      runId: input.runId === undefined ? null : readNullable(input.runId),
      surface: String(input.surface || 'desktop').trim() || 'desktop',
      effectsSummary,
      decision,
      proofEventId: input.proofEventId === undefined ? null : readNullable(input.proofEventId),
      ...(input.metadata ? { metadata: { ...input.metadata } } : {}),
    };
  }

  public recordDecision(
    cardOrInput: ApprovalPresentationCard | LooseApprovalRequestInput,
    decision: ApprovalDecisionInput,
    options: RecordDecisionOptions = {},
  ): ApprovalPresentationCard {
    const base = isPresentationCard(cardOrInput)
      ? { ...cardOrInput, scope: { ...cardOrInput.scope }, decision: { ...cardOrInput.decision } }
      : this.fromLooseRequest(cardOrInput);

    const action = normalizeDecisionAction(decision.action);
    if (!action) {
      throw new Error(`Invalid approval decision action: ${String(decision.action)}`);
    }

    const decidedAt = decision.decidedAt
      ? String(decision.decidedAt)
      : this.now().toISOString();
    const decidedBy = decision.decidedBy != null && String(decision.decidedBy).trim()
      ? String(decision.decidedBy).trim()
      : 'operator';
    const reason = decision.reason != null && String(decision.reason).trim()
      ? String(decision.reason).trim()
      : null;

    const stage = stageForAction(action);

    let card: ApprovalPresentationCard = {
      ...base,
      stage,
      decision: {
        action,
        decidedAt,
        decidedBy,
        reason,
      },
      effectsSummary: [
        ...base.effectsSummary.filter((line) => !line.startsWith('Decision:')),
        `Decision: ${action}${reason ? ` — ${reason}` : ''}`,
      ],
      metadata: {
        ...(base.metadata || {}),
        lastDecisionAction: action,
      },
    };

    const emitProof = options.emitProof !== undefined
      ? options.emitProof
      : this.emitProofByDefault || options.proofLedger != null || this.proofLedger != null;

    if (emitProof) {
      const ledger = options.proofLedger
        ?? this.proofLedger
        ?? new ProofLedgerService({
          now: this.now,
          jsonlPath: defaultProofLedgerJsonlPath(),
        });

      const proofStatus = decisionActionToProofStatus(action);
      const proofRisk = mapLeaseRiskToProofRisk(card.riskLevel);
      const toolPart = card.scope.toolName ? ` tool=${card.scope.toolName}` : '';
      const scopePart = formatScopeLine(card.scope);

      const event = ledger.append({
        runId: card.runId,
        kind: 'approval',
        surface: options.surface || card.surface || 'runtime',
        title: `Approval ${action}`,
        summary: `${action} · ${card.title}${toolPart} · ${scopePart}`,
        status: proofStatus,
        riskLevel: proofRisk,
        approvalId: card.approvalId || card.id,
        artifacts: card.leaseId
          ? [{ id: card.leaseId, type: 'lease', label: 'Approval lease' }]
          : [],
        source: options.source || 'approval-presentation',
        metadata: {
          presentationCardId: card.id,
          leaseId: card.leaseId,
          decisionAction: action,
          decidedBy,
          reason,
          stage,
          riskLevel: card.riskLevel,
          contractVersion: APPROVAL_PRESENTATION_CONTRACT_VERSION,
        },
      });

      card = {
        ...card,
        proofEventId: event.id,
        stage: action === 'approve' || action === 'deny' ? 'receipted' : card.stage,
      };
    }

    return card;
  }

  public listOpenCards(leases: Array<ApprovalLease | ApprovalLeaseLike>): ApprovalPresentationCard[] {
    const now = this.now();
    const cards: ApprovalPresentationCard[] = [];
    for (const lease of leases || []) {
      const card = this.fromLease(lease);
      if (isOpenCard(card, now)) {
        cards.push(card);
      }
    }
    return cards;
  }

  public listCards(
    cards: ApprovalPresentationCard[],
    filter: ApprovalPresentationListFilter = {},
  ): ApprovalPresentationCard[] {
    const now = this.now();
    let result = (cards || []).map((c) => ({
      ...c,
      scope: { ...c.scope, allowedOperations: [...c.scope.allowedOperations] },
      decision: { ...c.decision },
      effectsSummary: [...c.effectsSummary],
    }));

    if (filter.openOnly) {
      result = result.filter((c) => isOpenCard(c, now));
    }
    if (filter.stage) {
      const stages = new Set(
        Array.isArray(filter.stage) ? filter.stage : [filter.stage],
      );
      result = result.filter((c) => stages.has(c.stage));
    }
    if (filter.riskLevel) {
      const risk = String(filter.riskLevel).toLowerCase();
      result = result.filter((c) => c.riskLevel === risk);
    }
    if (filter.surface) {
      const surface = String(filter.surface).toLowerCase();
      result = result.filter((c) => c.surface.toLowerCase() === surface);
    }
    if (filter.runId != null && String(filter.runId).trim()) {
      const runId = String(filter.runId).trim();
      result = result.filter((c) => c.runId === runId);
    }
    if (filter.leaseId != null && String(filter.leaseId).trim()) {
      const leaseId = String(filter.leaseId).trim();
      result = result.filter((c) => c.leaseId === leaseId);
    }
    if (filter.approvalId != null && String(filter.approvalId).trim()) {
      const approvalId = String(filter.approvalId).trim();
      result = result.filter((c) => c.approvalId === approvalId || c.id === approvalId);
    }
    if (filter.query && String(filter.query).trim()) {
      const q = String(filter.query).trim().toLowerCase();
      result = result.filter((c) => {
        const hay = [
          c.title,
          c.summary,
          c.id,
          c.leaseId,
          c.approvalId,
          c.scope.toolName,
          c.effectsSummary.join(' '),
        ].join(' ').toLowerCase();
        return hay.includes(q);
      });
    }

    if (filter.limit !== undefined && filter.limit !== null && Number.isFinite(filter.limit)) {
      const limit = Math.max(0, Math.floor(Number(filter.limit)));
      result = result.slice(0, limit);
    }

    return result;
  }

  public buildSnapshot(cards: ApprovalPresentationCard[]): ApprovalPresentationSnapshot {
    const now = this.now();
    const list = cards || [];
    const byStage: Record<string, number> = {};
    const byRisk: Record<string, number> = {};
    let open = 0;
    for (const card of list) {
      byStage[card.stage] = (byStage[card.stage] || 0) + 1;
      byRisk[card.riskLevel] = (byRisk[card.riskLevel] || 0) + 1;
      if (isOpenCard(card, now)) open += 1;
    }
    return {
      contractVersion: APPROVAL_PRESENTATION_CONTRACT_VERSION,
      source: 'approval-presentation',
      generatedAt: now.toISOString(),
      cards: list,
      summary: {
        total: list.length,
        open,
        byStage,
        byRisk,
      },
    };
  }

  public toDesktopApprovalHint(card: ApprovalPresentationCard): DesktopApprovalHint {
    return {
      id: card.id,
      title: card.title,
      summary: card.summary,
      risk: card.riskLevel,
      status: actionToDesktopStatus(card.decision.action, card.stage),
      approvalId: card.approvalId,
      leaseId: card.leaseId,
      stage: card.stage,
      expiresAt: card.expiresAt,
      effectsSummary: [...card.effectsSummary],
    };
  }
}

/** Map decision action → ProofEvent status. */
export function decisionActionToProofStatus(action: ApprovalDecisionAction): ProofEventStatus {
  switch (action) {
    case 'approve':
      return 'ok';
    case 'deny':
      return 'failed';
    case 'defer':
      return 'pending';
    case 'revoke':
    case 'expire':
      return 'info';
    default:
      return 'info';
  }
}

export function isOpenCard(card: ApprovalPresentationCard, now: Date = new Date()): boolean {
  if (card.stage === 'revoked' || card.stage === 'expired') return false;
  if (card.stage === 'decided' || card.stage === 'receipted') {
    // decided/receipted with terminal action are closed (except defer which stays open-ish)
    if (card.decision.action && card.decision.action !== 'defer') return false;
  }
  if (card.decision.action && card.decision.action !== 'defer') {
    if (card.decision.action === 'approve' || card.decision.action === 'deny'
      || card.decision.action === 'revoke' || card.decision.action === 'expire') {
      return false;
    }
  }
  if (card.expiresAt) {
    const exp = formatLeaseExpiry(card.expiresAt, now);
    if (exp.expired) return false;
  }
  return true;
}

function deriveStageFromLease(params: {
  expiresAt: string | null;
  revokedAt: string | null;
  now: Date;
}): ApprovalLifecycleStage {
  if (params.revokedAt) return 'revoked';
  if (params.expiresAt) {
    const exp = formatLeaseExpiry(params.expiresAt, params.now);
    if (exp.expired) return 'expired';
  }
  return 'leased';
}

function deriveStageFromLoose(
  input: LooseApprovalRequestInput,
  expiresAt: string | null,
  now: Date,
): ApprovalLifecycleStage {
  const status = String(input.status || '').toLowerCase();
  if (status.includes('revok')) return 'revoked';
  if (status.includes('expir')) return 'expired';
  if (status.includes('approv') || status.includes('deny') || status.includes('reject')) {
    return 'decided';
  }
  if (expiresAt) {
    const exp = formatLeaseExpiry(expiresAt, now);
    if (exp.expired) return 'expired';
  }
  if (input.leaseId) return 'leased';
  if (input.toolName || input.toolQualifiedName || input.workspaceId) return 'scoped';
  return 'request';
}

function normalizeStage(value: unknown): ApprovalLifecycleStage | null {
  const text = String(value || '').trim().toLowerCase();
  if (
    text === 'request'
    || text === 'scoped'
    || text === 'leased'
    || text === 'decided'
    || text === 'receipted'
    || text === 'expired'
    || text === 'revoked'
  ) {
    return text;
  }
  return null;
}

function normalizeDecisionAction(value: unknown): ApprovalDecisionAction | null {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'approve' || text === 'approved' || text === 'allow' || text === 'yes') {
    return 'approve';
  }
  if (text === 'deny' || text === 'denied' || text === 'reject' || text === 'rejected' || text === 'no') {
    return 'deny';
  }
  if (text === 'defer' || text === 'deferred' || text === 'later' || text === 'hold') {
    return 'defer';
  }
  if (text === 'revoke' || text === 'revoked') return 'revoke';
  if (text === 'expire' || text === 'expired') return 'expire';
  return null;
}

function stageForAction(action: ApprovalDecisionAction): ApprovalLifecycleStage {
  switch (action) {
    case 'revoke':
      return 'revoked';
    case 'expire':
      return 'expired';
    case 'defer':
      return 'request';
    case 'approve':
    case 'deny':
      return 'decided';
    default:
      return 'decided';
  }
}

function statusToAction(status: string): ApprovalDecisionAction | null {
  return normalizeDecisionAction(status);
}

function actionToDesktopStatus(
  action: ApprovalDecisionAction | null,
  stage: ApprovalLifecycleStage,
): DesktopApprovalHint['status'] {
  if (action === 'approve') return 'approved';
  if (action === 'deny') return 'denied';
  if (action === 'defer') return 'deferred';
  if (action === 'revoke' || stage === 'revoked') return 'revoked';
  if (action === 'expire' || stage === 'expired') return 'expired';
  return 'pending';
}

function normalizeDecision(
  partial?: Partial<ApprovalPresentationDecision> | null,
): ApprovalPresentationDecision {
  if (!partial) {
    return { action: null, decidedAt: null, decidedBy: null, reason: null };
  }
  return {
    action: partial.action ? normalizeDecisionAction(partial.action) : null,
    decidedAt: partial.decidedAt != null ? String(partial.decidedAt) : null,
    decidedBy: partial.decidedBy != null ? String(partial.decidedBy) : null,
    reason: partial.reason != null ? String(partial.reason) : null,
  };
}

function isPresentationCard(value: unknown): value is ApprovalPresentationCard {
  return Boolean(
    value
    && typeof value === 'object'
    && 'scope' in value
    && 'decision' in value
    && 'effectsSummary' in value
    && 'stage' in value,
  );
}

function normalizeOps(ops: unknown): string[] {
  if (!Array.isArray(ops)) return [];
  return ops.map((o) => String(o || '').trim()).filter(Boolean);
}

function readNullable(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

export { TERMINAL_STAGES };

/** Demo fixtures for CLI smoke and tests. */
export function createApprovalPresentationDemoCards(
  now: () => Date = () => new Date(),
): ApprovalPresentationCard[] {
  const service = new ApprovalPresentationService({ now });
  const ts = now();
  const future = new Date(ts.getTime() + 60 * 60 * 1000).toISOString();
  const past = new Date(ts.getTime() - 60 * 60 * 1000).toISOString();

  const openLease: ApprovalLeaseLike = {
    leaseId: 'lease-demo-1',
    subjectId: 'user-demo',
    workspaceId: 'ws-demo',
    channelId: 'cli',
    toolQualifiedName: 'fs.write',
    toolFingerprint: 'fp-demo-1',
    riskClassAtGrant: 'medium',
    allowedOperations: ['write'],
    createdAt: ts.toISOString(),
    expiresAt: future,
    grantReason: 'Demo lease for approval presentation',
    grantSource: 'test_only',
    auditCorrelationId: 'audit-demo-1',
  };

  const expiredLease: ApprovalLeaseLike = {
    leaseId: 'lease-demo-expired',
    subjectId: 'user-demo',
    workspaceId: 'ws-demo',
    toolQualifiedName: 'shell.exec',
    riskClassAtGrant: 'high',
    allowedOperations: ['exec'],
    createdAt: past,
    expiresAt: past,
    grantReason: 'Expired demo',
    grantSource: 'test_only',
    auditCorrelationId: 'audit-demo-exp',
  };

  const revokedLease: ApprovalLeaseLike = {
    leaseId: 'lease-demo-revoked',
    subjectId: 'user-demo',
    workspaceId: 'ws-demo',
    toolQualifiedName: 'net.fetch',
    riskClassAtGrant: 'low',
    allowedOperations: ['fetch'],
    createdAt: ts.toISOString(),
    expiresAt: future,
    revokedAt: ts.toISOString(),
    grantReason: 'Revoked demo',
    grantSource: 'test_only',
    auditCorrelationId: 'audit-demo-rev',
  };

  return [
    service.fromLease(openLease, {
      id: 'card-demo-open',
      surface: 'cli',
      approvalId: 'appr-demo-1',
      runId: 'run-demo-1',
    }),
    service.fromLease(expiredLease, {
      id: 'card-demo-expired',
      surface: 'cli',
    }),
    service.fromLease(revokedLease, {
      id: 'card-demo-revoked',
      surface: 'cli',
    }),
    service.fromLooseRequest({
      id: 'card-demo-loose',
      title: 'Approve temporary directory access',
      summary: 'Agent requests write access to a temp workspace.',
      risk: 'low',
      toolName: 'workspace.temp',
      allowedOperations: ['read', 'write'],
      surface: 'desktop',
      workspaceId: 'ws-demo',
    }),
  ];
}
