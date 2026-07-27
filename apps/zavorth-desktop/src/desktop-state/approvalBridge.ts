/**
 * Desktop bridge for unified ApprovalPresentationCard shapes.
 *
 * Pure mappers so desktop store/approval cards can project into the
 * Trust Loop approval presentation model without pulling Node-only services.
 * Mirrors src/contracts/approval/ApprovalPresentationContract.ts.
 */

/** Mirrored lifecycle stages from ApprovalPresentationContract. */
export type DesktopApprovalLifecycleStage =
  | 'request'
  | 'scoped'
  | 'leased'
  | 'decided'
  | 'receipted'
  | 'expired'
  | 'revoked';

export type DesktopApprovalDecisionAction =
  | 'approve'
  | 'deny'
  | 'defer'
  | 'revoke'
  | 'expire';

export type DesktopApprovalPresentationRisk =
  | 'none'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical'
  | 'unknown';

export type DesktopApprovalPresentationScope = {
  subjectId: string | null;
  workspaceId: string | null;
  channelId: string | null;
  toolName: string | null;
  allowedOperations: string[];
};

export type DesktopApprovalPresentationDecision = {
  action: DesktopApprovalDecisionAction | null;
  decidedAt: string | null;
  decidedBy: string | null;
  reason: string | null;
};

/** Presentation card shape aligned with monorepo contract. */
export type DesktopApprovalPresentationCard = {
  id: string;
  stage: DesktopApprovalLifecycleStage;
  title: string;
  summary: string;
  riskLevel: DesktopApprovalPresentationRisk;
  scope: DesktopApprovalPresentationScope;
  expiresAt: string | null;
  leaseId: string | null;
  approvalId: string | null;
  runId: string | null;
  surface: string;
  effectsSummary: string[];
  decision: DesktopApprovalPresentationDecision;
  proofEventId: string | null;
  metadata?: Record<string, unknown>;
};

/** Loose desktop approval-ish object (store, InThread card, API). */
export type DesktopLooseApproval = {
  id?: string;
  approvalId?: string;
  leaseId?: string;
  title?: string;
  summary?: string;
  action?: string;
  risk?: string;
  riskLevel?: string;
  status?: string;
  createdAt?: string;
  expiresAt?: string | null;
  runId?: string | null;
  sessionId?: string | null;
  toolName?: string;
  workspaceId?: string;
  channelId?: string;
  subjectId?: string;
  allowedOperations?: string[];
  effectsSummary?: string[];
  decidedBy?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
};

/** Thin hint matching InThreadApprovalCard-ish props. */
export type DesktopInThreadApprovalHint = {
  id: string;
  title: string;
  summary?: string;
  risk?: string;
};

export function normalizeDesktopApprovalRisk(
  risk: string | null | undefined,
): DesktopApprovalPresentationRisk {
  const text = String(risk || '').trim().toLowerCase();
  if (!text) return 'unknown';
  if (text === 'safe' || text === 'none') return 'none';
  if (text === 'low') return 'low';
  if (text === 'medium' || text === 'med') return 'medium';
  if (text === 'high') return 'high';
  if (text === 'critical' || text === 'severe') return 'critical';
  if (text === 'unknown') return 'unknown';
  if (text.includes('critical')) return 'critical';
  if (text.includes('high')) return 'high';
  if (text.includes('med')) return 'medium';
  if (text.includes('low')) return 'low';
  return 'unknown';
}

export function mapChannelDecisionToTrustLoop(
  decision: string | null | undefined,
): 'approve' | 'deny' | 'defer' | null {
  const text = String(decision || '').trim().toLowerCase();
  if (text === 'once' || text === 'session' || text === 'always' || text === 'approve' || text === 'approved' || text === 'ok') return 'approve';
  if (text === 'deny' || text === 'denied' || text === 'reject' || text === 'rejected') return 'deny';
  if (text === 'defer' || text === 'deferred') return 'defer';
  return null;
}

export function mapDesktopStatusToStage(
  status: string | null | undefined,
): DesktopApprovalLifecycleStage {
  const text = String(status || '').trim().toLowerCase();
  if (text.includes('revok')) return 'revoked';
  if (text.includes('expir')) return 'expired';
  if (new Set(['approved', 'approve', 'denied', 'deny', 'rejected', 'reject', 'ok', 'failed']).has(text)) {
    return 'decided';
  }
  if (text.includes('receipt')) return 'receipted';
  if (text.includes('lease')) return 'leased';
  if (text.includes('scope')) return 'scoped';
  return 'request';
}

export function mapDesktopStatusToDecisionAction(
  status: string | null | undefined,
): DesktopApprovalDecisionAction | null {
  const text = String(status || '').trim().toLowerCase();
  if (text === 'approve' || text === 'approved' || text === 'ok' || text === 'once' || text === 'session' || text === 'always') return 'approve';
  if (text === 'deny' || text === 'denied' || text === 'reject' || text === 'rejected') return 'deny';
  if (text === 'defer' || text === 'deferred') return 'defer';
  if (text === 'revoke' || text === 'revoked') return 'revoke';
  if (text === 'expire' || text === 'expired') return 'expire';
  return null;
}

/**
 * Project a loose desktop approval into the presentation card shape.
 */
