/**
 * ExtensionLeaseInternalTesterFlow.test.ts
 *
 * Internal tester execution requirements:
 *  - safe local extension fixture can be registered
 *  - extension remains pending/unapproved
 *  - fingerprint is stable
 *  - safe/low scoped lease can be granted
 *  - complete gate receipt is required
 *  - lease_satisfied occurs only after complete gate receipt
 *  - lease can be revoked
 *  - revoked lease falls back to normal approval
 *  - descriptor drift falls back to normal approval
 *  - handler is not executed during registration/evaluation
 *  - result language does not imply execute/approved/bypass/trusted/autoApprove
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
const CORR = 'corr-tester-flow';

describe('ExtensionLeaseInternalTesterFlow', () => {
  let mockAuditLogger: any;
  let mockLeaseAuditSink: any;
  let leaseService: ApprovalLeaseService;
  let mockDecisionSink: any;
  let decisionEvents: any[];

  beforeEach(() => {
    ServiceRegistry.resetForTests();
    ZavorthExtensionFacade.resetForTests();
    InMemoryApprovalLeaseStore.clearForTests();

    mockAuditLogger = { logMcpRuntimeEvent: jest.fn() };
    ServiceRegistry.register(ServiceTokens.SecurityAuditLogger, mockAuditLogger);

    mockLeaseAuditSink = { logApprovalLeaseEvent: jest.fn() };
    leaseService = new ApprovalLeaseService(mockLeaseAuditSink);

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
      name: 'tester_echo',
      description: 'Safe local tester echo fixture.',
      inputSchema: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
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
      subjectId: 'user-tester',
      workspaceId: 'ws-tester',
      toolQualifiedName: qualifiedName,
      toolFingerprint: fingerprint,
      riskClass: 'safe',
      requestedOperation: 'execute',
      auditCorrelationId: CORR,
      existingGateResult: receipt,
    };
  }

  test('tester registers safe local extension fixture pending/unapproved', () => {
    const descriptor = makeDescriptor();
    const result = ZavorthExtensionFacade.registerCustomTool(descriptor);

    expect(result.qualifiedName).toBe('local:tester_echo');
    expect(result.status).toBe('registered_unapproved');
    expect(descriptor.handler).not.toHaveBeenCalled();
  });

  test('stable fingerprint is generated and remains stable', () => {
    const descriptor = makeDescriptor({ name: 'tester_stable' });
    const r1 = ZavorthExtensionFacade.registerCustomTool(descriptor);

    ZavorthExtensionFacade.resetForTests();
    const r2 = ZavorthExtensionFacade.registerCustomTool(descriptor);

    expect(r1.fingerprint).toBe(r2.fingerprint);
  });

  test('grant, evaluate, and revoke scoped safe/low lease flow works', () => {
    const descriptor = makeDescriptor({ name: 'tester_scoped' });
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    const lease = leaseService.grantLease({
      subjectId: 'user-tester',
      workspaceId: 'ws-tester',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 60 * 60 * 1000,
      grantReason: 'tester-execution',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    expect(lease.leaseId).toBeDefined();

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });

    // Evaluate without receipt -> fails closed
    const resNoReceipt = adapter.evaluate(baseDecisionContext(reg.qualifiedName, reg.fingerprint, undefined));
    expect(resNoReceipt.status).toBe('fail_closed');

    // Evaluate with receipt -> lease_satisfied
    const result = adapter.evaluate(baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)));
    expect(result.status).toBe('lease_satisfied');
    expect(result.status).not.toBe('execute');
    expect(result.status).not.toBe('approved');
    expect(result.status).not.toBe('bypass');
    expect(result.status).not.toBe('trusted');
    expect(result.status).not.toBe('autoApprove');

    expect(descriptor.handler).not.toHaveBeenCalled();

    // Revoke
    leaseService.revokeLease(lease.leaseId, 'tester-revocation', NOW);

    // After revoke, evaluate returns lease_rejected (requires normal approval path)
    const resultAfterRevoke = adapter.evaluate(baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)));
    expect(resultAfterRevoke.status).toBe('lease_rejected');
    expect(descriptor.handler).not.toHaveBeenCalled();
  });

  test('descriptor drift invalidates prior lease and requires normal approval', () => {
    const descriptor = makeDescriptor({ name: 'tester_drift_tool', capabilities: ['filesystem'] });
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    leaseService.grantLease({
      subjectId: 'user-tester',
      workspaceId: 'ws-tester',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 60 * 60 * 1000,
      grantReason: 'tester-execution',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    ZavorthExtensionFacade.resetForTests();
    const driftedDescriptor = makeDescriptor({ name: 'tester_drift_tool', capabilities: ['filesystem', 'network'] });
    const regDrifted = ZavorthExtensionFacade.registerCustomTool(driftedDescriptor);

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(baseDecisionContext(reg.qualifiedName, regDrifted.fingerprint, validReceipt(regDrifted.fingerprint)));

    // Fingerprint changed -> lease_rejected (requires normal approval path)
    expect(result.status).toBe('lease_rejected');
  });
});
