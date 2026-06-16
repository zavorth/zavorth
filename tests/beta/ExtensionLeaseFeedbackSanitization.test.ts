/**
 * ExtensionLeaseFeedbackSanitization.test.ts
 *
 * Feedback sanitization verification:
 *  - raw prompt marker is redacted or rejected
 *  - provider response marker is redacted or rejected
 *  - Authorization/Bearer marker is redacted or rejected
 *  - secretRef marker is redacted or rejected
 *  - apiKey marker is redacted or rejected
 *  - rawKey marker is redacted or rejected
 *  - ciphertext marker is redacted or rejected
 *  - authTag marker is redacted or rejected
 *  - BEGIN PRIVATE KEY marker is redacted or rejected
 *  - handler source marker is redacted or rejected
 *  - private filesystem path marker is redacted or rejected
 *  - sanitized output contains no forbidden markers
 */

import { ApprovalLeaseFeedbackSanitizer, REDACTION_TOKENS } from '../../src/approval-leases/ApprovalLeaseFeedbackSanitizer.js';

describe('ExtensionLeaseFeedbackSanitization', () => {
  const baseFeedback = {
    scenarioId: 'scen-sanitization',
    extensionFixtureName: 'local.tester_echo',
    leaseDecisionStatus: 'lease_satisfied',
    severity: 'P2' as const
  };

  test('raw prompt marker is redacted', () => {
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      ...baseFeedback,
      sanitizedNotes: 'Tester input was rawPrompt: SELECT * FROM keys;'
    });

    expect(feedback.sanitizedNotes).not.toContain('rawPrompt');
    expect(feedback.sanitizedNotes).not.toContain('SELECT');
    expect(feedback.sanitizedNotes).toContain(REDACTION_TOKENS.PROMPT);
  });

  test('provider response marker is redacted', () => {
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      ...baseFeedback,
      sanitizedNotes: 'Response contained providerResponse: choices: [{"text": "Hello"}]'
    });

    expect(feedback.sanitizedNotes).not.toContain('providerResponse');
    expect(feedback.sanitizedNotes).not.toContain('choices');
    expect(feedback.sanitizedNotes).toContain(REDACTION_TOKENS.PROVIDER_RESPONSE);
  });

  test('Authorization/Bearer token is redacted', () => {
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      ...baseFeedback,
      sanitizedNotes: 'The request header has Authorization: Bearer token12345'
    });

    expect(feedback.sanitizedNotes).not.toContain('Authorization');
    expect(feedback.sanitizedNotes).not.toContain('Bearer');
    expect(feedback.sanitizedNotes).toContain(REDACTION_TOKENS.AUTH);
  });

  test('secrets like secretRef, apiKey, rawKey, ciphertext, authTag, and BEGIN PRIVATE KEY are redacted/rejected', () => {
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      ...baseFeedback,
      sanitizedNotes: 'Credentials: secretRef: my-secret, apiKey: key123, rawKey: rk, ciphertext: ctx, authTag: tag, BEGIN PRIVATE KEY'
    });

    expect(feedback.sanitizedNotes).not.toContain('secretRef');
    expect(feedback.sanitizedNotes).not.toContain('apiKey');
    expect(feedback.sanitizedNotes).not.toContain('rawKey');
    expect(feedback.sanitizedNotes).not.toContain('ciphertext');
    expect(feedback.sanitizedNotes).not.toContain('authTag');
    expect(feedback.sanitizedNotes).not.toContain('BEGIN PRIVATE KEY');
    expect(feedback.sanitizedNotes).toContain(REDACTION_TOKENS.SECRET);
  });

  test('handler source is redacted', () => {
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      ...baseFeedback,
      sanitizedNotes: 'Handler source was: () => { return "NOT_EXECUTED"; } or function(arg) {}'
    });

    expect(feedback.sanitizedNotes).not.toContain('function(');
    expect(feedback.sanitizedNotes).not.toContain('=>');
    expect(feedback.sanitizedNotes).toContain(REDACTION_TOKENS.SECRET);
  });

  test('private filesystem path is redacted', () => {
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      ...baseFeedback,
      sanitizedNotes: 'File was read from C:\\Users\\Administrator\\secret.txt or /home/user/app.ts'
    });

    expect(feedback.sanitizedNotes).not.toContain('C:\\Users');
    expect(feedback.sanitizedNotes).not.toContain('/home/user');
    expect(feedback.sanitizedNotes).toContain(REDACTION_TOKENS.PATH);
  });

  test('sanitized output contains no forbidden markers', () => {
    const feedback = ApprovalLeaseFeedbackSanitizer.sanitizeFeedback({
      ...baseFeedback,
      sanitizedNotes: 'A clean and normal note containing no secrets.'
    });

    expect(feedback.sanitizedNotes).toBe('A clean and normal note containing no secrets.');
  });
});
