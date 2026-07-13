import { redactSensitiveText } from '../../../src/services/ZavorthNativeAutonomyShared.js';

describe('redactSensitiveText', () => {
  it('redacts common secret shapes', () => {
    const fakeTelegramToken = ['123456789', 'AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw'].join(':');
    const input = [
      'sk-abcdefghijklmnopqrstuvwxyz',
      'token=abc123secretvalue',
      'Bearer abcdefghijklmnop',
      fakeTelegramToken,
      'ghp_abcdefghijklmnopqrstuvwx',
      'AIzaSyA-abcdefghijklmnopqrst',
    ].join(' ');
    const out = redactSensitiveText(input);
    expect(out).not.toContain('sk-abcdefghijklmnopqrstuvwxyz');
    expect(out).not.toContain(fakeTelegramToken);
    expect(out).not.toContain('ghp_abcdefghijklmnopqrstuvwx');
    expect(out).toMatch(/REDACTED/i);
  });
});
