import { InMemoryApprovalLeaseStore } from '../../src/approval-leases/InMemoryApprovalLeaseStore.js';
import type { ApprovalLease } from '../../src/approval-leases/ApprovalLeaseTypes.js';

describe('InMemoryApprovalLeaseStore Tests', () => {
  const mockLease: ApprovalLease = {
    leaseId: 'lease-test-1',
    subjectId: 'user-alice',
    workspaceId: '/home/workspace/a',
    cchannelId: 'cli',
    toolQualifiedName: 'fs:read_file',
    toolFingerprint: 'hash-abc',
    riskClassAtGrant: 'low',
    allowedOperations: ['read'],
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    grantReason: 'for test',
    grantSource: 'test_only',
    auditCorrelationId: 'correlation-123',
  };

  beforeEach(() => {
    InMemoryApprovalLeaseStore.clearForTests();
  });

  test('create and get lease', () => {
    InMemoryApprovalLeaseStore.createLease(mockLease);
    const retrieved = InMemoryApprovalLeaseStore.getLease('lease-test-1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.subjectId).toBe('user-alice');
  });

  test('revoke lease', () => {
    InMemoryApprovalLeaseStore.createLease(mockLease);
    const revokedTime = new Date().toISOString();
    InMemoryApprovalLeaseStore.revokeLease('lease-test-1', revokedTime);

    const retrieved = InMemoryApprovalLeaseStore.getLease('lease-test-1');
    expect(retrieved?.revokedAt).toBe(revokedTime);
  });

  test('findLeaseForSubjectToolWorkspace matching behavior', () => {
    InMemoryApprovalLeaseStore.createLease(mockLease);

    // Exact match
    const found = InMemoryApprovalLeaseStore.findLeaseForSubjectToolWorkspace(
      'user-alice',
      'fs:read_file',
      '/home/workspace/a'
    );
    expect(found.length).toBe(1);
    expect(found[0].leaseId).toBe('lease-test-1');

    // Mismatched subject ID does not leak
    const badSubject = InMemoryApprovalLeaseStore.findLeaseForSubjectToolWorkspace(
      'user-bob',
      'fs:read_file',
      '/home/workspace/a'
    );
    expect(badSubject.length).toBe(0);

    // Mismatched workspace ID does not leak
    const badWorkspace = InMemoryApprovalLeaseStore.findLeaseForSubjectToolWorkspace(
      'user-alice',
      'fs:read_file',
      '/home/workspace/b'
    );
    expect(badWorkspace.length).toBe(0);

    // Mismatched tool qualified name does not leak
    const badTool = InMemoryApprovalLeaseStore.findLeaseForSubjectToolWorkspace(
      'user-alice',
      'fs:write_file',
      '/home/workspace/a'
    );
    expect(badTool.length).toBe(0);
  });

  test('clearForTests throws error outside test mode', () => {
    const oldEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      expect(() => InMemoryApprovalLeaseStore.clearForTests()).toThrow(
        'clearForTests is only allowed in test environment'
      );
    } finally {
      process.env.NODE_ENV = oldEnv;
    }
  });
});
