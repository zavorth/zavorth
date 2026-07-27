/**
 * ApprovalLeaseIntegrationAudit.test.ts
 *
 * Validates that the integration-level audit correctly emits events
 * and excludes all secret and forbidden fields.
 */

import { ApprovalLeaseDecisionAdapter } from '../../src/approval-leases/ApprovalLeaseDecisionAdapter';
import { InMemoryApprovalLeaseStore } from '../../src/approval-leases/InMemoryApprovalLeaseStore';
import { ApprovalLeaseService } from '../../src/approval-leases/ApprovalLeaseService';
import type { ApprovalLeaseDecisionContext } from '../../src/approval-leases/ApprovalLeaseDecisionResult';
import type { ApprovalLeaseIntegrationAuditEvent } from '../../src/approval-leases/ApprovalLeaseDecisionAdapter';
import type { ApprovalLeaseGateReceipt } from '../../src/approval-leases/ApprovalLeaseIntegrationPolicy';

const NOW = '2026-06-15T12:00:00.000Z';
const CORR = 'corr-audit-test';

function makeSink() {
  const events: ApprovalLeaseIntegrationAuditEvent[] = [];
  return {
    sink: { logIntegrationEvent: (e: ApprovalLeaseIntegrationAuditEvent) => { events.push(e); } },
    events,
  };
}

function makeLeaseSink() {
  return { logApprovalLeaseEvent: (_: unknown) => {} };
}

function validGateReceipt(overrides-: Partial<ApprovalLeaseGateReceipt>): ApprovalLeaseGateReceipt {
  return {
    channelWorkspaceExposureChecked: true,
    riskClassResolved: 'safe',
    toolGatekeeperExecuted: true,
    toolFingerprintVerified: 'fp-audit',
    ...overrides,
  };
}

function baseContext(overrides-: Partial<ApprovalLeaseDecisionContext>): ApprovalLeaseDecisionContext {
  return {
    subjectId: 'user-1',
    workspaceId: 'ws-1',
    toolQualifiedName: 'read_file',
    toolFingerprint: 'fp-audit',
    riskClass: 'safe',
    requestedOperation: 'read',
    auditCorrelationId: CORR,
    existingGateResult: validGateReceipt(),
    ...overrides,
  };
}

// Forbidden field *names* (keys) that must not appear on any audit event.
// We check that these names do not exist as JSON object keys.
// Words like "prompt" may appear in reason strings; what must not appear
// is a field *named* "prompt" on the audit event object.
const FORBIDDEN_AUDIT_KEY_NAMES = [
  'prompt',
  'rawprompt',
  'providerresponse',
  'rawproviderresponse',
  'authorization',
  'bearer',
  'secretref',
  'rawkey',
  'ciphertext',
  'authtag',
  'apikey',
  'password',
  'privatekey',
  'openai_api_key',
  'anthropic_api_key',
  'google_api_key',
];

function assertNoForbiddenFields(event: ApprovalLeaseIntegrationAuditEvent): void {
  const keys = Object.keys(event).map((k) => k.toLowerCase());
  for (const forbidden of FORBIDDEN_AUDIT_KEY_NAMES) {
    expect(keys).not.toContain(forbidden);
  }
  // Also verify no PEM private key content sneaks into any string value
  const serialized = JSON.stringify(event);
  expect(serialized).not.toContain('BEGIN PRIVATE KEY');
}

describe('ApprovalLeaseIntegrationAudit', () => {
  let svc: ApprovalLeaseService;

  beforeEach(() => {
    InMemoryApprovalLeaseStore.clearForTests();
    svc = new ApprovalLeaseService(makeLeaseSink());
  });

  function grantStandardLease() {
    svc.grantLease({
      subjectId: 'user-1',
      workspaceId: 'ws-1',
      toolQualifiedName: 'read_file',
      toolFingerprint: 'fp-audit',
      riskClass: 'safe',
      allowedOperations: ['read'],
      durationMs: 24 * 60 * 60 * 1000,
      grantReason: 'test',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });
  }

  test('lease_considered audit emitted when a candidate lease is found', () => {
    const { sink, events } = makeSink();
    grantStandardLease();
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: () => new Date(NOW) });
    // Operation mismatch forces rejection after lease_considered
    adapter.evaluate(baseContext({ requestedOperation: 'write' }));
    expect(events.some((e) => e.eventType === 'lease_considered')).toBe(true);
  });

  test('lease_satisfied audit emitted on successful match', () => {
    const { sink, events } = makeSink();
    grantStandardLease();
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: () => new Date(NOW) });
    adapter.evaluate(baseContext());
    expect(events.some((e) => e.eventType === 'lease_satisfied')).toBe(true);
  });

  test('lease_rejected audit emitted when all candidates fail', () => {
    const { sink, events } = makeSink();
    grantStandardLease();
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: () => new Date(NOW) });
    adapter.evaluate(baseContext({ requestedOperation: 'write' }));
    expect(events.some((e) => e.eventType === 'lease_rejected')).toBe(true);
  });

  test('lease_fail_closed audit emitted when gate result is missing', () => {
    const { sink, events } = makeSink();
    const adapter = new ApprovalLeaseDecisionAdapter(sink);
    adapter.evaluate(baseContext({ existingGateResult: undefined }));
    expect(events.some((e) => e.eventType === 'lease_fail_closed')).toBe(true);
  });

  test('lease_not_applicable audit emitted for critical risk', () => {
    const { sink, events } = makeSink();
    const adapter = new ApprovalLeaseDecisionAdapter(sink);
    adapter.evaluate(baseContext({
      riskClass: 'critical',
      existingGateResult: validGateReceipt({ riskClassResolved: 'critical' }),
    }));
    expect(events.some((e) => e.eventType === 'lease_not_applicable')).toBe(true);
  });

  test('all audit events exclude forbidden fields — lease_satisfied path', () => {
    const { sink, events } = makeSink();
    grantStandardLease();
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: () => new Date(NOW) });
    adapter.evaluate(baseContext());
    for (const event of events) {
      assertNoForbiddenFields(event);
    }
  });

  test('all audit events exclude forbidden fields — fail_closed path', () => {
    const { sink, events } = makeSink();
    const adapter = new ApprovalLeaseDecisionAdapter(sink);
    adapter.evaluate(baseContext({ existingGateResult: undefined }));
    for (const event of events) {
      assertNoForbiddenFields(event);
    }
  });

  test('all audit events exclude forbidden fields — lease_rejected path', () => {
    const { sink, events } = makeSink();
    grantStandardLease();
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: () => new Date(NOW) });
    adapter.evaluate(baseContext({ requestedOperation: 'write' }));
    for (const event of events) {
      assertNoForbiddenFields(event);
    }
  });

  test('audit events carry required safe fields', () => {
    const { sink, events } = makeSink();
    grantStandardLease();
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: () => new Date(NOW) });
    adapter.evaluate(baseContext());
    const satisfied = events.find((e) => e.eventType === 'lease_satisfied');
    expect(satisfied).toBeDefined();
    expect(satisfied!.subjectId).toBe('user-1');
    expect(satisfied!.workspaceId).toBe('ws-1');
    expect(satisfied!.toolQualifiedName).toBe('read_file');
    expect(satisfied!.toolFingerprint).toBe('fp-audit');
    expect(satisfied!.riskClass).toBe('safe');
    expect(satisfied!.requestedOperation).toBe('read');
    expect(satisfied!.auditCorrelationId).toBe(CORR);
    expect(satisfied!.timestamp).toBeDefined();
    expect(satisfied!.status).toBe('lease_satisfied');
    expect(satisfied!.reason).toBeTruthy();
  });
});
