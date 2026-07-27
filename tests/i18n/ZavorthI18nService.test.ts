import { ZavorthI18nService, getI18nService, resetI18nService } from '../../src/i18n/ZavorthI18nService.js';
import { interpolate } from '../../src/i18n/interpolation.js';
import { normalizeLocale, resolveLocale, resolveFromEnv } from '../../src/i18n/localeDetector.js';

describe('ZavorthI18nService', () => {
  afterEach(() => {
    resetI18nService();
  });

  describe('interpolation', () => {
    it('should replace {var} with values', () => {
      expect(interpolate('Hello {name}!', { name: 'World' })).toBe('Hello World!');
    });

    it('should replace multiple variables', () => {
      expect(interpolate('{greeting} {name}!', { greeting: 'Hi', name: 'Ermy' })).toBe('Hi Ermy!');
    });

    it('should handle numeric values', () => {
      expect(interpolate('{count} items', { count: 42 })).toBe('42 items');
    });

    it('should leave unreplaced vars intact', () => {
      expect(interpolate('{a} and {b}', { a: 'X' })).toBe('X and {b}');
    });
  });

  describe('normalizeLocale', () => {
    it('should normalize pt variants to pt-BR', () => {
      expect(normalizeLocale('pt')).toBe('pt-BR');
      expect(normalizeLocale('pt-BR')).toBe('pt-BR');
      expect(normalizeLocale('pt_BR')).toBe('pt-BR');
      expect(normalizeLocale('PT')).toBe('pt-BR');
    });

    it('should normalize en variants to en-US', () => {
      expect(normalizeLocale('en')).toBe('en-US');
      expect(normalizeLocale('en-US')).toBe('en-US');
      expect(normalizeLocale('EN')).toBe('en-US');
    });

    it('should normalize es variants to es-ES', () => {
      expect(normalizeLocale('es')).toBe('es-ES');
      expect(normalizeLocale('es-ES')).toBe('es-ES');
      expect(normalizeLocale('es-MX')).toBe('es-ES');
    });

    it('should normalize fr variants to fr-FR', () => {
      expect(normalizeLocale('fr')).toBe('fr-FR');
      expect(normalizeLocale('fr-FR')).toBe('fr-FR');
      expect(normalizeLocale('fr-CA')).toBe('fr-FR');
    });

    it('should normalize de variants to de-DE', () => {
      expect(normalizeLocale('de')).toBe('de-DE');
      expect(normalizeLocale('de-DE')).toBe('de-DE');
      expect(normalizeLocale('de-AT')).toBe('de-DE');
    });

    it('should normalize ja to ja-JP', () => {
      expect(normalizeLocale('ja')).toBe('ja-JP');
      expect(normalizeLocale('ja-JP')).toBe('ja-JP');
    });

    it('should normalize zh to zh-CN', () => {
      expect(normalizeLocale('zh')).toBe('zh-CN');
      expect(normalizeLocale('zh-CN')).toBe('zh-CN');
      // Traditional Chinese stays its own locale (not collapsed to Simplified).
      expect(normalizeLocale('zh-TW')).toBe('zh-TW');
    });

    it('should normalize ko to ko-KR', () => {
      expect(normalizeLocale('ko')).toBe('ko-KR');
    });

    it('should normalize ru to ru-RU', () => {
      expect(normalizeLocale('ru')).toBe('ru-RU');
    });

    it('should normalize ar to ar-SA', () => {
      expect(normalizeLocale('ar')).toBe('ar-SA');
    });

    it('should return raw locale for unknown (dynamic fallback)', () => {
      expect(normalizeLocale('xx')).toBe('xx');
      expect(normalizeLocale(null)).toBe('en-US');
      expect(normalizeLocale('')).toBe('en-US');
    });
  });

  describe('resolveFromEnv', () => {
    it('should read ZAVORTH_LANG first', () => {
      expect(resolveFromEnv({ ZAVORTH_LANG: 'pt-BR' })).toBe('pt-BR');
    });

    it('should fall back through env chain', () => {
      expect(resolveFromEnv({ LANG: 'pt_BR.UTF-8' })).toBe('pt_BR.UTF-8');
    });

    it('should return empty for no env', () => {
      expect(resolveFromEnv({})).toBe('');
      expect(resolveFromEnv(undefined)).toBe('');
    });
  });

  describe('resolveLocale', () => {
    it('should prefer explicitLocale', () => {
      expect(resolveLocale({ explicitLocale: 'pt-BR' })).toBe('pt-BR');
    });

    it('should fall back to cookie', () => {
      expect(resolveLocale({ cookie: 'pt-BR' })).toBe('pt-BR');
    });

    it('should fall back to header', () => {
      expect(resolveLocale({ header: 'pt-BR' })).toBe('pt-BR');
    });

    it('should fall back to env', () => {
      expect(resolveLocale({ env: { ZAVORTH_LANG: 'pt-BR' } })).toBe('pt-BR');
    });
  });

  describe('ZavorthI18nService', () => {
    it('should default to en-US', () => {
      const svc = new ZavorthI18nService();
      expect(svc.getLocale()).toBe('en-US');
    });

    it('should accept locale from runtime', () => {
      const svc = new ZavorthI18nService({ locale: 'pt-BR' });
      expect(svc.getLocale()).toBe('pt-BR');
    });

    it('should accept locale from config', () => {
      const svc = new ZavorthI18nService({ config: { zavorthLocale: 'pt' } });
      expect(svc.getLocale()).toBe('pt-BR');
    });

    it('should set and get locale', () => {
      const svc = new ZavorthI18nService();
      svc.setLocale('pt');
      expect(svc.getLocale()).toBe('pt-BR');
    });

    it('should return key as fallback when translation missing', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('nonexistent.key');
      expect(result).toBe('nonexistent.key');
    });

    it('should return custom fallback when provided', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('nonexistent.key', { fallback: 'Default Text' });
      expect(result).toBe('Default Text');
    });

    it('should handle interpolation in translations', () => {
      const svc = new ZavorthI18nService();
      const result = svc.t('cli.welcome', { vars: { name: 'Ermy' } });
      expect(result).toContain('Ermy');
    });

    it('should detect available locales', () => {
      const svc = new ZavorthI18nService();
      const locales = svc.getAvailableLocales();
      expect(locales).toContain('en-US');
      expect(locales).toContain('pt-BR');
    });

    it('should detect loaded namespaces', () => {
      const svc = new ZavorthI18nService();
      const namespaces = svc.getLoadedNamespaces();
      expect(namespaces).toContain('common');
      expect(namespaces).toContain('cli');
      expect(namespaces).toContain('errors');
    });

    it('should check if key exists', () => {
      const svc = new ZavorthI18nService();
      expect(svc.has('common.app.name')).toBe(true);
      expect(svc.has('nonexistent.key')).toBe(false);
    });

    it('should clear cache', () => {
      const svc = new ZavorthI18nService();
      svc.t('common.app.name');
      svc.clearCache();
      expect(svc.getLocale()).toBe('en-US');
    });

    it('resolves product-mode desktop labels without leaking raw keys', () => {
      const svc = new ZavorthI18nService({ locale: 'en-US' });
      const keys = [
        'services.desktop.current_mode',
        'services.desktop.expected_base_profile',
        'services.desktop.visible_surfaces',
        'services.desktop.hidden_by_default',
        'services.desktop.possible_escalations',
        'services.desktop.commands',
        'services.desktop.cli',
        'services.desktop.recommend_restart',
        'services.desktop.nothing',
        'services.desktop.aligned',
        'services.desktop.none',
        'services.surface.actions',
      ] as const;
      for (const key of keys) {
        const value = svc.t(key);
        expect(value).not.toBe(key);
        expect(value).not.toMatch(/^desktop\./);
        expect(value).not.toBe('Actions');
      }
      expect(svc.t('services.desktop.current_mode')).toBe('Current mode');
      expect(svc.t('services.surface.actions')).toBe('Actions');
    });

    it('falls back desktop keys to en-US for other locales when missing', () => {
      const svc = new ZavorthI18nService({ locale: 'de-DE' });
      expect(svc.t('services.desktop.current_mode')).toBe('Current mode');
      expect(svc.t('services.surface.actions')).toBe('Actions');
    });
  });

  describe('getI18nService singleton', () => {
    it('should return same instance', () => {
      const a = getI18nService();
      const b = getI18nService();
      expect(a).toBe(b);
    });

    it('should create new instance after reset', () => {
      const a = getI18nService();
      resetI18nService();
      const b = getI18nService();
      expect(a).not.toBe(b);
    });
  });
});
