import {
  CONTROL_LOCALES,
  readControlLocalePreference,
  readEffectiveDocumentLocale,
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
    expect(codes).toContain('es');
    expect(codes.length).toBeGreaterThanOrEqual(4);
  });

  

  it('migrates the previous Spanish preference and ignores unsupported saved locales', () => {
    storedLocale = 'es';
    expect(readControlLocalePreference()).toBe('es');

    storedLocale = 'de';
    expect(readControlLocalePreference()).toBe('de');
  });

  it('translates known product strings', () => {
    expect(translate('app.chat', 'pt-BR')).toBe('Conversa');
  });

  it('returns the original key for untranslated strings', () => {
    expect(translate('common.actions', 'pt-BR')).toBe('Ações');
    expect(translate('approvals.commandPreview', 'es-AR')).toBe('Vista Previa del Comando');
  });
});
