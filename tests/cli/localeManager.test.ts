import {
  detectSystemLanguage,
  getCommandAliases,
  normalizeCliLocale,
} from '../../src/cli/locales/localeManager';

describe('Zavorth CLI locale manager', () => {
  it('prefers ZAVORTH_LANG over system locale variables', () => {
    expect(detectSystemLanguage({
      ZAVORTH_LANG: 'pt-BR',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
    })).toBe('pt');
  });

  it('detects Portuguese from LANG or LC_ALL and falls back to English', () => {
    expect(detectSystemLanguage({ LANG: 'pt_BR.UTF-8' })).toBe('pt');
    expect(detectSystemLanguage({ LC_ALL: 'pt_PT.UTF-8' })).toBe('pt');
    expect(detectSystemLanguage({ LANG: 'fr_FR.UTF-8' })).toBe('en');
    expect(detectSystemLanguage({})).toBe('en');
  });

  it('normalizes supported locale names safely', () => {
    expect(normalizeCliLocale('pt-BR')).toBe('pt');
    expect(normalizeCliLocale('pt_BR.UTF-8')).toBe('pt');
    expect(normalizeCliLocale('en-US')).toBe('en');
    expect(normalizeCliLocale('es')).toBe('en');
    expect(normalizeCliLocale(null)).toBe('en');
  });

  it('returns Portuguese command aliases only when Portuguese is active', () => {
    const ptAliases = getCommandAliases({ env: { ZAVORTH_LANG: 'pt-BR' } });
    const enAliases = getCommandAliases({ env: { ZAVORTH_LANG: 'en-US' } });

    expect(ptAliases.ajuda).toBe('help');
    expect(ptAliases.configurar).toBe('setup');
    expect(ptAliases.habilidades).toBe('skills');
    expect(ptAliases['diagnóstico']).toBe('doctor');
    expect(ptAliases['começar']).toBe('start');
    expect(Object.keys(ptAliases).some((key) => key.includes('Ã'))).toBe(false);
    expect(enAliases).toEqual({});
  });
});
