import { redactPrivacyText, redactPrivacyValue } from '../../src/privacy/PrivacyRedactor.js';

describe('PrivacyRedactor', () => {
  it('redacts secrets and common PII from text', () => {
    const text = redactPrivacyText(
      'Authorization: Bearer abcdefghijklmnopqrstuvwxyz token=sk-testabcdefghijklmnopqrstuvwxyz user=jane@example.com',
    );

    expect(text).toContain('Bearer [redacted]');
    expect(text).toContain('token=[redacted]');
    expect(text).toContain('[email-redacted]');
    expect(text).not.toContain('abcdefghijklmnopqrstuvwxyz');
    expect(text).not.toContain('jane@example.com');
  });

  it('redacts sensitive object keys recursively', () => {
    const redacted = redactPrivacyValue({
      apiKey: 'sk-testabcdefghijklmnopqrstuvwxyz',
      nested: {
        client_secret: 'super-secret-value',
        ownerEmail: 'owner@example.com',
      },
    }) as any;

    expect(redacted.apiKey).toBe('[redacted]');
    expect(redacted.nested.client_secret).toBe('[redacted]');
    expect(redacted.nested.ownerEmail).toBe('[email-redacted]');
  });
});
