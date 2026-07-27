import { ProviderFactory } from '../../src/providers/ProviderFactory.js';

describe('ProviderFactory credential pool resolving', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    ProviderFactory.clearCache();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('resolves the primary key from env variables and ignores suffixes', () => {
    process.env.GEMINI_API_KEY = 'key-1';
    process.env.GEMINI_API_KEY_2 = 'key-2';
    process.env.GEMINI_API_KEY_3 = 'key-3';

    const target = ProviderFactory.resolveRuntimeTarget('gemini');
    expect(target.apiKey).toBe('key-1');
  });

  it('resolves single key if no suffixes are present', () => {
    process.env.GEMINI_API_KEY = 'key-only';
    delete process.env.GEMINI_API_KEY_2;

    const target = ProviderFactory.resolveRuntimeTarget('gemini');
    expect(target.apiKey).toBe('key-only');
  });

  it('resolves only the primary key even when suffixes have gaps', () => {
    process.env.GEMINI_API_KEY = 'key-1';
    process.env.GEMINI_API_KEY_2 = 'key-2';
    // Gap: GEMINI_API_KEY_3 is empty
    delete process.env.GEMINI_API_KEY_3;
    process.env.GEMINI_API_KEY_4 = 'key-4';

    const target = ProviderFactory.resolveRuntimeTarget('gemini');
    expect(target.apiKey).toBe('key-1');
  });
});
