/**
 * ExtensionLeaseBetaContinuationSafety.test.ts
 *
 * Verifies critical safety invariants of the personal approval lease subsystem
 * during beta continuation.
 */

import { ZavorthExtensionFacade } from '../../src/sdk/ZavorthExtensionFacade.js';
import { ServiceRegistry } from '../../src/bootstrap/ServiceRegistry.js';
import { ServiceTokens } from '../../src/bootstrap/ServiceTokens.js';
import { ApprovalLeaseDecisionAdapter } from '../../src/approval-leases/ApprovalLeaseDecisionAdapter.js';
import { ApprovalLeaseService } from '../../src/approval-leases/ApprovalLeaseService.js';
import { InMemoryApprovalLeaseStore } from '../../src/approval-leases/InMemoryApprovalLeaseStore.js';
import type { CustomToolDescriptor } from '../../src/sdk/CustomToolDescriptor.js';
import type { ApprovalLeaseDecisionContext } from '../../src/approval-leases/ApprovalLeaseDecisionResult.js';

const NOW = '2026-06-15T12:00:00.000Z';
const CORR = 'corr-beta-continuation-safety';

describe('ExtensionLeaseBetaContinuationSafety', () => {
  let mockAuditLogger: any;
  let mockLeaseAuditSink: any;
  let leaseService: ApprovalLeaseService;
  let decisionEvents: any[];
  let mockDecisionSink: any;

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

  function makeDescriptor(overrides-: Partial<CustomToolDescriptor>): CustomToolDescriptor {
    return {
      namespace: 'local',
      name: 'echo',
      description: 'A safe local echo tool.',
      inputSchema: { type: 'object', properties: {} },
      capabilities: ['filesystem'],
      riskClass: 'safe',
      handler: jest.fn().mockReturnValue('NOT_EXECUTED'),
      ...overrides,
    };
  }

  test('critical risk remains impossible and high risk remains disabled by default', () => {
    const descCritical = makeDescriptor({ name: 'critical_tool', riskClass: 'critical' });
    const descHigh = makeDescriptor({ name: 'high_tool', riskClass: 'high' });

    // Validate that granting critical fails validation
    expect(() => {
      leaseService.grantLease({
        subjectId: 'user-beta',
        workspaceId: 'ws-beta',
        toolQualifiedName: 'local:critical_tool',
        toolFingerprint: 'some-hash',
        riskClass: 'critical',
        allowedOperations: ['execute'],
        durationMs: 60 * 60 * 1000,
        grantReason: 'critical-test',
        grantSource: 'test_only',
        auditCorrelationId: CORR,
        currentTime: NOW,
      });
    }).toThrow('Lease activation is prohibited for "critical" risk class.');

    // Validate high risk tools are disabled by default
    expect(() => {
      leaseService.grantLease({
        subjectId: 'user-beta',
        workspaceId: 'ws-beta',
        toolQualifiedName: 'local:high_tool',
        toolFingerprint: 'some-hash',
        riskClass: 'high',
        allowedOperations: ['execute'],
        durationMs: 60 * 60 * 1000,
        grantReason: 'high-test',
        grantSource: 'test_only',
        auditCorrelationId: CORR,
        currentTime: NOW,
      });
    }).toThrow('Lease activation is prohibited for "high" risk class under current policy.');
  });

  test('incomplete gate receipt, revoked/expired lease, and mismatched parameters fail closed', async () => {
    const desc = makeDescriptor();
    const reg = ZavorthExtensionFacade.registerCustomTool(desc);
    const fingerprint = reg.fingerprint;
    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });

    // 1. Incomplete gate receipt fails closed
    const incompleteReceipt = {
      channelWorkspaceExposureChecked: false, // incomplete
      toolGatekeeperExecuted: true,
      riskClassResolved: 'safe' as const,
      toolFingerprintVerified: fingerprint,
    };

    const resultIncomplete = adapter.evaluate({
      subjectId: 'user-beta',
      workspaceId: 'ws-beta',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: fingerprint,
      riskClass: 'safe',
      requestedOperation: 'execute',
      auditCorrelationId: CORR,
      existingGateResult: incompleteReceipt,
    });
    expect(resultIncomplete.status).toBe('fail_closed');

    // 2. Mismatched subject fails closed to requires_approval
    const validReceipt = {
      channelWorkspaceExposureChecked: true,
      toolGatekeeperExecuted: true,
      riskClassResolved: 'safe' as const,
      toolFingerprintVerified: fingerprint,
    };

    // First grant lease scoped to channelId: 'Slack'
    const lease = leaseService.grantLease({
      subjectId: 'user-beta',
      workspaceId: 'ws-beta',
      channelId: 'Slack',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 60 * 60 * 1000,
      grantReason: 'beta-lease',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const resultMismatchedSubject = adapter.evaluate({
      subjectId: 'another-user', // mismatched
      workspaceId: 'ws-beta',
      channelId: 'Slack',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: fingerprint,
      riskClass: 'safe',
      requestedOperation: 'execute',
      auditCorrelationId: CORR,
      existingGateResult: validReceipt,
    });
    expect(resultMismatchedSubject.status).toBe('requires_approval');

    // 3. Mismatched workspace fails closed
    const resultMismatchedWorkspace = adapter.evaluate({
      subjectId: 'user-beta',
      workspaceId: 'another-ws', // mismatched
      channelId: 'Slack',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: fingerprint,
      riskClass: 'safe',
      requestedOperation: 'execute',
      auditCorrelationId: CORR,
      existingGateResult: validReceipt,
    });
    expect(resultMismatchedWorkspace.status).toBe('requires_approval');

    // 4. Mismatched channel fails closed when channel is scoped
    const resultMismatchedChannel = adapter.evaluate({
      subjectId: 'user-beta',
      workspaceId: 'ws-beta',
      channelId: 'WhatsApp', // mismatched channel
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: fingerprint,
      riskClass: 'safe',
      requestedOperation: 'execute',
      auditCorrelationId: CORR,
      existingGateResult: validReceipt,
    });
    expect(resultMismatchedChannel.status).toBe('lease_rejected');

    // 5. Expired lease fails closed
    const adapterExpired = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date('2026-06-15T14:00:00.000Z') });
    const resultExpired = adapterExpired.evaluate({
      subjectId: 'user-beta',
      workspaceId: 'ws-beta',
      channelId: 'Slack',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: fingerprint,
      riskClass: 'safe',
      requestedOperation: 'execute',
      auditCorrelationId: CORR,
      existingGateResult: validReceipt,
    });
    expect(resultExpired.status).toBe('lease_rejected');

    // 6. Descriptor drift fails closed
    const resultDrift = adapter.evaluate({
      subjectId: 'user-beta',
      workspaceId: 'ws-beta',
      channelId: 'Slack',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: 'drifted-fingerprint', // mismatched
      riskClass: 'safe',
      requestedOperation: 'execute',
      auditCorrelationId: CORR,
      existingGateResult: validReceipt,
    });
    expect(resultDrift.status).toBe('fail_closed');

    // 7. Revoked lease fails closed
    leaseService.revokeLease(lease.leaseId, 'revoked', NOW);
    const resultRevoked = adapter.evaluate({
      subjectId: 'user-beta',
      workspaceId: 'ws-beta',
      channelId: 'Slack',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: fingerprint,
      riskClass: 'safe',
      requestedOperation: 'execute',
      auditCorrelationId: CORR,
      existingGateResult: validReceipt,
    });
    expect(resultRevoked.status).toBe('lease_rejected');

    // 8. Handler execution is not triggered during continuation checks
    expect(desc.handler).not.toHaveBeenCalled();
  });
});
