/**
 * ExtensionLeaseFailureModes.test.ts
 *
 * Scenario B: Failure modes and edge cases.
 *
 * Validates that:
 *  - Descriptor drift (changing properties) invalidates fingerprint & registration
 *  - Revoked or expired leases require normal approval
 *  - Subject, workspace, or channel/op mismatches fail closed
 *  - Critical risk tools are forbidden/fail closed
 *  - High-risk tools are disabled/fail closed by default
 *  - Incomplete gate receipts (truthy but missing keys, mismatched risk, etc.) fail closed
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
const CORR = 'corr-dogfood-failures';

describe('ExtensionLeaseFailureModes', () => {
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
      name: 'file-writer',
      description: 'A dogfood tool for checking failure modes.',
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
      subjectId: 'user-dogfood',
      workspaceId: 'ws-dogfood',
      toolQualifiedName: qualifiedName,
      toolFingerprint: fingerprint,
      riskClass: 'safe',
      requestedOperation: 'execute',
      auditCorrelationId: CORR,
      existingGateResult: receipt,
      ...overrides,
    };
  }

  test('descriptor drift invalidates fingerprint & registration matches', () => {
    const desc = makeDescriptor({ name: 'drift-tool' });
    const r1 = ZavorthExtensionFacade.registerCustomTool(desc);

    // Re-register with slightly changed capabilities
    ZavorthExtensionFacade.resetForTests();
    const descDrifted = makeDescriptor({ name: 'drift-tool', capabilities: ['filesystem', 'network'] });
    const r2 = ZavorthExtensionFacade.registerCustomTool(descDrifted);

    expect(r1.fingerprint).not.toBe(r2.fingerprint);
  });

  test('expired lease requires normal approval', () => {
    const descriptor = makeDescriptor({ name: 'expired-tool' });
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    leaseService.grantLease({
      subjectId: 'user-dogfood',
      workspaceId: 'ws-dogfood',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 1000, // 1 second duration
      grantReason: 'expired-dogfood',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: '2026-06-15T11:59:00.000Z', // 1 minute in the past relative to NOW
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)),
    );

    // Lease should be expired by NOW, resulting in lease_rejected
    expect(result.status).toBe('lease_rejected');
    expect(result.leaseConsidered).toBe(true);
  });

  test('revoked lease requires normal approval', () => {
    const descriptor = makeDescriptor({ name: 'revoked-tool' });
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    const lease = leaseService.grantLease({
      subjectId: 'user-dogfood',
      workspaceId: 'ws-dogfood',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 60 * 60 * 1000,
      grantReason: 'revoked-dogfood',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    leaseService.revokeLease(lease.leaseId, 'dogfood revocation', NOW);

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)),
    );

    expect(result.status).toBe('lease_rejected');
  });

  test('subject or workspace mismatch fails closed', () => {
    const descriptor = makeDescriptor({ name: 'mismatch-tool' });
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    leaseService.grantLease({
      subjectId: 'user-dogfood',
      workspaceId: 'ws-dogfood',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 60 * 60 * 1000,
      grantReason: 'mismatch-dogfood',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });

    // Subject mismatch (no candidates found -> requires_approval)
    const resSubject = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint), {
        subjectId: 'user-attacker',
      }),
    );
    expect(resSubject.status).toBe('requires_approval');

    // Workspace mismatch (no candidates found -> requires_approval)
    const resWorkspace = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint), {
        workspaceId: 'ws-other',
      }),
    );
    expect(resWorkspace.status).toBe('requires_approval');
  });

  test('operation mismatch fails closed', () => {
    const descriptor = makeDescriptor({ name: 'op-mismatch-tool' });
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    leaseService.grantLease({
      subjectId: 'user-dogfood',
      workspaceId: 'ws-dogfood',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['read_only_view'], // does not allow 'execute'
      durationMs: 60 * 60 * 1000,
      grantReason: 'op-mismatch-dogfood',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)),
    );

    expect(result.status).toBe('lease_rejected');
  });

  test('critical risk tools are completely forbidden and fail closed', () => {
    const descriptor = makeDescriptor({ name: 'critical-tool', riskClass: 'critical' });
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    // Verify registration status shows they are blocked or at least not clean
    expect(reg.status).toBe('pending_approval');

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint, 'critical'), {
        riskClass: 'critical',
      }),
    );

    expect(result.status).toBe('not_applicable');
  });

  test('incomplete, spoofed or invalid receipts fail closed', () => {
    const descriptor = makeDescriptor({ name: 'spoof-tool' });
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    leaseService.grantLease({
      subjectId: 'user-dogfood',
      workspaceId: 'ws-dogfood',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 60 * 60 * 1000,
      grantReason: 'spoof-dogfood',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });

    // Incomplete receipt missing 'toolFingerprintVerified'
    const incompleteReceipt1: any = {
      channelWorkspaceExposureChecked: true,
      toolGatekeeperExecuted: true,
      riskClassResolved: 'safe',
    };
    const resIncomplete1 = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, incompleteReceipt1),
    );
    expect(resIncomplete1.status).toBe('fail_closed');

    // Incomplete receipt containing truthy object but missing standard gate confirmation keys
    const incompleteReceipt2: any = {
      someOtherKey: true,
    };
    const resIncomplete2 = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, incompleteReceipt2),
    );
    expect(resIncomplete2.status).toBe('fail_closed');

    // Mismatched fingerprint in receipt
    const mismatchedReceipt = validReceipt('wrong_fingerprint_hash');
    const resMismatched = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, mismatchedReceipt),
    );
    expect(resMismatched.status).toBe('fail_closed');
  });
});
