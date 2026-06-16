import { ApprovalLeasePolicy, type ApprovalLeaseQuery } from '../../src/approval-leases/ApprovalLeasePolicy.js';
import type { ApprovalLease } from '../../src/approval-leases/ApprovalLeaseTypes.js';

describe('ApprovalLeasePolicy Tests', () => {
  const baseLease: ApprovalLease = {
    leaseId: 'lease-test-1',
    subjectId: 'user-alice',
    workspaceId: '/home/workspace/a',
    channelId: 'cli',
    toolQualifiedName: 'fs:read_file',
    toolFingerprint: 'hash-abc',
    riskClassAtGrant: 'low',
    allowedOperations: ['read'],
    createdAt: '2026-06-15T10:00:00.000Z',
    expiresAt: '2026-06-15T12:00:00.000Z', // 2 hours duration
    grantReason: 'for test',
    grantSource: 'test_only',
    auditCorrelationId: 'correlation-123',
  };

  const baseQuery: ApprovalLeaseQuery = {
    subjectId: 'user-alice',
    workspaceId: '/home/workspace/a',
    channelId: 'cli',
    toolQualifiedName: 'fs:read_file',
    toolFingerprint: 'hash-abc',
    riskClass: 'low',
    operation: 'read',
    currentTime: '2026-06-15T11:00:00.000Z',
  };

  test('valid scoped lease passes', () => {
    const policy = new ApprovalLeasePolicy();
    const result = policy.evaluateLease(baseLease, baseQuery);
    expect(result.valid).toBe(true);
  });

  test('expired lease fails closed', () => {
    const policy = new ApprovalLeasePolicy();
    const expiredQuery = { ...baseQuery, currentTime: '2026-06-15T12:00:00.000Z' };
    const result = policy.evaluateLease(baseLease, expiredQuery);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expired lease');
  });

  test('revoked lease fails closed', () => {
    const policy = new ApprovalLeasePolicy();
    const revokedLease = { ...baseLease, revokedAt: '2026-06-15T10:30:00.000Z' };
    const result = policy.evaluateLease(revokedLease, baseQuery);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('revoked lease');
  });

  test('fingerprint drift fails closed', () => {
    const policy = new ApprovalLeasePolicy();
    const driftedQuery = { ...baseQuery, toolFingerprint: 'hash-drifted' };
    const result = policy.evaluateLease(baseLease, driftedQuery);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('fingerprint drift');
  });

  test('risk class change fails closed', () => {
    const policy = new ApprovalLeasePolicy();
    const changedQuery = { ...baseQuery, riskClass: 'medium' };
    const result = policy.evaluateLease(baseLease, changedQuery);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('risk class change');
  });

  test('workspace mismatch fails closed', () => {
    const policy = new ApprovalLeasePolicy();
    const badWorkspaceQuery = { ...baseQuery, workspaceId: '/home/workspace/b' };
    const result = policy.evaluateLease(baseLease, badWorkspaceQuery);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('workspace mismatch');
  });

  test('subject mismatch fails closed', () => {
    const policy = new ApprovalLeasePolicy();
    const badSubjectQuery = { ...baseQuery, subjectId: 'user-bob' };
    const result = policy.evaluateLease(baseLease, badSubjectQuery);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('subject mismatch');
  });

  test('channel mismatch fails closed when channel scoped', () => {
    const policy = new ApprovalLeasePolicy();
    const badChannelQuery = { ...baseQuery, channelId: 'telegram' };
    const result = policy.evaluateLease(baseLease, badChannelQuery);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('channel mismatch');
  });

  test('operation mismatch fails closed', () => {
    const policy = new ApprovalLeasePolicy();
    const badOpQuery = { ...baseQuery, operation: 'write' };
    const result = policy.evaluateLease(baseLease, badOpQuery);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('operation mismatch');
  });

  test('invalid time / clock skew fails closed', () => {
    const policy = new ApprovalLeasePolicy();

    // Clock skew: now is earlier than createdAt
    const skewQuery = { ...baseQuery, currentTime: '2026-06-15T09:00:00.000Z' };
    const resultSkew = policy.evaluateLease(baseLease, skewQuery);
    expect(resultSkew.valid).toBe(false);
    expect(resultSkew.reason).toBe('clock skew/invalid time encountered');

    // Invalid timestamp string
    const badTimeQuery = { ...baseQuery, currentTime: 'not-a-date' };
    const resultBad = policy.evaluateLease(baseLease, badTimeQuery);
    expect(resultBad.valid).toBe(false);
    expect(resultBad.reason).toBe('invalid time encountered');
  });

  test('critical risk rejected', () => {
    const policy = new ApprovalLeasePolicy();
    const criticalLease = { ...baseLease, riskClassAtGrant: 'critical' as const };
    const criticalQuery = { ...baseQuery, riskClass: 'critical' };
    const result = policy.evaluateLease(criticalLease, criticalQuery);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('critical risk rejected');
  });

  test('unknown risk rejected', () => {
    const policy = new ApprovalLeasePolicy();
    const unknownLease = { ...baseLease, riskClassAtGrant: 'unknown' as const };
    const unknownQuery = { ...baseQuery, riskClass: 'unknown' };
    const result = policy.evaluateLease(unknownLease, unknownQuery);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('unknown risk rejected');
  });

  test('safe/low TTL cap enforced', () => {
    const policy = new ApprovalLeasePolicy();
    // 25 hours is > 24 hours cap
    const longLease = {
      ...baseLease,
      createdAt: '2026-06-15T10:00:00.000Z',
      expiresAt: '2026-06-16T11:00:00.000Z',
    };
    const result = policy.evaluateLease(longLease, baseQuery);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('safe/low TTL cap exceeded');
  });

  test('medium TTL cap enforced', () => {
    const policy = new ApprovalLeasePolicy();
    // 3 hours is > 2 hours cap
    const mediumLease = {
      ...baseLease,
      riskClassAtGrant: 'medium' as const,
      createdAt: '2026-06-15T10:00:00.000Z',
      expiresAt: '2026-06-15T13:00:00.000Z',
    };
    const mediumQuery = { ...baseQuery, riskClass: 'medium' };
    const result = policy.evaluateLease(mediumLease, mediumQuery);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('medium TTL cap exceeded');
  });

  test('high risk disabled by default', () => {
    const policy = new ApprovalLeasePolicy();
    const highLease = {
      ...baseLease,
      riskClassAtGrant: 'high' as const,
      expiresAt: '2026-06-15T10:10:00.000Z', // 10 minutes
    };
    const highQuery = { ...baseQuery, riskClass: 'high' };
    const result = policy.evaluateLease(highLease, highQuery);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('high risk disabled by default');
  });

  test('high risk requires explicit policy config and TTL check', () => {
    // Explicitly allowed
    const policyAllowed = new ApprovalLeasePolicy({ highRiskAllowed: true });
    const highLeaseOk = {
      ...baseLease,
      riskClassAtGrant: 'high' as const,
      expiresAt: '2026-06-15T10:10:00.000Z', // 10m
    };
    const highQuery = { ...baseQuery, riskClass: 'high', currentTime: '2026-06-15T10:05:00.000Z' };
    const resultOk = policyAllowed.evaluateLease(highLeaseOk, highQuery);
    expect(resultOk.valid).toBe(true);

    // TTL check (16 minutes exceeds 15 minutes cap)
    const highLeaseTooLong = {
      ...baseLease,
      riskClassAtGrant: 'high' as const,
      expiresAt: '2026-06-15T10:16:00.000Z',
    };
    const resultTooLong = policyAllowed.evaluateLease(highLeaseTooLong, highQuery);
    expect(resultTooLong.valid).toBe(false);
    expect(resultTooLong.reason).toBe('high TTL cap exceeded');
  });

});
