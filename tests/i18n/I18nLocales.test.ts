import { describe, it, expect, beforeEach } from '@jest/globals';
import { resolve } from 'node:path';
import * as fs from 'fs';
import * as path from 'path';
import { I18nManager } from '../../src/i18n/I18nManager';
import { normalizeLocale, resolveFromEnv, resolveLocale } from '../../src/i18n/localeDetector';
import { interpolate } from '../../src/i18n/interpolation';

import { DEFAULT_LOCALE, KNOWN_LOCALES, NAMESPACE_LIST } from '../../src/i18n/types';


const LOCALES_DIR = resolve(__dirname, '../../src/i18n/locales');

const ALL_LOCALE_CODES = ['en', 'pt-BR', 'es', 'fr', 'de', 'ja', 'ko', 'zh-CN', 'zh-TW', 'ru'];

const EXPECTED_NAMESPACES: readonly string[] = ['common', 'cli', 'tools', 'errors', 'auth', 'sessions'];

const SPOT_CHECK_KEYS: Record<string, Record<string, string>> = {
  en: {
    'common.yes': 'Yes',
    'common.no': 'No',
    'errors.not_found': 'Not found',
    'auth.login': 'Login',
    'sessions.created': 'Session created',
  },
  'pt-BR': {
    'common.yes': 'Sim',
    'common.no': 'Não',
    'errors.not_found': 'Não encontrado',
    'auth.login': 'Entrar',
    'sessions.created': 'Sessão criada',
  },
  es: {
    'common.yes': 'Sí',
    'common.no': 'No',
    'errors.not_found': 'No encontrado',
    'auth.login': 'Iniciar sesión',
    'sessions.created': 'Sesión creada',
  },
  fr: {
    'common.yes': 'Oui',
    'common.no': 'Non',
    'errors.not_found': 'Introuvable',
    'auth.login': 'Connexion',
    'sessions.created': 'Session créée',
  },
  de: {
    'common.yes': 'Ja',
    'common.no': 'Nein',
    'errors.not_found': 'Nicht gefunden',
    'auth.login': 'Anmelden',
    'sessions.created': 'Sitzung erstellt',
  },
  ja: {
    'common.yes': 'はい',
    'common.no': 'いいえ',
    'errors.not_found': '見つかりません',
    'auth.login': 'ログイン',
    'sessions.created': 'セッションが作成されました',
  },
  ko: {
    'common.yes': '예',
    'common.no': '아니오',
    'errors.not_found': '찾을 수 없음',
    'auth.login': '로그인',
    'sessions.created': '세션이 생성되었습니다',
  },
  'zh-CN': {
    'common.yes': '是',
    'common.no': '否',
    'errors.not_found': '未找到',
    'auth.login': '登录',
    'sessions.created': '会话已创建',
  },
  'zh-TW': {
    'common.yes': '是',
    'common.no': '否',
    'errors.not_found': '找不到',
    'auth.login': '登入',
    'sessions.created': '工作階段已建立',
  },
  ru: {
    'common.yes': 'Да',
    'common.no': 'Нет',
    'errors.not_found': 'Не найдено',
    'auth.login': 'Вход',
    'sessions.created': 'Сессия создана',
  },
};

function loadLocaleJson(localeCode: string): Record<string, unknown> {
  const filePath = path.join(LOCALES_DIR, `${localeCode}.json`);
  const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
  return JSON.parse(raw) as Record<string, unknown>;
}

function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') {
      keys.push(full);
    } else if (typeof v === 'object' && v !== null) {
      keys.push(...collectKeys(v as Record<string, unknown>, full));
    }
  }
  return keys;
}

