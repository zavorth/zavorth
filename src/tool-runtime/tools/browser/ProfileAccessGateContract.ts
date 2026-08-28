export interface ProfileAccessGateInput {
  sessionId: string;
  allowedDomains: string[];
}

export interface ProfileAccessGateResult {
  allowed: boolean;
  reason?: string | null;
}

export interface ProfileAccessGate {
  requestProfileAccess(input: ProfileAccessGateInput): Promise<ProfileAccessGateResult>;
}
