/**
 * ApprovalLeaseControlledIntegration.test.ts
 *
 * Proves that the controlled lease integration never bypasses upstream
 * safety gates, never executes tools, never exposes tools, and always
 * falls back to the normal approval path when the lease is invalid.
 *
 * Gate receipt invariants enforced here:
 *  - validateGateReceipt is called before any lease is consulted
 *  - A truthy but incomplete object fails closed
 *  - riskClassResolved/toolFingerprintVerified cross-checks enforced
 */

import { ApprovalLeaseDecisionAdapter } from '../../src/approval-leases/ApprovalLeaseDecisionAdapter';
import { InMemoryApprovalLeaseStore } from '../../src/approval-leases/InMemoryApprovalLeaseStore';
import { ApprovalLeaseService } from '../../src/approval-leases/ApprovalLeaseService';
import {
  validateGateReceipt,
  APPROVAL_LEASE_INTEGRATION_INVARIANTS,
  APPROVAL_LEASE_INTEGRATION_ORDER,
} from '../../src/approval-leases/ApprovalLeaseIntegrationPolicy';
import type { ApprovalLeaseDecisionContext } from '../../src/approval-leases/ApprovalLeaseDecisionResult';
import type { ApprovalLeaseIntegrationAuditEvent } from '../../src/approval-leases/ApprovalLeaseDecisionAdapter';
import type { ApprovalLeaseGateReceipt } from '../../src/approval-leases/ApprovalLeaseIntegrationPolicy';

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

const NOW = '2026-06-15T12:00:00.000Z';
const CORR = 'corr-integration-test';

function validGateReceipt(overrides?: Partial<ApprovalLeaseGateReceipt>): ApprovalLeaseGateReceipt {
  return {
    channelWorkspaceExposureChecked: true,
    riskClassResolved: 'safe',
    toolGatekeeperExecuted: true,
    toolFingerprintVerified: 'fp-integration',
    ...overrides,
  };
}

function baseContext(overrides?: Partial<ApprovalLeaseDecisionContext>): ApprovalLeaseDecisionContext {
  return {
    subjectId: 'user-1',
    workspaceId: 'ws-1',
    toolQualifiedName: 'read_file',
    toolFingerprint: 'fp-integration',
    riskClass: 'safe',
    requestedOperation: 'read',
    auditCorrelationId: CORR,
    existingGateResult: validGateReceipt(),
    ...overrides,
  };
}