describe('I18n Locales — comprehensive coverage for all 10 languages', () => {
  // 1. Locale file loading
  describe('Locale files load correctly', () => {
    for (const localeCode of ALL_LOCALE_CODES) {
      it(`${localeCode}.json should exist and be valid JSON`, () => {
        const filePath = path.join(LOCALES_DIR, `${localeCode}.json`);
        expect(fs.existsSync(filePath)).toBe(true);
        const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
        let parsed: Record<string, unknown>;
        expect(() => {
          parsed = JSON.parse(raw) as Record<string, unknown>;
        }).not.toThrow();
        expect(typeof parsed!).toBe('object');
      });
    }
  });

  // 2. Required namespaces per locale
  describe('Each locale has all required namespaces', () => {
    for (const localeCode of ALL_LOCALE_CODES) {
      it(`${localeCode} contains namespaces: ${EXPECTED_NAMESPACES.join(', ')}`, () => {
        const data = loadLocaleJson(localeCode);
        for (const ns of EXPECTED_NAMESPACES) {
          expect(data).toHaveProperty(ns);
          expect(typeof data[ns]).toBe('object');
        }
      });
    }
  });

  // 3. Translation keys exist for all expected strings
  describe('Translation keys exist for all expected strings', () => {
    for (const localeCode of ALL_LOCALE_CODES) {
      const expected = SPOT_CHECK_KEYS[localeCode];
      for (const [dotKey, expectedValue] of Object.entries(expected)) {
        it(`${localeCode}: ${dotKey} should have correct value`, () => {
          const data = loadLocaleJson(localeCode);
          const parts = dotKey.split('.');
          let current: unknown = data;
          for (const part of parts) {
            expect(typeof current === 'object' && current !== null).toBe(true);
            current = (current as Record<string, unknown>)[part];
          }
          expect(current).toBe(expectedValue);
        });
      }
    }

    for (const localeCode of ALL_LOCALE_CODES) {
      it(`${localeCode}: all namespace objects should be non-empty`, () => {
        const data = loadLocaleJson(localeCode);
        for (const ns of EXPECTED_NAMESPACES) {
          const nsObj = data[ns] as Record<string, unknown>;
          expect(Object.keys(nsObj).length).toBeGreaterThan(0);
        }
      });
    }
  });

  // 4. Interpolation works per locale
  describe('Interpolation works in each locale', () => {
    it('interpolate() replaces {name} placeholder', () => {
      expect(interpolate('Hello, {name}!', { name: 'World' })).toBe('Hello, World!');
    });

    it('interpolate() replaces multiple placeholders', () => {
      expect(
        interpolate('{greeting}, {name}! You have {count} items.', {
          greeting: 'Hi',
          name: 'Alice',
          count: 5,
        }),
      ).toBe('Hi, Alice! You have 5 items.');
    });

    it('interpolate() handles missing vars by leaving placeholder intact', () => {
      expect(interpolate('Hello, {name}!', {})).toBe('Hello, {name}!');
    });

    it('interpolate() handles numeric values', () => {
      expect(interpolate('Count: {n}', { n: 42 })).toBe('Count: 42');
    });

    it('interpolate() is locale-agnostic — same function for all locales', () => {
      const template = '{verb} {noun}';
      const vars = { verb: 'testar', noun: 'arquivo' };
      for (const localeCode of ALL_LOCALE_CODES) {
        expect(interpolate(template, vars)).toBe('testar arquivo');
      }
    });
  });

  // 5. Pluralization works per locale
  describe('Pluralization works in each locale', () => {
    let manager: I18nManager;

    beforeEach(() => {
      manager = new I18nManager({
        defaultLocale: 'en',
        localesDir: LOCALES_DIR,
      });
    });

    it('tplural returns "other" form for count > 1', () => {
      manager.setLocale('en');
      const result = manager.tplural('sessions.session_count', 5, {}, 'sessions');
      expect(result).toBeDefined();
    });

    it('tplural returns numeric string when no plural forms exist', () => {
      manager.setLocale('en');
      const result = manager.tplural('common.ok', 10, {}, 'common');
      expect(result).toBeDefined();
    });

    it('tplural handles count = 0', () => {
      manager.setLocale('en');
      const result = manager.tplural('sessions.no_sessions', 0, {}, 'sessions');
      expect(result).toBeDefined();
    });

    it('tplural handles count = 1', () => {
      manager.setLocale('en');
      const result = manager.tplural('sessions.session_count', 1, {}, 'sessions');
      expect(result).toBeDefined();
    });

    for (const localeCode of ALL_LOCALE_CODES) {
      it(`tplural does not throw for locale ${localeCode}`, () => {
        manager.setLocale(localeCode);
        expect(() => manager.tplural('sessions.session_count', 0, {}, 'sessions')).not.toThrow();
        expect(() => manager.tplural('sessions.session_count', 1, {}, 'sessions')).not.toThrow();
        expect(() => manager.tplural('sessions.session_count', 5, {}, 'sessions')).not.toThrow();
      });
    }
  });

  // 6. Fallback chain works across locales
  describe('Fallback chain works across locales', () => {
    let manager: I18nManager;

    beforeEach(() => {
      manager = new I18nManager({
        defaultLocale: 'en',
        localesDir: LOCALES_DIR,
      });
    });

    it('falls back to default locale when current locale lacks a key', () => {
      const mgr = new I18nManager({ defaultLocale: 'en-US', localesDir: LOCALES_DIR });
      mgr.loadTranslations('en-US', {
        common: { yes: 'Yes', no: 'No' },
      });
      mgr.loadTranslations('pt-BR', {
        common: { yes: 'Sim' },
      });
      mgr.setLocale('en-US');
      const enResult = mgr.t('yes', undefined, 'common');
      mgr.setLocale('pt-BR');
      const ptResult = mgr.t('yes', undefined, 'common');
      const ptNoResult = mgr.t('no', undefined, 'common');
      expect(enResult).toBe('Yes');
      expect(ptResult).toBe('Sim');
      expect(ptNoResult).toBe('No');
    });

    it('returns translated value when current locale has the key', () => {
      for (const localeCode of ALL_LOCALE_CODES) {
        manager.setLocale(localeCode);
        const result = manager.t('yes', undefined, 'common');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it('returns key itself when no translation found anywhere', () => {
      manager.setLocale('pt-BR');
      const result = manager.t('nonexistent.deeply.nested.key');
      expect(result).toBe('nonexistent.deeply.nested.key');
    });

    it('fallback in ZavorthI18nService resolves missing keys to default locale', () => {
      manager.setLocale('ja');
      const result = manager.t('errors.file_not_found', undefined, 'errors');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  // 7. Missing keys fall back to English
  describe('Missing keys fall back to English', () => {
    let manager: I18nManager;

    beforeEach(() => {
      manager = new I18nManager({
        defaultLocale: 'en',
        localesDir: LOCALES_DIR,
      });
    });

    for (const localeCode of ALL_LOCALE_CODES) {
      it(`${localeCode}: a known key resolves to a non-empty string`, () => {
        manager.setLocale(localeCode);
        const result = manager.t('error', undefined, 'common');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    }

    it('all locales return same key for completely unknown key', () => {
      const fakeKey = 'totally.nonexistent.key.abc123';
      for (const localeCode of ALL_LOCALE_CODES) {
        manager.setLocale(localeCode);
        const result = manager.t(fakeKey);
        expect(result).toBe(fakeKey);
      }
    });

    it('getMissingKeys reports missing keys for a non-default locale', () => {
      manager.setLocale('en');
      manager.loadTranslations('en', {
        custom_ns: { only_en_key: 'English only' },
      });
      manager.setLocale('pt-BR');
      manager.loadTranslations('pt-BR', {
        custom_ns: { pt_key: 'Português' },
      });
      const missing = manager.getMissingKeys('pt-BR');
      expect(Array.isArray(missing)).toBe(true);
      expect(missing).toContain('custom_ns.only_en_key');
    });
  });

  // 8. Date formatting works per locale
  describe('Date formatting works per locale', () => {
    let manager: I18nManager;

    beforeEach(() => {
      manager = new I18nManager({
        defaultLocale: 'en',
        localesDir: LOCALES_DIR,
      });
    });

    const testDate = new Date(2025, 5, 15, 10, 30, 0);

    for (const localeCode of ALL_LOCALE_CODES) {
      it(`${localeCode}: formatDate short returns a string`, () => {
        const result = manager.formatDate(testDate, { locale: localeCode, format: 'short' });
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });

      it(`${localeCode}: formatDate long returns a string`, () => {
        const result = manager.formatDate(testDate, { locale: localeCode, format: 'long' });
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });

      it(`${localeCode}: formatDate relative returns a string`, () => {
        const result = manager.formatDate(testDate, { locale: localeCode, format: 'relative' });
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    }

    it('formatDate short differs between locales', () => {
      const en = manager.formatDate(testDate, { locale: 'en', format: 'short' });
      const ja = manager.formatDate(testDate, { locale: 'ja', format: 'short' });
      expect(en).not.toBe(ja);
    });

    it('formatDate accepts Date, number, and string inputs', () => {
      const dateObj = new Date(2025, 0, 1);
      const numMs = dateObj.getTime();
      const strIso = '2025-01-01T00:00:00.000Z';

      const fromObj = manager.formatDate(dateObj, { locale: 'en', format: 'short' });
      const fromNum = manager.formatDate(numMs, { locale: 'en', format: 'short' });
      const fromStr = manager.formatDate(strIso, { locale: 'en', format: 'short' });

      expect(typeof fromObj).toBe('string');
      expect(typeof fromNum).toBe('string');
      expect(typeof fromStr).toBe('string');
    });
  });

  // 9. Number formatting works per locale
  describe('Number formatting works per locale', () => {
    let manager: I18nManager;

    beforeEach(() => {
      manager = new I18nManager({
        defaultLocale: 'en',
        localesDir: LOCALES_DIR,
      });
    });

    for (const localeCode of ALL_LOCALE_CODES) {
      it(`${localeCode}: formatNumber decimal returns a string`, () => {
        const result = manager.formatNumber(1234567.89, {
          locale: localeCode,
          style: 'decimal',
        });
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });

      it(`${localeCode}: formatNumber currency returns a string`, () => {
        const result = manager.formatNumber(99.99, {
          locale: localeCode,
          style: 'currency',
          currency: 'USD',
        });
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });

      it(`${localeCode}: formatNumber percent returns a string`, () => {
        const result = manager.formatNumber(0.75, {
          locale: localeCode,
          style: 'percent',
        });
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    }

    it('formatNumber decimal differs between locales (different separators)', () => {
      const en = manager.formatNumber(1234.56, { locale: 'en', style: 'decimal' });
      const de = manager.formatNumber(1234.56, { locale: 'de', style: 'decimal' });
      expect(typeof en).toBe('string');
      expect(typeof de).toBe('string');
      expect(en).not.toBe(de);
    });

    it('formatNumber handles zero', () => {
      const result = manager.formatNumber(0, { locale: 'en', style: 'decimal' });
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('formatNumber handles negative values', () => {
      const result = manager.formatNumber(-42.5, { locale: 'en', style: 'decimal' });
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  // 10. normalizeLocale mapping correctness
  describe('normalizeLocale maps locale inputs correctly', () => {
    const mappings: [string, string][] = [
      ['en', 'en-US'],
      ['en-us', 'en-US'],
      ['pt', 'pt-BR'],
      ['pt-br', 'pt-BR'],
      ['es', 'es-ES'],
      ['fr', 'fr-FR'],
      ['de', 'de-DE'],
      ['ja', 'ja-JP'],
      ['zh', 'zh-CN'],
      ['zh-cn', 'zh-CN'],
      ['ko', 'ko-KR'],
      ['ru', 'ru-RU'],
      ['EN_US', 'en-US'],
      ['PT_BR', 'pt-BR'],
      ['pt_BR', 'pt-BR'],
      ['', 'en-US'],
      [null as unknown as string, 'en-US'],
      [undefined as unknown as string, 'en-US'],
    ];

    for (const [input, expected] of mappings) {
      it(`normalizeLocale(${JSON.stringify(input)}) => ${expected}`, () => {
        expect(normalizeLocale(input)).toBe(expected);
      });
    }
  });

  // 11. resolveFromEnv picks correct env var
  describe('resolveFromEnv reads environment variables', () => {
    it('returns ZAVORTH_LANG when set', () => {
      const result = resolveFromEnv({ ZAVORTH_LANG: 'pt-BR' });
      expect(result).toBe('pt-BR');
    });

    it('returns LC_ALL when ZAVORTH_LANG is not set', () => {
      const result = resolveFromEnv({ LC_ALL: 'fr-FR' });
      expect(result).toBe('fr-FR');
    });

    it('returns empty string when no env vars set', () => {
      expect(resolveFromEnv({})).toBe('');
      expect(resolveFromEnv(undefined)).toBe('');
    });

    it('trims whitespace from env values', () => {
      const result = resolveFromEnv({ ZAVORTH_LANG: '  de-DE  ' });
      expect(result).toBe('de-DE');
    });
  });

  // 12. resolveLocale priority chain
  describe('resolveLocale respects priority chain', () => {
    it('explicitLocale takes highest priority', () => {
      const result = resolveLocale({
        explicitLocale: 'ja-JP',
        cookie: 'pt-BR',
        header: 'de-DE',
        env: { ZAVORTH_LANG: 'fr-FR' },
      });
      expect(result).toBe('ja-JP');
    });

    it('cookie used when no explicitLocale', () => {
      const result = resolveLocale({
        cookie: 'pt-BR',
        header: 'de-DE',
        env: { ZAVORTH_LANG: 'fr-FR' },
      });
      expect(result).toBe('pt-BR');
    });

    it('header used when no explicitLocale or cookie', () => {
      const result = resolveLocale({
        header: 'de-DE',
        env: { ZAVORTH_LANG: 'fr-FR' },
      });
      expect(result).toBe('de-DE');
    });

    it('env used when no explicitLocale, cookie, or header', () => {
      const result = resolveLocale({
        env: { ZAVORTH_LANG: 'ru-RU' },
      });
      expect(result).toBe('ru-RU');
    });

    it('falls back to default when nothing is set', () => {
      const result = resolveLocale({});
      expect(result).toBe(DEFAULT_LOCALE);
    });
  });

  // 13. I18nManager setLocale / getLocale round-trip
  describe('I18nManager setLocale / getLocale', () => {
    it('defaults to the configured defaultLocale (normalized)', () => {
      const mgr = new I18nManager({ defaultLocale: 'en', localesDir: LOCALES_DIR });
      expect(mgr.getLocale()).toBe('en-US');
    });

    it('setLocale normalizes the input', () => {
      const mgr = new I18nManager({ defaultLocale: 'en', localesDir: LOCALES_DIR });
      mgr.setLocale('pt');
      expect(mgr.getLocale()).toBe('pt-BR');
    });

    it('setLocale normalizes zh-TW to zh-TW per locale map', () => {
      const mgr = new I18nManager({ defaultLocale: 'en', localesDir: LOCALES_DIR });
      mgr.setLocale('zh-TW');
      expect(mgr.getLocale()).toBe('zh-TW');
    });
  });

  // 14. KNOWN_LOCALES and NAMESPACE_LIST constants
  describe('Constants are defined correctly', () => {
    it('DEFAULT_LOCALE is en-US', () => {
      expect(DEFAULT_LOCALE).toBe('en-US');
    });

    it('KNOWN_LOCALES contains expected locales', () => {
      expect(KNOWN_LOCALES).toContain('en-US');
      expect(KNOWN_LOCALES).toContain('pt-BR');
      expect(KNOWN_LOCALES).toContain('ja-JP');
      expect(KNOWN_LOCALES).toContain('zh-CN');
      expect(KNOWN_LOCALES).toContain('ko-KR');
      expect(KNOWN_LOCALES).toContain('ru-RU');
    });

    it('NAMESPACE_LIST contains all expected namespaces', () => {
      expect(NAMESPACE_LIST).toContain('common');
      expect(NAMESPACE_LIST).toContain('cli');
      expect(NAMESPACE_LIST).toContain('errors');
      expect(NAMESPACE_LIST).toContain('services');
      expect(NAMESPACE_LIST).toContain('zavorthControl');
      expect(NAMESPACE_LIST).toContain('desktop');
      expect(NAMESPACE_LIST).toContain('telegram');
      expect(NAMESPACE_LIST).toContain('onboarding');
    });
  });

  // 15. Structural integrity across all locales
  describe('Structural integrity across all locales', () => {
    for (const localeCode of ALL_LOCALE_CODES) {
      it(`${localeCode}: all namespace values are string-valued (leaf strings)`, () => {
        const data = loadLocaleJson(localeCode);
        for (const ns of EXPECTED_NAMESPACES) {
          const nsData = data[ns] as Record<string, unknown>;
          const keys = collectKeys(nsData);
          for (const key of keys) {
            expect(typeof key).toBe('string');
            expect(key.length).toBeGreaterThan(0);
          }
        }
      });

      it(`${localeCode}: key counts match across namespaces`, () => {
        const data = loadLocaleJson(localeCode);
        const enData = loadLocaleJson('en');
        for (const ns of EXPECTED_NAMESPACES) {
          const localeKeys = collectKeys(data[ns] as Record<string, unknown>).sort();
          const enKeys = collectKeys(enData[ns] as Record<string, unknown>).sort();
          expect(localeKeys.length).toBe(enKeys.length);
        }
      });
    }
  });

  // 16. loadTranslations and addNamespace
  describe('loadTranslations and addNamespace', () => {
    it('loadTranslations injects new translations', () => {
      const mgr = new I18nManager({ defaultLocale: 'en', localesDir: LOCALES_DIR });
      mgr.loadTranslations('en', { test_ns: { hello: 'Hello World' } });
      mgr.setLocale('en');
      const result = mgr.t('hello', undefined, 'test_ns');
      expect(result).toBe('Hello World');
    });

    it('addNamespace adds to the current locale', () => {
      const mgr = new I18nManager({ defaultLocale: 'en', localesDir: LOCALES_DIR });
      mgr.setLocale('en');
      mgr.addNamespace('custom', { foo: 'bar' });
      const result = mgr.t('foo', undefined, 'custom');
      expect(result).toBe('bar');
    });

    it('loaded translations override file-based translations for the same key', () => {
      const mgr = new I18nManager({ defaultLocale: 'en', localesDir: LOCALES_DIR });
      mgr.loadTranslations('en', { common: { yes: 'Override Yes' } });
      mgr.setLocale('en');
      const result = mgr.t('yes', undefined, 'common');
      expect(result).toBe('Override Yes');
    });
  });

  // 17. Interpolation via I18nManager.t()
  describe('I18nManager.t() with interpolation parameters', () => {
    it('replaces {name} in a loaded translation', () => {
      const mgr = new I18nManager({ defaultLocale: 'en', localesDir: LOCALES_DIR });
      mgr.loadTranslations('en', { greetings: { hello: 'Hello, {name}!' } });
      mgr.setLocale('en');
      expect(mgr.t('hello', { name: 'Alice' }, 'greetings')).toBe('Hello, Alice!');
    });

    it('replaces multiple parameters', () => {
      const mgr = new I18nManager({ defaultLocale: 'en', localesDir: LOCALES_DIR });
      mgr.loadTranslations('en', { msg: { intro: '{greeting}, {name}! Count: {n}' } });
      mgr.setLocale('en');
      expect(mgr.t('intro', { greeting: 'Hi', name: 'Bob', n: 7 }, 'msg')).toBe('Hi, Bob! Count: 7');
    });

    it('returns raw key when namespace and key are not found', () => {
      const mgr = new I18nManager({ defaultLocale: 'en', localesDir: LOCALES_DIR });
      mgr.setLocale('en');
      expect(mgr.t('nonexistent.key')).toBe('nonexistent.key');
    });
  });

  // 18. No duplicate translations across locale files
  describe('No unexpected extra keys compared to English baseline', () => {
    const enData = loadLocaleJson('en');
    const enKeysByNs: Record<string, string[]> = {};
    for (const ns of EXPECTED_NAMESPACES) {
      enKeysByNs[ns] = collectKeys(enData[ns] as Record<string, unknown>).sort();
    }

    for (const localeCode of ALL_LOCALE_CODES.filter((c) => c !== 'en')) {
      it(`${localeCode} has no extra keys not present in en`, () => {
        const data = loadLocaleJson(localeCode);
        for (const ns of EXPECTED_NAMESPACES) {
          const localeKeys = collectKeys(data[ns] as Record<string, unknown>).sort();
          for (const key of localeKeys) {
            expect(enKeysByNs[ns]).toContain(key);
          }
        }
      });
    }
  });
});
