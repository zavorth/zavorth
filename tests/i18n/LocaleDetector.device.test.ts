/**
 * Device / OS locale smoke tests for the core locale detector.
 *
 * Device default path:
 *   ZAVORTH_LANG → LC_ALL / LC_MESSAGES / LANG / LANGUAGE → normalize → en-US
 */
import { describe, it, expect } from '@jest/globals';
import {
  normalizeLocale,
  resolveFromEnv,
  resolveLocale,
} from '../../src/i18n/localeDetector.js';
import { DEFAULT_LOCALE } from '../../src/i18n/types.js';

describe('LocaleDetector device locale', () => {
  describe('resolveFromEnv priority', () => {
    it('reads ZAVORTH_LANG=pt-BR as explicit device override', () => {
      expect(resolveFromEnv({ ZAVORTH_LANG: 'pt-BR' })).toBe('pt-BR');
      expect(
        normalizeLocale(resolveFromEnv({ ZAVORTH_LANG: 'pt-BR' })),
      ).toBe('pt-BR');
    });

    it('maps LANG=pt_BR.UTF-8 to pt-BR after normalize', () => {
      const raw = resolveFromEnv({ LANG: 'pt_BR.UTF-8' });
      expect(raw).toBe('pt_BR.UTF-8');
      expect(normalizeLocale(raw)).toBe('pt-BR');
      expect(
        resolveLocale({ env: { LANG: 'pt_BR.UTF-8' } }),
      ).toBe('pt-BR');
    });

    it('prefers ZAVORTH_LANG over LANG', () => {
      expect(
        resolveFromEnv({
          ZAVORTH_LANG: 'en-US',
          LANG: 'pt_BR.UTF-8',
        }),
      ).toBe('en-US');
    });

    it('falls back through LC_* then LANG', () => {
      expect(resolveFromEnv({ LC_MESSAGES: 'pt_BR' })).toBe('pt_BR');
      expect(normalizeLocale(resolveFromEnv({ LC_MESSAGES: 'pt_BR' }))).toBe(
        'pt-BR',
      );
      expect(
        resolveFromEnv({ LANGUAGE: 'pt-BR:en-US' }),
      ).toBe('pt-BR:en-US');
      // Language lists use the first tag via normalize prefix map
      expect(normalizeLocale('pt-BR:en-US')).toBe('pt-BR');
    });
  });

  describe('default locale', () => {
    it('defaults to en-US when env is empty', () => {
      expect(resolveFromEnv({})).toBe('');
      expect(resolveFromEnv(undefined)).toBe('');
      expect(resolveLocale({ env: {} })).toBe(DEFAULT_LOCALE);
      expect(resolveLocale({})).toBe('en-US');
      expect(normalizeLocale(null)).toBe('en-US');
      expect(normalizeLocale('')).toBe('en-US');
    });
  });
});
