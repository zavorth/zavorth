import {
  detectSystemLanguage,
  getCommandAliases,
  normalizeCliLocale,
} from '../../src/cli/locales/localeManager';

describe('Zavorth CLI locale manager (EN-only command aliases)', () => {
  it('always reports English for CLI command locale', () => {
    expect(detectSystemLanguage({
      ZAVORTH_LANG: 'pt-BR',
      LANG: 'pt_BR.UTF-8',
    })).toBe('en');
    expect(detectSystemLanguage({ LANG: 'fr_FR.UTF-8' })).toBe('en');
    expect(detectSystemLanguage({})).toBe('en');
  });

  it('normalizes any input to English for CLI command tokens', () => {
    expect(normalizeCliLocale('pt-BR')).toBe('en');
    expect(normalizeCliLocale('es')).toBe('en');
    expect(normalizeCliLocale('en-US')).toBe('en');
    expect(normalizeCliLocale(null)).toBe('en');
  });

  it('returns only useful English synonyms (no identity no-ops, no PT pack)', () => {
    const ptEnvAliases = getCommandAliases({ env: { ZAVORTH_LANG: 'pt-BR' } });
    const enAliases = getCommandAliases({ env: { ZAVORTH_LANG: 'en-US' } });

    expect(ptEnvAliases.ajuda).toBeUndefined();
    expect(ptEnvAliases.configurar).toBeUndefined();
    expect(enAliases.help).toBeUndefined(); // identity no-op removed
    expect(enAliases.configure).toBe('setup');
    expect(enAliases.health).toBe('ready');
    expect(enAliases.check).toBe('doctor');
    expect(enAliases.talk).toBe('chat');
    expect(Object.keys(ptEnvAliases)).toEqual(Object.keys(enAliases));
    for (const [alias, target] of Object.entries(enAliases)) {
      expect(alias).not.toBe(target);
    }
  });
});
