import {
  detectSensitiveData,
  redactSensitiveData,
  redactSensitiveText,
  requiresSensitiveDataEgressGuard,
} from '../../src/security/SensitiveDataGuard';

describe('SensitiveDataGuard', () => {
  it('detects common raw secret material in nested arguments', () => {
    const findings = detectSensitiveData({
      prompt: 'Use OPENAI_API_KEY=sk-test12345678901234567890 in the next request',
      nested: {
        clientSecret: 'plain-secret-value',
      },
    });

    expect(findings.map((finding) => finding.kind)).toEqual(expect.arrayContaining([
      'secret-assignment',
      'provider-token',
      'sensitive-key',
    ]));
    expect(findings.map((finding) => finding.path)).toEqual(expect.arrayContaining([
      '$.prompt',
      '$.nested.clientSecret',
    ]));
  });

  it('allows SecretRef placeholders without treating them as raw secrets', () => {
    expect(detectSensitiveData({
      apiKey: 'secret-ref:providers.openai.primary',
      token: '[redacted-secret]',
    })).toEqual([]);
  });

  it('redacts secret-like text and object values for logs or receipts', () => {
    const jwtFixture = [
      'eyJhbGciOiJIUzI1NiJ9',
      'eyJzdWIiOiIxMjM0In0',
      'signature000000',
    ].join('.');
    expect(redactSensitiveText('Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456'))
      .toContain('[redacted-secret]');
    expect(redactSensitiveText('callback=https://user:pass@example.test/cb'))
      .toContain('[redacted-secret]');
    expect(redactSensitiveText(`jwt=${jwtFixture}`))
      .toContain('[redacted-secret]');
    expect(redactSensitiveData({
      password: 'super-secret',
      visible: 'ok',
    })).toEqual({
      password: '[redacted-secret]',
      visible: 'ok',
    });
  });

  it('scopes the egress guard to capabilities that can leak data', () => {
    expect(requiresSensitiveDataEgressGuard(['network'])).toBe(true);
    expect(requiresSensitiveDataEgressGuard(['external-send'])).toBe(true);
    expect(requiresSensitiveDataEgressGuard(['local-observation'])).toBe(false);
  });
});
