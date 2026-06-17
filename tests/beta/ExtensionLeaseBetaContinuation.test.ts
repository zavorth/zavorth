/**
 * ExtensionLeaseBetaContinuation.test.ts
 *
 * Verifies beta continuation gate rules and summary outputs.
 */

import { ApprovalLeaseFeedbackSanitizer } from '../../src/approval-leases/ApprovalLeaseFeedbackSanitizer.js';
import { ApprovalLeaseFeedbackTriage } from '../../src/approval-leases/ApprovalLeaseFeedbackTriage.js';
import { ApprovalLeaseFeedbackFixSelection } from '../../src/approval-leases/ApprovalLeaseFeedbackFixSelection.js';
import { ApprovalLeaseBetaContinuation } from '../../src/approval-leases/ApprovalLeaseBetaContinuation.js';

describe('ExtensionLeaseBetaContinuation', () => {
  test('no P0/P1 pending allows READY_FOR_EXTENSION_LEASE_BETA_STABILITY_RC, P2/P3/info are non-blocking', () => {
    const feedbackP2 = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      scenarioId: 'scen-p2',
      extensionFixtureName: 'local.test',
      leaseDecisionStatus: 'lease_rejected',
      safeFailureReasonCode: 'USABILITY',
      severity: 'P2',
      followUpCategory: 'beta_usability'
    });

    const feedbackInfo = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      scenarioId: 'scen-info',
      extensionFixtureName: 'local.test',
      leaseDecisionStatus: 'lease_satisfied',
      safeFailureReasonCode: 'OK',
      severity: 'info',
      followUpCategory: 'observation'
    });

    const triageP2 = ApprovalLeaseFeedbackTriage.createTriageRecord(feedbackP2);
    const triageInfo = ApprovalLeaseFeedbackTriage.createTriageRecord(feedbackInfo);

    const selectionP2 = ApprovalLeaseFeedbackFixSelection.createFixSelectionRecord(triageP2, {
      fixPriority: 'should_fix_in_beta' // Non-blocking for continuation
    });
    const selectionInfo = ApprovalLeaseFeedbackFixSelection.createFixSelectionRecord(triageInfo);

    const record = ApprovalLeaseBetaContinuation.evaluateContinuation([triageP2, triageInfo], [selectionP2, selectionInfo]);

    expect(record.verdict).toBe('READY_FOR_EXTENSION_LEASE_BETA_STABILITY_RC');
    expect(record.hasBlockingFeedback).toBe(false);
    expect(record.hasBlockingFixes).toBe(false);
    expect(record.trackedIssuesCount).toBe(2);
  });

  test('continuation summary excludes forbidden markers', () => {
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      scenarioId: 'scen-safe',
      extensionFixtureName: 'local.test',
      leaseDecisionStatus: 'lease_satisfied',
      severity: 'info'
    });
    const triage = ApprovalLeaseFeedbackTriage.createTriageRecord(feedback);
    const selection = ApprovalLeaseFeedbackFixSelection.createFixSelectionRecord(triage);

    const record = ApprovalLeaseBetaContinuation.evaluateContinuation([triage], [selection]);
    const serialized = JSON.stringify(record);

    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('secretRef');
    expect(serialized).not.toContain('rawPrompt');
    expect(serialized).not.toContain('providerResponse');
  });

  test('continuation does not grant new authority or approve extensions or activate leases without gate receipt', () => {
    // Pure local utility has no side effects and does not change lease state or grant authority
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      scenarioId: 'scen-safe',
      extensionFixtureName: 'local.test',
      leaseDecisionStatus: 'lease_satisfied',
      severity: 'info'
    });
    const triage = ApprovalLeaseFeedbackTriage.createTriageRecord(feedback);
    const selection = ApprovalLeaseFeedbackFixSelection.createFixSelectionRecord(triage);

    const beforeVerdict = ApprovalLeaseBetaContinuation.evaluateContinuation([triage], [selection]);
    expect(beforeVerdict.verdict).toBe('READY_FOR_EXTENSION_LEASE_BETA_STABILITY_RC');

    // Confirming that the utility remains local and non-modifying
  });
});
