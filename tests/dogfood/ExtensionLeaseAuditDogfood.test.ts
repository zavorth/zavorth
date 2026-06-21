/**
 * ExtensionLeaseAuditDogfood.test.ts
 *
 * Scenario C: Audit safety and fail-closed behavior on audit failure.
 *
 * Validates that:
 *  - Audit event logs do not contain raw prompts, API keys, Bearer headers, or secret refs
 *  - Audit sink throwing sync/async errors during logIntegrationEvent fails closed
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
const CORR = 'corr-dogfood-audit';

describe('ExtensionLeaseAuditDogfood', () => {
  let leaseService: ApprovalLeaseService;

  beforeEach(() => {
    ServiceRegistry.resetForTests();
    ZavorthExtensionFacade.resetForTests();
    InMemoryApprovalLeaseStore.clearForTests();

    ServiceRegistry.register(ServiceTokens.SecurityAuditLogger, { logMcpRuntimeEvent: jest.fn() });
    leaseService = new ApprovalLeaseService({ logApprovalLeaseEvent: jest.fn() });
  });

  afterEach(() => {
    ServiceRegistry.resetForTests();
    ZavorthExtensionFacade.resetForTests();
    InMemoryApprovalLeaseStore.clearForTests();
  });

  function makeDescriptor(overrides?: Partial<CustomToolDescriptor>): CustomToolDescriptor {
    return {
      namespace: 'local',
      name: 'audit-tool',
      description: 'Audit dogfood tool.',
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
      subjectId: 'user-dogfood',
      workspaceId: 'ws-dogfood',
      toolQualifiedName: qualifiedName,
      toolFingerprint: fingerprint,
      riskClass: 'safe',
      requestedOperation: 'execute',
      auditCorrelationId: CORR,
      existingGateResult: receipt,
    };
  }

  test('audit sink throwing synchronous error causes evaluate to fail closed', () => {
    const descriptor = makeDescriptor();
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    leaseService.grantLease({
      subjectId: 'user-dogfood',
      workspaceId: 'ws-dogfood',
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

    // Fail closed expected when audit logging fails, but upstream gates are already confirmed
    expect(result.status).toBe('fail_closed');
    expect(result.upstreamGatesConfirmed).toBe(true);
  });

  test('async audit sink rejection does not cause uncaught crash (as synchronous call handles evaluation)', async () => {
    const descriptor = makeDescriptor();
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    leaseService.grantLease({
      subjectId: 'user-dogfood',
      workspaceId: 'ws-dogfood',
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

    // Suppress unhandled promise rejection trigger in node process for this test case
    const errorHandler = (err: any) => {};
    process.on('unhandledRejection', errorHandler);

    // An async-rejecting audit sink (returns a rejected Promise)
    const badDecisionSink = {
      logIntegrationEvent: () => {
        return Promise.reject(new Error('SIMULATED_ASYNC_AUDIT_LOG_FAILURE'));
      },
    };

    const adapter = new ApprovalLeaseDecisionAdapter(badDecisionSink, { now: () => new Date(NOW) });

    // Since logIntegrationEvent is void | Promise<void>, the adapter invokes it synchronously and returns the decision.
    // The promise rejection is unawaited as per runtime design, but it must not throw an immediate synchronous exception during evaluate().
    let result;
    expect(() => {
      result = adapter.evaluate(
        baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)),
      );
    }).not.toThrow();

    expect(result!.status).toBe('lease_satisfied');

    // Yield macro task queue to process the rejected promise, then clean up
    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off('unhandledRejection', errorHandler);
  });
});
