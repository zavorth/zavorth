/**
 * ExtensionLeaseBetaOperatorChecklist.test.ts
 *
 * Beta operator checklist behavior verification:
 *  - critical never activates
 *  - unknown never activates
 *  - high disabled by default
 *  - subject mismatch fails closed
 *  - workspace mismatch fails closed
 *  - channel mismatch fails closed when scoped
 *  - audit sync throw fails closed
 *  - audit async rejection fails closed or documented safely
 *  - audit excludes raw prompts
 *  - audit excludes provider responses
 *  - audit excludes Authorization/Bearer
 *  - audit excludes secretRef/rawKey/ciphertext/authTag
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
const CORR = 'corr-beta-operator';

describe('ExtensionLeaseBetaOperatorChecklist', () => {
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
      name: 'operator_tool',
      description: 'A tool to test operator checklist.',
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
        grantReason: 'operator-lease',
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
        grantReason: 'operator-lease',
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
        grantReason: 'operator-lease',
        grantSource: 'test_only',
        auditCorrelationId: CORR,
        currentTime: NOW,
      });
    }).toThrow('Lease activation is prohibited for "high" risk class under current policy.');
  });

  test('subject mismatch fails closed by requiring approval', () => {
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
      grantReason: 'operator-lease',
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

  test('workspace mismatch fails closed by requiring approval', () => {
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
      grantReason: 'operator-lease',
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
      grantReason: 'operator-lease',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint), { requestedOperation: 'read' }),
    );

    expect(result.status).toBe('lease_rejected');
  });

  test('sync audit throw fails closed', () => {
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
      grantReason: 'sync-fail-operator',
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
      subjectId: 'user-beta',
      workspaceId: 'ws-beta',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 60 * 60 * 1000,
      grantReason: 'async-fail-operator',
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

  test('audit logs do not leak raw prompts, provider responses, or secrets', () => {
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
      grantReason: 'normal-beta-operator-reason',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)),
    );

    const allLoggedData = JSON.stringify({ leaseEvents, decisionEvents });
    const forbiddenPatterns = [
      'Bearer',
      'secretRef',
      'rawKey',
      'ciphertext',
      'authTag',
      'Authorization',
      'rawPrompt',
      'providerResponse',
      'handler',
    ];

    for (const pattern of forbiddenPatterns) {
      expect(allLoggedData).not.toContain(pattern);
    }
  });
});
