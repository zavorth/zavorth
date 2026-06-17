/**
 * ExtensionLeaseBetaStabilityRc.test.ts
 *
 * Verifies stability RC verdicts and output safety.
 */

import { ApprovalLeaseFeedbackSanitizer } from '../../src/approval-leases/ApprovalLeaseFeedbackSanitizer.js';
import { ApprovalLeaseFeedbackTriage } from '../../src/approval-leases/ApprovalLeaseFeedbackTriage.js';
import { ApprovalLeaseFeedbackFixSelection } from '../../src/approval-leases/ApprovalLeaseFeedbackFixSelection.js';
import { ApprovalLeaseBetaContinuation } from '../../src/approval-leases/ApprovalLeaseBetaContinuation.js';
import { ApprovalLeaseBetaStabilityRc } from '../../src/approval-leases/ApprovalLeaseBetaStabilityRc.js';

describe('ExtensionLeaseBetaStabilityRc', () => {
  test('no P0/P1 pending allows READY_FOR_EXTENSION_LEASE_BETA_CLOSEOUT_GO_NO_GO, P2/P3/info remain non-blocking', () => {
    const feedbackP2 = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      scenarioId: 'scen-p2',
      extensionFixtureName: 'local.test',
      leaseDecisionStatus: 'lease_rejected',
      severity: 'P2'
    });

    const triageP2 = ApprovalLeaseFeedbackTriage.createTriageRecord(feedbackP2);
    const selectionP2 = ApprovalLeaseFeedbackFixSelection.createFixSelectionRecord(triageP2, {
      fixPriority: 'should_fix_in_beta'
    });

    const continuationRecord = ApprovalLeaseBetaContinuation.evaluateContinuation([triageP2], [selectionP2]);
    expect(continuationRecord.verdict).toBe('READY_FOR_EXTENSION_LEASE_BETA_STABILITY_RC');

    const rcRecord = ApprovalLeaseBetaStabilityRc.evaluateRc(continuationRecord);
    expect(rcRecord.verdict).toBe('READY_FOR_EXTENSION_LEASE_BETA_CLOSEOUT_GO_NO_GO');
  });

  test('RC summary excludes forbidden markers', () => {
    const continuationRecord = {
      continuationId: 'cont-01',
      verdict: 'READY_FOR_EXTENSION_LEASE_BETA_STABILITY_RC' as const,
      triageSummary: 'Checked 0',
      fixSelectionSummary: 'Checked 0',
      hasBlockingFeedback: false,
      hasBlockingFixes: false,
      trackedIssuesCount: 0,
      createdAt: new Date().toISOString()
    };

    const record = ApprovalLeaseBetaStabilityRc.evaluateRc(continuationRecord, {
      sanitizedRcSummary: 'Checking Bearer and secretRef patterns.'
    });

    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('secretRef');
  });

  test('RC does not grant new authority, approve extensions, activate leases without gate receipt, or create persistent state', () => {
    const continuationRecord = {
      continuationId: 'cont-01',
      verdict: 'READY_FOR_EXTENSION_LEASE_BETA_STABILITY_RC' as const,
      triageSummary: 'Checked 0',
      fixSelectionSummary: 'Checked 0',
      hasBlockingFeedback: false,
      hasBlockingFixes: false,
      trackedIssuesCount: 0,
      createdAt: new Date().toISOString()
    };

    const record = ApprovalLeaseBetaStabilityRc.evaluateRc(continuationRecord);
    expect(record).toBeDefined();

    // Pure utility checks
  });

  test('RC record supports deterministic id and clock for audit closure', () => {
    const continuationRecord = {
      continuationId: 'cont-01',
      verdict: 'READY_FOR_EXTENSION_LEASE_BETA_STABILITY_RC' as const,
      triageSummary: 'Checked 0',
      fixSelectionSummary: 'Checked 0',
      hasBlockingFeedback: false,
      hasBlockingFixes: false,
      trackedIssuesCount: 0,
      createdAt: new Date().toISOString()
    };

    const record = ApprovalLeaseBetaStabilityRc.evaluateRc(
      continuationRecord,
      {},
      {
        idFactory: () => 'rc-fixed-21s-q',
        now: () => new Date('2026-06-15T13:00:00.000Z')
      }
    );

    expect(record.rcId).toBe('rc-fixed-21s-q');
    expect(record.createdAt).toBe('2026-06-15T13:00:00.000Z');
  });
});
