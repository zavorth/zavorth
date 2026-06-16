export type ApprovalLeaseRiskClass = "safe" | "low" | "medium" | "high" | "critical" | "unknown";

export type ApprovalLease = {
  leaseId: string;
  subjectId: string;
  workspaceId: string;
  channelId?: string;
  toolQualifiedName: string;
  toolFingerprint: string;
  riskClassAtGrant: ApprovalLeaseRiskClass;
  allowedOperations: string[];
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  grantReason: string;
  grantSource: "user_confirmed" | "admin_confirmed" | "test_only";
  auditCorrelationId: string;
};
