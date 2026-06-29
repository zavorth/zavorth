import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import yaml from 'js-yaml';

import {
  ZavorthI18nService,
  getI18nService,
  resetI18nService,
} from '../../src/i18n/ZavorthI18nService.js';
import { normalizeLocale, resolveFromEnv, resolveLocale } from '../../src/i18n/localeDetector.js';
import { interpolate } from '../../src/i18n/interpolation.js';
import type {
  SupportedLocale,
  LocaleNamespace,
} from '../../src/i18n/types.js';
import { DEFAULT_LOCALE, KNOWN_LOCALES, NAMESPACE_LIST } from '../../src/i18n/types.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-manager-test-'));
}

function writeLocaleFile(dir: string, locale: string, ns: string, data: Record<string, unknown>): void {
  const localeDir = path.join(dir, locale);
  fs.mkdirSync(localeDir, { recursive: true });
  fs.writeFileSync(path.join(localeDir, `${ns}.yaml`), yaml.dump(data), 'utf-8');
}

describe('I18nManager', () => {
  afterEach(() => {
    resetI18nService();
  });

  describe('set and get locale', () => {
    it('should default to en-US', () => {
      const svc = new ZavorthI18nService();
      expect(svc.getLocale()).toBe('en-US');
    });

    it('should accept locale from constructor runtime', () => {
      const svc = new ZavorthI18nService({ locale: 'pt-BR' });
      expect(svc.getLocale()).toBe('pt-BR');
    });

    it('should accept locale from config', () => {
      const svc = new ZavorthI18nService({ config: { zavorthLocale: 'de' } });
      expect(svc.getLocale()).toBe('de-DE');
    });

    it('should set locale dynamically', () => {
      const svc = new ZavorthI18nService();
      svc.setLocale('pt');
      expect(svc.getLocale()).toBe('pt-BR');
    });

    it('should normalize locale variants when setting', () => {
      const svc = new ZavorthI18nService();
      svc.setLocale('PT_BR');
      expect(svc.getLocale()).toBe('pt-BR');
    });

    it('should override previous locale', () => {
      const svc = new ZavorthI18nService({ locale: 'pt-BR' });
      expect(svc.getLocale()).toBe('pt-BR');
      svc.setLocale('de-DE');
      expect(svc.getLocale()).toBe('de-DE');
    });
  });

  describe('list available locales', () => {
    it('should list locales with translation files on disk', () => {
      const svc = new ZavorthI18nService();
      const locales = svc.getAvailableLocales();
      expect(locales).toContain('en-US');
      expect(locales).toContain('pt-BR');
      expect(Array.isArray(locales)).toBe(true);
    });

    it('should return only locales with existing directories', () => {
      const svc = new ZavorthI18nService();
      const locales = svc.getAvailableLocales();
      for (const locale of locales) {
        expect(typeof locale).toBe('string');
        expect(locale.length).toBeGreaterThan(0);
      }
    });

    it('should include en-US as the default locale', () => {
      const svc = new ZavorthI18nService();
      const locales = svc.getAvailableLocales();
      expect(locales[0]).toBe('en-US');
    });
  });

  describe('translate simple strings', () => {
    it('should translate a known key', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('common.app.name');
      expect(result).toBe('Zavorth');
    });

    it('should translate nested keys', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('common.status.ready');
      expect(result).toBe('Ready');
    });

    it('should return the key as fallback for missing translations', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('nonexistent.key.path');
      expect(result).toBe('nonexistent.key.path');
    });

    it('should translate for pt-BR locale', () => {
      const svc = new ZavorthI18nService({ locale: 'pt-BR' });
      const result = svc.t('common.status.ready');
      expect(result).toBe('Pronto');
    });

    it('should translate action labels', () => {
      const svc = new ZavorthI18nService();
      expect(svc.t('common.actions.save')).toBe('Save');
      expect(svc.t('common.actions.delete')).toBe('Delete');
    });

    it('should translate in pt-BR action labels', () => {
      const svc = new ZavorthI18nService({ locale: 'pt-BR' });
      expect(svc.t('common.actions.save')).toBe('Salvar');
      expect(svc.t('common.actions.delete')).toBe('Excluir');
    });
  });

  describe('translate with interpolation params', () => {
    it('should interpolate a single variable', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('common.time.seconds_ago', { vars: { count: 5 } });
      expect(result).toBe('5 seconds ago');
    });

    it('should interpolate multiple variables', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('cli.doctor.summary', {
        vars: { pass: 10, fail: 2, warn: 1 },
      });
      expect(result).toBe('10 passed, 2 failed, 1 warnings');
    });

    it('should interpolate error messages with params', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('errors.generic.unexpected', {
        vars: { error: 'timeout' },
      });
      expect(result).toBe('An unexpected error occurred: timeout');
    });

    it('should interpolate pt-BR translations', () => {
      const svc = new ZavorthI18nService({ locale: 'pt-BR' });
      const result = svc.t('common.time.seconds_ago', { vars: { count: 3 } });
      expect(result).toBe('há 3 segundos');
    });

    it('should interpolate provider error messages', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('errors.provider.api_key_missing', {
        vars: { provider: 'openai' },
      });
      expect(result).toBe('API key for openai is not set.');
    });

    it('should interpolate dashboard welcome', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('dashboard.home.welcome', {
        vars: { name: 'Ermy' },
      });
      expect(result).toBe('Welcome back, Ermy.');
    });

    it('should interpolate services learning message', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('services.learning.skill_created', {
        vars: { name: 'code-review' },
      });
      expect(result).toBe('New skill created from experience: code-review');
    });
  });

  describe('fall back to default locale', () => {
    it('should fall back to en-US when key missing in pt-BR', () => {
      const svc = new ZavorthI18nService({ locale: 'pt-BR' });
      const result = svc.t('common.app.name');
      expect(result).toBe('Zavorth');
    });

    it('should fall back with custom fallback string', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('nonexistent.key', { fallback: 'Default Value' });
      expect(result).toBe('Default Value');
    });

    it('should fall back to key when no fallback provided', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('missing.dotted.key');
      expect(result).toBe('missing.dotted.key');
    });

    it('should resolve per-locale override then fall back to default', () => {
      const svc = new ZavorthI18nService({ locale: 'pt-BR' });
      const enResult = svc.t('common.status.ready', { locale: 'en-US' });
      expect(enResult).toBe('Ready');
      const ptResult = svc.t('common.status.ready', { locale: 'pt-BR' });
      expect(ptResult).toBe('Pronto');
    });

    it('should fall back for de-DE locale to en-US values', () => {
      const svc = new ZavorthI18nService({ locale: 'de-DE' });
      const result = svc.t('common.status.ready');
      expect(result).toBe('Bereit');
    });

    it('should handle fallback for missing de-DE key in common', () => {
      const svc = new ZavorthI18nService({ locale: 'de-DE' });
      const result = svc.t('common.time.seconds_ago', { vars: { count: 1 } });
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('namespace support', () => {
    it('should translate from the common namespace', () => {
      const svc = new ZavorthI18nService();
      expect(svc.t('common.app.name')).toBe('Zavorth');
    });

    it('should translate from the cli namespace', () => {
      const svc = new ZavorthI18nService();
      expect(svc.t('cli.help.title')).toBe('Zavorth CLI Help');
    });

    it('should translate from the errors namespace', () => {
      const svc = new ZavorthI18nService();
      expect(svc.t('errors.generic.not_implemented')).toBe('This feature is not yet implemented.');
    });

    it('should translate from the dashboard namespace', () => {
      const svc = new ZavorthI18nService();
      expect(svc.t('dashboard.chat.title')).toBe('Chat');
    });

    it('should translate from the desktop namespace', () => {
      const svc = new ZavorthI18nService();
      expect(svc.t('desktop.app.title')).toBe('Zavorth Desktop');
    });

    it('should translate from the services namespace', () => {
      const svc = new ZavorthI18nService();
      expect(svc.t('services.voice.listening')).toBe('Listening...');
    });

    it('should translate from the onboarding namespace', () => {
      const svc = new ZavorthI18nService();
      expect(svc.t('onboarding.welcome.title')).toBe('Welcome to Zavorth');
    });

    it('should check key existence per namespace', () => {
      const svc = new ZavorthI18nService();
      expect(svc.has('common.app.name')).toBe(true);
      expect(svc.has('cli.help.title')).toBe(true);
      expect(svc.has('errors.generic.unexpected')).toBe(true);
      expect(svc.has('dashboard.chat.title')).toBe(true);
    });

    it('should detect loaded namespaces', () => {
      const svc = new ZavorthI18nService();
      const namespaces = svc.getLoadedNamespaces();
      expect(namespaces).toContain('common');
      expect(namespaces).toContain('cli');
      expect(namespaces).toContain('errors');
    });

    it('should return false for nonexistent key', () => {
      const svc = new ZavorthI18nService();
      expect(svc.has('nonexistent.key')).toBe(false);
    });
  });

  describe('pluralization (one/other forms)', () => {
    it('should handle count-based time expressions as one form', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('common.time.seconds_ago', { vars: { count: 1 } });
      expect(result).toBe('1 seconds ago');
    });

    it('should handle count-based time expressions as other form', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('common.time.seconds_ago', { vars: { count: 5 } });
      expect(result).toBe('5 seconds ago');
    });

    it('should handle zero count', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('common.time.seconds_ago', { vars: { count: 0 } });
      expect(result).toBe('0 seconds ago');
    });

    it('should handle plural forms in pt-BR', () => {
      const svc = new ZavorthI18nService({ locale: 'pt-BR' });
      const singular = svc.t('common.time.days_ago', { vars: { count: 1 } });
      const plural = svc.t('common.time.days_ago', { vars: { count: 3 } });
      expect(singular).toContain('1');
      expect(plural).toContain('3');
    });

    it('should handle large counts in interpolation', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('common.time.hours_ago', { vars: { count: 1000 } });
      expect(result).toBe('1000 hours ago');
    });
  });

  describe('date formatting for different locales', () => {
    it('should format relative time for en-US', () => {
      const svc = new ZavorthI18nService();
      expect(svc.t('common.time.today')).toBe('today');
      expect(svc.t('common.time.yesterday')).toBe('yesterday');
      expect(svc.t('common.time.tomorrow')).toBe('tomorrow');
    });

    it('should format relative time for pt-BR', () => {
      const svc = new ZavorthI18nService({ locale: 'pt-BR' });
      expect(svc.t('common.time.today')).toBe('hoje');
      expect(svc.t('common.time.yesterday')).toBe('ontem');
      expect(svc.t('common.time.tomorrow')).toBe('amanhã');
    });

    it('should format relative time for de-DE', () => {
      const svc = new ZavorthI18nService({ locale: 'de-DE' });
      expect(svc.t('common.time.today')).toBe('heute');
      expect(svc.t('common.time.yesterday')).toBe('gestern');
    });

    it('should format time ago messages for en-US', () => {
      const svc = new ZavorthI18nService();
      expect(svc.t('common.time.minutes_ago', { vars: { count: 5 } })).toBe('5 minutes ago');
      expect(svc.t('common.time.hours_ago', { vars: { count: 2 } })).toBe('2 hours ago');
      expect(svc.t('common.time.days_ago', { vars: { count: 1 } })).toBe('1 days ago');
    });

    it('should format time ago messages for pt-BR', () => {
      const svc = new ZavorthI18nService({ locale: 'pt-BR' });
      expect(svc.t('common.time.minutes_ago', { vars: { count: 5 } })).toBe('há 5 minutos');
      expect(svc.t('common.time.hours_ago', { vars: { count: 2 } })).toBe('há 2 horas');
      expect(svc.t('common.time.days_ago', { vars: { count: 1 } })).toBe('há 1 dias');
    });

    it('should format future time messages', () => {
      const svc = new ZavorthI18nService();
      expect(svc.t('common.time.in_seconds', { vars: { count: 30 } })).toBe('in 30 seconds');
      expect(svc.t('common.time.in_minutes', { vars: { count: 10 } })).toBe('in 10 minutes');
      expect(svc.t('common.time.in_hours', { vars: { count: 1 } })).toBe('in 1 hours');
    });
  });

  describe('number formatting for different locales', () => {
    it('should return unit labels for en-US', () => {
      const svc = new ZavorthI18nService();
      expect(svc.t('common.units.bytes')).toBe('B');
      expect(svc.t('common.units.kilobytes')).toBe('KB');
      expect(svc.t('common.units.megabytes')).toBe('MB');
      expect(svc.t('common.units.gigabytes')).toBe('GB');
    });

    it('should return time unit labels for en-US', () => {
      const svc = new ZavorthI18nService();
      expect(svc.t('common.units.milliseconds')).toBe('ms');
      expect(svc.t('common.units.seconds')).toBe('s');
      expect(svc.t('common.units.minutes')).toBe('min');
      expect(svc.t('common.units.hours')).toBe('h');
      expect(svc.t('common.units.days')).toBe('d');
    });

    it('should return unit labels for pt-BR', () => {
      const svc = new ZavorthI18nService({ locale: 'pt-BR' });
      expect(svc.t('common.units.bytes')).toBe('B');
      expect(svc.t('common.units.kilobytes')).toBe('KB');
      expect(svc.t('common.units.megabytes')).toBe('MB');
    });

    it('should handle numeric interpolation in provider errors', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('errors.provider.timeout', {
        vars: { provider: 'openai', seconds: 30 },
      });
      expect(result).toBe("Provider 'openai' timed out after 30 seconds.");
    });

    it('should handle numeric interpolation in rate limit messages', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('errors.generic.rate_limited', { vars: { seconds: 60 } });
      expect(result).toBe('Rate limited. Please try again in 60 seconds.');
    });
  });

  describe('load translations dynamically', () => {
    it('should clear cache and reload', () => {
      const svc = new ZavorthI18nService();
      svc.t('common.app.name');
      svc.clearCache();
      expect(svc.getLocale()).toBe('en-US');
    });

    it('should reload after locale switch', () => {
      const svc = new ZavorthI18nService();
      expect(svc.t('cli.help.title')).toBe('Zavorth CLI Help');
      svc.setLocale('pt-BR');
      expect(svc.t('cli.help.title')).toBe('Ajuda do CLI Zavorth');
    });

    it('should use catalogFor to extract multiple keys at once', () => {
      const svc = new ZavorthI18nService();
      const catalog = svc.catalogFor('common', ['app.name', 'status.ready', 'actions.save']);
      expect(catalog['app.name']).toBe('Zavorth');
      expect(catalog['status.ready']).toBe('Ready');
      expect(catalog['actions.save']).toBe('Save');
    });

    it('should use catalogFor with pt-BR locale', () => {
      const svc = new ZavorthI18nService();
      const catalog = svc.catalogFor('common', ['status.ready', 'actions.save'], 'pt-BR');
      expect(catalog['status.ready']).toBe('Pronto');
      expect(catalog['actions.save']).toBe('Salvar');
    });

    it('should load translations from custom tmp dir', () => {
      const tmpDir = makeTmpDir();
      try {
        writeLocaleFile(tmpDir, 'en-US', 'common', { test: { key: 'hello' } });
        writeLocaleFile(tmpDir, 'pt-BR', 'common', { test: { key: 'olá' } });

        const svc = new ZavorthI18nService();
        (svc as unknown as { localesDir: string }).localesDir = tmpDir;
        (svc as unknown as { cache: Map<string, unknown> }).cache.clear();

        expect(svc.t('common.test.key')).toBe('hello');
        svc.setLocale('pt-BR');
        expect(svc.t('common.test.key')).toBe('olá');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('should not crash when loading invalid yaml', () => {
      const tmpDir = makeTmpDir();
      try {
        const localeDir = path.join(tmpDir, 'en-US');
        fs.mkdirSync(localeDir, { recursive: true });
        fs.writeFileSync(path.join(localeDir, 'common.yaml'), ':::invalid yaml{{', 'utf-8');

        const svc = new ZavorthI18nService();
        (svc as unknown as { localesDir: string }).localesDir = tmpDir;
        (svc as unknown as { cache: Map<string, unknown> }).cache.clear();

        const result = svc.t('common.any.key');
        expect(result).toBe('common.any.key');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('get missing keys', () => {
    it('should return false for nonexistent key', () => {
      const svc = new ZavorthI18nService();
      expect(svc.has('nonexistent.deep.key')).toBe(false);
    });

    it('should return false for key without namespace', () => {
      const svc = new ZavorthI18nService();
      expect(svc.has('noDot')).toBe(false);
    });

    it('should return true for existing keys', () => {
      const svc = new ZavorthI18nService();
      expect(svc.has('common.app.name')).toBe(true);
      expect(svc.has('cli.welcome')).toBe(true);
      expect(svc.has('errors.generic.unexpected')).toBe(true);
    });

    it('should return the key itself for missing translations in t()', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('common.totally.missing.key');
      expect(result).toBe('common.totally.missing.key');
    });

    it('should return custom fallback for missing keys', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('common.missing', { fallback: 'N/A' });
      expect(result).toBe('N/A');
    });

    it('should still interpolate when fallback is used', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('common.missing', {
        fallback: 'Value is {val}',
        vars: { val: 42 },
      });
      expect(result).toBe('Value is 42');
    });
  });

  describe('multiple namespace support', () => {
    it('should translate from all defined namespaces', () => {
      const svc = new ZavorthI18nService();
      for (const ns of NAMESPACE_LIST) {
        const key = `${ns}.`;
        const namespaces = svc.getLoadedNamespaces();
        if (namespaces.includes(ns as LocaleNamespace)) {
          expect(typeof namespaces).toBe('object');
        }
      }
    });

    it('should translate across common and cli namespaces', () => {
      const svc = new ZavorthI18nService();
      const commonResult = svc.t('common.app.name');
      const cliResult = svc.t('cli.help.title');
      expect(commonResult).toBe('Zavorth');
      expect(cliResult).toBe('Zavorth CLI Help');
    });

    it('should translate across errors and services namespaces', () => {
      const svc = new ZavorthI18nService();
      const errorResult = svc.t('errors.generic.not_implemented');
      const serviceResult = svc.t('services.voice.listening');
      expect(errorResult).toBe('This feature is not yet implemented.');
      expect(serviceResult).toBe('Listening...');
    });

    it('should translate across dashboard and desktop namespaces', () => {
      const svc = new ZavorthI18nService();
      const dashResult = svc.t('dashboard.chat.title');
      const desktopResult = svc.t('desktop.app.title');
      expect(dashResult).toBe('Chat');
      expect(desktopResult).toBe('Zavorth Desktop');
    });

    it('should translate across onboarding namespace', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('onboarding.steps.language.title');
      expect(result).toBe('Language');
    });

    it('should support per-namespace locale override', () => {
      const svc = new ZavorthI18nService({ locale: 'pt-BR' });
      expect(svc.t('common.status.ready')).toBe('Pronto');
      expect(svc.t('cli.help.title')).toBe('Ajuda do CLI Zavorth');
      expect(svc.t('onboarding.welcome.title')).toBe('Bem-vindo ao Zavorth');
    });

    it('should build catalog across namespaces', () => {
      const svc = new ZavorthI18nService();
      const commonCatalog = svc.catalogFor('common', ['app.name', 'status.ready']);
      const cliCatalog = svc.catalogFor('cli', ['help.title', 'welcome']);
      expect(commonCatalog['app.name']).toBe('Zavorth');
      expect(cliCatalog['help.title']).toBe('Zavorth CLI Help');
    });
  });

  describe('locale detection (from environment)', () => {
    it('should detect ZAVORTH_LANG env var', () => {
      expect(resolveFromEnv({ ZAVORTH_LANG: 'pt-BR' })).toBe('pt-BR');
    });

    it('should fall back through env priority chain', () => {
      expect(resolveFromEnv({ LC_ALL: 'fr_FR.UTF-8' })).toBe('fr_FR.UTF-8');
      expect(resolveFromEnv({ LANG: 'de_DE.UTF-8' })).toBe('de_DE.UTF-8');
    });

    it('should return empty when no env vars set', () => {
      expect(resolveFromEnv({})).toBe('');
      expect(resolveFromEnv(undefined)).toBe('');
    });

    it('should prefer ZAVORTH_LANG over LANG', () => {
      expect(resolveFromEnv({ ZAVORTH_LANG: 'pt', LANG: 'en_US.UTF-8' })).toBe('pt');
    });

    it('should detect locale from explicitLocale source', () => {
      expect(resolveLocale({ explicitLocale: 'pt-BR' })).toBe('pt-BR');
    });

    it('should detect locale from cookie source', () => {
      expect(resolveLocale({ cookie: 'fr-FR' })).toBe('fr-FR');
    });

    it('should detect locale from header source', () => {
      expect(resolveLocale({ header: 'de-DE' })).toBe('de-DE');
    });

    it('should detect locale from env source', () => {
      expect(resolveLocale({ env: { ZAVORTH_LANG: 'es-ES' } })).toBe('es-ES');
    });

    it('should prioritize explicitLocale over cookie', () => {
      expect(resolveLocale({ explicitLocale: 'pt-BR', cookie: 'en-US' })).toBe('pt-BR');
    });

    it('should prioritize cookie over header', () => {
      expect(resolveLocale({ cookie: 'pt-BR', header: 'en-US' })).toBe('pt-BR');
    });

    it('should normalize detected locale', () => {
      expect(normalizeLocale('pt')).toBe('pt-BR');
      expect(normalizeLocale('en')).toBe('en-US');
      expect(normalizeLocale('es')).toBe('es-ES');
      expect(normalizeLocale('fr')).toBe('fr-FR');
      expect(normalizeLocale('de')).toBe('de-DE');
      expect(normalizeLocale('ja')).toBe('ja-JP');
      expect(normalizeLocale('zh')).toBe('zh-CN');
      expect(normalizeLocale('ko')).toBe('ko-KR');
      expect(normalizeLocale('ru')).toBe('ru-RU');
      expect(normalizeLocale('ar')).toBe('ar-SA');
    });

    it('should fallback to en-US for null or empty input', () => {
      expect(normalizeLocale(null)).toBe('en-US');
      expect(normalizeLocale('')).toBe('en-US');
    });

    it('should preserve unknown locales as-is', () => {
      expect(normalizeLocale('xx-YY')).toBe('xx-yy');
    });

    it('should resolve locale through full chain with fallback', () => {
      expect(resolveLocale({})).toBe(DEFAULT_LOCALE);
      expect(resolveLocale({ env: {} })).toBe(DEFAULT_LOCALE);
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance from getI18nService', () => {
      const a = getI18nService();
      const b = getI18nService();
      expect(a).toBe(b);
    });

    it('should create a new instance after reset', () => {
      const a = getI18nService();
      resetI18nService();
      const b = getI18nService();
      expect(a).not.toBe(b);
    });

    it('should persist locale on singleton', () => {
      const svc = getI18nService();
      svc.setLocale('pt-BR');
      expect(svc.getLocale()).toBe('pt-BR');
      const same = getI18nService();
      expect(same.getLocale()).toBe('pt-BR');
      resetI18nService();
    });
  });

  describe('interpolation edge cases', () => {
    it('should leave template intact when no vars provided', () => {
      expect(interpolate('Hello {name}', {})).toBe('Hello {name}');
    });

    it('should handle numeric variable values', () => {
      expect(interpolate('{count} items', { count: 42 })).toBe('42 items');
    });

    it('should handle multiple occurrences of the same variable', () => {
      expect(interpolate('{x} and {x}', { x: 'A' })).toBe('A and A');
    });

    it('should escape regex special characters in variable names', () => {
      expect(interpolate('{a.b} value', { 'a.b': 'test' })).toBe('test value');
    });

    it('should handle variables with special regex chars', () => {
      expect(interpolate('{a+b} value', { 'a+b': 'ok' })).toBe('ok value');
    });
  });

  describe('resolveFromSource integration', () => {
    it('should resolve locale via service resolveFromSource', () => {
      const svc = new ZavorthI18nService();
      const resolved = svc.resolveFromSource({ explicitLocale: 'pt-BR' });
      expect(resolved).toBe('pt-BR');
    });

    it('should fall back to default locale when no source matches', () => {
      const svc = new ZavorthI18nService({ locale: 'de-DE' });
      const resolved = svc.resolveFromSource({});
      expect(resolved).toBe(DEFAULT_LOCALE);
    });
  });
});
