export type SafeApprovalLeaseAuditEvent = {
  eventType: 'lease_granted' | 'lease_revoked' | 'lease_evaluated';
  leaseId: string;
  subjectId: string;
  workspaceId: string;
  channelId?: string;
  toolQualifiedName: string;
  toolFingerprint: string;
  riskClassAtGrant: 'safe' | 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  allowedOperations: string[];
  status: 'valid' | 'invalid' | 'revoked' | 'expired' | 'granted';
  reason: string;
  auditCorrelationId: string;
  timestamp: string;
};

export interface ApprovalLeaseAuditSink {
  logApprovalLeaseEvent(event: SafeApprovalLeaseAuditEvent): void | Promise<void>;
}

const FORBIDDEN_KEYS = [
  'messagebody',
  'prompt',
  'env',
  'envvalue',
  'toolargs',
  'schema',
  'parameters',
  'apikey',
  'rawkey',
  'ciphertext',
  'authtag',
  'secretref',
  'authorization',
  'bearer',
  'credential',
  'token',
  'privatekey'
];

const FORBIDDEN_PATTERNS = [
  /bearer\s+/i,
  /authorization/i,
  /secretref/i,
  /rawkey/i,
  /ciphertext/i,
  /authtag/i,
  /begin\s+private\s+key/i,
  /openai_api_key/i,
  /anthropic_api_key/i,
  /google_api_key/i
];

export function validateNoSecrets(payload: Record<string, unknown>): void {
  const checkValue = (val: unknown): void => {
    if (typeof val === 'string') {
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(val)) {
          throw new Error(`Security Violation: Forbidden secret pattern detected in value.`);
        }
      }
    } else if (Array.isArray(val)) {
      for (const item of val) {
        checkValue(item);
      }
    } else if (val && typeof val === 'object') {
      validateNoSecrets(val as Record<string, unknown>);
    }
  };

  for (const [key, value] of Object.entries(payload)) {
    const cleanKey = key.toLowerCase();
    for (const forbidden of FORBIDDEN_KEYS) {
      if (cleanKey.includes(forbidden)) {
        throw new Error(`Security Violation: Forbidden secret-bearing key "${key}" detected.`);
      }
    }
    checkValue(value);
  }
}
