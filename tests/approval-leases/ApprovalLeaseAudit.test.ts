import { validateNoSecrets, type SafeApprovalLeaseAuditEvent } from '../../src/approval-leases/ApprovalLeaseAudit.js';

describe('ApprovalLeaseAudit Tests', () => {
  const safeEvent: SafeApprovalLeaseAuditEvent = {
    eventType: 'lease_granted',
    leaseId: 'lease-123',
    subjectId: 'user-alice',
    workspaceId: '/home/workspace/a',
    cchannelId: 'cli',
    toolQualifiedName: 'fs:read_file',
    toolFingerprint: 'hash-abc',
    riskClassAtGrant: 'low',
    allowedOperations: ['read'],
    status: 'granted',
    reason: 'safe reason',
    auditCorrelationId: 'correlation-123',
    timestamp: new Date().toISOString(),
  };

  test('audit includes safe fields and passes secrets scanner validation', () => {
    expect(() => validateNoSecrets(safeEvent)).not.toThrow();
  });

  test('audit rejects Authorization and Bearer patterns', () => {
    const badEvent: any = {
      ...safeEvent,
      reason: 'Bearer mytoken123',
    };
    expect(() => validateNoSecrets(badEvent)).toThrow(
      'Security Violation: Forbidden secret pattern detected in value.'
    );
  });

  test('audit rejects secretRef, rawKey, ciphertext, authTag key presence', () => {
    const badEvent1: any = {
      ...safeEvent,
      secretRef: 'something',
    };
    expect(() => validateNoSecrets(badEvent1)).toThrow(
      'Security Violation: Forbidden secret-bearing key "secretRef" detected.'
    );

    const badEvent2: any = {
      ...safeEvent,
      rawKey: 'something',
    };
    expect(() => validateNoSecrets(badEvent2)).toThrow(
      'Security Violation: Forbidden secret-bearing key "rawKey" detected.'
    );

    const badEvent3: any = {
      ...safeEvent,
      ciphertext: 'something',
    };
    expect(() => validateNoSecrets(badEvent3)).toThrow(
      'Security Violation: Forbidden secret-bearing key "ciphertext" detected.'
    );

    const badEvent4: any = {
      ...safeEvent,
      authTag: 'something',
    };
    expect(() => validateNoSecrets(badEvent4)).toThrow(
      'Security Violation: Forbidden secret-bearing key "authTag" detected.'
    );
  });

  test('audit rejects raw prompt / message body keys', () => {
    const badEvent: any = {
      ...safeEvent,
      prompt: 'tell me my api key',
    };
    expect(() => validateNoSecrets(badEvent)).toThrow(
      'Security Violation: Forbidden secret-bearing key "prompt" detected.'
    );
  });

  test('audit scanner recursively checks nested objects and arrays', () => {
    const nestedBadEvent: any = {
      ...safeEvent,
      allowedOperations: ['read', 'write'],
      nestedObj: {
        deeper: {
          dangerKey: 'value with Bearer token inside',
        },
      },
    };
    expect(() => validateNoSecrets(nestedBadEvent)).toThrow(
      'Security Violation: Forbidden secret pattern detected in value.'
    );
  });
});
