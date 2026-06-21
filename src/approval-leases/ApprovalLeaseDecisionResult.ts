/**
 * ApprovalLeaseDecisionResult.ts
 *
 * Pure types for the controlled approval lease decision integration.
 * Decision status names use advisory/state language.
 * No execution, bypass, or trust-grant semantics are expressed here.
 */

export type ApprovalLeaseDecisionStatus =
  | 'lease_satisfied'
  | 'lease_rejected'
  | 'requires_approval'
  | 'fail_closed'
  | 'not_applicable';

/**
 * The full result object returned by ApprovalLeaseDecisionAdapter.
 * Advisory-only: callers must not execute tools based solely on this
 * result without completing all upstream safety gates.
 */
export type ApprovalLeaseDecisionResult = {
  status: ApprovalLeaseDecisionStatus;
  reason: string;
  leaseId?: string;
  toolQualifiedName: string;
  riskClass: string;
  upstreamGatesConfirmed: boolean;
  leaseConsidered: boolean;
  evaluatedAt: string;
};

/**
 * Context required to evaluate whether an approval lease may satisfy
 * a repeated approval prompt. No secrets, raw prompts, provider
 * responses, API keys, bearer tokens, secretRef, rawKey, ciphertext,
 * or authTag are allowed here.
 */
export type ApprovalLeaseDecisionContext = {
  subjectId: string;
  workspaceId: string;
  channelId?: string;
  toolQualifiedName: string;
  toolFingerprint: string;
  riskClass: 'safe' | 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  requestedOperation: string;
  auditCorrelationId: string;
  /**
   * Opaque receipt from the upstream gate evaluation. Must be provided
   * to prove that ToolGatekeeper and risk classification have already
   * been executed. Any truthy value is treated as gates have run.
   */
  existingGateResult?: unknown;
};
