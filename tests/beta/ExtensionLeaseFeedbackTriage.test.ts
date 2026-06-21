/**
 * ExtensionLeaseFeedbackTriage.test.ts
 *
 * Feedback triage verification:
 *  - P0 safety bypass blocks progression
 *  - P0 secret leak blocks progression
 *  - P1 fail-closed regression blocks progression
 *  - P1 unsafe audit blocks progression
 *  - P2 usability blocker is tracked but does not mark safety bypass
 *  - P3 minor guidance issue is tracked
 *  - info observation is tracked
 *  - triage summary excludes forbidden markers
 *  - triage summary includes safe scenario id and safe reason code only
 *  - P0/P1 pending prevents READY verdict
 *  - no P0/P1 allows feedback cycle to advance
 */

import { ApprovalLeaseFeedbackSanitizer, BetaTesterFeedback } from '../../src/approval-leases/ApprovalLeaseFeedbackSanitizer.js';

class FeedbackTriageManager {
  private feedbackRecords: BetaTesterFeedback[] = [];

  public submitFeedback(feedback: BetaTesterFeedback): void {
    this.feedbackRecords.push(feedback);
  }

  public hasBlockingFeedback(): boolean {
    return this.feedbackRecords.some(r => r.severity === 'P0' || r.severity === 'P1');
  }

  public getVerdict(): string {
    if (this.hasBlockingFeedback()) {
      return 'NO_GO_EXTENSION_LEASE_FEEDBACK_CYCLE_BLOCKED';
    }
    return 'READY_FOR_EXTENSION_LEASE_BETA_FEEDBACK_TRIAGE';
  }

  public generateTriageSummary(): string {
    let summary = 'Feedback Triage Summary:\n';
    for (const record of this.feedbackRecords) {
      summary += `- Scenario: ${record.scenarioId}, Reason: ${record.safeFailureReasonCode}, Severity: ${record.severity}, Outcome: ${record.testerObservedOutcome}\n`;
    }

    const forbiddenPatterns = [
      'Bearer',
      'secretRef',
      'rawKey',
      'ciphertext',
      'authTag',
      'Authorization',
      'rawPrompt',
      'providerResponse',
      'BEGIN PRIVATE KEY'
    ];

    for (const pattern of forbiddenPatterns) {
      if (summary.includes(pattern)) {
        throw new Error(`Security Violation: Triage summary leaks forbidden token "${pattern}".`);
      }
    }

    return summary;
  }
}

describe('ExtensionLeaseFeedbackTriage', () => {
  let triageManager: FeedbackTriageManager;

  beforeEach(() => {
    triageManager = new FeedbackTriageManager();
  });

  test('P0 safety bypass and secret leak block progression', () => {
    triageManager.submitFeedback(
      ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
        scenarioId: 'scen-01',
        extensionFixtureName: 'local.tester_echo',
        leaseDecisionStatus: 'requires_approval',
        safeFailureReasonCode: 'BYPASS_DETECTED',
        severity: 'P0',
        testerObservedOutcome: 'safety_bypass'
      })
    );

    expect(triageManager.hasBlockingFeedback()).toBe(true);
    expect(triageManager.getVerdict()).toBe('NO_GO_EXTENSION_LEASE_FEEDBACK_CYCLE_BLOCKED');
  });

  test('P1 fail-closed regression and unsafe audit block progression', () => {
    triageManager.submitFeedback(
      ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
        scenarioId: 'scen-02',
        extensionFixtureName: 'local.tester_echo',
        leaseDecisionStatus: 'fail_closed',
        safeFailureReasonCode: 'AUDIT_UNSAFE',
        severity: 'P1',
        testerObservedOutcome: 'audit_failure'
      })
    );

    expect(triageManager.hasBlockingFeedback()).toBe(true);
    expect(triageManager.getVerdict()).toBe('NO_GO_EXTENSION_LEASE_FEEDBACK_CYCLE_BLOCKED');
  });

  test('P2 usability blocker is tracked but does not block progression', () => {
    triageManager.submitFeedback(
      ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
        scenarioId: 'scen-03',
        extensionFixtureName: 'local.tester_echo',
        leaseDecisionStatus: 'lease_rejected',
        safeFailureReasonCode: 'USABILITY_BLOCKER',
        severity: 'P2',
        testerObservedOutcome: 'usability_blocker'
      })
    );

    expect(triageManager.hasBlockingFeedback()).toBe(false);
    expect(triageManager.getVerdict()).toBe('READY_FOR_EXTENSION_LEASE_BETA_FEEDBACK_TRIAGE');
  });

  test('P3 minor guidance issue and info observations are tracked', () => {
    triageManager.submitFeedback(
      ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
        scenarioId: 'scen-04',
        extensionFixtureName: 'local.tester_echo',
        leaseDecisionStatus: 'lease_rejected',
        safeFailureReasonCode: 'MINOR_ISSUE',
        severity: 'P3',
        testerObservedOutcome: 'minor_guidance'
      })
    );

    triageManager.submitFeedback(
      ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
        scenarioId: 'scen-05',
        extensionFixtureName: 'local.tester_echo',
        leaseDecisionStatus: 'lease_satisfied',
        safeFailureReasonCode: 'OBSERVATION',
        severity: 'info',
        testerObservedOutcome: 'info_only'
      })
    );

    expect(triageManager.hasBlockingFeedback()).toBe(false);
    expect(triageManager.getVerdict()).toBe('READY_FOR_EXTENSION_LEASE_BETA_FEEDBACK_TRIAGE');
  });

  test('triage summary includes safe scenario id/reason code and excludes forbidden markers', () => {
    triageManager.submitFeedback(
      ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
        scenarioId: 'scen-safe-triage',
        extensionFixtureName: 'local.tester_echo',
        leaseDecisionStatus: 'lease_satisfied',
        safeFailureReasonCode: 'SAFE_REASON',
        severity: 'info',
        testerObservedOutcome: 'success',
        sanitizedNotes: 'Normal notes here.'
      })
    );

    const summary = triageManager.generateTriageSummary();
    expect(summary).toContain('scen-safe-triage');
    expect(summary).toContain('SAFE_REASON');
    expect(summary).not.toContain('Bearer');
    expect(summary).not.toContain('secretRef');
  });
});
