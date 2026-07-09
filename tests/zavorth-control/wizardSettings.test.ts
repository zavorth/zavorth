import {
  describeWizardSecret,
  normalizeWizardUpdates,
  serializeEnvValue,
} from '../../src/ai-gateway/lib/api/wizardSettings';

describe('wizard settings security helpers', () => {
  it('describes configured secrets without returning raw values', () => {
    const state = describeWizardSecret('sk-test-secret-123456');

    expect(state.configured).toBe(true);
    expect(state.masked).toBe('***3456');
    expect(JSON.stringify(state)).not.toContain('sk-test-secret');
  });

  it('ignores empty secret updates so blank fields do not erase existing secrets', () => {
    expect(normalizeWizardUpdates({
      AISTUDIO_API_KEY: '',
      TELEGRAM_BOT_TOKEN: '   ',
      TELEGRAM_DEFAULT_CHAT_ID: '12345',
    })).toEqual({
      TELEGRAM_DEFAULT_CHAT_ID: '12345',
    });
  });

  it('rejects newline env injection attempts', () => {
    expect(() => normalizeWizardUpdates({
      AISTUDIO_API_KEY: 'ok\nEVIL=value',
    })).toThrow('cannot contain line breaks');
  });

  it('quotes env values that need escaping', () => {
    expect(serializeEnvValue('abc def')).toBe('"abc def"');
    expect(serializeEnvValue('abc_123')).toBe('abc_123');
  });
});
