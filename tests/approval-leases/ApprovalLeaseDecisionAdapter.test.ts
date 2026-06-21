/**
 * ApprovalLeaseDecisionAdapter.test.ts
 *
 * Validates that the ApprovalLeaseDecisionAdapter evaluates leases as
 * a strictly advisory, fail-closed decision input.
 *
 * Gate receipt validation invariants:
 *  - Must be a complete ApprovalLeaseGateReceipt
 *  - channelWorkspaceExposureChecked === true
 *  - toolGatekeeperExecuted === true
 *  - riskClassResolved must match context.riskClass
 *  - toolFingerprintVerified must match context.toolFingerprint
 *
 * Audit sink fail-closed invariants:
 *  - null sink rejected at construction
 *  - synchronous throw from logIntegrationEvent => fail_closed result
 */

import { ApprovalLeaseDecisionAdapter } from '../../src/approval-leases/ApprovalLeaseDecisionAdapter';
import { InMemoryApprovalLeaseStore } from '../../src/approval-leases/InMemoryApprovalLeaseStore';
import { ApprovalLeaseService } from '../../src/approval-leases/ApprovalLeaseService';
import type { ApprovalLeaseDecisionContext } from '../../src/approval-leases/ApprovalLeaseDecisionResult';
import type { ApprovalLeaseIntegrationAuditEvent } from '../../src/approval-leases/ApprovalLeaseDecisionAdapter';
import type { ApprovalLeaseGateReceipt } from '../../src/approval-leases/ApprovalLeaseIntegrationPolicy';

// ---- Test helpers ----

const AUDIT_CORRELATION = 'corr-abc-123';
const NOW = '2026-06-15T12:00:00.000Z';

function makeNow(iso: string) {
  return () => new Date(iso);
}

function makeSink() {
  const events: ApprovalLeaseIntegrationAuditEvent[] = [];
  return {
    sink: { logIntegrationEvent: (e: ApprovalLeaseIntegrationAuditEvent) => { events.push(e); } },
    events,
  };
}

function makeThrowingSink(onEventType?: string) {
  return {
    logIntegrationEvent: (e: ApprovalLeaseIntegrationAuditEvent) => {
      if (!onEventType || e.eventType === onEventType) {
        throw new Error('Audit sink simulated failure for ' + e.eventType);
      }
    },
  };
}

function makeLeaseSink() {
  return { logApprovalLeaseEvent: (_: unknown) => {} };
}

function validGateReceipt(overrides?: Partial<ApprovalLeaseGateReceipt>): ApprovalLeaseGateReceipt {
  return {
    channelWorkspaceExposureChecked: true,
    riskClassResolved: 'safe',
    toolGatekeeperExecuted: true,
    toolFingerprintVerified: 'fp-abc',
    ...overrides,
  };
}

function baseContext(overrides?: Partial<ApprovalLeaseDecisionContext>): ApprovalLeaseDecisionContext {
  return {
    subjectId: 'user-1',
    workspaceId: 'ws-1',
    toolQualifiedName: 'read_file',
    toolFingerprint: 'fp-abc',
    riskClass: 'safe',
    requestedOperation: 'read',
    auditCorrelationId: AUDIT_CORRELATION,
    existingGateResult: validGateReceipt(),
    ...overrides,
  };
}

function grantLease(overrides?: Record<string, unknown>) {
  const svc = new ApprovalLeaseService(makeLeaseSink());
  return svc.grantLease({
    subjectId: 'user-1',
    workspaceId: 'ws-1',
    toolQualifiedName: 'read_file',
    toolFingerprint: 'fp-abc',
    riskClass: 'safe',
    allowedOperations: ['read'],
    durationMs: 24 * 60 * 60 * 1000,
    grantReason: 'test grant',
    grantSource: 'test_only',
    auditCorrelationId: AUDIT_CORRELATION,
    currentTime: NOW,
    ...overrides,
  });
}

// ---- Core decision tests ----

