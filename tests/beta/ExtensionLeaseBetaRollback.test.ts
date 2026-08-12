/**
 * ExtensionLeaseBetaRollback.test.ts
 *
 * Beta rollback and disable requirements:
 *  - revoking lease disables repeated approval satisfaction
 *  - expired lease falls back to normal approval
 *  - withholding gate receipt disables lease satisfaction
 *  - descriptor drift disables existing lease satisfaction
 *  - process-local store can be cleared in test mode
 *  - no persisted lease state is used
 *  - normal approval path remains available
 */

import { ZavorthExtensionFacade } from '../../src/sdk/ZavorthExtensionFacade.js';
import { ServiceRegistry } from '../../src/bootstrap/ServiceRegistry.js';
import { ServiceTokens } from '../../src/bootstrap/ServiceTokens.js';
import { ApprovalLeaseDecisionAdapter } from '../../src/approval-leases/ApprovalLeaseDecisionAdapter.js';
import { ApprovalLeaseService } from '../../src/approval-leases/ApprovalLeaseService.js';
import { InMemoryApprovalLeaseStore } from '../../src/approval-leases/InMemoryApprovalLeaseStore.js';
import type { CustomToolDescriptor } from '../../src/sdk/CustomToolDescriptor.js';
import type { ApprovalLeaseGateReceipt } from '../../src/approval-leases/ApprovalLeaseIntegrationPolicy.js';
import type { ApprovalLeaseDecisionContext } from '../../src/approval-leases/ApprovalLeaseDecisionResult.js';

const NOW = '2026-06-15T12:00:00.000Z';
const CORR = 'corr-beta-rollback';

describe('ExtensionLeaseBetaRollback', () => {
  let leaseService: ApprovalLeaseService;
  let mockDecisionSink: any;
  let decisionEvents: any[];

  beforeEach(() => {
    ServiceRegistry.resetForTests();
    ZavorthExtensionFacade.resetForTests();
    InMemoryApprovalLeaseStore.clearForTests();

    ServiceRegistry.register(ServiceTokens.SecurityAuditLogger, { logMcpRuntimeEvent: jest.fn() });
    leaseService = new ApprovalLeaseService({ logApprovalLeaseEvent: jest.fn() });

    decisionEvents = [];
    mockDecisionSink = {
      logIntegrationEvent: (e: any) => { decisionEvents.push(e); },
    };
  });

  afterEach(() => {
    ServiceRegistry.resetForTests();
    ZavorthExtensionFacade.resetForTests();
    InMemoryApprovalLeaseStore.clearForTests();
  });

  function makeDescriptor(overrides?: Partial<CustomToolDescriptor>): CustomToolDescriptor {
    return {
      namespace: 'local',
      name: 'rollback_tool',
      description: 'A tool to test rollback.',
      inputSchema: { type: 'object', properties: {} },
      capabilities: ['filesystem'],
      riskClass: 'safe',
      handler: jest.fn().mockReturnValue('NOT_EXECUTED'),
      ...overrides,
    };
  }

  function validReceipt(fingerprint: string): ApprovalLeaseGateReceipt {
    return {
      channelWorkspaceExposureChecked: true,
      toolGatekeeperExecuted: true,
      riskClassResolved: 'safe',
      toolFingerprintVerified: fingerprint,
    };
  }

  function baseDecisionContext(
    qualifiedName: string,
    fingerprint: string,
    receipt?: ApprovalLeaseGateReceipt,
  ): ApprovalLeaseDecisionContext {
    return {
      subjectId: 'user-beta',
      workspaceId: 'ws-beta',
      toolQualifiedName: qualifiedName,
      toolFingerprint: fingerprint,
      riskClass: 'safe',
      requestedOperation: 'execute',
      auditCorrelationId: CORR,
      existingGateResult: receipt,
    };
  }

  test('revoking lease disables repeated approval satisfaction, falls back to normal approval path', () => {
    const descriptor = makeDescriptor();
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    const lease = leaseService.grantLease({
      subjectId: 'user-beta',
      workspaceId: 'ws-beta',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 60 * 60 * 1000,
      grantReason: 'rollback-lease',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    expect(adapter.evaluate(baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint))).status).toBe('lease_satisfied');

    // Rollback path 1: Revoke the lease
    leaseService.revokeLease(lease.leaseId, 'rollback-revocation', NOW);

    // Expect fall back to normal approval path (lease_rejected -> prompts user)
    const resultAfterRevoke = adapter.evaluate(baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)));
    expect(resultAfterRevoke.status).toBe('lease_rejected');
  });

  test('expired lease falls back to normal approval path', () => {
    const descriptor = makeDescriptor();
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    leaseService.grantLease({
      subjectId: 'user-beta',
      workspaceId: 'ws-beta',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 1000,
      grantReason: 'rollback-lease',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: '2026-06-15T11:59:00.000Z',
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)));

    // Falls back to normal approval path
    expect(result.status).toBe('lease_rejected');
  });

  test('withholding gate receipt disables lease satisfaction and fails closed', () => {
    const descriptor = makeDescriptor();
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    leaseService.grantLease({
      subjectId: 'user-beta',
      workspaceId: 'ws-beta',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 60 * 60 * 1000,
      grantReason: 'rollback-lease',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });

    // Withhold receipt -> fails closed
    const result = adapter.evaluate(baseDecisionContext(reg.qualifiedName, reg.fingerprint, undefined));
    expect(result.status).toBe('fail_closed');
  });

  test('descriptor drift disables existing lease satisfaction and falls back to normal approval', () => {
    const descriptor = makeDescriptor({ capabilities: ['filesystem'] });
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    leaseService.grantLease({
      subjectId: 'user-beta',
      workspaceId: 'ws-beta',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 60 * 60 * 1000,
      grantReason: 'rollback-lease',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    ZavorthExtensionFacade.resetForTests();
    // Drift the capabilities
    const driftedDescriptor = makeDescriptor({ capabilities: ['filesystem', 'network'] });
    const regDrifted = ZavorthExtensionFacade.registerCustomTool(driftedDescriptor);

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(baseDecisionContext(reg.qualifiedName, regDrifted.fingerprint, validReceipt(regDrifted.fingerprint)));

    // Falls back to normal approval path (lease_rejected)
    expect(result.status).toBe('lease_rejected');
  });

  test('process-local store can be cleared in test mode, removing all leases', () => {
    const descriptor = makeDescriptor();
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    const lease = leaseService.grantLease({
      subjectId: 'user-beta',
      workspaceId: 'ws-beta',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 60 * 60 * 1000,
      grantReason: 'rollback-lease',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    // Verify lease exists in store
    expect(InMemoryApprovalLeaseStore.getLease(lease.leaseId)).toBeDefined();

    // Rollback path 2: Clear the in-memory store
    InMemoryApprovalLeaseStore.clearForTests();

    // Verify all leases are cleared and normal approval is required
    expect(InMemoryApprovalLeaseStore.getLease(lease.leaseId)).toBeUndefined();
    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)));
    expect(result.status).toBe('requires_approval');
  });
});
