import { ZavorthLocalizationService } from '../../../src/services/localization/ZavorthLocalizationService.js';
import {
  SUPPORTED_LOCALES,
  type SupportedLocale,
  type LocalizationCatalog,
} from '../../../src/services/localization/localeContracts.js';
import { BUILTIN_CATALOGS } from '../../../src/services/localization/catalogs/index.js';

describe('ZavorthLocalizationService', () => {
  it('should support all 18 built-in locale catalogs without missing keys', () => {
    const service = new ZavorthLocalizationService({ locale: 'en' });
    const enCatalog = service.getCatalog('en');
    const catalogKeys = Object.keys(enCatalog) as Array<keyof LocalizationCatalog>;

    expect(SUPPORTED_LOCALES.length).toBe(17); // 17 comprehensive world languages + variants

    for (const locale of SUPPORTED_LOCALES) {
      const catalog = service.getCatalog(locale);
      expect(catalog).toBeDefined();

      for (const section of catalogKeys) {
        expect(catalog[section]).toBeDefined();
        const subKeys = Object.keys(enCatalog[section]);
        for (const subKey of subKeys) {
          const val = (catalog[section] as Record<string, string>)[subKey];
          expect(typeof val).toBe('string');
          expect(val.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('should resolve translations via dotted keyPath and interpolate parameters', () => {
    const service = new ZavorthLocalizationService({ locale: 'pt' });

    expect(service.t('common.save')).toBe('Salvar');
    expect(service.t('app.title')).toBe('Zavorth Desktop');
    expect(service.t('mnemos.title')).toBe('Memória Persistente Mnemos');
    expect(service.t('kanban.autoRepairLane')).toBe('Auto-Reparo');

    // Test parameter interpolation
    service.registerDynamicCatalog('custom', {
      ...BUILTIN_CATALOGS.en,
      common: {
        ...BUILTIN_CATALOGS.en.common,
        status: 'Status: {val} of {total}',
      },
    });
    expect(service.t('common.status', { val: '5', total: '10' }, 'custom')).toBe('Status: 5 of 10');
  });

  it('should correctly identify RTL locales', () => {
    const service = new ZavorthLocalizationService();

    expect(service.isRtl('ar')).toBe(true);
    expect(service.isRtl('en')).toBe(false);
    expect(service.isRtl('pt')).toBe(false);
    expect(service.isRtl('ja')).toBe(false);
  });

  it('should normalize locale tags from system environments', () => {
    const service = new ZavorthLocalizationService();

    expect(service.normalizeLocaleTag('pt_BR.UTF-8')).toBe('pt');
    expect(service.normalizeLocaleTag('es-ES')).toBe('es');
    expect(service.normalizeLocaleTag('zh-TW')).toBe('zh-hant');
    expect(service.normalizeLocaleTag('ja-JP')).toBe('ja');
    expect(service.normalizeLocaleTag('de_DE')).toBe('de');
    expect(service.normalizeLocaleTag('unknown-tag')).toBeNull();
  });

  it('should provide available locales list with native endonyms', () => {
    const service = new ZavorthLocalizationService();
    const available = service.getAvailableLocales();

    expect(available.length).toBeGreaterThanOrEqual(17);
    const jaEntry = available.find((item) => item.code === 'ja');
    expect(jaEntry?.name).toBe('日本語');

    const ptEntry = available.find((item) => item.code === 'pt');
    expect(ptEntry?.name).toBe('Português');

    const arEntry = available.find((item) => item.code === 'ar');
    expect(arEntry?.name).toBe('العربية');
    expect(arEntry?.isRtl).toBe(true);
  });
});
