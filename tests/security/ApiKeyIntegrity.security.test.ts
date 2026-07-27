jest.mock('@/shared/utils/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}), { virtual: true });

import {
  generateApiKeyWithMachine,
  verifyApiKeyCrc,
} from '../../src/ai-gateway/shared/utils/apiKey.js';

describe('API key integrity', () => {
  const previousSecret = process.env.API_KEY_SECRET;

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.API_KEY_SECRET;
    else process.env.API_KEY_SECRET = previousSecret;
  });

  it('falls back to a built-in secret when API_KEY_SECRET is unavailable', () => {
    delete process.env.API_KEY_SECRET;

    const { key } = generateApiKeyWithMachine('machine123456789');
    expect(key).toMatch(/^sk-machine123456789-/);
    expect(verifyApiKeyCrc(key)).toBe(true);
  });

  it('accepts legacy keys that do not carry an integrity tag', () => {
    process.env.API_KEY_SECRET = 'a-secure-test-secret-with-enough-entropy';

    expect(verifyApiKeyCrc('sk-legacy12')).toBe(true);
  });

  it('accepts generated keys and rejects tampering', () => {
    process.env.API_KEY_SECRET = 'a-secure-test-secret-with-enough-entropy';
    const { key } = generateApiKeyWithMachine('machine123456789');

    expect(verifyApiKeyCrc(key)).toBe(true);
    const replacement = key.endsWith('0') ? '1' : '0';
    expect(verifyApiKeyCrc(`${key.slice(0, -1)}${replacement}`)).toBe(false);
  });
});
