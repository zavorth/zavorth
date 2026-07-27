import {
  validatePreferenceMutationOrigin,
  validateSelectionIds,
} from '../../../src/services/selection/ProviderPreferenceRequestSecurity.js';

describe('provider preference route security', () => {
  function headers(values: Record<string, string>): Headers {
    return new Headers({ host: 'localhost', ...values });
  }

  it('requires Origin for browser/cookie mutations but permits bearer automation', () => {
    expect(validatePreferenceMutationOrigin(headers({}))).toMatch(/Origin header required/);
    expect(validatePreferenceMutationOrigin(headers({ authorization: 'Bearer test-token' }))).toBeNull();
  });

  it('rejects cross-origin mutations and accepts an exact host match', () => {
    expect(validatePreferenceMutationOrigin(headers({ origin: 'https://attacker.example' }))).toMatch(/Cross-origin/);
    expect(validatePreferenceMutationOrigin(headers({ origin: 'http://localhost' }))).toBeNull();
  });

  it('rejects non-string and control-character selection identifiers', () => {
    expect(validateSelectionIds({ providerId: { id: 'openai' } })).toMatch(/must be a string/);
    expect(validateSelectionIds({ providerId: 'openai', modelId: ['gpt-4o'] })).toMatch(/must be a string/);
    expect(validateSelectionIds({ providerId: 'openai\nmalformed' })).toMatch(/control characters/);
    expect(validateSelectionIds({ providerId: '../openai' })).toMatch(/unsupported characters/);
    expect(validateSelectionIds({ providerId: 'company-compatible', cchannelId: 'nextcloud-talk' })).toBeNull();
    expect(validateSelectionIds({ providerId: 'openai', modelId: null })).toBeNull();
  });
});
