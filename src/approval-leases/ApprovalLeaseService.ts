import type { ApprovalLease, ApprovalLeaseRiskClass } from './ApprovalLeaseTypes.js';
import { InMemoryApprovalLeaseStore } from './InMemoryApprovalLeaseStore.js';
import { ApprovalLeasePolicy, type ApprovalLeaseQuery, type ApprovalLeasePolicyConfig } from './ApprovalLeasePolicy.js';
import { type ApprovalLeaseAuditSink, validateNoSecrets } from './ApprovalLeaseAudit.js';

export type ApprovalLeaseEvaluation = {
  valid: boolean;
  reason: string;
  leaseId?: string;
};

export class ApprovalLeaseService {
  private readonly auditSink: ApprovalLeaseAuditSink;
  private readonly policy: ApprovalLeasePolicy;
  private readonly policyConfig: ApprovalLeasePolicyConfig;

  constructor(auditSink: ApprovalLeaseAuditSink, policyConfig?: ApprovalLeasePolicyConfig) {
    if (!auditSink) {
      throw new Error('Audit sink is required for ApprovalLeaseService.');
    }
    this.auditSink = auditSink;
    this.policyConfig = policyConfig || {};
    this.policy = new ApprovalLeasePolicy(this.policyConfig);
  }

  public grantLease(params: {
    subjectId: string;
    workspaceId: string;
    channelId?: string;
    toolQualifiedName: string;
    toolFingerprint: string;
    riskClass: ApprovalLeaseRiskClass;
    allowedOperations: string[];
    durationMs: number;
    grantReason: string;
    grantSource: 'user_confirmed' | 'admin_confirmed' | 'test_only';
    auditCorrelationId: string;
    currentTime?: string;
  }): ApprovalLease {
    // 1. Mandatory Parameter Validation
    if (!params.subjectId || params.subjectId.trim() === '') {
      throw new Error('subjectId is required');
    }
    if (!params.workspaceId || params.workspaceId.trim() === '') {
      throw new Error('workspaceId is required');
    }
    if (!params.toolQualifiedName || params.toolQualifiedName.trim() === '') {
      throw new Error('toolQualifiedName is required');
    }
    if (!params.toolFingerprint || params.toolFingerprint.trim() === '') {
      throw new Error('toolFingerprint is required');
    }
    if (!params.riskClass) {
      throw new Error('riskClass is required');
    }
    if (!params.allowedOperations || params.allowedOperations.length === 0) {
      throw new Error('allowedOperations is required');
    }
    if (!params.auditCorrelationId || params.auditCorrelationId.trim() === '') {
      throw new Error('auditCorrelationId is required');
    }

    // 2. Reject Forbidden Secret-Bearing Fields
    validateNoSecrets(params);

    // 3. Risk Class Limit Checks
    const risk = params.riskClass;
    if (risk === 'critical' || risk === 'unknown') {
      throw new Error(`Lease activation is prohibited for "${risk}" risk class.`);
    }

    // High risk checks
    if (risk === 'high' && !this.policyConfig.highRiskAllowed) {
      throw new Error('Lease activation is prohibited for "high" risk class under current policy.');
    }

    // 4. TTL Caps Validation
    const durationMs = params.durationMs;
    const maxSafeLowMs = 24 * 60 * 60 * 1000;
    const maxMediumMs = 2 * 60 * 60 * 1000;
    const maxHighMs = 15 * 60 * 1000;

    if (risk === 'safe' || risk === 'low') {
      if (durationMs > maxSafeLowMs) {
        throw new Error('Requested duration exceeds the maximum 24h cap for safe/low risk leases.');
      }
    } else if (risk === 'medium') {
      if (durationMs > maxMediumMs) {
        throw new Error('Requested duration exceeds the maximum 2h cap for medium risk leases.');
      }
    } else if (risk === 'high') {
      if (durationMs > maxHighMs) {
        throw new Error('Requested duration exceeds the maximum 15m cap for high risk leases.');
      }
    }

    // 5. Build Lease Object
    const nowIso = params.currentTime ? new Date(params.currentTime).toISOString() : new Date().toISOString();
    const expiresIso = new Date(new Date(nowIso).getTime() + durationMs).toISOString();
    const leaseId = `lease-${Math.random().toString(36).substring(2, 11)}`;

    const lease: ApprovalLease = {
      leaseId,
      subjectId: params.subjectId,
      workspaceId: params.workspaceId,
      channelId: params.channelId,
      toolQualifiedName: params.toolQualifiedName,
      toolFingerprint: params.toolFingerprint,
      riskClassAtGrant: params.riskClass,
      allowedOperations: params.allowedOperations,
      createdAt: nowIso,
      expiresAt: expiresIso,
      grantReason: params.grantReason,
      grantSource: params.grantSource,
      auditCorrelationId: params.auditCorrelationId,
    };

    // 6. Save in Memory Store
    InMemoryApprovalLeaseStore.createLease(lease);

    // 7. Log Audit
    this.auditSink.logApprovalLeaseEvent({
      eventType: 'lease_granted',
      leaseId: lease.leaseId,
      subjectId: lease.subjectId,
      workspaceId: lease.workspaceId,
      channelId: lease.channelId,
      toolQualifiedName: lease.toolQualifiedName,
      toolFingerprint: lease.toolFingerprint,
      riskClassAtGrant: lease.riskClassAtGrant,
      allowedOperations: lease.allowedOperations,
      status: 'granted',
      reason: params.grantReason,
      auditCorrelationId: lease.auditCorrelationId,
      timestamp: nowIso,
    });

    return lease;
  }

