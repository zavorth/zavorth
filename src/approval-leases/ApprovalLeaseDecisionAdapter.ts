import { asErrorLike } from '../utils/errorLike';
import { logger } from '../logger.js';
/**
 * ApprovalLeaseDecisionAdapter.ts
 *
 * Controlled adapter that evaluates an approval lease as one advisory input
 * to the approval decision flow.
 *
 * INTEGRATION ORDER (must be preserved by callers):
 *  1. Receive tool request context.
 *  2. Resolve subject/profile/workspace/channel/tool identity.
 *  3. Run existing channel/workspace exposure checks.
 *  4. Run existing risk classification.
 *  5. Run existing ToolGatekeeper/policy checks.
 *  6. Compute/verify current tool fingerprint.
 *  7. Call ApprovalLeaseDecisionAdapter.evaluate().
 *  8. If result is not lease_satisfied: fall back to normal approval path.
 *  9. If result is lease_satisfied: mark only the repeated prompt as satisfied.
 * 10. Audit the outcome via the injected audit sink.
 *
 * GATE RECEIPT INVARIANT:
 *  existingGateResult MUST be a valid ApprovalLeaseGateReceipt:
 *    - channelWorkspaceExposureChecked === true
 *    - toolGatekeeperExecuted === true
 *    - riskClassResolved === context.riskClass
 *    - toolFingerprintVerified === context.toolFingerprint
 *  Any falsy or incomplete receipt causes immediate fail_closed.
 *
 * AUDIT INVARIANT:
 *  logIntegrationEvent() throwing at any point causes fail_closed.
 *  Silent audit suppression is not permitted.
 *
 * The adapter NEVER executes a tool, bypasses ToolGatekeeper, risk
 * classification, channel/workspace policy, grants global or permanent trust,
 * crosses workspace/profile boundaries, or activates critical/unknown tools.
 */

import { validateNoSecrets } from './ApprovalLeaseAudit.js';
import { InMemoryApprovalLeaseStore } from './InMemoryApprovalLeaseStore.js';
import { ApprovalLeasePolicy, type ApprovalLeasePolicyConfig } from './ApprovalLeasePolicy.js';
import { validateGateReceipt } from './ApprovalLeaseIntegrationPolicy.js';
import type {
  ApprovalLeaseDecisionContext,
  ApprovalLeaseDecisionResult,
  ApprovalLeaseDecisionStatus,
} from './ApprovalLeaseDecisionResult.js';

export type ApprovalLeaseIntegrationAuditEvent = {
  eventType:
    | 'lease_considered'
    | 'lease_satisfied'
    | 'lease_rejected'
    | 'lease_fail_closed'
    | 'lease_not_applicable';
  subjectId: string;
  workspaceId: string;
  channelId?: string;
  toolQualifiedName: string;
  toolFingerprint: string;
  riskClass: string;
  requestedOperation: string;
  leaseId?: string;
  status: ApprovalLeaseDecisionStatus;
  reason: string;
  auditCorrelationId: string;
  timestamp: string;
};

export type ApprovalLeaseDecisionAdapterAuditSink = {
  logIntegrationEvent(event: ApprovalLeaseIntegrationAuditEvent): void | Promise<void>;
};

type AdapterRuntime = {
  now?: () => Date;
  policyConfig?: ApprovalLeasePolicyConfig;
};

const INELIGIBLE_RISK_CLASSES = new Set(['critical', 'unknown']);

/**
 * Builds a fail_closed result directly, bypassing audit emission.
 * Used only for the audit-failure path where emitting would recurse.
 */
function buildFailClosedResult(
  reason: string,
  context: ApprovalLeaseDecisionContext,
  evaluatedAt: string,
  upstreamGatesConfirmed: boolean,
): ApprovalLeaseDecisionResult {
  return {
    status: 'fail_closed',
    reason,
    leaseId: undefined,
    toolQualifiedName: context.toolQualifiedName,
    riskClass: context.riskClass,
    upstreamGatesConfirmed,
    leaseConsidered: false,
    evaluatedAt,
  };
}

export class ApprovalLeaseDecisionAdapter {
  private readonly now: () => Date;
  private readonly policy: ApprovalLeasePolicy;
  private readonly auditSink: ApprovalLeaseDecisionAdapterAuditSink;

  constructor(
    auditSink: ApprovalLeaseDecisionAdapterAuditSink,
    runtime: AdapterRuntime = {},
  ) {
    if (!auditSink) {
      throw new Error('Audit sink is required for ApprovalLeaseDecisionAdapter.');
    }
    this.auditSink = auditSink;
    this.now = runtime.now ?? (() => new Date());
    this.policy = new ApprovalLeasePolicy(runtime.policyConfig);
  }

