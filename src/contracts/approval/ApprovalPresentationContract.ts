/**
 * Unified approval presentation model (product face).
 *
 * Facade over existing approval-leases, desktop approval cards/modals,
 * and Control cards. Does not replace those systems — normalizes shapes
 * for UI surfaces and emits Proof OS events via ProofLedgerService.
 */

export const APPROVAL_PRESENTATION_CONTRACT_VERSION =
  '2026-07-11.proof-os-approval-v1' as const;

export type ApprovalLifecycleStage =
  | 'request'
  | 'scoped'
  | 'leased'
  | 'decided'
  | 'receipted'
  | 'expired'
  | 'revoked';

export type ApprovalDecisionAction =
  | 'approve'
  | 'deny'
  | 'defer'
  | 'revoke'
  | 'expire';

export type ApprovalPresentationRiskLevel =
  | 'none'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical'
  | 'unknown';

export type ApprovalPresentationScope = {
  subjectId: string | null;
  workspaceId: string | null;
  channelId: string | null;
  toolName: string | null;
  allowedOperations: string[];
};

export type ApprovalPresentationDecision = {
  action: ApprovalDecisionAction | null;
  decidedAt: string | null;
  decidedBy: string | null;
  reason: string | null;
};

export type ApprovalPresentationCard = {
  id: string;
  stage: ApprovalLifecycleStage;
  title: string;
  summary: string;
  riskLevel: ApprovalPresentationRiskLevel;
  scope: ApprovalPresentationScope;
  /** ISO-8601 expiry timestamp, if any */
  expiresAt: string | null;
  leaseId: string | null;
  approvalId: string | null;
  runId: string | null;
  /** Originating surface: desktop | cli | control | acp | runtime */
  surface: string;
  /** Short bullets for card UI */
  effectsSummary: string[];
  decision: ApprovalPresentationDecision;
  proofEventId: string | null;
  metadata?: Record<string, unknown>;
};

export type ApprovalPresentationListFilter = {
  stage?: ApprovalLifecycleStage | ApprovalLifecycleStage[];
  riskLevel?: ApprovalPresentationRiskLevel | string;
  surface?: string;
  runId?: string | null;
  leaseId?: string | null;
  approvalId?: string | null;
  query?: string;
  /** When true, only cards without a terminal decision that are not expired/revoked */
  openOnly?: boolean;
  limit?: number;
};

export type ApprovalPresentationSnapshot = {
  contractVersion: typeof APPROVAL_PRESENTATION_CONTRACT_VERSION;
  source: 'approval-presentation';
  generatedAt: string;
  cards: ApprovalPresentationCard[];
  summary: {
    total: number;
    open: number;
    byStage: Record<string, number>;
    byRisk: Record<string, number>;
  };
};

export const APPROVAL_LIFECYCLE_STAGES: readonly ApprovalLifecycleStage[] = [
  'request',
  'scoped',
  'leased',
  'decided',
  'receipted',
  'expired',
  'revoked',
] as const;

export const APPROVAL_DECISION_ACTIONS: readonly ApprovalDecisionAction[] = [
  'approve',
  'deny',
  'defer',
  'revoke',
  'expire',
] as const;

export const APPROVAL_PRESENTATION_RISK_LEVELS: readonly ApprovalPresentationRiskLevel[] = [
  'none',
  'low',
  'medium',
  'high',
  'critical',
  'unknown',
] as const;
