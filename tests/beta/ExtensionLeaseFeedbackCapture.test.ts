/**
 * ExtensionLeaseFeedbackCapture.test.ts
 *
 * Feedback capture verification:
 *  - safe feedback object can be created
 *  - feedback captures scenario id
 *  - feedback captures extension fixture name
 *  - feedback captures lease decision status
 *  - feedback captures safe failure reason code
 *  - feedback captures severity
 *  - feedback captures sanitized notes
 *  - feedback rejects invalid severity
 *  - feedback rejects unknown status
 *  - feedback does not require raw prompt/provider response
 */

import { ApprovalLeaseFeedbackSanitizer } from '../../src/approval-leases/ApprovalLeaseFeedbackSanitizer.js';

describe('ExtensionLeaseFeedbackCapture', () => {
  test('safe feedback object can be created with correct fields', () => {
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      scenarioId: 'scen-01-echo',
      extensionFixtureName: 'local.tester_echo',
      riskClass: 'safe',
      leaseDecisionStatus: 'lease_satisfied',
      safeFailureReasonCode: 'NONE',
      severity: 'P2',
      sanitizedNotes: 'Lease correctly applied and bypassed repeated prompt.',
      testerObservedOutcome: 'success',
      reproducibility: 'always',
      followUpCategory: 'usability'
    });

    expect(feedback.scenarioId).toBe('scen-01-echo');
    expect(feedback.extensionFixtureName).toBe('local.tester_echo');
    expect(feedback.riskClass).toBe('safe');
    expect(feedback.leaseDecisionStatus).toBe('lease_satisfied');
    expect(feedback.safeFailureReasonCode).toBe('NONE');
    expect(feedback.severity).toBe('P2');
    expect(feedback.sanitizedNotes).toBe('Lease correctly applied and bypassed repeated prompt.');
  });

  test('feedback rejects invalid severity', () => {
    expect(() => {
      ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
        scenarioId: 'scen-01-echo',
        extensionFixtureName: 'local.tester_echo',
        leaseDecisionStatus: 'lease_satisfied',
        severity: 'INVALID_SEVERITY' as any
      });
    }).toThrow('Invalid severity');
  });

  test('feedback rejects unknown leaseDecisionStatus', () => {
    expect(() => {
      ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
        scenarioId: 'scen-01-echo',
        extensionFixtureName: 'local.tester_echo',
        leaseDecisionStatus: 'UNKNOWN_STATUS',
        severity: 'P2'
      });
    }).toThrow('Invalid leaseDecisionStatus');
  });

  test('feedback does not require raw prompt or provider response to be created', () => {
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      scenarioId: 'scen-02-no-payload',
      extensionFixtureName: 'local.tester_echo',
      leaseDecisionStatus: 'lease_rejected',
      severity: 'P3'
    });

    expect(feedback.scenarioId).toBe('scen-02-no-payload');
    expect(feedback.severity).toBe('P3');
    expect(feedback.sanitizedNotes).toBe('');
  });
});
