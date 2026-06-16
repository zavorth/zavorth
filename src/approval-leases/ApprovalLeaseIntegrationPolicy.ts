/**
 * ApprovalLeaseIntegrationPolicy.ts
 *
 * Documents and enforces the controlled integration invariants for
 * approval lease evaluation within the Zavorth decision path.
 *
 * This module does NOT modify ToolGatekeeper, ToolExposurePolicy,
 * risk classifiers, channel/workspace policy, or ApprovalDecisionCacheService.
 *
 * It provides:
 *  - A typed PolicyReceipt to be produced by callers that have run all gates.
 *  - A guard function that checks the receipt before lease evaluation may proceed.
 *  - Named constants for the required integration order.
 */

/**
 * A typed record confirming that all required upstream safety gates
 * have been executed for a given request before lease evaluation begins.
 *
 * Callers are responsible for populating this from their actual gate results.
 * This type is advisory: it signals intent but cannot enforce execution order
 * at the TypeScript type level alone. Integration tests enforce the invariant.
 */
export type ApprovalLeaseGateReceipt = {
  /**
   * The result of the channel/workspace exposure check.
   * Must be present and truthy to confirm this gate ran.
   */
  channelWorkspaceExposureChecked: true;
  /**
   * The resolved risk class from the upstream risk classifier.
   * Must match the riskClass passed in the decision context.
   */
  riskClassResolved: 'safe' | 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  /**
   * Confirmation that ToolGatekeeper (or an equivalent policy check)
   * was executed for this tool request.
   */
  toolGatekeeperExecuted: true;
  /**
   * The tool fingerprint computed by the upstream caller.
   * Must match the toolFingerprint in the decision context.
   */
  toolFingerprintVerified: string;
};

/**
 * Validates that a gate receipt is structurally complete before
 * allowing lease evaluation to proceed.
 *
 * Returns null if valid; returns a descriptive error string if not.
 * The ApprovalLeaseDecisionAdapter treats any falsy existingGateResult
 * as fail_closed regardless of this function.
 */
export function validateGateReceipt(
  receipt: unknown,
): receipt is ApprovalLeaseGateReceipt {
  if (!receipt || typeof receipt !== 'object') {
    return false;
  }
  const r = receipt as Record<string, unknown>;
  if (r['channelWorkspaceExposureChecked'] !== true) return false;
  if (typeof r['riskClassResolved'] !== 'string') return false;
  if (r['toolGatekeeperExecuted'] !== true) return false;
  if (typeof r['toolFingerprintVerified'] !== 'string') return false;
  return true;
}

/**
 * Integration order constants for documentation and test assertions.
 * The numeric values match the required step order described in the
 * Phase 21S-F specification.
 */
export const APPROVAL_LEASE_INTEGRATION_ORDER = {
  RECEIVE_TOOL_REQUEST_CONTEXT: 1,
  RESOLVE_IDENTITY: 2,
  CHANNEL_WORKSPACE_EXPOSURE_CHECK: 3,
  RISK_CLASSIFICATION: 4,
  TOOL_GATEKEEPER_POLICY_CHECK: 5,
  COMPUTE_VERIFY_FINGERPRINT: 6,
  EVALUATE_APPROVAL_LEASE: 7,
  FALLBACK_OR_SATISFY: 8,
  AUDIT_OUTCOME: 9,
} as const;

/**
 * Documents the lease integration invariants that must hold at all times.
 * These are enforced by automated tests in ApprovalLeaseControlledIntegration.test.ts.
 */
export const APPROVAL_LEASE_INTEGRATION_INVARIANTS = {
  leaseDoesNotExecuteTools: true,
  leaseDoesNotExposeTools: true,
  leaseDoesNotBypassToolGatekeeper: true,
  leaseDoesNotBypassRiskClassification: true,
  leaseDoesNotBypassChannelWorkspacePolicy: true,
  leaseDoesNotModifyToolExposurePolicy: true,
  leaseDoesNotActivateCriticalOrUnknown: true,
  leaseDoesNotGrantGlobalTrust: true,
  leaseDoesNotGrantPermanentTrust: true,
  leaseMayNotCrossWorkspaceBoundaries: true,
  leaseMayNotCrossProfileBoundaries: true,
  auditMandatoryWhenSinkAvailable: true,
  missingAuditSinkFailsClosed: true,
  invalidLeaseReturnsFallback: true,
} as const;
