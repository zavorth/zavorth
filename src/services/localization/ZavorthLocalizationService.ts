import {
  SUPPORTED_LOCALES,
  RTL_LOCALES,
  LOCALE_ENDONYMS,
  type SupportedLocale,
  type LocalizationCatalog,
} from './localeContracts.js';
import { BUILTIN_CATALOGS } from './catalogs/index.js';

export interface LocalizationOptions {
  locale?: SupportedLocale;
  fallbackLocale?: SupportedLocale;
  dynamicCatalogs?: Map<string, LocalizationCatalog>;
}

export class ZavorthLocalizationService {
  private currentLocale: SupportedLocale;
  private readonly fallbackLocale: SupportedLocale;
  private readonly dynamicCatalogs: Map<string, LocalizationCatalog>;

  public constructor(options: LocalizationOptions = {}) {
    this.fallbackLocale = options.fallbackLocale || 'en';
    this.dynamicCatalogs = options.dynamicCatalogs || new Map();
    this.currentLocale = options.locale || this.detectSystemLocale();
  }

  public getLocale(): SupportedLocale {
    return this.currentLocale;
  }

  public setLocale(locale: SupportedLocale): void {
    if (this.isSupportedLocale(locale) || this.dynamicCatalogs.has(locale)) {
      this.currentLocale = locale;
    } else {
      this.currentLocale = this.fallbackLocale;
    }
  }

  public registerDynamicCatalog(locale: string, catalog: LocalizationCatalog): void {
    this.dynamicCatalogs.set(locale.toLowerCase(), catalog);
  }

  public getCatalog(locale: string = this.currentLocale): LocalizationCatalog {
    const normalized = locale.toLowerCase();
    if (this.dynamicCatalogs.has(normalized)) {
      return this.dynamicCatalogs.get(normalized)!;
    }
    if (this.isSupportedLocale(normalized)) {
      return BUILTIN_CATALOGS[normalized];
    }
    return BUILTIN_CATALOGS[this.fallbackLocale];
  }

  public isRtl(locale: string = this.currentLocale): boolean {
    return RTL_LOCALES.has(locale as SupportedLocale);
  }

  public getEndonym(locale: SupportedLocale): string {
    return LOCALE_ENDONYMS[locale] || locale;
  }

  public getAvailableLocales(): Array<{ code: string; name: string; isRtl: boolean }> {
    const list: Array<{ code: string; name: string; isRtl: boolean }> = SUPPORTED_LOCALES.map((code) => ({
      code,
      name: LOCALE_ENDONYMS[code],
      isRtl: RTL_LOCALES.has(code),
    }));

    for (const [code] of this.dynamicCatalogs.entries()) {
      if (!this.isSupportedLocale(code)) {
        list.push({
          code,
          name: code.toUpperCase(),
          isRtl: RTL_LOCALES.has(code as SupportedLocale),
        });
      }
    }

    return list;
  }

  public t(keyPath: string, params: Record<string, string | number> = {}, overrideLocale?: string): string {
    const targetLocale = overrideLocale || this.currentLocale;
    const catalog = this.getCatalog(targetLocale);
    const fallbackCatalog = BUILTIN_CATALOGS[this.fallbackLocale];

    const value = this.extractNestedKey(catalog, keyPath) || this.extractNestedKey(fallbackCatalog, keyPath) || keyPath;

    return this.interpolateParams(value, params);
  }

  private extractNestedKey(obj: unknown, keyPath: string): string | null {
    if (!obj || typeof obj !== 'object') return null;

    const segments = keyPath.split('.');
    let current: unknown = obj;

    for (const segment of segments) {
      if (current && typeof current === 'object' && segment in current) {
        current = (current as Record<string, unknown>)[segment];
      } else {
        return null;
      }
    }

    return typeof current === 'string' ? current : null;
  }

  private interpolateParams(template: string, params: Record<string, string | number>): string {
    let result = template;
    for (const [key, val] of Object.entries(params)) {
      result = result.split(`{${key}}`).join(String(val));
    }
    return result;
  }

  public isSupportedLocale(value: string): value is SupportedLocale {
    return (SUPPORTED_LOCALES as readonly string[]).includes(value);
  }

  public detectSystemLocale(): SupportedLocale {
    try {
      if (typeof process !== 'undefined' && process.env) {
        const envLocale = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || process.env.LANGUAGE;
        if (envLocale) {
          const matched = this.normalizeLocaleTag(envLocale);
          if (matched) return matched;
        }
      }

      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
        if (intlLocale) {
          const matched = this.normalizeLocaleTag(intlLocale);
          if (matched) return matched;
        }
      }
    } catch {
      // Graceful fallback to default 'en'
    }

    return 'en';
  }

  public normalizeLocaleTag(tag: string): SupportedLocale | null {
    const clean = tag.toLowerCase().split('.')[0].replace('_', '-');
    if (this.isSupportedLocale(clean)) return clean;

    const prefix = clean.split('-')[0];
    if (prefix === 'pt') return 'pt';
    if (prefix === 'zh') {
      return clean.includes('tw') || clean.includes('hk') || clean.includes('hant') ? 'zh-hant' : 'zh';
    }
    if (this.isSupportedLocale(prefix)) return prefix;

    return null;
  }
}