describe('ApprovalLeaseDecisionAdapter', () => {
  beforeEach(() => {
    InMemoryApprovalLeaseStore.clearForTests();
  });

  test('valid lease with complete gate receipt satisfies repeated approval', () => {
    const { sink, events } = makeSink();
    grantLease();
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: makeNow(NOW) });
    const result = adapter.evaluate(baseContext());
    expect(result.status).toBe('lease_satisfied');
    expect(result.leaseConsidered).toBe(true);
    expect(result.upstreamGatesConfirmed).toBe(true);
    expect(events.some((e) => e.eventType === 'lease_satisfied')).toBe(true);
  });

  test('missing lease requires normal approval', () => {
    const { sink } = makeSink();
    const adapter = new ApprovalLeaseDecisionAdapter(sink);
    const result = adapter.evaluate(baseContext());
    expect(result.status).toBe('requires_approval');
    expect(result.leaseConsidered).toBe(false);
  });

  test('expired lease results in lease_rejected', () => {
    const { sink } = makeSink();
    grantLease();
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: makeNow('2027-01-01T00:00:00.000Z') });
    const result = adapter.evaluate(baseContext({
      existingGateResult: validGateReceipt(),
    }));
    expect(result.status).toBe('lease_rejected');
    expect(result.leaseConsidered).toBe(true);
  });

  test('revoked lease falls back to approval path', () => {
    const { sink } = makeSink();
    const svc = new ApprovalLeaseService(makeLeaseSink());
    const lease = svc.grantLease({
      subjectId: 'user-1',
      workspaceId: 'ws-1',
      toolQualifiedName: 'read_file',
      toolFingerprint: 'fp-abc',
      riskClass: 'safe',
      allowedOperations: ['read'],
      durationMs: 24 * 60 * 60 * 1000,
      grantReason: 'test',
      grantSource: 'test_only',
      auditCorrelationId: AUDIT_CORRELATION,
      currentTime: NOW,
    });
    svc.revokeLease(lease.leaseId, 'test revoke', NOW);
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: makeNow(NOW) });
    const result = adapter.evaluate(baseContext());
    expect(['requires_approval', 'lease_rejected']).toContain(result.status);
  });

  test('fingerprint drift causes lease_rejected', () => {
    const { sink } = makeSink();
    grantLease();
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: makeNow(NOW) });
    const result = adapter.evaluate(baseContext({
      toolFingerprint: 'fp-different',
      existingGateResult: validGateReceipt({ toolFingerprintVerified: 'fp-different' }),
    }));
    expect(result.status).toBe('lease_rejected');
    expect(result.leaseConsidered).toBe(true);
  });

  test('risk class change causes lease_rejected', () => {
    const { sink } = makeSink();
    grantLease();
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: makeNow(NOW) });
    const result = adapter.evaluate(baseContext({
      riskClass: 'medium',
      existingGateResult: validGateReceipt({ riskClassResolved: 'medium' }),
    }));
    expect(result.status).toBe('lease_rejected');
  });

  test('workspace mismatch — no candidates found', () => {
    const { sink } = makeSink();
    grantLease();
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: makeNow(NOW) });
    const result = adapter.evaluate(baseContext({ workspaceId: 'ws-other' }));
    expect(result.status).toBe('requires_approval');
    expect(result.upstreamGatesConfirmed).toBe(true);
  });

  test('subject mismatch — no candidates found', () => {
    const { sink } = makeSink();
    grantLease();
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: makeNow(NOW) });
    const result = adapter.evaluate(baseContext({ subjectId: 'user-other' }));
    expect(result.status).toBe('requires_approval');
  });

  test('channel mismatch rejects when channel-scoped', () => {
    const { sink } = makeSink();
    const svc = new ApprovalLeaseService(makeLeaseSink());
    svc.grantLease({
      subjectId: 'user-1',
      workspaceId: 'ws-1',
      channelId: 'channel-a',
      toolQualifiedName: 'read_file',
      toolFingerprint: 'fp-abc',
      riskClass: 'safe',
      allowedOperations: ['read'],
      durationMs: 24 * 60 * 60 * 1000,
      grantReason: 'test',
      grantSource: 'test_only',
      auditCorrelationId: AUDIT_CORRELATION,
      currentTime: NOW,
    });
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: makeNow(NOW) });
    const result = adapter.evaluate(baseContext({ channelId: 'channel-b' }));
    expect(result.status).toBe('lease_rejected');
  });

  test('operation mismatch causes lease_rejected', () => {
    const { sink } = makeSink();
    grantLease(); // allowedOperations: ['read']
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: makeNow(NOW) });
    const result = adapter.evaluate(baseContext({ requestedOperation: 'write' }));
    expect(result.status).toBe('lease_rejected');
  });

  test('missing auditCorrelationId fails closed', () => {
    const { sink, events } = makeSink();
    const adapter = new ApprovalLeaseDecisionAdapter(sink);
    const result = adapter.evaluate(baseContext({ auditCorrelationId: '' }));
    expect(result.status).toBe('fail_closed');
    expect(events.some((e) => e.eventType === 'lease_fail_closed')).toBe(true);
  });

  test('critical risk returns not_applicable', () => {
    const { sink, events } = makeSink();
    const adapter = new ApprovalLeaseDecisionAdapter(sink);
    const result = adapter.evaluate(baseContext({
      riskClass: 'critical',
      existingGateResult: validGateReceipt({ riskClassResolved: 'critical' }),
    }));
    expect(result.status).toBe('not_applicable');
    expect(events.some((e) => e.eventType === 'lease_not_applicable')).toBe(true);
  });

  test('unknown risk returns not_applicable', () => {
    const { sink } = makeSink();
    const adapter = new ApprovalLeaseDecisionAdapter(sink);
    const result = adapter.evaluate(baseContext({
      riskClass: 'unknown',
      existingGateResult: validGateReceipt({ riskClassResolved: 'unknown' }),
    }));
    expect(result.status).toBe('not_applicable');
  });

  test('null audit sink throws at construction', () => {
    expect(() => {
      new ApprovalLeaseDecisionAdapter(null as unknown as never);
    }).toThrow('Audit sink is required');
  });

  // ---- Gate receipt validation tests ----

  test('undefined existingGateResult fails closed (no gate ran)', () => {
    const { sink, events } = makeSink();
    const adapter = new ApprovalLeaseDecisionAdapter(sink);
    const result = adapter.evaluate(baseContext({ existingGateResult: undefined }));
    expect(result.status).toBe('fail_closed');
    expect(result.upstreamGatesConfirmed).toBe(false);
    expect(events.some((e) => e.eventType === 'lease_fail_closed')).toBe(true);
  });

  test('truthy but incomplete object fails closed', () => {
    const { sink } = makeSink();
    const adapter = new ApprovalLeaseDecisionAdapter(sink);
    // Has toolGatekeeperExecuted but missing channelWorkspaceExposureChecked
    const result = adapter.evaluate(baseContext({
      existingGateResult: { toolGatekeeperExecuted: true },
    }));
    expect(result.status).toBe('fail_closed');
    expect(result.upstreamGatesConfirmed).toBe(false);
  });

  test('receipt missing channelWorkspaceExposureChecked fails closed', () => {
    const { sink } = makeSink();
    const adapter = new ApprovalLeaseDecisionAdapter(sink);
    const result = adapter.evaluate(baseContext({
      existingGateResult: {
        // channelWorkspaceExposureChecked intentionally omitted
        riskClassResolved: 'safe',
        toolGatekeeperExecuted: true,
        toolFingerprintVerified: 'fp-abc',
      },
    }));
    expect(result.status).toBe('fail_closed');
    expect(result.upstreamGatesConfirmed).toBe(false);
  });

  test('receipt missing toolGatekeeperExecuted fails closed', () => {
    const { sink } = makeSink();
    const adapter = new ApprovalLeaseDecisionAdapter(sink);
    const result = adapter.evaluate(baseContext({
      existingGateResult: {
        channelWorkspaceExposureChecked: true,
        riskClassResolved: 'safe',
        // toolGatekeeperExecuted intentionally omitted
        toolFingerprintVerified: 'fp-abc',
      },
    }));
    expect(result.status).toBe('fail_closed');
    expect(result.upstreamGatesConfirmed).toBe(false);
  });

  test('receipt riskClassResolved differs from context.riskClass fails closed', () => {
    const { sink, events } = makeSink();
    const adapter = new ApprovalLeaseDecisionAdapter(sink);
    const result = adapter.evaluate(baseContext({
      riskClass: 'safe',
      existingGateResult: validGateReceipt({ riskClassResolved: 'medium' }), // mismatch
    }));
    expect(result.status).toBe('fail_closed');
    expect(result.upstreamGatesConfirmed).toBe(false);
    expect(events.some((e) => e.eventType === 'lease_fail_closed')).toBe(true);
  });

  test('receipt toolFingerprintVerified differs from context.toolFingerprint fails closed', () => {
    const { sink, events } = makeSink();
    const adapter = new ApprovalLeaseDecisionAdapter(sink);
    const result = adapter.evaluate(baseContext({
      toolFingerprint: 'fp-abc',
      existingGateResult: validGateReceipt({ toolFingerprintVerified: 'fp-DIFFERENT' }), // mismatch
    }));
    expect(result.status).toBe('fail_closed');
    expect(result.upstreamGatesConfirmed).toBe(false);
    expect(events.some((e) => e.eventType === 'lease_fail_closed')).toBe(true);
  });

  test('complete and consistent gate receipt allows lease evaluation', () => {
    const { sink } = makeSink();
    grantLease();
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: makeNow(NOW) });
    const result = adapter.evaluate(baseContext({
      existingGateResult: validGateReceipt({
        channelWorkspaceExposureChecked: true,
        riskClassResolved: 'safe',
        toolGatekeeperExecuted: true,
        toolFingerprintVerified: 'fp-abc',
      }),
    }));
    // With a valid lease and complete receipt, must satisfy
    expect(result.status).toBe('lease_satisfied');
    expect(result.upstreamGatesConfirmed).toBe(true);
  });

  // ---- Audit sink fail-closed tests ----

  test('audit sink throw on lease_considered returns fail_closed', () => {
    grantLease();
    const throwingSink = makeThrowingSink('lease_considered');
    const adapter = new ApprovalLeaseDecisionAdapter(throwingSink, { now: makeNow(NOW) });
    const result = adapter.evaluate(baseContext());
    expect(result.status).toBe('fail_closed');
    expect(result.reason).toContain('Audit sink threw');
  });

  test('audit sink throw on lease_satisfied returns fail_closed', () => {
    grantLease();
    // Throw on lease_satisfied but not on lease_considered
    const throwingSink = makeThrowingSink('lease_satisfied');
    const adapter = new ApprovalLeaseDecisionAdapter(throwingSink, { now: makeNow(NOW) });
    const result = adapter.evaluate(baseContext());
    // lease_considered emitted first (pass), then lease_satisfied throws
    expect(result.status).toBe('fail_closed');
    expect(result.reason).toContain('Audit sink threw');
  });

  test('audit sink throw on lease_rejected returns fail_closed', () => {
    grantLease();
    const throwingSink = makeThrowingSink('lease_rejected');
    const adapter = new ApprovalLeaseDecisionAdapter(throwingSink, { now: makeNow(NOW) });
    // Fingerprint mismatch in receipt to force rejection after candidates are evaluated
    const result = adapter.evaluate(baseContext({
      toolFingerprint: 'fp-abc',
      existingGateResult: validGateReceipt({ toolFingerprintVerified: 'fp-abc' }),
      requestedOperation: 'write', // operation mismatch will cause candidate rejection
    }));
    expect(result.status).toBe('fail_closed');
    expect(result.reason).toContain('Audit sink threw');
  });

  test('no uncaught exception escapes from audit sink failure', () => {
    grantLease();
    const throwingSink = { logIntegrationEvent: () => { throw new Error('catastrophic sink failure'); } };
    const adapter = new ApprovalLeaseDecisionAdapter(throwingSink, { now: makeNow(NOW) });
    expect(() => adapter.evaluate(baseContext())).not.toThrow();
    const result = adapter.evaluate(baseContext());
    expect(result.status).toBe('fail_closed');
  });
});
