/**
 * ExtensionLeaseDogfoodFlow.test.ts
 *
 * Scenario A: valid safe local extension + valid lease
 *
 * Validates that:
 *  - Custom tool descriptor validates and registers as pending/unapproved
 *  - Fingerprint is stable
 *  - Missing gate receipt fails closed before lease is consulted
 *  - Valid lease + complete gate receipt yields lease_satisfied
 *  - Handler is never called during registration or evaluation
 *  - Result uses advisory language (lease_satisfied/requires_approval/fail_closed)
 *  - Audit events are safe
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
import type { ApprovalLeaseIntegrationAuditEvent } from '../../src/approval-leases/ApprovalLeaseDecisionAdapter.js';

const NOW = '2026-06-15T12:00:00.000Z';
const CORR = 'corr-dogfood-flow';

describe('ExtensionLeaseDogfoodFlow', () => {
  let mockAuditLogger: any;
  let mockLeaseAuditSink: any;
  let leaseService: ApprovalLeaseService;
  let decisionEvents: ApprovalLeaseIntegrationAuditEvent[];
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
      logIntegrationEvent: (e: ApprovalLeaseIntegrationAuditEvent) => { decisionEvents.push(e); },
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
      description: 'A safe local echo dogfood tool.',
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
    receipt-: ApprovalLeaseGateReceipt,
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

  test('safe tool registers as registered_unapproved, not executed', () => {
    const descriptor = makeDescriptor();
    const result = ZavorthExtensionFacade.registerCustomTool(descriptor);

    expect(result.qualifiedName).toBe('local:echo');
    expect(result.status).toBe('registered_unapproved');
    expect(result.fingerprint).toHaveLength(64);
    expect(descriptor.handler).not.toHaveBeenCalled();
  });

  test('medium risk tool registers as pending_approval', () => {
    const descriptor = makeDescriptor({ name: 'notes-preview', riskClass: 'medium' });
    const result = ZavorthExtensionFacade.registerCustomTool(descriptor);
    expect(result.status).toBe('pending_approval');
    expect(descriptor.handler).not.toHaveBeenCalled();
  });

  test('fingerprint is stable across repeated registration attempts with same descriptor', () => {
    const descriptor = makeDescriptor({ name: 'stable-echo' });
    const r1 = ZavorthExtensionFacade.registerCustomTool(descriptor);
    // Re-register same descriptor in a fresh facade
    ZavorthExtensionFacade.resetForTests();
    const r2 = ZavorthExtensionFacade.registerCustomTool(descriptor);
    expect(r1.fingerprint).toBe(r2.fingerprint);
  });

  test('missing gate receipt fails closed before consulting any lease', () => {
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
      grantReason: 'dogfood',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(baseDecisionContext(reg.qualifiedName, reg.fingerprint, undefined));

    expect(result.status).toBe('fail_closed');
    expect(result.upstreamGatesConfirmed).toBe(false);
    expect(descriptor.handler).not.toHaveBeenCalled();
    expect(decisionEvents.some(e => e.eventType === 'lease_fail_closed')).toBe(true);
  });

  test('complete gate receipt + valid lease yields lease_satisfied, handler never called', () => {
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
      grantReason: 'dogfood',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)),
    );

    expect(result.status).toBe('lease_satisfied');
    expect(result.upstreamGatesConfirmed).toBe(true);
    expect(result.leaseConsidered).toBe(true);

    // Advisory-only language — no execution properties
    expect(result).not.toHaveProperty('executor');
    expect(result).not.toHaveProperty('bypass');
    expect(result).not.toHaveProperty('executeNow');
    expect(result).not.toHaveProperty('approved');

    // Handler never called during evaluation
    expect(descriptor.handler).not.toHaveBeenCalled();

    // Audit event emitted
    expect(decisionEvents.some(e => e.eventType === 'lease_satisfied')).toBe(true);
  });

  test('no lease present requires normal approval path', () => {
    const descriptor = makeDescriptor({ name: 'unleasable' });
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink);
    const result = adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)),
    );

    expect(result.status).toBe('requires_approval');
    expect(descriptor.handler).not.toHaveBeenCalled();
  });

  test('audit events do not contain forbidden field keys', () => {
    const descriptor = makeDescriptor({ name: 'audit-check-echo' });
    const reg = ZavorthExtensionFacade.registerCustomTool(descriptor);
    leaseService.grantLease({
      subjectId: 'user-dogfood',
      workspaceId: 'ws-dogfood',
      toolQualifiedName: reg.qualifiedName,
      toolFingerprint: reg.fingerprint,
      riskClass: 'safe',
      allowedOperations: ['execute'],
      durationMs: 60 * 60 * 1000,
      grantReason: 'dogfood',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date(NOW) });
    adapter.evaluate(
      baseDecisionContext(reg.qualifiedName, reg.fingerprint, validReceipt(reg.fingerprint)),
    );

    const forbidden = ['prompt', 'authorization', 'bearer', 'secretref', 'rawkey', 'ciphertext', 'authtag', 'apikey'];
    for (const event of decisionEvents) {
      const keys = Object.keys(event).map(k => k.toLowerCase());
      for (const f of forbidden) {
        expect(keys).not.toContain(f);
      }
    }
  });
});
