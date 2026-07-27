import {
  CONTROL_LOCALES,
  detectControlLocale,
  detectDeviceLocale,
  readControlLocalePreference,
  readEffectiveDocumentLocale,
  resolveSupportedControlLocale,
  translate,
} from '../../../apps/zavorth-control-vite-shell/src/locale';

describe('Zavorth Control locale selection', () => {
  let storedLocale: string | null;

  beforeEach(() => {
    storedLocale = null;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { language: 'en-US', languages: ['en-US'] },
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: jest.fn(() => storedLocale),
        setItem: jest.fn((_key: string, value: string) => {
          storedLocale = value;
        }),
      },
    });
  });

  it('advertises all locales backed by the Control catalogs', () => {
    const codes = CONTROL_LOCALES.map(({ code }) => code);
    expect(codes).toContain('system');
    expect(codes).toContain('en-US');
    expect(codes).toContain('pt-BR');
    expect(codes).toContain('es-AR');
    expect(codes.length).toBeGreaterThanOrEqual(4);
  });

  it('matches supported regional variants and falls back to English', () => {
    expect(resolveSupportedControlLocale('pt-PT')).toBe('pt-BR');
    expect(resolveSupportedControlLocale('es-MX')).toBe('es');
    expect(resolveSupportedControlLocale('fr-FR')).toBe('en-US');
    expect(resolveSupportedControlLocale('invalid locale')).toBe('en-US');
  });

  it('uses the first supported language reported by the browser', () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { language: 'fr-FR', languages: ['fr-FR', 'pt-PT', 'en-US'] },
    });

    expect(detectDeviceLocale()).toBe('fr-FR');
    expect(detectControlLocale()).toBe('en-US');
  });

  it('falls back to English when the device reports no supported language', () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { language: 'de-DE', languages: ['de-DE', 'fr-FR'] },
    });

    expect(detectControlLocale()).toBe('en-US');
    expect(readEffectiveDocumentLocale()).toBe('de-DE');
    expect(translate('Settings', detectControlLocale())).toBe('Settings');
  });

  it('migrates the previous Spanish preference and ignores unsupported saved locales', () => {
    storedLocale = 'es';
    expect(readControlLocalePreference()).toBe('es');

    storedLocale = 'de';
    expect(readControlLocalePreference()).toBe('de');
  });

  it('translates known product strings', () => {
    expect(translate('Conversation', 'pt-BR')).toBe('Conversa');
  });

  it('returns the original key for untranslated strings', () => {
    expect(translate('Actions', 'pt-BR')).toBe('Actions');
    expect(translate('Command palette', 'es-AR')).toBe('Command palette');
  });
});
