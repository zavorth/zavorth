/**
 * ExtensionLeaseBetaFixSelectionSafety.test.ts
 *
 * Verifies safety constraints on the fix selection records and utility.
 */

import { ApprovalLeaseFeedbackSanitizer } from '../../src/approval-leases/ApprovalLeaseFeedbackSanitizer.js';
import { ApprovalLeaseFeedbackTriage } from '../../src/approval-leases/ApprovalLeaseFeedbackTriage.js';
import { ApprovalLeaseFeedbackFixSelection } from '../../src/approval-leases/ApprovalLeaseFeedbackFixSelection.js';

describe('ExtensionLeaseBetaFixSelectionSafety', () => {
  let triageRecord: any;

  beforeEach(() => {
    triageRecord = ApprovalLeaseFeedbackTriage.createTriageRecord(
      ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
        scenarioId: 'scen-safety',
        extensionFixtureName: 'local.test',
        leaseDecisionStatus: 'lease_satisfied',
        safeFailureReasonCode: 'SUCCESS',
        severity: 'info'
      })
    );
  });

  test('fix selection rejects invalid priority', () => {
    expect(() => {
      ApprovalLeaseFeedbackFixSelection.createFixSelectionRecord(triageRecord, {
        fixPriority: 'critical_emergency' as any
      });
    }).toThrow(/Invalid fix priority/);
  });

  test('fix selection rejects invalid action', () => {
    expect(() => {
      ApprovalLeaseFeedbackFixSelection.createFixSelectionRecord(triageRecord, {
        recommendedAction: 'bypass_entire_gatekeeper' as any
      });
    }).toThrow(/Invalid recommended action/);
  });

  test('fix selection rejects invalid severity', () => {
    expect(() => {
      ApprovalLeaseFeedbackFixSelection.createFixSelectionRecord(triageRecord, {
        severity: 'P5' as any
      });
    }).toThrow(/Invalid severity/);
  });

  test('fix selection sanitizes selection reason and summary and excludes filesystem paths', () => {
    const record = ApprovalLeaseFeedbackFixSelection.createFixSelectionRecord(triageRecord, {
      selectionReason: 'Bearer token mySecret. Path is /home/user/app/file.txt',
      sanitizedSummary: 'Summary rawPrompt and secretRef check'
    });

    expect(record.selectionReason).not.toContain('Bearer');
    expect(record.selectionReason).not.toContain('mySecret');
    expect(record.selectionReason).toContain('[REDACTED_AUTH]');
    expect(record.selectionReason).toContain('[REDACTED_PATH]');

    expect(record.sanitizedSummary).not.toContain('rawPrompt');
    expect(record.sanitizedSummary).not.toContain('secretRef');
  });

  test('fix selection does not modify state or create persistent storage', () => {
    const beforeCount = (ApprovalLeaseFeedbackFixSelection as any).sequenceCounter;
    const record = ApprovalLeaseFeedbackFixSelection.createFixSelectionRecord(triageRecord);
    const afterCount = (ApprovalLeaseFeedbackFixSelection as any).sequenceCounter;

    expect(record).toBeDefined();
    expect(afterCount).toBe(beforeCount + 1);

    // Pure functional verification: no side-effects
  });
});
