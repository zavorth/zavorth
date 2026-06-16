/**
 * ExtensionLeaseBetaFixBacklog.test.ts
 *
 * Verifies that safe fix backlog candidates can be built from safe triage records.
 */

import { ApprovalLeaseFeedbackSanitizer } from '../../src/approval-leases/ApprovalLeaseFeedbackSanitizer.js';
import { ApprovalLeaseFeedbackTriage } from '../../src/approval-leases/ApprovalLeaseFeedbackTriage.js';
import { ApprovalLeaseFeedbackFixSelection } from '../../src/approval-leases/ApprovalLeaseFeedbackFixSelection.js';

describe('ExtensionLeaseBetaFixBacklog', () => {
  test('safe fix backlog candidate can be built from safe triage record', () => {
    // 1. Create a raw feedback with credentials and sensitive items
    const rawFeedback = {
      scenarioId: 'scen-fix-backlog-01',
      extensionFixtureName: 'local.tester_echo',
      leaseDecisionStatus: 'lease_rejected',
      safeFailureReasonCode: 'REJECTED_VIA_GATEKEEPER',
      severity: 'P1' as const,
      sanitizedNotes: 'Authorization: Bearer mySecretToken. We used rawPrompt: SELECT * FROM secrets. Also providerResponse: {choices: []} and secretRef: 123. Handler: => console.log(process.env.API_KEY). Path: C:\\Users\\user\\test\\file.txt',
      followUpCategory: 'safety_blocker',
      testerObservedOutcome: 'blocked'
    };

    const sanitized = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback(rawFeedback);
    const triageRecord = ApprovalLeaseFeedbackTriage.createTriageRecord(sanitized);

    // Create backlog candidate
    const candidate = ApprovalLeaseFeedbackFixSelection.createFixSelectionRecord(triageRecord, {
      selectionReason: 'Must mitigate leak of Bearer token. Secret details rawPrompt: SELECT * FROM secrets. Also process.env.KEY. Path: C:\\Users\\user\\out.txt'
    });

    // 2. Validate safe fields are present
    expect(candidate.scenarioId).toBe('scen-fix-backlog-01');
    expect(candidate.safeFailureReasonCode).toBe('REJECTED_VIA_GATEKEEPER');
    expect(candidate.severity).toBe('P1');
    expect(candidate.followUpCategory).toBe('safety_blocker');
    expect(candidate.recommendedAction).toBe('block_rollout');
    expect(candidate.fixPriority).toBe('must_fix_before_beta_continue');

    // 3. Verify exclusions in serialized candidate
    const serialized = JSON.stringify(candidate);

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
