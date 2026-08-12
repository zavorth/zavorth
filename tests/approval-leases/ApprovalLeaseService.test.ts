import { ApprovalLeaseService } from '../../src/approval-leases/ApprovalLeaseService.js';
import { InMemoryApprovalLeaseStore } from '../../src/approval-leases/InMemoryApprovalLeaseStore.js';
import type { ApprovalLeaseAuditSink, SafeApprovalLeaseAuditEvent } from '../../src/approval-leases/ApprovalLeaseAudit.js';

class MockAuditSink implements ApprovalLeaseAuditSink {
  public readonly loggedEvents: SafeApprovalLeaseAuditEvent[] = [];
  public logApprovalLeaseEvent(event: SafeApprovalLeaseAuditEvent): void {
    this.loggedEvents.push(event);
  }
}

describe('ApprovalLeaseService Tests', () => {
  let mockAudit: MockAuditSink;
  let service: ApprovalLeaseService;

  beforeEach(() => {
    mockAudit = new MockAuditSink();
    service = new ApprovalLeaseService(mockAudit);
    InMemoryApprovalLeaseStore.clearForTests();
  });

  test('grant lease enforces TTL caps and stores lease and logs event', () => {
    const lease = service.grantLease({
      subjectId: 'user-alice',
      workspaceId: '/home/workspace/a',
      toolQualifiedName: 'fs:read_file',
      toolFingerprint: 'hash-abc',
      riskClass: 'low',
      allowedOperations: ['read'],
      durationMs: 3600000, // 1 hour
      grantReason: 'testing grant',
      grantSource: 'test_only',
      auditCorrelationId: 'correlation-123',
    });

    expect(lease).toBeDefined();
    expect(lease.leaseId).toBeDefined();

    // Verify stored
    const retrieved = InMemoryApprovalLeaseStore.getLease(lease.leaseId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.subjectId).toBe('user-alice');

    // Verify audit
    expect(mockAudit.loggedEvents.length).toBe(1);
    expect(mockAudit.loggedEvents[0].eventType).toBe('lease_granted');
    expect(mockAudit.loggedEvents[0].leaseId).toBe(lease.leaseId);
  });

  test('grant rejects critical risk', () => {
    expect(() => {
      service.grantLease({
        subjectId: 'user-alice',
        workspaceId: '/home/workspace/a',
        toolQualifiedName: 'fs:read_file',
        toolFingerprint: 'hash-abc',
        riskClass: 'critical',
        allowedOperations: ['read'],
        durationMs: 60000,
        grantReason: 'testing critical',
        grantSource: 'test_only',
        auditCorrelationId: 'correlation-123',
      });
    }).toThrow('Lease activation is prohibited for "critical" risk class.');
  });

  test('grant rejects unknown risk', () => {
    expect(() => {
      service.grantLease({
        subjectId: 'user-alice',
        workspaceId: '/home/workspace/a',
        toolQualifiedName: 'fs:read_file',
        toolFingerprint: 'hash-abc',
        riskClass: 'unknown',
        allowedOperations: ['read'],
        durationMs: 60000,
        grantReason: 'testing unknown',
        grantSource: 'test_only',
        auditCorrelationId: 'correlation-123',
      });
    }).toThrow('Lease activation is prohibited for "unknown" risk class.');
  });

  test('grant rejects forbidden secret-bearing fields', () => {
    expect(() => {
      service.grantLease({
        subjectId: 'user-alice',
        workspaceId: '/home/workspace/a',
        toolQualifiedName: 'fs:read_file',
        toolFingerprint: 'hash-abc',
        riskClass: 'low',
        allowedOperations: ['read'],
        durationMs: 60000,
        grantReason: 'testing',
        grantSource: 'test_only',
        auditCorrelationId: 'correlation-123',
        // Injected secretRef key
        secretRef: 'my-secret-id',
      } as any);
    }).toThrow('Security Violation: Forbidden secret-bearing key "secretRef" detected.');


    expect(() => {
      service.grantLease({
        subjectId: 'user-alice',
        workspaceId: '/home/workspace/a',
        toolQualifiedName: 'fs:read_file',
        toolFingerprint: 'hash-abc',
        riskClass: 'low',
        allowedOperations: ['read'],
        durationMs: 60000,
        grantReason: 'testing Bearer token value',
        grantSource: 'test_only',
        auditCorrelationId: 'correlation-123',
        channelId: 'Bearer token-123',
      });
    }).toThrow('Security Violation: Forbidden secret pattern detected in value.');
  });

  test('grant enforces low TTL cap', () => {
    expect(() => {
      service.grantLease({
        subjectId: 'user-alice',
        workspaceId: '/home/workspace/a',
        toolQualifiedName: 'fs:read_file',
        toolFingerprint: 'hash-abc',
        riskClass: 'low',
        allowedOperations: ['read'],
        durationMs: 25 * 60 * 60 * 1000, // 25 hours
        grantReason: 'too long',
        grantSource: 'test_only',
        auditCorrelationId: 'correlation-123',
      });
    }).toThrow('Requested duration exceeds the maximum 24h cap for safe/low risk leases.');
  });

  test('grant enforces medium TTL cap', () => {
    expect(() => {
      service.grantLease({
        subjectId: 'user-alice',
        workspaceId: '/home/workspace/a',
        toolQualifiedName: 'fs:read_file',
        toolFingerprint: 'hash-abc',
        riskClass: 'medium',
        allowedOperations: ['read'],
        durationMs: 3 * 60 * 60 * 1000, // 3 hours
        grantReason: 'too long',
        grantSource: 'test_only',
        auditCorrelationId: 'correlation-123',
      });
    }).toThrow('Requested duration exceeds the maximum 2h cap for medium risk leases.');
  });

  test('revoke lease logs audit event and invalidates evaluations', () => {
    const lease = service.grantLease({
      subjectId: 'user-alice',
      workspaceId: '/home/workspace/a',
      toolQualifiedName: 'fs:read_file',
      toolFingerprint: 'hash-abc',
      riskClass: 'low',
      allowedOperations: ['read'],
      durationMs: 60000,
      grantReason: 'to be revoked',
      grantSource: 'test_only',
      auditCorrelationId: 'correlation-123',
    });

    service.revokeLease(lease.leaseId, 'manual revocation');

    const retrieved = InMemoryApprovalLeaseStore.getLease(lease.leaseId);
    expect(retrieved?.revokedAt).toBeDefined();

    expect(mockAudit.loggedEvents.length).toBe(2);
    expect(mockAudit.loggedEvents[1].eventType).toBe('lease_revoked');
    expect(mockAudit.loggedEvents[1].reason).toBe('manual revocation');

    // Evaluation should now return invalid
    const evalResult = service.evaluateLease({
      subjectId: 'user-alice',
      workspaceId: '/home/workspace/a',
      toolQualifiedName: 'fs:read_file',
      toolFingerprint: 'hash-abc',
      riskClass: 'low',
      operation: 'read',
    });
    expect(evalResult.valid).toBe(false);
    expect(evalResult.reason).toBe('revoked lease');
  });

  test('evaluate returns advisory result only', () => {
    service.grantLease({
      subjectId: 'user-alice',
      workspaceId: '/home/workspace/a',
      toolQualifiedName: 'fs:read_file',
      toolFingerprint: 'hash-abc',
      riskClass: 'low',
      allowedOperations: ['read'],
      durationMs: 60000,
      grantReason: 'testing eval',
      grantSource: 'test_only',
      auditCorrelationId: 'correlation-123',
    });

    const result = service.evaluateLease({
      subjectId: 'user-alice',
      workspaceId: '/home/workspace/a',
      toolQualifiedName: 'fs:read_file',
      toolFingerprint: 'hash-abc',
      riskClass: 'low',
      operation: 'read',
    });

    // Verify advisory type shape (no execution capability or automatic override)
    expect(result).toEqual(
      expect.objectContaining({
        valid: true,
        reason: 'lease is valid',
        leaseId: expect.any(String),
      })
    );
  });
});
