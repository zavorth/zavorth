import type { ApprovalLease } from './ApprovalLeaseTypes.js';

export type ApprovalLeaseQuery = {
  subjectId: string;
  workspaceId: string;
  channelId?: string;
  toolQualifiedName: string;
  toolFingerprint: string;
  riskClass: 'safe' | 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  operation: string;
  currentTime?: string;
};

export type ApprovalLeasePolicyConfig = {
  highRiskAllowed?: boolean;
};

export class ApprovalLeasePolicy {
  private readonly highRiskAllowed: boolean;

  constructor(config?: ApprovalLeasePolicyConfig) {
    this.highRiskAllowed = config?.highRiskAllowed ?? false;
  }

  public evaluateLease(lease: ApprovalLease, query: ApprovalLeaseQuery): { valid: boolean; reason: string } {
    // 1. Audit Correlation Check
    if (!lease.auditCorrelationId || lease.auditCorrelationId.trim() === '') {
      return { valid: false, reason: 'missing audit correlation id' };
    }

    // 2. Risk Classification Eligibility
    const currentRisk = query.riskClass;
    if (currentRisk === 'critical' || lease.riskClassAtGrant === 'critical') {
      return { valid: false, reason: 'critical risk rejected' };
    }
    if (currentRisk === 'unknown' || lease.riskClassAtGrant === 'unknown') {
      return { valid: false, reason: 'unknown risk rejected' };
    }

    // 3. High Risk Policy Flag
    if ((currentRisk === 'high' || lease.riskClassAtGrant === 'high') && !this.highRiskAllowed) {
      return { valid: false, reason: 'high risk disabled by default' };
    }

    // 4. Time Checks
    const nowTime = query.currentTime ? new Date(query.currentTime).getTime() : Date.now();
    const createdTime = new Date(lease.createdAt).getTime();
    const expiresTime = new Date(lease.expiresAt).getTime();

    if (isNaN(nowTime) || isNaN(createdTime) || isNaN(expiresTime)) {
      return { valid: false, reason: 'invalid time encountered' };
    }

    // Suspicious clock skew checks
    if (nowTime < createdTime) {
      return { valid: false, reason: 'clock skew/invalid time encountered' };
    }

    if (createdTime >= expiresTime) {
      return { valid: false, reason: 'invalid lease duration config' };
    }

    // Expiration check
    if (nowTime >= expiresTime) {
      return { valid: false, reason: 'expired lease' };
    }

    // 5. Revocation Check
    if (lease.revokedAt) {
      return { valid: false, reason: 'revoked lease' };
    }

    // 6. Identity & Scope Matching
    if (lease.subjectId !== query.subjectId) {
      return { valid: false, reason: 'subject mismatch' };
    }

    if (lease.workspaceId !== query.workspaceId) {
      return { valid: false, reason: 'workspace mismatch' };
    }

    if (lease.toolQualifiedName !== query.toolQualifiedName) {
      return { valid: false, reason: 'tool mismatch' };
    }

    // 7. Fingerprint / Drift Verification
    if (lease.toolFingerprint !== query.toolFingerprint) {
      return { valid: false, reason: 'fingerprint drift' };
    }

    // 8. Risk Level Change Check
    if (lease.riskClassAtGrant !== currentRisk) {
      return { valid: false, reason: 'risk class change' };
    }

    // 9. Channel Scope Verification
    if (lease.channelId && lease.channelId !== query.channelId) {
      return { valid: false, reason: 'channel mismatch' };
    }

    // 10. Operation Verification
    if (!lease.allowedOperations.includes(query.operation)) {
      return { valid: false, reason: 'operation mismatch' };
    }

    // 11. TTL Cap Verification
    const durationMs = expiresTime - createdTime;
    const maxSafeLowMs = 24 * 60 * 60 * 1000;
    const maxMediumMs = 2 * 60 * 60 * 1000;
    const maxHighMs = 15 * 60 * 1000;

    if (lease.riskClassAtGrant === 'safe' || lease.riskClassAtGrant === 'low') {
      if (durationMs > maxSafeLowMs) {
        return { valid: false, reason: 'safe/low TTL cap exceeded' };
      }
    } else if (lease.riskClassAtGrant === 'medium') {
      if (durationMs > maxMediumMs) {
        return { valid: false, reason: 'medium TTL cap exceeded' };
      }
    } else if (lease.riskClassAtGrant === 'high') {
      if (durationMs > maxHighMs) {
        return { valid: false, reason: 'high TTL cap exceeded' };
      }
    }

    return { valid: true, reason: 'lease is valid' };
  }
}
