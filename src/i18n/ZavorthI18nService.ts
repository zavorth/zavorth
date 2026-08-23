import type {
  LocaleNamespace,
  SupportedLocale,
  I18nRuntime,
  TranslationOptions,
  LocaleSource,
} from './types.js';
import { DEFAULT_LOCALE, NAMESPACE_LIST } from './types.js';

import { resolveLocale, normalizeLocale } from './localeDetector.js';
import { interpolate } from './interpolation.js';
import type { ZavorthLocalizationService } from '../services/localization/ZavorthLocalizationService.js';
import {
  createLegacyAwareLocalizationService,
  getLegacyEnglishNamespaces,
} from '../services/localization/legacySupport.js';

const BASE: SupportedLocale = DEFAULT_LOCALE;

/**
 * Compatibility facade over the unified localization system.
 *
 * All `<namespace>.<dotted.path>` lookups previously served by the YAML/JSON
 * catalogs under src/i18n/locales now resolve through
 * ZavorthLocalizationService (migrated legacy sections layered onto the typed
 * builtin catalogs). The public surface (t/setLocale/getLocale/…) is preserved
 * verbatim for existing consumers; locale tags keep their historical
 * `en-US`/`pt-BR` style.
 */
export class ZavorthI18nService {
  private locale: SupportedLocale = BASE;
  private readonly localization: ZavorthLocalizationService;

  constructor(runtime: I18nRuntime = {}) {
    this.localization = createLegacyAwareLocalizationService();
    this.locale = normalizeLocale(
      runtime.config?.zavorthLocale || runtime.locale,
    );
  }

  setLocale(locale: string): void {
    this.locale = normalizeLocale(locale);
  }

  getLocale(): SupportedLocale {
    return this.locale;
  }

  resolveFromSource(source: LocaleSource): SupportedLocale {
    return resolveLocale(source, this.locale);
  }

  t(key: string, options: TranslationOptions = {}): string {
    const dotIndex = key.indexOf('.');
    if (dotIndex === -1) {
      const resolved = options.fallback ?? key;
      return options.vars ? interpolate(resolved, options.vars) : resolved;
    }

    const requestedTag = this.toResolutionTag(
      options.locale ? normalizeLocale(options.locale) : this.locale,
    );
    const legacyPath = `legacy.${key}`;
    const value = this.lookupLegacy(legacyPath, requestedTag);
    const resolved = value ?? options.fallback ?? key;
    return options.vars ? interpolate(resolved, options.vars) : resolved;
  }

  catalogFor<T extends Record<string, string>>(
    namespace: LocaleNamespace,
    keys: (keyof T)[],
    locale?: string,
  ): T {
    const result: Record<string, string> = {};
    for (const k of keys) {
      const s = String(k);
      result[s] = this.t(`${namespace}.${s}`, locale ? { locale } : {});
    }
    return result as T;
  }

  has(key: string): boolean {
    const dotIndex = key.indexOf('.');
    if (dotIndex === -1) return false;
    const requestedTag = this.toResolutionTag(this.locale);
    return this.lookupLegacy(`legacy.${key}`, requestedTag) !== undefined;
  }

  getAvailableLocales(): SupportedLocale[] {
    return ['en-US', 'pt-BR'];
  }

  getLoadedNamespaces(): LocaleNamespace[] {
    const englishNamespaces = getLegacyEnglishNamespaces();
    return NAMESPACE_LIST.filter((ns) => englishNamespaces.includes(ns));
  }

  clearCache(): void {
    // Catalogs live in memory inside the localization service; nothing to evict.
  }

  /**
   * Resolve a migrated legacy key for one locale tag, falling back to English
   * exactly like the former locale-then-BASE lookup chain.
   */
  private lookupLegacy(legacyPath: string, requestedTag: string): string | undefined {
    if (requestedTag !== 'en') {
      const localized = this.localization.t(legacyPath, {}, requestedTag);
      if (localized !== legacyPath) return localized;
    }
    const english = this.localization.t(legacyPath, {}, 'en');
    return english !== legacyPath ? english : undefined;
  }

  /** Map a legacy `xx-YY` style tag onto a localization-system catalog key. */
  private toResolutionTag(tag: string): string {
    const normalized = normalizeLocale(tag);
    return this.localization.normalizeLocaleTag(normalized) ?? normalized.toLowerCase();
  }
}

let _instance: ZavorthI18nService | null = null;

export function getI18nService(runtime?: I18nRuntime): ZavorthI18nService {
  if (!_instance) _instance = new ZavorthI18nService(runtime);
  return _instance;
}

export function resetI18nService(): void {
  _instance = null;
}