describe('ApprovalLeaseControlledIntegration', () => {
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
      toolFingerprint: 'fp-integration',
      riskClass: 'safe',
      allowedOperations: ['read'],
      durationMs: 24 * 60 * 60 * 1000,
      grantReason: 'test',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });
  }

  test('upstream gate must be a complete ApprovalLeaseGateReceipt before lease satisfaction', () => {
    const { sink } = makeSink();
    grantStandardLease();
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: () => new Date(NOW) });
    // Truthy but incomplete receipt — must fail_closed
    const result = adapter.evaluate(baseContext({
      existingGateResult: { toolGatekeeperExecuted: true },
    }));
    expect(result.status).toBe('fail_closed');
    expect(result.upstreamGatesConfirmed).toBe(false);
  });

  test('undefined existingGateResult fails closed regardless of lease presence', () => {
    const { sink } = makeSink();
    grantStandardLease();
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(baseContext({ existingGateResult: undefined }));
    expect(result.status).toBe('fail_closed');
    expect(result.upstreamGatesConfirmed).toBe(false);
  });

  test('riskClassResolved mismatch fails closed even with valid structure', () => {
    const { sink } = makeSink();
    grantStandardLease();
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(baseContext({
      riskClass: 'safe',
      existingGateResult: validGateReceipt({ riskClassResolved: 'low' }), // mismatch with context.riskClass='safe'
    }));
    expect(result.status).toBe('fail_closed');
    expect(result.upstreamGatesConfirmed).toBe(false);
  });

  test('toolFingerprintVerified mismatch fails closed even with valid structure', () => {
    const { sink } = makeSink();
    grantStandardLease();
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(baseContext({
      toolFingerprint: 'fp-integration',
      existingGateResult: validGateReceipt({ toolFingerprintVerified: 'fp-DIFFERENT' }), // mismatch
    }));
    expect(result.status).toBe('fail_closed');
    expect(result.upstreamGatesConfirmed).toBe(false);
  });

  test('complete consistent receipt allows lease evaluation', () => {
    const { sink } = makeSink();
    grantStandardLease();
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(baseContext());
    expect(result.status).toBe('lease_satisfied');
    expect(result.upstreamGatesConfirmed).toBe(true);
  });

  test('critical tools are never activated by a lease', () => {
    const { sink } = makeSink();
    const adapter = new ApprovalLeaseDecisionAdapter(sink);
    const result = adapter.evaluate(baseContext({
      riskClass: 'critical',
      existingGateResult: validGateReceipt({ riskClassResolved: 'critical' }),
    }));
    expect(result.status).toBe('not_applicable');
    expect(result.leaseConsidered).toBe(false);
  });

  test('unknown risk tools are never activated by a lease', () => {
    const { sink } = makeSink();
    const adapter = new ApprovalLeaseDecisionAdapter(sink);
    const result = adapter.evaluate(baseContext({
      riskClass: 'unknown',
      existingGateResult: validGateReceipt({ riskClassResolved: 'unknown' }),
    }));
    expect(result.status).toBe('not_applicable');
  });

  test('high risk tools fail closed by default (highRiskAllowed=false)', () => {
    const { sink } = makeSink();
    svc.grantLease({
      subjectId: 'user-1',
      workspaceId: 'ws-1',
      toolQualifiedName: 'read_file',
      toolFingerprint: 'fp-integration',
      riskClass: 'medium',
      allowedOperations: ['read'],
      durationMs: 2 * 60 * 60 * 1000,
      grantReason: 'test',
      grantSource: 'test_only',
      auditCorrelationId: CORR,
      currentTime: NOW,
    });
    const adapter = new ApprovalLeaseDecisionAdapter(sink, {
      policyConfig: { highRiskAllowed: false },
      now: () => new Date(NOW),
    });
    const result = adapter.evaluate(baseContext({
      riskClass: 'high',
      existingGateResult: validGateReceipt({ riskClassResolved: 'high' }),
    }));
    expect(result.status).toBe('lease_rejected');
  });

  test('lease_satisfied result is advisory-only; it carries no execution properties', () => {
    const { sink } = makeSink();
    grantStandardLease();
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: () => new Date(NOW) });
    const result = adapter.evaluate(baseContext());
    expect(result.status).toBe('lease_satisfied');
    expect(result).not.toHaveProperty('executor');
    expect(result).not.toHaveProperty('toolRunner');
    expect(result).not.toHaveProperty('channelExposed');
    expect(result).not.toHaveProperty('executeNow');
    expect(result).not.toHaveProperty('bypass');
  });

  test('ToolExposurePolicy module is not imported by the lease adapter', () => {
    const adapterSource = require('fs').readFileSync(
      require('path').resolve('src/approval-leases/ApprovalLeaseDecisionAdapter.ts'),
      'utf8',
    );
    expect(adapterSource).not.toContain('ToolExposurePolicy');
  });

  test('risk classifier is not imported by the lease adapter', () => {
    const adapterSource = require('fs').readFileSync(
      require('path').resolve('src/approval-leases/ApprovalLeaseDecisionAdapter.ts'),
      'utf8',
    );
    expect(adapterSource).not.toContain('WorkspaceCommandRiskClassifier');
  });

  test('ApprovalDecisionCacheService is not imported by the lease adapter', () => {
    const adapterSource = require('fs').readFileSync(
      require('path').resolve('src/approval-leases/ApprovalLeaseDecisionAdapter.ts'),
      'utf8',
    );
    expect(adapterSource).not.toContain('ApprovalDecisionCacheService');
  });

  test('adapter imports validateGateReceipt from ApprovalLeaseIntegrationPolicy', () => {
    const adapterSource = require('fs').readFileSync(
      require('path').resolve('src/approval-leases/ApprovalLeaseDecisionAdapter.ts'),
      'utf8',
    );
    expect(adapterSource).toContain('validateGateReceipt');
  });

  test('fallback to requires_approval when no valid lease exists', () => {
    const { sink } = makeSink();
    const adapter = new ApprovalLeaseDecisionAdapter(sink);
    const result = adapter.evaluate(baseContext());
    expect(result.status).toBe('requires_approval');
  });

  test('fallback to lease_rejected when all candidates fail evaluation', () => {
    const { sink } = makeSink();
    grantStandardLease();
    const adapter = new ApprovalLeaseDecisionAdapter(sink, { now: () => new Date(NOW) });
    // Operation mismatch will reject the lease candidate
    const result = adapter.evaluate(baseContext({ requestedOperation: 'write' }));
    expect(result.status).toBe('lease_rejected');
  });

  test('APPROVAL_LEASE_INTEGRATION_INVARIANTS are all true', () => {
    for (const [, value] of Object.entries(APPROVAL_LEASE_INTEGRATION_INVARIANTS)) {
      expect(value).toBe(true);
    }
  });

  test('integration order constants are sequential', () => {
    const values = Object.values(APPROVAL_LEASE_INTEGRATION_ORDER);
    for (let i = 0; i < values.length - 1; i++) {
      expect(values[i]).toBeLessThan(values[i + 1]);
    }
    expect(APPROVAL_LEASE_INTEGRATION_ORDER.EVALUATE_APPROVAL_LEASE).toBeGreaterThan(
      APPROVAL_LEASE_INTEGRATION_ORDER.TOOL_GATEKEEPER_POLICY_CHECK,
    );
    expect(APPROVAL_LEASE_INTEGRATION_ORDER.EVALUATE_APPROVAL_LEASE).toBeGreaterThan(
      APPROVAL_LEASE_INTEGRATION_ORDER.RISK_CLASSIFICATION,
    );
    expect(APPROVAL_LEASE_INTEGRATION_ORDER.EVALUATE_APPROVAL_LEASE).toBeGreaterThan(
      APPROVAL_LEASE_INTEGRATION_ORDER.CHANNEL_WORKSPACE_EXPOSURE_CHECK,
    );
  });

  test('validateGateReceipt accepts a valid complete receipt', () => {
    const receipt = validGateReceipt();
    expect(validateGateReceipt(receipt)).toBe(true);
  });

  test('validateGateReceipt rejects null', () => {
    expect(validateGateReceipt(null)).toBe(false);
  });

  test('validateGateReceipt rejects empty object', () => {
    expect(validateGateReceipt({})).toBe(false);
  });

  test('validateGateReceipt rejects partial receipt missing channelWorkspaceExposureChecked', () => {
    expect(validateGateReceipt({
      riskClassResolved: 'safe',
      toolGatekeeperExecuted: true,
      toolFingerprintVerified: 'fp',
    })).toBe(false);
  });

  test('validateGateReceipt rejects receipt with channelWorkspaceExposureChecked=false', () => {
    expect(validateGateReceipt({
      channelWorkspaceExposureChecked: false,
      riskClassResolved: 'safe',
      toolGatekeeperExecuted: true,
      toolFingerprintVerified: 'fp',
    })).toBe(false);
  });

  test('validateGateReceipt rejects receipt missing toolGatekeeperExecuted', () => {
    expect(validateGateReceipt({
      channelWorkspaceExposureChecked: true,
      riskClassResolved: 'safe',
      toolFingerprintVerified: 'fp',
    })).toBe(false);
  });
});
