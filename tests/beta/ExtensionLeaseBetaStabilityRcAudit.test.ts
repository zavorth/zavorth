/**
 * ExtensionLeaseBetaStabilityRcAudit.test.ts
 *
 * Verifies that the audit and rollback capabilities remain fully operational
 * during the stability RC gate.
 */

import { ApprovalLeaseBetaStabilityRc } from '../../src/approval-leases/ApprovalLeaseBetaStabilityRc.js';
import { InMemoryApprovalLeaseStore } from '../../src/approval-leases/InMemoryApprovalLeaseStore.js';
import { ApprovalLeaseService } from '../../src/approval-leases/ApprovalLeaseService.js';
import { ApprovalLeaseDecisionAdapter } from '../../src/approval-leases/ApprovalLeaseDecisionAdapter.js';

describe('ExtensionLeaseBetaStabilityRcAudit', () => {
  let leaseService: ApprovalLeaseService;
  let mockLeaseAuditSink: any;
  let mockDecisionSink: any;

  beforeEach(() => {
    InMemoryApprovalLeaseStore.clearForTests();
    mockLeaseAuditSink = { logApprovalLeaseEvent: jest.fn() };
    leaseService = new ApprovalLeaseService(mockLeaseAuditSink);
    mockDecisionSink = { logIntegrationEvent: jest.fn() };
  });

  afterEach(() => {
    InMemoryApprovalLeaseStore.clearForTests();
  });

  test('audit summary excludes raw prompts, provider responses, Authorization/Bearer, secretRef/rawKey/ciphertext/authTag, handler source', () => {
    const rawAuditLog = 'Authorization: Bearer mySecretToken. rawPrompt: SELECT * FROM secrets. providerResponse: yes. secretRef: 123. rawKey: cipher. ciphertext: c1. authTag: a1. Handler: => fn';
    const sanitized = ApprovalLeaseBetaStabilityRc.sanitizeText(rawAuditLog);

    expect(sanitized).not.toContain('mySecretToken');
    expect(sanitized).not.toContain('SELECT * FROM secrets');
    expect(sanitized).not.toContain('Bearer');
    expect(sanitized).not.toContain('secretRef');
    expect(sanitized).not.toContain('rawPrompt');
    expect(sanitized).not.toContain('providerResponse');
    expect(sanitized).not.toContain('rawKey');
    expect(sanitized).not.toContain('ciphertext');
    expect(sanitized).not.toContain('authTag');
    expect(sanitized).not.toContain('=>');
  });

  test('rollback/disable path and normal approval fallback remain available', () => {
    InMemoryApprovalLeaseStore.clearForTests();

    const adapter = new ApprovalLeaseDecisionAdapter(mockDecisionSink, { now: () => new Date('2026-06-15T12:00:00.000Z') });
    const result = adapter.evaluate({
      subjectId: 'user-beta',
      workspaceId: 'ws-beta',
      toolQualifiedName: 'local:echo',
      toolFingerprint: 'hash-value',
      riskClass: 'safe',
      requestedOperation: 'execute',
      auditCorrelationId: 'corr-rc-audit',
      existingGateResult: {
        channelWorkspaceExposureChecked: true,
        toolGatekeeperExecuted: true,
        riskClassResolved: 'safe',
        toolFingerprintVerified: 'hash-value',
      }
    });

    // No lease exists, must fallback to requires_approval
    expect(result.status).toBe('requires_approval');
  });

  test('P0/P1 pending blocks RC, no P0/P1 allows closeout/go-no-go', () => {
    // 1. With P0/P1 pending (blocked continuation)
    const continuationRecordBlocked = {
      continuationId: 'cont-01',
      verdict: 'NO_GO_EXTENSION_LEASE_BETA_CONTINUATION_BLOCKED' as const,
      triageSummary: 'Blocked',
      fixSelectionSummary: 'Blocked',
      hasBlockingFeedback: true,
      hasBlockingFixes: true,
      trackedIssuesCount: 1,
      createdAt: new Date().toISOString()
    };

    const recordBlocked = ApprovalLeaseBetaStabilityRc.evaluateRc(continuationRecordBlocked);
    expect(recordBlocked.verdict).toBe('NO_GO_EXTENSION_LEASE_BETA_STABILITY_RC_BLOCKED');

    // 2. With no P0/P1 pending (ready continuation)
    const continuationRecordReady = {
      continuationId: 'cont-02',
      verdict: 'READY_FOR_EXTENSION_LEASE_BETA_STABILITY_RC' as const,
      triageSummary: 'Ready',
      fixSelectionSummary: 'Ready',
      hasBlockingFeedback: false,
      hasBlockingFixes: false,
      trackedIssuesCount: 0,
      createdAt: new Date().toISOString()
    };

    const recordReady = ApprovalLeaseBetaStabilityRc.evaluateRc(continuationRecordReady);
    expect(recordReady.verdict).toBe('READY_FOR_EXTENSION_LEASE_BETA_CLOSEOUT_GO_NO_GO');
  });
});