  public evaluate(context: ApprovalLeaseDecisionContext): ApprovalLeaseDecisionResult {
    const evaluatedAt = this.now().toISOString();

    // Step 1: Validate context does not carry secrets
    try {
      validateNoSecrets(context as unknown as Record<string, unknown>);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const errMsg = err instanceof Error ? err.message : 'unknown error';
      const reason = 'Context validation failed: ' + errMsg;
      return this.emitAndResult({ eventType: 'lease_fail_closed', context, status: 'fail_closed', reason, evaluatedAt, leaseConsidered: false, upstreamGatesConfirmed: false });
    }

    // Step 2: Validate required context fields
    const missing = this.validateRequiredFields(context);
    if (missing) {
      const reason = 'Missing required field: ' + missing;
      return this.emitAndResult({ eventType: 'lease_fail_closed', context, status: 'fail_closed', reason, evaluatedAt, leaseConsidered: false, upstreamGatesConfirmed: false });
    }

    // Step 3: Validate gate receipt — must be a structurally complete ApprovalLeaseGateReceipt
    //   with riskClassResolved and toolFingerprintVerified matching the current context.
    //   Boolean(existingGateResult) alone is NOT sufficient.
    const gateReceiptCheck = this.validateUpstreamGates(context);
    if (!gateReceiptCheck.valid) {
      const reason = 'Gate receipt invalid: ' + gateReceiptCheck.reason;
      return this.emitAndResult({ eventType: 'lease_fail_closed', context, status: 'fail_closed', reason, evaluatedAt, leaseConsidered: false, upstreamGatesConfirmed: false });
    }

    // Step 4: Ineligible risk classes (critical / unknown)
    if (INELIGIBLE_RISK_CLASSES.has(context.riskClass)) {
      const reason = 'Risk class ' + JSON.stringify(context.riskClass) + ' is not eligible for lease satisfaction.';
      return this.emitAndResult({ eventType: 'lease_not_applicable', context, status: 'not_applicable', reason, evaluatedAt, leaseConsidered: false, upstreamGatesConfirmed: true });
    }

    // Step 5: Lookup matching leases from the static in-memory store
    const candidates = InMemoryApprovalLeaseStore.findLeaseForSubjectToolWorkspace(
      context.subjectId,
      context.toolQualifiedName,
      context.workspaceId,
    );

    if (candidates.length === 0) {
      return this.emitAndResult({ eventType: 'lease_not_applicable', context, status: 'requires_approval', reason: 'No matching lease found.', evaluatedAt, leaseConsidered: false, upstreamGatesConfirmed: true });
    }

    // Step 6: Evaluate each candidate lease via policy
    const now = this.now().toISOString();
    for (const lease of candidates) {
      // Emit lease_considered — if this throws, fail_closed
      const considerResult = this.emitAndResult({ eventType: 'lease_considered', context, status: 'requires_approval', reason: 'Evaluating lease ' + lease.leaseId, leaseId: lease.leaseId, evaluatedAt, leaseConsidered: true, upstreamGatesConfirmed: true });
      if (considerResult.status === 'fail_closed') {
        return considerResult;
      }

      const evaluation = this.policy.evaluateLease(lease, {
        subjectId: context.subjectId,
        workspaceId: context.workspaceId,
        channelId: context.channelId,
        toolQualifiedName: context.toolQualifiedName,
        toolFingerprint: context.toolFingerprint,
        riskClass: context.riskClass,
        operation: context.requestedOperation,
        currentTime: now,
      });

      if (evaluation.valid) {
        const reason = 'Lease ' + lease.leaseId + ' satisfied all criteria; repeated approval prompt may be skipped.';
        return this.emitAndResult({ eventType: 'lease_satisfied', context, status: 'lease_satisfied', reason, leaseId: lease.leaseId, evaluatedAt, leaseConsidered: true, upstreamGatesConfirmed: true });
      }
    }

    // Step 7: All candidates failed — fall back to normal approval path
    const reason = 'All candidate leases were rejected; falling back to normal approval path.';
    return this.emitAndResult({ eventType: 'lease_rejected', context, status: 'lease_rejected', reason, evaluatedAt, leaseConsidered: true, upstreamGatesConfirmed: true });
  }

