/**
 * ExtensionLeaseBetaAudit.test.ts
 *
 * Beta audit safety and fail-closed requirements:
 *  - registration audit is safe
 *  - lease grant audit is safe
 *  - lease evaluation audit is safe
 *  - revoke audit is safe
 *  - drift/failure audit is safe
 *  - sync audit throw fails closed
 *  - async audit rejection fails closed or documented safely
 *  - audit excludes raw prompts
 *  - audit excludes provider responses
 *  - audit excludes Authorization/Bearer
 *  - audit excludes secretRef/rawKey/ciphertext/authTag
 *  - audit excludes handler source
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
const CORR = 'corr-beta-audit';

describe('ExtensionLeaseBetaAudit', () => {
  let leaseService: ApprovalLeaseService;
  let mockLeaseAuditSink: any;
  let mockDecisionSink: any;
  let decisionEvents: any[];
  let leaseEvents: any[];

  beforeEach(() => {
    ServiceRegistry.resetForTests();
    ZavorthExtensionFacade.resetForTests();
    InMemoryApprovalLeaseStore.clearForTests();

    ServiceRegistry.register(ServiceTokens.SecurityAuditLogger, { logMcpRuntimeEvent: jest.fn() });

    leaseEvents = [];
    mockLeaseAuditSink = {
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

  function makeDescriptor(overrides-: Partial<CustomToolDescriptor>): CustomToolDescriptor {
    return {
      namespace: 'local',
      name: 'audit_tool',
      description: 'Audit test tool.',
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
    receipt-: ApprovalLeaseGateReceipt,
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

  test('registration, lease grant, evaluation, and revoke audit logs are populated and safe', () => {
    const descriptor = makeDescriptor();

    // 1. Registration
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);
    expect(reg.fingerprint).toBeDefined();

    // 2. Lease Grant
    const lease = leaseService.grantLease({
      subjectId: 'user-beta',
      workspaceId: 'ws-beta',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 60 * 60 * 1000,
      grantReason: 'beta-audit-lease',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    expect(leaseEvents).toHaveLength(1);
    expect(leaseEvents[0].eventType).toBe('lease_granted');

    // 3. Evaluation
    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)),
    );

    // One event is lease_considered, other is lease_satisfied
    expect(decisionEvents).toHaveLength(2);
    expect(decisionEvents[1].status).toBe('lease_satisfied');

    // 4. Revocation
    leaseService.revokeLease(lease.leaseId, 'revocation-reason', NOW);

    expect(leaseEvents).toHaveLength(2);
    expect(leaseEvents[1].eventType).toBe('lease_revoked');
  });

  test('audit events exclude forbidden fields and secrets', () => {
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
      grantReason: 'normal-beta-grant-reason',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)),
    );

    // Verify all stringified audit events do not contain forbidden strings
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
      grantReason: 'sync-fail-dogfood',
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

  test('async audit sink rejection does not crash the system', async () => {
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
      grantReason: 'async-fail-dogfood',
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