  public revokeLease(leaseId: string, reason: string, currentTime?: string): void {
    const lease = InMemoryApprovalLeaseStore.getLease(leaseId);
    if (!lease) {
      throw new Error(`Lease "${leaseId}" not found for revocation.`);
    }

    const nowIso = currentTime ? new Date(currentTime).toISOString() : new Date().toISOString();
    InMemoryApprovalLeaseStore.revokeLease(leaseId, nowIso);

    this.auditSink.logApprovalLeaseEvent({
      eventType: 'lease_revoked',
      leaseId: lease.leaseId,
      subjectId: lease.subjectId,
      workspaceId: lease.workspaceId,
      channelId: lease.channelId,
      toolQualifiedName: lease.toolQualifiedName,
      toolFingerprint: lease.toolFingerprint,
      riskClassAtGrant: lease.riskClassAtGrant,
      allowedOperations: lease.allowedOperations,
      status: 'revoked',
      reason,
      auditCorrelationId: lease.auditCorrelationId,
      timestamp: nowIso,
    });
  }

  public evaluateLease(query: ApprovalLeaseQuery): ApprovalLeaseEvaluation {
    const leases = InMemoryApprovalLeaseStore.findLeaseForSubjectToolWorkspace(
      query.subjectId,
      query.toolQualifiedName,
      query.workspaceId
    );

    const nowIso = query.currentTime ? new Date(query.currentTime).toISOString() : new Date().toISOString();

    if (leases.length === 0) {
      this.auditSink.logApprovalLeaseEvent({
        eventType: 'lease_evaluated',
        leaseId: 'none',
        subjectId: query.subjectId,
        workspaceId: query.workspaceId,
        channelId: query.channelId,
        toolQualifiedName: query.toolQualifiedName,
        toolFingerprint: query.toolFingerprint,
        riskClassAtGrant: query.riskClass as any,
        allowedOperations: [],
        status: 'invalid',
        reason: 'missing lease',
        auditCorrelationId: 'none',
        timestamp: nowIso,
      });

      return { valid: false, reason: 'missing lease' };
    }

    let lastReason = 'no valid lease found';
    for (const lease of leases) {
      const evaluation = this.policy.evaluateLease(lease, query);
      if (evaluation.valid) {
        this.auditSink.logApprovalLeaseEvent({
          eventType: 'lease_evaluated',
          leaseId: lease.leaseId,
          subjectId: lease.subjectId,
          workspaceId: lease.workspaceId,
          channelId: lease.channelId,
          toolQualifiedName: lease.toolQualifiedName,
          toolFingerprint: lease.toolFingerprint,
          riskClassAtGrant: lease.riskClassAtGrant,
          allowedOperations: lease.allowedOperations,
          status: 'valid',
          reason: 'lease is valid',
          auditCorrelationId: lease.auditCorrelationId,
          timestamp: nowIso,
        });

        return { valid: true, reason: 'lease is valid', leaseId: lease.leaseId };
      }
      lastReason = evaluation.reason;
    }

    // If we evaluated leases but none were valid, log the failure
    const representativeLease = leases[leases.length - 1];
    this.auditSink.logApprovalLeaseEvent({
      eventType: 'lease_evaluated',
      leaseId: representativeLease.leaseId,
      subjectId: query.subjectId,
      workspaceId: query.workspaceId,
      channelId: query.channelId,
      toolQualifiedName: query.toolQualifiedName,
      toolFingerprint: query.toolFingerprint,
      riskClassAtGrant: query.riskClass as any,
      allowedOperations: [],
      status: 'invalid',
      reason: lastReason,
      auditCorrelationId: representativeLease.auditCorrelationId,
      timestamp: nowIso,
    });

    return { valid: false, reason: lastReason };
  }
}