  /**
   * Validates that the existingGateResult is a structurally complete
   * ApprovalLeaseGateReceipt, and that the receipt's riskClassResolved
   * and toolFingerprintVerified match the current context values.
   *
   * This is stricter than Boolean(existingGateResult).
   */
  private validateUpstreamGates(context: ApprovalLeaseDecisionContext): { valid: boolean; reason: string } {
    const receipt = context.existingGateResult;

    if (!validateGateReceipt(receipt)) {
      return { valid: false, reason: 'existingGateResult is not a valid ApprovalLeaseGateReceipt (missing or incomplete structure)' };
    }

    // Cross-check: riskClassResolved must match current context riskClass
    if (receipt.riskClassResolved !== context.riskClass) {
      return {
        valid: false,
        reason: 'Gate receipt riskClassResolved (' + receipt.riskClassResolved + ') does not match context riskClass (' + context.riskClass + ')',
      };
    }

    // Cross-check: toolFingerprintVerified must match current context toolFingerprint
    if (receipt.toolFingerprintVerified !== context.toolFingerprint) {
      return {
        valid: false,
        reason: 'Gate receipt toolFingerprintVerified does not match context toolFingerprint',
      };
    }

    return { valid: true, reason: 'ok' };
  }

  private validateRequiredFields(context: ApprovalLeaseDecisionContext): string | null {
    if (!context.subjectId || context.subjectId.trim() === '') return 'subjectId';
    if (!context.workspaceId || context.workspaceId.trim() === '') return 'workspaceId';
    if (!context.toolQualifiedName || context.toolQualifiedName.trim() === '') return 'toolQualifiedName';
    if (!context.toolFingerprint || context.toolFingerprint.trim() === '') return 'toolFingerprint';
    if (!context.riskClass) return 'riskClass';
    if (!context.requestedOperation || context.requestedOperation.trim() === '') return 'requestedOperation';
    if (!context.auditCorrelationId || context.auditCorrelationId.trim() === '') return 'auditCorrelationId';
    return null;
  }

  /**
   * Emits an audit event and returns the corresponding decision result.
   *
   * If logIntegrationEvent() throws (synchronously), this method catches
   * the error and returns a fail_closed result instead.
   *
   * NOTE: async rejection from logIntegrationEvent() is not awaited here
   * (the sink interface allows void | Promise<void>). Callers that need
   * async audit guarantee must provide a synchronous sink or await externally.
   * Synchronous throw always causes fail_closed.
   */
  private emitAndResult(params: {
    eventType: ApprovalLeaseIntegrationAuditEvent['eventType'];
    context: ApprovalLeaseDecisionContext;
    status: ApprovalLeaseDecisionStatus;
    reason: string;
    leaseId?: string;
    evaluatedAt: string;
    leaseConsidered: boolean;
    upstreamGatesConfirmed: boolean;
  }): ApprovalLeaseDecisionResult {
    const event: ApprovalLeaseIntegrationAuditEvent = {
      eventType: params.eventType,
      subjectId: params.context.subjectId,
      workspaceId: params.context.workspaceId,
      channelId: params.context.channelId,
      toolQualifiedName: params.context.toolQualifiedName,
      toolFingerprint: params.context.toolFingerprint,
      riskClass: params.context.riskClass,
      requestedOperation: params.context.requestedOperation,
      leaseId: params.leaseId,
      status: params.status,
      reason: params.reason,
      auditCorrelationId: params.context.auditCorrelationId,
      timestamp: params.evaluatedAt,
    };

    try {
      // Intentionally not awaited — synchronous throw is caught below.
      // Async rejection is caught to prevent unhandled promise rejections crashing Node.js.
      const p = this.auditSink.logIntegrationEvent(event);
      if (p instanceof Promise) {
        p.catch((asyncErr) => {
          // Log to stderr but do not crash. Since evaluate is sync and already returned,
          // we cannot change the returned status to fail_closed retroactively here.
          logger.error('[SECURITY-AUDIT-ERROR] Async audit logging failed: ', asyncErr);
        });
      }
    } catch (auditErr: unknown) {
      const auditErrLike = asErrorLike(auditErr);
      const auditErrMsg = auditErr instanceof Error ? auditErrLike.message : 'unknown audit error';
      const failReason = 'Audit sink threw during ' + params.eventType + ': ' + auditErrMsg + '. Failing closed.';
      return buildFailClosedResult(failReason, params.context, params.evaluatedAt, params.upstreamGatesConfirmed);
    }

    return {
      status: params.status,
      reason: params.reason,
      leaseId: params.leaseId,
      toolQualifiedName: params.context.toolQualifiedName,
      riskClass: params.context.riskClass,
      upstreamGatesConfirmed: params.upstreamGatesConfirmed,
      leaseConsidered: params.leaseConsidered,
      evaluatedAt: params.evaluatedAt,
    };
  }
}
