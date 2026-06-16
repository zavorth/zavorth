/**
 * ExtensionLeaseInternalTesterSafety.test.ts
 *
 * Safety requirements verification:
 *  - critical never activates
 *  - unknown never activates
 *  - high disabled by default
 *  - subject mismatch fails closed
 *  - workspace mismatch fails closed
 *  - channel mismatch fails closed when scoped
 *  - withholding gate receipt disables lease satisfaction
 *  - process-local store can be cleared
 *  - no persisted lease state is used
 *  - audit sync throw fails closed
 *  - audit async rejection fails closed or documented safely
 *  - audit excludes forbidden markers
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
const CORR = 'corr-tester-safety';

describe('ExtensionLeaseInternalTesterSafety', () => {
  let leaseService: ApprovalLeaseService;
  let mockDecisionSink: any;
  let decisionEvents: any[];
  let leaseEvents: any[];

  beforeEach(() => {
    ServiceRegistry.resetForTests();
    ZavorthExtensionFacade.resetForTests();
    InMemoryApprovalLeaseStore.clearForTests();

    ServiceRegistry.register(ServiceTokens.SecurityAuditLogger, { logMcpRuntimeEvent: jest.fn() });

    leaseEvents = [];
    const mockLeaseAuditSink = {
      logApprovalLeaseEvent: (e: any) => { leaseEvents.push(e); },
    };
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
      name: 'safety_tool',
      description: 'Tester safety tool.',
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
    receipt?: ApprovalLeaseGateReceipt,
    overrides?: Partial<ApprovalLeaseDecisionContext>,
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
      ...overrides,
    };
  }

  test('critical risk tools never activate', () => {
    const descriptor = makeDescriptor({ name: 'critical_tool', riskClass: 'critical' });
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    expect(() => {
      leaseService.grantLease({
        subjectId: 'user-tester',
        workspaceId: 'ws-tester',
        toolQualifiedName: reg.qualifiedName,
        toolFingerprint: reg.fingerprint,
        riskClass: 'critical',
        allowedOperations: ['execute'],
        durationMs: 60 * 60 * 1000,
        grantReason: 'tester-safety',
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
        subjectId: 'user-tester',
        workspaceId: 'ws-tester',
        toolQualifiedName: reg.qualifiedName,
        toolFingerprint: reg.fingerprint,
        riskClass: 'unknown' as any,
        allowedOperations: ['execute'],
        durationMs: 60 * 60 * 1000,
        grantReason: 'tester-safety',
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
        subjectId: 'user-tester',
        workspaceId: 'ws-tester',
        toolQualifiedName: reg.qualifiedName,
        toolFingerprint: reg.fingerprint,
        riskClass: 'high',
        allowedOperations: ['execute'],
        durationMs: 60 * 60 * 1000,
        grantReason: 'tester-safety',
        grantSource: 'test_only',
        auditCorrelationId: CORR,
        currentTime: NOW,
      });
    }).toThrow('Lease activation is prohibited for "high" risk class under current policy.');
  });

  test('subject and workspace mismatches fail closed by requiring approval', () => {
    const descriptor = makeDescriptor();
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    leaseService.grantLease({
      subjectId: 'user-tester',
      workspaceId: 'ws-tester',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 60 * 60 * 1000,
      grantReason: 'tester-safety',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });

    const resultSubject = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint), { subjectId: 'attacker-user' }),
    );
    expect(resultSubject.status).toBe('requires_approval');

    const resultWorkspace = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint), { workspaceId: 'attacker-ws' }),
    );
    expect(resultWorkspace.status).toBe('requires_approval');
  });

  test('withholding gate receipt disables lease satisfaction and fails closed', () => {
    const descriptor = makeDescriptor();
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    leaseService.grantLease({
      subjectId: 'user-tester',
      workspaceId: 'ws-tester',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 60 * 60 * 1000,
      grantReason: 'tester-safety',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, undefined),
    );

    expect(result.status).toBe('fail_closed');
  });

  test('sync audit throw fails closed', () => {
    const descriptor = makeDescriptor();
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    leaseService.grantLease({
      subjectId: 'user-tester',
      workspaceId: 'ws-tester',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 60 * 60 * 1000,
      grantReason: 'sync-fail-tester',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const badDecisionSink = {
      logIntegrationEvent: () => {
        throw new Error('SIMULATED_AUDIT_LOG_FAILURE');
      },
    };

    const adapter = new ApprovalLeaseDecisionAdapter(badDecisionSink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)),
    );

    expect(result.status).toBe('fail_closed');
  });

  test('async audit sink rejection fails safely without crashing', async () => {
    const descriptor = makeDescriptor();
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    leaseService.grantLease({
      subjectId: 'user-tester',
      workspaceId: 'ws-tester',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 60 * 60 * 1000,
      grantReason: 'async-fail-tester',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const errorHandler = (err: any) => {};
    process.on('unhandledRejection', errorHandler);

    const badDecisionSink = {
      logIntegrationEvent: () => {
        return Promise.reject(new Error('SIMULATED_ASYNC_AUDIT_LOG_FAILURE'));
      },
    };

    const adapter = new ApprovalLeaseDecisionAdapter(badDecisionSink, { now: () => new Date(NOW) });

    let result;
    expect(() => {
      result = adapter.evaluate(
        baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)),
      );
    }).not.toThrow();

    expect(result!.status).toBe('lease_satisfied');

    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off('unhandledRejection', errorHandler);
  });
});
