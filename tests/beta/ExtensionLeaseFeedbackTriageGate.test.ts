/**
 * ExtensionLeaseFeedbackTriageGate.test.ts
 *
 * Verifies feedback triage gate rules and verdicts.
 */

import { ApprovalLeaseFeedbackSanitizer } from '../../src/approval-leases/ApprovalLeaseFeedbackSanitizer.js';
import { ApprovalLeaseFeedbackTriage, FeedbackTriageRecord } from '../../src/approval-leases/ApprovalLeaseFeedbackTriage.js';

describe('ExtensionLeaseFeedbackTriageGate', () => {
  test('P0 safety bypass blocks rollout', () => {
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      scenarioId: 'scen-bypass',
      extensionFixtureName: 'local.tester_echo',
      leaseDecisionStatus: 'requires_approval',
      safeFailureReasonCode: 'BYPASS_DETECTED',
      severity: 'P0',
      testerObservedOutcome: 'safety_bypass',
      followUpCategory: 'safety_blocker'
    });

    const record = ApprovalLeaseFeedbackTriage.createTriageRecord(feedback);
    expect(record.blocksRollout).toBe(true);
    expect(ApprovalLeaseFeedbackTriage.getVerdict([record])).toBe('NO_GO_EXTENSION_LEASE_FEEDBACK_TRIAGE_BLOCKED');
  });

  test('P0 secret leak blocks rollout', () => {
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      scenarioId: 'scen-leak',
      extensionFixtureName: 'local.tester_echo',
      leaseDecisionStatus: 'lease_satisfied',
      safeFailureReasonCode: 'SECRET_LEAK',
      severity: 'P0',
      testerObservedOutcome: 'secret_leak',
      followUpCategory: 'safety_blocker'
    });

    const record = ApprovalLeaseFeedbackTriage.createTriageRecord(feedback);
    expect(record.blocksRollout).toBe(true);
    expect(ApprovalLeaseFeedbackTriage.getVerdict([record])).toBe('NO_GO_EXTENSION_LEASE_FEEDBACK_TRIAGE_BLOCKED');
  });

  test('P0 unauthorized execution blocks rollout', () => {
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      scenarioId: 'scen-unauth-exec',
      extensionFixtureName: 'local.tester_echo',
      leaseDecisionStatus: 'lease_rejected',
      safeFailureReasonCode: 'UNAUTHORIZED_EXECUTION',
      severity: 'P0',
      testerObservedOutcome: 'unauthorized_execution',
      followUpCategory: 'safety_blocker'
    });

    const record = ApprovalLeaseFeedbackTriage.createTriageRecord(feedback);
    expect(record.blocksRollout).toBe(true);
    expect(ApprovalLeaseFeedbackTriage.getVerdict([record])).toBe('NO_GO_EXTENSION_LEASE_FEEDBACK_TRIAGE_BLOCKED');
  });

  test('P0 unauthorized exposure blocks rollout', () => {
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      scenarioId: 'scen-unauth-exposure',
      extensionFixtureName: 'local.tester_echo',
      leaseDecisionStatus: 'lease_rejected',
      safeFailureReasonCode: 'UNAUTHORIZED_EXPOSURE',
      severity: 'P0',
      testerObservedOutcome: 'unauthorized_exposure',
      followUpCategory: 'safety_blocker'
    });

    const record = ApprovalLeaseFeedbackTriage.createTriageRecord(feedback);
    expect(record.blocksRollout).toBe(true);
    expect(ApprovalLeaseFeedbackTriage.getVerdict([record])).toBe('NO_GO_EXTENSION_LEASE_FEEDBACK_TRIAGE_BLOCKED');
  });

  test('P1 fail-closed regression blocks rollout', () => {
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      scenarioId: 'scen-fail-closed',
      extensionFixtureName: 'local.tester_echo',
      leaseDecisionStatus: 'fail_closed',
      safeFailureReasonCode: 'FAIL_CLOSED_REGRESSION',
      severity: 'P1',
      testerObservedOutcome: 'fail_closed_regression',
      followUpCategory: 'fail_closed_regression'
    });

    const record = ApprovalLeaseFeedbackTriage.createTriageRecord(feedback);
    expect(record.blocksRollout).toBe(true);
    expect(ApprovalLeaseFeedbackTriage.getVerdict([record])).toBe('NO_GO_EXTENSION_LEASE_FEEDBACK_TRIAGE_BLOCKED');
  });

  test('P1 unsafe audit blocks rollout', () => {
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      scenarioId: 'scen-unsafe-audit',
      extensionFixtureName: 'local.tester_echo',
      leaseDecisionStatus: 'lease_rejected',
      safeFailureReasonCode: 'UNSAFE_AUDIT',
      severity: 'P1',
      testerObservedOutcome: 'unsafe_audit',
      followUpCategory: 'audit_safety'
    });

    const record = ApprovalLeaseFeedbackTriage.createTriageRecord(feedback);
    expect(record.blocksRollout).toBe(true);
    expect(ApprovalLeaseFeedbackTriage.getVerdict([record])).toBe('NO_GO_EXTENSION_LEASE_FEEDBACK_TRIAGE_BLOCKED');
  });

  test('P1 drift boundary regression blocks rollout', () => {
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      scenarioId: 'scen-drift',
      extensionFixtureName: 'local.tester_echo',
      leaseDecisionStatus: 'lease_rejected',
      safeFailureReasonCode: 'DRIFT_BOUNDARY_REGRESSION',
      severity: 'P1',
      testerObservedOutcome: 'drift_boundary_regression',
      followUpCategory: 'drift_boundary'
    });

    const record = ApprovalLeaseFeedbackTriage.createTriageRecord(feedback);
    expect(record.blocksRollout).toBe(true);
    expect(ApprovalLeaseFeedbackTriage.getVerdict([record])).toBe('NO_GO_EXTENSION_LEASE_FEEDBACK_TRIAGE_BLOCKED');
  });

  test('P1 revocation/expiration boundary regression blocks rollout', () => {
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      scenarioId: 'scen-revocation',
      extensionFixtureName: 'local.tester_echo',
      leaseDecisionStatus: 'lease_rejected',
      safeFailureReasonCode: 'REVOCATION_EXPIRATION_REGRESSION',
      severity: 'P1',
      testerObservedOutcome: 'revocation_expiration_regression',
      followUpCategory: 'revocation_expiration_boundary'
    });

    const record = ApprovalLeaseFeedbackTriage.createTriageRecord(feedback);
    expect(record.blocksRollout).toBe(true);
    expect(ApprovalLeaseFeedbackTriage.getVerdict([record])).toBe('NO_GO_EXTENSION_LEASE_FEEDBACK_TRIAGE_BLOCKED');
  });

  test('P1 workspace/profile/channel boundary regression blocks rollout', () => {
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      scenarioId: 'scen-boundary',
      extensionFixtureName: 'local.tester_echo',
      leaseDecisionStatus: 'lease_rejected',
      safeFailureReasonCode: 'BOUNDARY_REGRESSION',
      severity: 'P1',
      testerObservedOutcome: 'boundary_regression',
      followUpCategory: 'workspace_profile_boundary'
    });

    const record = ApprovalLeaseFeedbackTriage.createTriageRecord(feedback);
    expect(record.blocksRollout).toBe(true);
    expect(ApprovalLeaseFeedbackTriage.getVerdict([record])).toBe('NO_GO_EXTENSION_LEASE_FEEDBACK_TRIAGE_BLOCKED');
  });

  test('P2 usability issue does not mark safety bypass', () => {
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      scenarioId: 'scen-usability',
      extensionFixtureName: 'local.tester_echo',
      leaseDecisionStatus: 'lease_rejected',
      safeFailureReasonCode: 'USABILITY_BLOCKER',
      severity: 'P2',
      testerObservedOutcome: 'usability_blocker',
      followUpCategory: 'beta_usability'
    });

    const record = ApprovalLeaseFeedbackTriage.createTriageRecord(feedback);
    expect(record.blocksRollout).toBe(false);
    expect(ApprovalLeaseFeedbackTriage.getVerdict([record])).toBe('READY_FOR_EXTENSION_LEASE_BETA_FIX_SELECTION');
  });

  test('P3 guidance issue does not block rollout', () => {
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      scenarioId: 'scen-guidance',
      extensionFixtureName: 'local.tester_echo',
      leaseDecisionStatus: 'lease_satisfied',
      safeFailureReasonCode: 'GUIDANCE_ISSUE',
      severity: 'P3',
      testerObservedOutcome: 'guidance_issue',
      followUpCategory: 'tester_guidance'
    });

    const record = ApprovalLeaseFeedbackTriage.createTriageRecord(feedback);
    expect(record.blocksRollout).toBe(false);
    expect(ApprovalLeaseFeedbackTriage.getVerdict([record])).toBe('READY_FOR_EXTENSION_LEASE_BETA_FIX_SELECTION');
  });

  test('info observation does not block rollout', () => {
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      scenarioId: 'scen-observation',
      extensionFixtureName: 'local.tester_echo',
      leaseDecisionStatus: 'lease_satisfied',
      safeFailureReasonCode: 'OBSERVATION',
      severity: 'info',
      testerObservedOutcome: 'observation_only',
      followUpCategory: 'observation'
    });

    const record = ApprovalLeaseFeedbackTriage.createTriageRecord(feedback);
    expect(record.blocksRollout).toBe(false);
    expect(ApprovalLeaseFeedbackTriage.getVerdict([record])).toBe('READY_FOR_EXTENSION_LEASE_BETA_FIX_SELECTION');
  });

  test('no P0/P1 allows READY_FOR_EXTENSION_LEASE_BETA_FIX_SELECTION', () => {
    const f1 = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      scenarioId: 'scen-p2',
      extensionFixtureName: 'local.tester_echo',
      leaseDecisionStatus: 'lease_satisfied',
      safeFailureReasonCode: 'OK',
      severity: 'P2',
      followUpCategory: 'beta_usability'
    });
    const f2 = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      scenarioId: 'scen-info',
      extensionFixtureName: 'local.tester_echo',
      leaseDecisionStatus: 'lease_satisfied',
      safeFailureReasonCode: 'OK',
      severity: 'info',
      followUpCategory: 'observation'
    });

    const r1 = ApprovalLeaseFeedbackTriage.createTriageRecord(f1);
    const r2 = ApprovalLeaseFeedbackTriage.createTriageRecord(f2);
    expect(ApprovalLeaseFeedbackTriage.getVerdict([r1, r2])).toBe('READY_FOR_EXTENSION_LEASE_BETA_FIX_SELECTION');
  });
});
