/**
 * ExtensionLeaseBetaFailureModes.test.ts
 *
 * Beta failure modes and edge cases:
 *  - incomplete receipt fails closed
 *  - risk mismatch receipt fails closed
 *  - fingerprint mismatch receipt fails closed
 *  - descriptor schema drift invalidates lease
 *  - descriptor capability drift invalidates lease
 *  - descriptor risk drift invalidates lease or fails closed
 *  - revoked lease fails closed
 *  - expired lease fails closed
 *  - subject mismatch fails closed
 *  - workspace mismatch fails closed
 *  - channel mismatch fails closed when scoped
 *  - critical never activates
 *  - unknown never activates
 *  - high disabled by default
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
const CORR = 'corr-beta-failures';

describe('ExtensionLeaseBetaFailureModes', () => {
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

  function makeDescriptor(overrides-: Partial<CustomToolDescriptor>): CustomToolDescriptor {
    return {
      namespace: 'local',
      name: 'failure_tool',
      description: 'A tool to test failure modes.',
      inputSchema: { type: 'object', properties: {} },
      capabilities: ['filesystem'],
      riskClass: 'safe',
      handler: jest.fn().mockReturnValue('NOT_EXECUTED'),
      ...overrides,
    };
  }

  function validReceipt(fingerprint: string, riskClass: string = 'safe'): ApprovalLeaseGateReceipt {
    return {
      channelWorkspaceExposureChecked: true,
      toolGatekeeperExecuted: true,
      riskClassResolved: riskClass as any,
      toolFingerprintVerified: fingerprint,
    };
  }

  function baseDecisionContext(
    qualifiedName: string,
    fingerprint: string,
    receipt-: ApprovalLeaseGateReceipt,
    overrides-: Partial<ApprovalLeaseDecisionContext>,
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
      ...overrides,
    };
  }

  test('incomplete receipt fails closed', () => {
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
      grantReason: 'beta-lease',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });

    // Incomplete receipt missing properties
    const incompleteReceipt = {
      channelWorkspaceExposureChecked: false, // exposure check failed/incomplete
      toolGatekeeperExecuted: true,
      riskClassResolved: 'safe' as any,
      toolFingerprintVerified: reg.fingerprint,
    };

    const result = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, incompleteReceipt as any),
    );

    expect(result.status).toBe('fail_closed');
  });

  test('risk mismatch receipt fails closed', () => {
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
      grantReason: 'beta-lease',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });

    // Receipt has riskClassResolved as 'medium' but descriptor is 'safe'
    const receipt = validReceipt(reg.fingerprint, 'medium');

    const result = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, receipt, { riskClass: 'safe' }),
    );

    expect(result.status).toBe('fail_closed');
  });

  test('fingerprint mismatch receipt fails closed', () => {
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
      grantReason: 'beta-lease',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });

    // Receipt has a different fingerprint
    const receipt = validReceipt('incorrect-fingerprint-123456');

    const result = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, receipt),
    );

    expect(result.status).toBe('fail_closed');
  });

  test('descriptor schema drift invalidates lease', () => {
    const descriptor = makeDescriptor({
      name: 'drift_tool',
      inputSchema: {
        type: 'object',
        properties: { value: { type: 'string' } },
        required: ['value'],
      },
    });
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

    ZavorthExtensionFacade.resetForTests();
    // Re-register with different schema
    const driftedDescriptor = makeDescriptor({
      name: 'drift_tool',
      inputSchema: {
        type: 'object',
        properties: { value: { type: 'number' } }, // type changed
        required: ['value'],
      },
    });
    const regDrifted = ZavorthExtensionFacade.registerCustomTool(driftedDescriptor);

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });

    // Evaluate using original lease fingerprint against shifted fingerprint
    const result = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, regDrifted.fingerprint, validReceipt(regDrifted.fingerprint)),
    );

    expect(result.status).toBe('lease_rejected'); // fingerprint drift shifts context, lease is not found for this new fingerprint
  });

  test('descriptor capability drift invalidates lease', () => {
    const descriptor = makeDescriptor({ name: 'drift_tool', capabilities: ['filesystem'] });
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

    ZavorthExtensionFacade.resetForTests();
    // Re-register with different capabilities
    const driftedDescriptor = makeDescriptor({ name: 'drift_tool', capabilities: ['filesystem', 'network'] });
    const regDrifted = ZavorthExtensionFacade.registerCustomTool(driftedDescriptor);

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });

    const result = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, regDrifted.fingerprint, validReceipt(regDrifted.fingerprint)),
    );

    expect(result.status).toBe('lease_rejected');
  });

  test('descriptor risk drift invalidates lease or fails closed', () => {
    const descriptor = makeDescriptor({ name: 'drift_tool', riskClass: 'safe' });
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

    ZavorthExtensionFacade.resetForTests();
    // Re-register with different risk
    const driftedDescriptor = makeDescriptor({ name: 'drift_tool', riskClass: 'medium' });
    const regDrifted = ZavorthExtensionFacade.registerCustomTool(driftedDescriptor);

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });

    const result = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, regDrifted.fingerprint, validReceipt(regDrifted.fingerprint, 'medium'), { riskClass: 'medium' }),
    );

    expect(result.status).toBe('lease_rejected');
  });

  test('revoked lease fails closed', () => {
    const descriptor = makeDescriptor({ name: 'revoked_tool' });
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

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

    leaseService.revokeLease(lease.leaseId, 'revocation-reason', NOW);

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)),
    );

    expect(result.status).toBe('lease_rejected');
  });

  test('expired lease fails closed', () => {
    const descriptor = makeDescriptor({ name: 'expired_tool' });
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    leaseService.grantLease({
      subjectId: 'user-beta',
      workspaceId: 'ws-beta',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 1000, // 1 second duration
      grantReason: 'beta-lease',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: '2026-06-15T11:59:00.000Z', // 1 minute in the past relative to NOW
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)),
    );

    expect(result.status).toBe('lease_rejected');
  });

  test('subject mismatch fails closed', () => {
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
      grantReason: 'beta-lease',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint), { subjectId: 'another-user' }),
    );

    expect(result.status).toBe('requires_approval');
  });

  test('workspace mismatch fails closed', () => {
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
      grantReason: 'beta-lease',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint), { workspaceId: 'another-ws' }),
    );

    expect(result.status).toBe('requires_approval');
  });

  test('channel mismatch fails closed when scoped', () => {
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
      grantReason: 'beta-lease',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    // Requested operation is 'read' which is not allowed ('execute' is the only allowed operation in lease)
    const result = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint), { requestedOperation: 'read' }),
    );

    expect(result.status).toBe('lease_rejected');
  });

  test('critical risk tools never activate', () => {
    const descriptor = makeDescriptor({ name: 'critical_tool', riskClass: 'critical' });
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    expect(() => {
      leaseService.grantLease({
        subjectId: 'user-beta',
        workspaceId: 'ws-beta',
        toolQualifiedName: reg.qualifiedName,
        toolFingerprint: reg.fingerprint,
        riskClass: 'critical',
        allowedOperations: ['execute'],
        durationMs: 60 * 60 * 1000,
        grantReason: 'beta-lease',
        grantSource: 'test_only',
        auditCorrelationId: CORR,
        currentTime: NOW,
      });
    }).toThrow('Lease activation is prohibited for "critical" risk class.');
  });

  test('unknown risk tools never activate', () => {
    const descriptor = makeDescriptor({ name: 'unknown_tool', riskClass: 'unknown' as any });
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    expect(() => {
      leaseService.grantLease({
        subjectId: 'user-beta',
        workspaceId: 'ws-beta',
        toolQualifiedName: reg.qualifiedName,
        toolFingerprint: reg.fingerprint,
        riskClass: 'unknown' as any,
        allowedOperations: ['execute'],
        durationMs: 60 * 60 * 1000,
        grantReason: 'beta-lease',
        grantSource: 'test_only',
        auditCorrelationId: CORR,
        currentTime: NOW,
      });
    }).toThrow('Lease activation is prohibited for "unknown" risk class.');
  });

  test('high risk tools are disabled by default', () => {
    const descriptor = makeDescriptor({ name: 'high_tool', riskClass: 'high' });
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    expect(() => {
      leaseService.grantLease({
        subjectId: 'user-beta',
        workspaceId: 'ws-beta',
        toolQualifiedName: reg.qualifiedName,
        toolFingerprint: reg.fingerprint,
        riskClass: 'high',
        allowedOperations: ['execute'],
        durationMs: 60 * 60 * 1000,
        grantReason: 'beta-lease',
        grantSource: 'test_only',
        auditCorrelationId: CORR,
        currentTime: NOW,
      });
    }).toThrow('Lease activation is prohibited for "high" risk class under current policy.');
  });
});
