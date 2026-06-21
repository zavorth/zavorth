/**
 * ExtensionLeaseFeedbackBacklog.test.ts
 *
 * Verifies that safe backlog items can be built from sanitized feedback.
 */

import { ApprovalLeaseFeedbackSanitizer } from '../../src/approval-leases/ApprovalLeaseFeedbackSanitizer.js';
import { ApprovalLeaseFeedbackTriage } from '../../src/approval-leases/ApprovalLeaseFeedbackTriage.js';

describe('ExtensionLeaseFeedbackBacklog', () => {
  test('safe backlog item can be built from sanitized feedback and verifies requirements', () => {
    // 1. Setup feedback containing sensitive info that should be redacted
    const rawFeedback = {
      scenarioId: 'scen-backlog-01',
      extensionFixtureName: 'local.tester_echo',
      leaseDecisionStatus: 'lease_rejected',
      safeFailureReasonCode: 'REJECTED_VIA_GATEKEEPER',
      severity: 'P1' as const,
      sanitizedNotes: 'Authorization: Bearer mySecretToken. We used rawPrompt: SELECT * FROM secrets. Also providerResponse: {choices: []} and secretRef: 123. Handler: => console.log(process.env.API_KEY). Path: C:\\Users\\user\\test\\file.txt',
      followUpCategory: 'safety_blocker',
      testerObservedOutcome: 'blocked'
    };

    const sanitized = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback(rawFeedback);
    const triageRecord = ApprovalLeaseFeedbackTriage.createTriageRecord(sanitized, {
      recommendedAction: 'block_rollout'
    });

    // 2. Verify all safe fields exist
    expect(triageRecord.scenarioId).toBe('scen-backlog-01');
    expect(triageRecord.safeFailureReasonCode).toBe('REJECTED_VIA_GATEKEEPER');
    expect(triageRecord.severity).toBe('P1');
    expect(triageRecord.followUpCategory).toBe('safety_blocker');
    expect(triageRecord.recommendedAction).toBe('block_rollout');

    // 3. Verify exclusions in serialized record
    const serialized = JSON.stringify(triageRecord);

    expect(serialized).not.toContain('mySecretToken');
    expect(serialized).not.toContain('SELECT * FROM secrets');
    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('secretRef');
    expect(serialized).not.toContain('rawPrompt');
    expect(serialized).not.toContain('providerResponse');
    expect(serialized).not.toContain('process.env');
    expect(serialized).not.toContain('C:\\Users\\user');
    expect(serialized).not.toContain('=>');
  });
});
