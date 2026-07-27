import {
  collectGeminiApiKeys,
  isGeminiKeyFailoverError,
  isGeminiModelUnavailableError,
  isGeminiMultiKeyTestEnabled,
  isGeminiQuotaLikeError,
  listGeminiModelFallbacks,
} from './GeminiKeyRotation.js';

describe('GeminiKeyRotation', () => {
  it('uses only the primary credential by default', () => {
    const keys = collectGeminiApiKeys({
      GEMINI_API_KEY: 'primary-key-abcdefgh',
      GEMINI_API_KEY_2: 'second-key-abcdefgh',
      GEMINI_API_KEY_3: 'third-key-abcdefghij',
      GOOGLE_API_KEY: 'google-key-abcdefgh',
    });
    expect(keys).toEqual(['primary-key-abcdefgh']);
    expect(isGeminiMultiKeyTestEnabled({})).toBe(false);
  });

  it('uses only the first configured credential by default', () => {
    expect(collectGeminiApiKeys({}, [
      'config-key-abcdefgh',
      'config-key-2-abcdef',
      'config-key-3-abcdef',
    ])).toEqual(['config-key-abcdefgh']);
  });

  it('loads distinct extra credentials only in explicit experimental mode', () => {
    expect(collectGeminiApiKeys({
      ZAVORTH_GEMINI_MULTI_KEY_TEST: '1',
      GEMINI_API_KEY: 'primary-key-abcdefgh',
      GEMINI_API_KEY_2: 'second-key-abcdefgh',
      GOOGLE_API_KEY: 'google-key-abcdefgh',
    })).toEqual([
      'primary-key-abcdefgh',
      'google-key-abcdefgh',
      'second-key-abcdefgh',
    ]);
  });

  it('classifies only recoverable failures for credential failover', () => {
    expect(isGeminiQuotaLikeError(new Error('429 Too Many Requests quota exceeded'))).toBe(true);
    expect(isGeminiKeyFailoverError(new Error('503 upstream unavailable'))).toBe(true);
    expect(isGeminiKeyFailoverError(new Error('API key not valid'))).toBe(true);
    expect(isGeminiKeyFailoverError(new Error('400 invalid request'))).toBe(false);
    expect(isGeminiModelUnavailableError(new Error('404 model is no longer available'))).toBe(true);
  });

  it('lists current model fallbacks without retired flash-lite', () => {
    const models = listGeminiModelFallbacks('gemini-2.5-flash', {
      ZAVORTH_BACKGROUND_MODEL: 'gemini-2.5-flash-lite',
      ZAVORTH_SECONDARY_MODEL: 'gemini-2.0-flash',
    });
    expect(models[0]).toBe('gemini-2.5-flash');
    expect(models).toContain('gemini-2.0-flash');
    expect(models).not.toContain('gemini-2.5-flash-lite');
  });
});
