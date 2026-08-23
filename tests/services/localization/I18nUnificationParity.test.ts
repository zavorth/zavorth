import { describe, it, expect, afterEach } from '@jest/globals';
import {
  ZavorthI18nService,
  getI18nService,
  resetI18nService,
} from '../../../src/i18n/ZavorthI18nService.js';
import { tService, tError } from '../../../src/i18n/services.js';
import { tSurface } from '../../../src/i18n/surface.js';
import { tCli, tCommon, initCliLocale } from '../../../src/i18n/cli.js';
import { t as tTelegramGateway } from '../../../src/gateways/channels/telegram/i18n.js';
import {
  formatPluginLoadTip,
  resolvePluginLoadLocale,
} from '../../../src/services/localization/pluginTips.js';

/**
 * Contract suite for the i18n unification: every assertion pins a string that
 * previously shipped through the retired src/i18n YAML catalogs or the
 * retired src/services/plugin-i18n JSON loader, now resolved exclusively
 * through ZavorthLocalizationService.
 */

// The helper wrappers capture the first singleton at module load; keep a
// handle to that same instance for locale switching.
const wrapperBoundSingleton = getI18nService();

describe('i18n unification parity contracts', () => {
  afterEach(() => {
    resetI18nService();
  });

  describe('legacy YAML catalog keys resolve identically through the facade', () => {
    const cases: Array<[string, string, string]> = [
      ['cli.welcome', 'Welcome to Zavorth, {name}.', 'Bem-vindo ao Zavorth, {name}.'],
      ['cli.help.title', 'Zavorth CLI Help', 'Ajuda do CLI Zavorth'],
      ['cli.instance.title', 'Zavorth Instance Profiles', 'Perfis de Instância do Zavorth'],
      ['common.app.name', 'Zavorth', 'Zavorth'],
      ['services.desktop.current_mode', 'Current mode', 'Modo atual'],
      ['errors.generic.not_found', 'Resource not found: {resource}', 'Recurso não encontrado: {resource}'],
      ['quickstart.welcome.title', 'Welcome to Zavorth', 'Bem-vindo ao Zavorth'],
      ['zavorthControl.nav.home', 'Home', 'Início'],
      ['trust-loop.proof.title', 'Proof', 'Prova'],
      ['dashboard.home.welcome', 'Welcome back, {user}.', 'Welcome back, {user}.'],
    ];

    for (const [key, english, portuguese] of cases) {
      it(`resolves ${key} for en-US and pt-BR`, () => {
        const en = new ZavorthI18nService({ locale: 'en-US' });
        expect(en.t(key)).toBe(english);

        const pt = new ZavorthI18nService({ locale: 'pt-BR' });
        expect(pt.t(key)).toBe(portuguese);
      });
    }
  });

  it('interpolates migrated templates with vars in both locales', () => {
    const svc = new ZavorthI18nService({ locale: 'en-US' });
    expect(svc.t('cli.welcome', { vars: { name: 'Ermy' } })).toBe('Welcome to Zavorth, Ermy.');
    expect(svc.t('errors.generic.not_found', { vars: { resource: 'config' } })).toBe(
      'Resource not found: config',
    );

    const pt = new ZavorthI18nService({ locale: 'pt-BR' });
    expect(pt.t('errors.generic.not_found', { vars: { resource: 'config' } })).toBe(
      'Recurso não encontrado: config',
    );
  });

  it('falls back from partial locales to English exactly like the former BASE chain', () => {
    const svc = new ZavorthI18nService({ locale: 'de-DE' });
    expect(svc.t('services.desktop.current_mode')).toBe('Current mode');
    expect(svc.t('services.surface.actions')).toBe('Actions');
  });

  it('returns the raw key when nothing resolves and honors explicit fallbacks', () => {
    const svc = new ZavorthI18nService();
    expect(svc.t('nonexistent.deeply.nested.key')).toBe('nonexistent.deeply.nested.key');
    expect(svc.t('nonexistent.key', { fallback: 'Default Text' })).toBe('Default Text');
  });

  it('reports availability metadata consistent with the pre-unification service', () => {
    const svc = new ZavorthI18nService();
    expect(svc.getAvailableLocales()).toEqual(['en-US', 'pt-BR']);

    const namespaces = svc.getLoadedNamespaces();
    expect(namespaces).toContain('common');
    expect(namespaces).toContain('cli');
    expect(namespaces).toContain('errors');
    expect(namespaces).toContain('telegram');
    expect(namespaces).toContain('services');

    expect(svc.has('common.app.name')).toBe(true);
    expect(svc.has('nonexistent.key')).toBe(false);
  });

  describe('surface/service/cli helper wrappers keep their resolution contract', () => {
    afterEach(() => {
      delete process.env.ZAVORTH_LANG;
      delete process.env.ZAVORTH_LOCALE;
    });

    it('tService prefers the active locale then English', () => {
      wrapperBoundSingleton.setLocale('en-US');
      expect(tService('desktop.current_mode')).toBe('Current mode');
      wrapperBoundSingleton.setLocale('pt-BR');
      expect(tService('desktop.current_mode')).toBe('Modo atual');
    });

    it('tError interpolates localized templates', () => {
      wrapperBoundSingleton.setLocale('pt-BR');
      expect(tError('generic.not_found', { resource: 'memória' })).toBe(
        'Recurso não encontrado: memória',
      );
    });

    it('tSurface prefixes services.surface and localizes', () => {
      wrapperBoundSingleton.setLocale('en-US');
      expect(tSurface('actions')).toBe('Actions');
    });

    it('tCli/tCommon/initCliLocale honor env-driven detection', () => {
      process.env.ZAVORTH_LANG = 'pt-BR';
      initCliLocale(process.env);
      expect(tCli('help.title')).toBe('Ajuda do CLI Zavorth');
      expect(tCommon('app.name')).toBe('Zavorth');
    });
  });

  describe('telegram gateway strings resolve from migrated catalogs', () => {
    it('serves the inline-dictionary strings from the unified catalog', () => {
      const svc = new ZavorthI18nService({ locale: 'en-US' });
      expect(svc.t('telegram.auth.access_restricted')).toContain('**Access Restricted:**');
      expect(svc.t('telegram.security.wrong_password')).toBe('❌ Wrong password.');

      const pt = new ZavorthI18nService({ locale: 'pt-BR' });
      expect(pt.t('telegram.auth.access_restricted')).toContain('**Acesso Restrito:**');
    });

    it('keeps the gateway t() helper resolving through localization', () => {
      delete process.env.ZAVORTH_LANG;
      delete process.env.ZAVORTH_LOCALE;
      expect(tTelegramGateway('security.wrong_password')).toBe('❌ Wrong password.');
      expect(tTelegramGateway('scheduler.create_failed', { error: 'boom' })).toBe(
        'Failed to create schedule: boom',
      );
    });
  });

  describe('plugin load tips resolve from migrated catalogs', () => {
    it('formats tips with double-brace interpolation per locale', () => {
      expect(formatPluginLoadTip('tip.declare_capability', { cap: 'extra.ping' }, 'en')).toContain(
        'extra.ping',
      );
      expect(formatPluginLoadTip('tip.export_register', {}, 'en')).toMatch(/Export `register`/);
      expect(formatPluginLoadTip('tip.export_register', {}, 'pt')).toMatch(/Exporte/);
      expect(formatPluginLoadTip('tip.bind_capability', {}, 'es')).toMatch(/bindCapability/i);
      expect(formatPluginLoadTip('tip.export_register', {}, 'ja')).toMatch(/エクスポート|register/);
      expect(formatPluginLoadTip('tip.export_register', {}, 'zh')).toMatch(/导出|register/);
    });

    it('normalizes exotic locale tags like the retired loader', () => {
      expect(resolvePluginLoadLocale('xx-unknown')).toBe('en');
      expect(resolvePluginLoadLocale('pt-BR')).toBe('pt');
      expect(resolvePluginLoadLocale('zh-TW')).toBe('zh-hant');
      expect(resolvePluginLoadLocale(null)).toBe('en');
    });
  });
});
