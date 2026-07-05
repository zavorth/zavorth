import { getLanguagePack, mergeLanguagePacks, listAvailableLocales, detectDeviceLocale } from '../../src/services/ZavorthIntentI18n';

describe('I18n Extended — All 21 languages', () => {
  const allLocales = listAvailableLocales();

  describe('Every locale has required intents', () => {
    const requiredIntents = [
      'read_file', 'create_file', 'web_search', 'email',
      'calendar', 'greeting', 'acknowledgment',
    ];

    for (const locale of allLocales) {
      test(`${locale} has all required intents`, () => {
        const pack = getLanguagePack(locale);
        for (const intent of requiredIntents) {
          expect(pack.intents[intent]).toBeDefined();
          expect(pack.intents[intent].verbs.length + pack.intents[intent].nouns.length + (pack.intents[intent].phrases?.length ?? 0)).toBeGreaterThan(0);
        }
      });
    }
  });

  describe('Every locale has greeting phrases', () => {
    for (const locale of allLocales) {
      test(`${locale} has greeting phrases`, () => {
        const pack = getLanguagePack(locale);
        expect(pack.intents.greeting.phrases.length).toBeGreaterThan(0);
      });
    }
  });

  describe('Every locale has acknowledgment phrases', () => {
    for (const locale of allLocales) {
      test(`${locale} has acknowledgment phrases`, () => {
        const pack = getLanguagePack(locale);
        expect(pack.intents.acknowledgment.phrases.length).toBeGreaterThan(0);
      });
    }
  });

  describe('Merged packs work for all locales', () => {
    for (const locale of allLocales) {
      if (locale.startsWith('en')) continue;
      test(`merge ${locale} + en works`, () => {
        const merged = mergeLanguagePacks(locale, 'en');
        expect(merged.intents.read_file.verbs.length).toBeGreaterThan(0);
        expect(merged.intents.greeting.phrases.length).toBeGreaterThan(0);
      });
    }
  });

  describe('Locale detection', () => {
    it('should return a string', () => {
      const locale = detectDeviceLocale();
      expect(typeof locale).toBe('string');
    });

    it('should return at least 2 characters', () => {
      const locale = detectDeviceLocale();
      expect(locale.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string locale by returning fallback', () => {
      const pack = getLanguagePack('');
      expect(pack).toBeDefined();
      expect(pack.code).toBeDefined();
    });

    it('should handle numeric locale', () => {
      const pack = getLanguagePack('123');
      expect(pack).toBeDefined();
      expect(pack.code).toBeDefined();
    });

    it('should handle very long locale string', () => {
      const pack = getLanguagePack('pt-BR-very-long-locale-string');
      expect(Object.keys(pack.intents).length).toBeGreaterThan(0);
    });
  });
});
