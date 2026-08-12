/**
 * ExtensionLeaseBetaRollout.test.ts
 *
 * Controlled beta rollout requirements:
 *  - safe local extension fixture registers pending/unapproved
 *  - fingerprint is stable
 *  - safe/low scoped lease can be granted
 *  - complete gate receipt is required
 *  - lease_satisfied occurs only after complete gate receipt
 *  - handler is not executed during registration
 *  - handler is not executed during lease evaluation
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
const CORR = 'corr-beta-rollout';

describe('ExtensionLeaseBetaRollout', () => {
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
      name: 'echo',
      description: 'A safe local echo tool for beta rollout tests.',
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

  test('safe local extension fixture registers pending/unapproved', () => {
    const descriptor = makeDescriptor();
    const result = ZavorthExtensionFacade.registerCustomTool(descriptor);

    expect(result.qualifiedName).toBe('local:echo');
    expect(result.status).toBe('registered_unapproved');
    expect(descriptor.handler).not.toHaveBeenCalled();
  });

  test('fingerprint is stable across re-registrations', () => {
    const descriptor = makeDescriptor({ name: 'stable_tool' });
    const r1 = ZavorthExtensionFacade.registerCustomTool(descriptor);

    ZavorthExtensionFacade.resetForTests();
    const r2 = ZavorthExtensionFacade.registerCustomTool(descriptor);

    expect(r1.fingerprint).toBe(r2.fingerprint);
  });

  test('safe/low scoped lease can be granted and evaluated successfully', () => {
    const descriptor = makeDescriptor({ name: 'low_risk_tool' });
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    const lease = leaseService.grantLease({
      subjectId: 'user-beta',
      workspaceId: 'ws-beta',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 60 * 60 * 1000,
      grantReason: 'rollout-lease',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    expect(lease.leaseId).toBeDefined();

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)),
    );

    expect(result.status).toBe('lease_satisfied');
    expect(result.status).not.toBe('execute');
    expect(result.status).not.toBe('approved');
    expect(result.status).not.toBe('bypass');
    expect(result.status).not.toBe('trusted');
    expect(descriptor.handler).not.toHaveBeenCalled();
  });

  test('complete gate receipt is required for lease satisfaction', () => {
    const descriptor = makeDescriptor({ name: 'gate_receipt_tool' });
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    leaseService.grantLease({
      subjectId: 'user-beta',
      workspaceId: 'ws-beta',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 60 * 60 * 1000,
      grantReason: 'rollout-lease',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });

    // No receipt -> fails closed
    const resNoReceipt = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, undefined),
    );
    expect(resNoReceipt.status).toBe('fail_closed');

    // Valid receipt -> satisfied
    const resWithReceipt = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)),
    );
    expect(resWithReceipt.status).toBe('lease_satisfied');
  });
});
