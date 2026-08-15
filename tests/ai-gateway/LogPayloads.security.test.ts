import { protectPayloadForLog } from '../../src/ai-gateway/lib/logPayloads';

describe('log payload protection', () => {
  it('redacts secret-like strings even outside sensitive key names', () => {
    const payload = protectPayloadForLog({
      message: 'provider failed with key sk-test12345678901234567890',
      nested: {
        detail: 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456',
      },
      clientSecret: 'plain-client-secret',
      cookie: 'sessionid=very-secret-cookie',
      tokens: {
        in: 12,
        out: 4,
      },
    });

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('sk-test12345678901234567890');
    expect(serialized).not.toContain('abcdefghijklmnopqrstuvwxyz123456');
    expect(serialized).not.toContain('plain-client-secret');
    expect(serialized).not.toContain('very-secret-cookie');
    expect(payload).toMatchObject({
      clientSecret: '[REDACTED]',
      cookie: '[REDACTED]',
      tokens: {
        in: 12,
        out: 4,
      },
    });
  });
});