export function presentationCardFromDesktopApproval(
  item: DesktopLooseApproval,
  defaults: { surface?: string } = {},
): DesktopApprovalPresentationCard {
  const id = String(item.id || item.approvalId || `appr-desktop-${Date.now().toString(36)}`).trim();
  const approvalId = item.approvalId != null && String(item.approvalId).trim()
    ? String(item.approvalId).trim()
    : (item.id != null ? String(item.id) : null);
  const riskLevel = normalizeDesktopApprovalRisk(item.riskLevel || item.risk);
  const stage = mapDesktopStatusToStage(item.status);
  const action = mapDesktopStatusToDecisionAction(item.status);
  const toolName = item.toolName != null && String(item.toolName).trim()
    ? String(item.toolName).trim()
    : null;
  const ops = Array.isArray(item.allowedOperations)
    ? item.allowedOperations.map((o) => String(o || '').trim()).filter(Boolean)
    : [];

  const effectsSummary = Array.isArray(item.effectsSummary) && item.effectsSummary.length
    ? item.effectsSummary.map(String)
    : buildDesktopEffects(item, riskLevel, toolName, ops);

  return {
    id,
    stage,
    title: String(item.title || item.action || 'Approval request').trim() || 'Approval request',
    summary: String(item.summary || item.action || 'Awaiting decision.').trim() || 'Awaiting decision.',
    riskLevel,
    scope: {
      subjectId: item.subjectId != null ? String(item.subjectId) : null,
      workspaceId: item.workspaceId != null ? String(item.workspaceId) : null,
      channelId: item.channelId != null ? String(item.channelId) : null,
      toolName,
      allowedOperations: ops,
    },
    expiresAt: item.expiresAt != null && String(item.expiresAt).trim()
      ? String(item.expiresAt)
      : null,
    leaseId: item.leaseId != null && String(item.leaseId).trim() ? String(item.leaseId) : null,
    approvalId,
    runId: item.runId != null && String(item.runId).trim()
      ? String(item.runId)
      : (item.sessionId != null && String(item.sessionId).trim() ? String(item.sessionId) : null),
    surface: defaults.surface || 'desktop',
    effectsSummary,
    decision: {
      action,
      decidedAt: action && item.createdAt ? String(item.createdAt) : null,
      decidedBy: item.decidedBy != null ? String(item.decidedBy) : null,
      reason: item.reason != null ? String(item.reason) : null,
    },
    proofEventId: null,
    ...(item.metadata ? { metadata: { ...item.metadata } } : {}),
  };
}

/**
 * Project presentation card back into a loose desktop approval item.
 */
export function desktopApprovalFromPresentationCard(
  card: DesktopApprovalPresentationCard,
): DesktopLooseApproval {
  return {
    id: card.id,
    approvalId: card.approvalId ?? card.id,
    leaseId: card.leaseId ?? undefined,
    title: card.title,
    summary: card.summary,
    risk: card.riskLevel,
    riskLevel: card.riskLevel,
    status: card.decision.action
      || (card.stage === 'revoked' ? 'revoked'
        : card.stage === 'expired' ? 'expired'
          : 'pending'),
    expiresAt: card.expiresAt,
    runId: card.runId,
    toolName: card.scope.toolName ?? undefined,
    workspaceId: card.scope.workspaceId ?? undefined,
    channelId: card.scope.channelId ?? undefined,
    subjectId: card.scope.subjectId ?? undefined,
    allowedOperations: [...card.scope.allowedOperations],
    effectsSummary: [...card.effectsSummary],
    decidedBy: card.decision.decidedBy ?? undefined,
    reason: card.decision.reason ?? undefined,
    metadata: {
      ...(card.metadata || {}),
      stage: card.stage,
      proofEventId: card.proofEventId,
      surface: card.surface,
      projectedFrom: 'approval-presentation',
    },
  };
}

/** Thin shape for InThreadApprovalCard props. */
export function inThreadHintFromPresentationCard(
  card: DesktopApprovalPresentationCard,
): DesktopInThreadApprovalHint {
  return {
    id: card.id,
    title: card.title,
    summary: card.summary,
    risk: card.riskLevel === 'unknown' ? undefined : card.riskLevel,
  };
}

export function presentationCardsFromDesktopApprovals(
  items: DesktopLooseApproval[],
  defaults: { surface?: string } = {},
): DesktopApprovalPresentationCard[] {
  return (items || []).map((item) => presentationCardFromDesktopApproval(item, defaults));
}

export function desktopApprovalsFromPresentationCards(
  cards: DesktopApprovalPresentationCard[],
): DesktopLooseApproval[] {
  return (cards || []).map(desktopApprovalFromPresentationCard);
}

function buildDesktopEffects(
  item: DesktopLooseApproval,
  riskLevel: DesktopApprovalPresentationRisk,
  toolName: string | null,
  ops: string[],
): string[] {
  const effects: string[] = [];
  if (toolName) effects.push(`Tool: ${toolName}`);
  if (ops.length) {
    effects.push(ops.length === 1 ? `Operation: ${ops[0]}` : `Operations: ${ops.join(', ')}`);
  }
  if (riskLevel && riskLevel !== 'unknown') {
    effects.push(`Risk: ${riskLevel}`);
  }
  if (item.workspaceId) effects.push(`Workspace: ${item.workspaceId}`);
  return effects;
}
