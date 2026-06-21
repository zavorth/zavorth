/**
 * ExtensionLeaseInternalTesterFeedback.test.ts
 *
 * Feedback capture requirements:
 *  - feedback object captures scenario id
 *  - feedback object captures safe decision status
 *  - feedback object captures sanitized notes
 *  - feedback object captures severity without raw secrets
 *  - feedback object excludes raw prompts
 *  - feedback object excludes provider responses
 *  - feedback object excludes Authorization/Bearer
 *  - feedback object excludes secretRef/rawKey/ciphertext/authTag
 *  - feedback object excludes handler source
 *  - P0/P1/P2 severity values are explicit
 */

interface BetaTesterFeedback {
  scenarioId: string;
  extensionFixtureName: string;
  riskClass: string;
  leaseDecisionStatus: string;
  safeFailureReasonCode?: string;
  timestamp: string;
  testerObservedOutcome: string;
  sanitizedNotes: string;
  severity: 'P0' | 'P1' | 'P2';
}

describe('ExtensionLeaseInternalTesterFeedback', () => {
  function createFeedbackRecord(params: Partial<BetaTesterFeedback>): BetaTesterFeedback {
    // Basic sanitization/validation check helper simulating operator/tester behavior
    const feedback: BetaTesterFeedback = {
      scenarioId: 'scen-01-basic-satisfaction',
      extensionFixtureName: 'local.tester_echo',
      riskClass: 'safe',
      leaseDecisionStatus: 'lease_satisfied',
      timestamp: new Date().toISOString(),
      testerObservedOutcome: 'success',
      sanitizedNotes: 'Lease was successfully applied and skipped repeated prompt.',
      severity: 'P2',
      ...params,
    };

    const forbiddenPatterns = [
      /Bearer/i,
      /secretRef/i,
      /rawKey/i,
      /ciphertext/i,
      /authTag/i,
      /Authorization/i,
      /rawPrompt/i,
      /providerResponse/i,
      /function\s*\(/i, // handler source
    ];

    const serialize = JSON.stringify(feedback);
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(serialize)) {
        throw new Error(`Security Violation: Sensitive data detected in feedback record.`);
      }
    }

    return feedback;
  }

  test('feedback object successfully captures scenario and sanitized info', () => {
    const feedback = createFeedbackRecord({
      scenarioId: 'sc-rollout-01',
      sanitizedNotes: 'Lease correctly rejected after manual revocation.',
      severity: 'P2',
    });

    expect(feedback.scenarioId).toBe('sc-rollout-01');
    expect(feedback.severity).toBe('P2');
    expect(feedback.sanitizedNotes).toContain('revocation');
  });

  test('feedback fails to construct if sensitive credentials or raw prompts are passed', () => {
    expect(() => {
      createFeedbackRecord({
        sanitizedNotes: 'Tested with Authorization Bearer token 12345',
      });
    }).toThrow('Security Violation: Sensitive data detected in feedback record.');

    expect(() => {
      createFeedbackRecord({
        sanitizedNotes: 'Passed rawPrompt: SELECT * FROM secrets',
      });
    }).toThrow('Security Violation: Sensitive data detected in feedback record.');
  });

  test('P0/P1/P2 severity values are explicitly supported', () => {
    const p0 = createFeedbackRecord({ severity: 'P0' });
    const p1 = createFeedbackRecord({ severity: 'P1' });
    const p2 = createFeedbackRecord({ severity: 'P2' });

    expect(p0.severity).toBe('P0');
    expect(p1.severity).toBe('P1');
    expect(p2.severity).toBe('P2');
  });
});
