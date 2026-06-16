/**
 * ExtensionLeaseBetaAcceptance.test.ts
 *
 * Beta acceptance requirements:
 *  - safe local extension descriptor validates
 *  - registration remains pending/unapproved
 *  - fingerprint is stable
 *  - lease grant/evaluate/revoke flow works in scoped safe/low case
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
const CORR = 'corr-beta-acceptance';

describe('ExtensionLeaseBetaAcceptance', () => {
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

  // Safe local fixtures (No filesystem writes, network calls, secrets, shell commands, etc.)
  function makeDescriptor(overrides?: Partial<CustomToolDescriptor>): CustomToolDescriptor {
    return {
      namespace: 'local',
      name: 'echo',
      description: 'A safe local echo tool for beta acceptance tests.',
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

  test('safe local extension descriptor validates and remains pending/unapproved', () => {
    const descriptor = makeDescriptor();
    const result = ZavorthExtensionFacade.registerCustomTool(descriptor);

    expect(result.qualifiedName).toBe('local:echo');
    expect(result.status).toBe('registered_unapproved');
    expect(result.fingerprint).toHaveLength(64);
    expect(descriptor.handler).not.toHaveBeenCalled();
  });

  test('stable fingerprint is computed correctly', () => {
    const descriptor = makeDescriptor({ name: 'stable_tool' });
    const r1 = ZavorthExtensionFacade.registerCustomTool(descriptor);

    ZavorthExtensionFacade.resetForTests();
    const r2 = ZavorthExtensionFacade.registerCustomTool(descriptor);

    expect(r1.fingerprint).toBe(r2.fingerprint);
  });

  test('lease grant, evaluate, and revoke flow works in scoped safe/low case', () => {
    const descriptor = makeDescriptor({ name: 'low_risk_tool' });
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    // Lease Grant
    const lease = leaseService.grantLease({
      subjectId: 'user-beta',
      workspaceId: 'ws-beta',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 60 * 60 * 1000,
      grantReason: 'beta-lease',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    expect(lease.leaseId).toBeDefined();

    // Evaluate - with complete gate receipt
    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)),
    );

    // Advisory language only: lease_satisfied, not execute/approved/bypass/trusted/autoApprove
    expect(result.status).toBe('lease_satisfied');
    expect(result.status).not.toBe('execute');
    expect(result.status).not.toBe('approved');
    expect(result.status).not.toBe('bypass');
    expect(result.status).not.toBe('trusted');
    expect(result.status).not.toBe('autoApprove');

    expect(descriptor.handler).not.toHaveBeenCalled();

    // Revoke Lease
    leaseService.revokeLease(lease.leaseId, 'beta-revocation', NOW);

    // Evaluate after revocation
    const resultAfterRevoke = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)),
    );

    expect(resultAfterRevoke.status).toBe('lease_rejected');
    expect(resultAfterRevoke.leaseConsidered).toBe(true);
    expect(descriptor.handler).not.toHaveBeenCalled();
  });

  test('lease_satisfied occurs only after complete gate receipt', () => {
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
      grantReason: 'beta-lease',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });

    // Evaluate - without gate receipt
    const resultNoReceipt = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, undefined),
    );
    expect(resultNoReceipt.status).toBe('fail_closed');

    // Evaluate - with complete gate receipt
    const resultWithReceipt = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)),
    );
    expect(resultWithReceipt.status).toBe('lease_satisfied');
  });
});
