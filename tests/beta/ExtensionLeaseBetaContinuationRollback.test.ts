/**
 * ExtensionLeaseBetaContinuationRollback.test.ts
 *
 * Verifies the lease rollback and clearing capabilities.
 */

import { InMemoryApprovalLeaseStore } from '../../src/approval-leases/InMemoryApprovalLeaseStore.js';
import { ApprovalLeaseService } from '../../src/approval-leases/ApprovalLeaseService.js';
import { ApprovalLeaseDecisionAdapter } from '../../src/approval-leases/ApprovalLeaseDecisionAdapter.js';
import { ZavorthExtensionFacade } from '../../src/sdk/ZavorthExtensionFacade.js';

describe('ExtensionLeaseBetaContinuationRollback', () => {
  let leaseService: ApprovalLeaseService;
  let mockLeaseAuditSink: any;
  let mockDecisionSink: any;

  beforeEach(() => {
    InMemoryApprovalLeaseStore.clearForTests();
    ZavorthExtensionFacade.resetForTests();

    mockLeaseAuditSink = { logApprovalLeaseEvent: jest.fn() };
    leaseService = new ApprovalLeaseService(mockLeaseAuditSink);
    mockDecisionSink = { logIntegrationEvent: jest.fn() };
  });

  afterEach(() => {
    InMemoryApprovalLeaseStore.clearForTests();
    ZavorthExtensionFacade.resetForTests();
  });

  test('rollback/clear capability removes all state and normal fallback works', async () => {
    // 1. Grant a lease
    await leaseService.grantLease({
      subjectId: 'user-beta',
      workspaceId: 'ws-beta',
      toolQualifiedName: 'local:echo',
      toolFingerprint: 'hash-value',
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 60 * 60 * 1000,
      grantReason: 'beta-lease',
      grantSource: 'test_only',
      auditCorrelationId: 'corr-rollback',
      currentTime: '2026-06-15T12:00:00.000Z',
    });

    // Check it exists
    let leases = InMemoryApprovalLeaseStore.findLeaseForSubjectToolWorkspace('user-beta', 'local:echo', 'ws-beta');
    expect(leases.filter(l => !l.revokedAt).length).toBe(1);

    // 2. Clear store (rollback/disable)
    InMemoryApprovalLeaseStore.clearForTests();

    // Verify it is gone
    leases = InMemoryApprovalLeaseStore.findLeaseForSubjectToolWorkspace('user-beta', 'local:echo', 'ws-beta');
    expect(leases.filter(l => !l.revokedAt).length).toBe(0);

    // 3. Normal approval fallback remains available
    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date('2026-06-15T12:00:00.000Z') });
    const result = adapter.evaluate({
      subjectId: 'user-beta',
      workspaceId: 'ws-beta',
      toolQualifiedName: 'local:echo',
      toolFingerprint: 'hash-value',
      riskClass: 'safe',
      requestedOperation: 'execute',
      auditCorrelationId: 'corr-rollback',
      existingGateResult: {
        cchannelWorkspaceExposureChecked: true,
        toolGatekeeperExecuted: true,
        riskClassResolved: 'safe',
        toolFingerprintVerified: 'hash-value',
      }
    });

    // No lease exists, should fallback to requires_approval
    expect(result.status).toBe('requires_approval');
  });
});
