/**
 * ExtensionLeaseBetaFixSelection.test.ts
 *
 * Verifies the mapping of triage records to fix selection priorities and verdicts.
 */

import { ApprovalLeaseFeedbackSanitizer } from '../../src/approval-leases/ApprovalLeaseFeedbackSanitizer.js';
import { ApprovalLeaseFeedbackTriage } from '../../src/approval-leases/ApprovalLeaseFeedbackTriage.js';
import { ApprovalLeaseFeedbackFixSelection } from '../../src/approval-leases/ApprovalLeaseFeedbackFixSelection.js';

describe('ExtensionLeaseBetaFixSelection', () => {
  let triageP0: any;
  let triageP1: any;
  let triageP2: any;
  let triageP3: any;
  let triageInfo: any;

  beforeEach(() => {
    triageP0 = ApprovalLeaseFeedbackTriage.createTriageRecord(
      ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
        scenarioId: 'scen-p0',
        extensionFixtureName: 'local.test',
        leaseDecisionStatus: 'requires_approval',
        safeFailureReasonCode: 'BYPASS_DETECTED',
        severity: 'P0',
        testerObservedOutcome: 'bypass'
      })
    );

    triageP1 = ApprovalLeaseFeedbackTriage.createTriageRecord(
      ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
        scenarioId: 'scen-p1',
        extensionFixtureName: 'local.test',
        leaseDecisionStatus: 'fail_closed',
        safeFailureReasonCode: 'FAIL_CLOSED_REGRESSION',
        severity: 'P1',
        testerObservedOutcome: 'regression'
      })
    );

    triageP2 = ApprovalLeaseFeedbackTriage.createTriageRecord(
      ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
        scenarioId: 'scen-p2',
        extensionFixtureName: 'local.test',
        leaseDecisionStatus: 'lease_rejected',
        safeFailureReasonCode: 'USABILITY_BLOCKER',
        severity: 'P2',
        testerObservedOutcome: 'usability'
      })
    );

    triageP3 = ApprovalLeaseFeedbackTriage.createTriageRecord(
      ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
        scenarioId: 'scen-p3',
        extensionFixtureName: 'local.test',
        leaseDecisionStatus: 'lease_satisfied',
        safeFailureReasonCode: 'MINOR_GUIDANCE_NEEDED',
        severity: 'P3',
        testerObservedOutcome: 'guidance'
      })
    );

    triageInfo = ApprovalLeaseFeedbackTriage.createTriageRecord(
      ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
        scenarioId: 'scen-info',
        extensionFixtureName: 'local.test',
        leaseDecisionStatus: 'lease_satisfied',
        safeFailureReasonCode: 'OBSERVATION_OK',
        severity: 'info',
        testerObservedOutcome: 'observation'
      })
    );
  });

  test('P0 safety bypass becomes must_fix_before_beta_continue', () => {
    const record = ApprovalLeaseFeedbackFixSelection.createFixSelectionRecord(triageP0);
    expect(record.fixPriority).toBe('must_fix_before_beta_continue');
    expect(record.blocksNextBetaCycle).toBe(true);
    expect(record.selectedForFix).toBe(true);
  });

  test('P0 secret leak becomes must_fix_before_beta_continue', () => {
    const secretTriage = ApprovalLeaseFeedbackTriage.createTriageRecord(
      ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
        scenarioId: 'scen-p0-leak',
        extensionFixtureName: 'local.test',
        leaseDecisionStatus: 'lease_satisfied',
        safeFailureReasonCode: 'SECRET_LEAK',
        severity: 'P0'
      })
    );
    const record = ApprovalLeaseFeedbackFixSelection.createFixSelectionRecord(secretTriage);
    expect(record.fixPriority).toBe('must_fix_before_beta_continue');
    expect(record.blocksNextBetaCycle).toBe(true);
  });

  test('P1 fail-closed regression becomes must_fix_before_beta_continue', () => {
    const record = ApprovalLeaseFeedbackFixSelection.createFixSelectionRecord(triageP1);
    expect(record.fixPriority).toBe('must_fix_before_beta_continue');
    expect(record.blocksNextBetaCycle).toBe(true);
  });

  test('P1 unsafe audit becomes must_fix_before_beta_continue', () => {
    const auditTriage = ApprovalLeaseFeedbackTriage.createTriageRecord(
      ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
        scenarioId: 'scen-p1-audit',
        extensionFixtureName: 'local.test',
        leaseDecisionStatus: 'lease_rejected',
        safeFailureReasonCode: 'UNSAFE_AUDIT',
        severity: 'P1'
      })
    );
    const record = ApprovalLeaseFeedbackFixSelection.createFixSelectionRecord(auditTriage);
    expect(record.fixPriority).toBe('must_fix_before_beta_continue');
    expect(record.blocksNextBetaCycle).toBe(true);
  });

  test('P2 usability blocker becomes should_fix_in_beta', () => {
    const record = ApprovalLeaseFeedbackFixSelection.createFixSelectionRecord(triageP2);
    expect(record.fixPriority).toBe('should_fix_in_beta');
    expect(record.blocksNextBetaCycle).toBe(false);
    expect(record.selectedForFix).toBe(true);
  });

  test('P3 guidance issue becomes can_defer', () => {
    const record = ApprovalLeaseFeedbackFixSelection.createFixSelectionRecord(triageP3);
    expect(record.fixPriority).toBe('can_defer');
    expect(record.blocksNextBetaCycle).toBe(false);
    expect(record.selectedForFix).toBe(false);
  });

  test('info observation becomes observation_only', () => {
    const record = ApprovalLeaseFeedbackFixSelection.createFixSelectionRecord(triageInfo);
    expect(record.fixPriority).toBe('observation_only');
    expect(record.blocksNextBetaCycle).toBe(false);
    expect(record.selectedForFix).toBe(false);
  });

  test('no P0/P1 pending allows continuation verdict or fix implementation', () => {
    const recP3 = ApprovalLeaseFeedbackFixSelection.createFixSelectionRecord(triageP3);
    const recInfo = ApprovalLeaseFeedbackFixSelection.createFixSelectionRecord(triageInfo);

    // No fixes selected
    expect(ApprovalLeaseFeedbackFixSelection.getVerdict([recP3, recInfo])).toBe(
      'READY_FOR_EXTENSION_LEASE_BETA_CONTINUATION_WITH_NO_BLOCKING_FIXES'
    );

    // If P2 is added, it is selected for fix, triggering fix implementation
    const recP2 = ApprovalLeaseFeedbackFixSelection.createFixSelectionRecord(triageP2);
    expect(ApprovalLeaseFeedbackFixSelection.getVerdict([recP2, recInfo])).toBe(
      'READY_FOR_EXTENSION_LEASE_BETA_FIX_IMPLEMENTATION'
    );
  });
});
