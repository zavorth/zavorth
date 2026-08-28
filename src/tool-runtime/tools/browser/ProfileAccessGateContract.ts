export interface ProfileAccessGateInput {
  sessionId: string;
  allowedDomains: string[];
  approvalId?: string | null;
}

export interface ProfileAccessGateResult {
  allowed: boolean;
  reason?: string | null;
  approvalRequired?: boolean;
  approvalId?: string | null;
}

export interface ProfileAccessGate {
  requestProfileAccess(input: ProfileAccessGateInput): Promise<ProfileAccessGateResult>;
}
