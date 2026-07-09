import * as fs from 'fs';
import * as path from 'path';

import { DEFAULT_LOCALE } from './types.js';
import { normalizeLocale } from './localeDetector.js';

export type Locale = string;

export interface TranslationDict {
  [key: string]: string | TranslationDict;
}

export type InterpolationParams = Record<string, string | number>;

export type PluralForms = {
  one: string;
  other: string;
  zero?: string;
};

export type DateFormatOptions = {
  locale: string;
  format: 'short' | 'long' | 'relative';
};

export type NumberFormatOptions = {
  locale: string;
  style: 'decimal' | 'currency' | 'percent';
  currency?: string;
};

export class I18nManager {
  private currentLocale: Locale = DEFAULT_LOCALE;
  private defaultLocale: Locale = DEFAULT_LOCALE;
  private translations: Map<Locale, Map<string, string | TranslationDict>> = new Map();
  private localesDir: string;

  constructor(options?: { defaultLocale?: Locale; localesDir?: string }) {
    if (options?.defaultLocale) {
      this.defaultLocale = normalizeLocale(options.defaultLocale);
      this.currentLocale = this.defaultLocale;
    }
    this.localesDir = options?.localesDir ?? this.findLocalesDir();
    this.scanExistingLocales();
  }

  setLocale(locale: Locale): void {
    this.currentLocale = normalizeLocale(locale);
  }

  getLocale(): Locale {
    return this.currentLocale;
  }

  getAvailableLocales(): Locale[] {
    const locales: Locale[] = [this.defaultLocale];
    try {
      if (fs.existsSync(this.localesDir)) {
        const entries = fs.readdirSync(this.localesDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name !== this.defaultLocale) {
            locales.push(entry.name);
          }
        }
      }
    } catch (error: any) { const err = error; const e = error;
      // directory may not exist yet
    }
    return Array.from(new Set(locales)).sort();
  }

  t(key: string, params?: InterpolationParams, namespace?: string): string {
    const lookupKey = namespace ? `${namespace}.${key}` : key;
    const resolved = this.resolve(lookupKey);
    if (!resolved) return key;
    return this.interpolateString(resolved, params);
  }

  tplural(
    key: string,
    count: number,
    params?: InterpolationParams,
    namespace?: string,
  ): string {
    const lookupKey = namespace ? `${namespace}.${key}` : key;
    const dict = this.getDictForLocale(this.currentLocale);
    const fallbackDict = this.getDictForLocale(this.defaultLocale);
    const raw = this.getNestedValue(dict, lookupKey)
      ?? this.getNestedValue(fallbackDict, lookupKey);

    if (!raw) return String(count);

    const pluralForms = this.extractPluralForms(raw, lookupKey);
    if (pluralForms) {
      const form = this.selectPluralForm(count, pluralForms);
      const merged = { ...params, count };
      return this.interpolateString(form, merged);
    }

    const merged = { ...params, count };
    return this.interpolateString(String(raw), merged);
  }

  formatDate(date: Date | number | string, options: DateFormatOptions): string {
    const d = date instanceof Date ? date : new Date(date);
    const locale = normalizeLocale(options.locale);

    switch (options.format) {
      case 'short':
        return this.formatDateShort(d, locale);
      case 'long':
        return this.formatDateLong(d, locale);
      case 'relative':
        return this.formatDateRelative(d, locale);
      default:
        return d.toISOString();
    }
  }

  formatNumber(number: number, options: NumberFormatOptions): string {
    const locale = normalizeLocale(options.locale);

    try {
      const formatter = new Intl.NumberFormat(locale, {
        style: options.style,
        ...(options.style === 'currency' && options.currency
          ? { currency: options.currency }
          : {}),
      });
      return formatter.format(number);
    } catch (error: any) { const err = error; const e = error;
      return String(number);
    }
  }

  loadTranslations(locale: Locale, translations: TranslationDict): void {
    const normalized = normalizeLocale(locale);
    if (!this.translations.has(normalized)) {
      this.translations.set(normalized, new Map());
    }
    const localeMap = this.translations.get(normalized)!;
    for (const [key, value] of Object.entries(translations)) {
      localeMap.set(key, value);
    }
  }

  addNamespace(namespace: string, translations: TranslationDict): void {
    this.loadTranslations(this.currentLocale, { [namespace]: translations });
  }

  getMissingKeys(locale: Locale): string[] {
    const normalized = normalizeLocale(locale);
    if (normalized === this.defaultLocale) return [];

    const baseKeys = this.collectKeys(this.getDictForLocale(this.defaultLocale));
    const targetKeys = this.collectKeys(this.getDictForLocale(normalized));
    return baseKeys.filter((k) => !targetKeys.includes(k));
  }

  private resolve(key: string): string | undefined {
    const dict = this.getDictForLocale(this.currentLocale);
    const val = this.getNestedValue(dict, key);
    if (val !== undefined) return String(val);

    if (this.currentLocale !== this.defaultLocale) {
      const fallbackDict = this.getDictForLocale(this.defaultLocale);
      const fb = this.getNestedValue(fallbackDict, key);
      if (fb !== undefined) return String(fb);
    }

    return undefined;
  }

  private getDictForLocale(locale: Locale): TranslationDict {
    const merged: TranslationDict = {};
    const nsMap = this.translations.get(locale);
    if (nsMap) {
      const entries = Array.from(nsMap.entries());
      for (const [ns, dict] of entries) {
        if (typeof dict !== 'string') {
          merged[ns] = dict;
        }
      }
    }

    try {
      const localeDir = path.join(this.localesDir, locale);
      if (fs.existsSync(localeDir)) {
        const files = fs.readdirSync(localeDir).filter((f) => f.endsWith('.json'));
        for (const file of files) {
          const ns = path.basename(file, '.json');
          try {
            const content = fs.readFileSync(path.join(localeDir, file), 'utf-8');
            const parsed = JSON.parse(content) as TranslationDict;
            if (!merged[ns]) merged[ns] = {};
            this.deepMerge(merged[ns] as TranslationDict, parsed);
          } catch (error: any) { const err = error; const e = error;
            // skip corrupt files
          }
        }
      }
    } catch (error: any) { const err = error; const e = error;
      // directory may not exist
    }

    return merged;
  }

  private getNestedValue(obj: TranslationDict, dotPath: string): string | undefined {
    const parts = dotPath.split('.');
    let cur: unknown = obj;

    for (const part of parts) {
      if (cur === null || typeof cur !== 'object') return undefined;
      cur = (cur as Record<string, unknown>)[part];
    }

    if (typeof cur === 'string') return cur;
    if (typeof cur === 'object' && cur !== null) {
      const dict = cur as TranslationDict;
      if (dict['other']) return String(dict['other']);
      if (dict['one']) return String(dict['one']);
    }

    return undefined;
  }

  private interpolateString(
    template: string,
    params?: InterpolationParams,
  ): string {
    if (!params) return template;
    let result = template;

    // Basic ICU plural syntax: {count, plural, one {# ...} other {# ...}}
    const icuMatch = result.match(
      /\{(\w+),\s*plural\s*,\s*(?:zero\s*\{([^}]*)\}\s*)?(?:one\s*\{([^}]*)\}\s*)?other\s*\{([^}]*)\}\s*\}/,
    );
    if (icuMatch) {
      const varName = icuMatch[1];
      const count = Number(params[varName]);
      const zeroForm = icuMatch[2];
      const oneForm = icuMatch[3];
      const otherForm = icuMatch[4];

      let selected: string;
      if (count === 0 && zeroForm) {
        selected = zeroForm;
      } else if (count === 1 && oneForm) {
        selected = oneForm;
      } else {
        selected = otherForm;
      }
      result = selected.replace(/#/g, String(count));
    }

    // Simple interpolation: {varName}
    for (const [key, value] of Object.entries(params)) {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`\\{${escaped}\\}`, 'g'), String(value));
    }

    // Plural form shorthand: {count, plural, one {# item} other {# items}}
    const pluralMatch = result.match(
      /\{count,\s*plural\s*,\s*(?:zero\s*\{([^}]*)\}\s*)?(?:one\s*\{([^}]*)\}\s*)?other\s*\{([^}]*)\}\s*\}/,
    );
    if (pluralMatch) {
      const count = params?.count !== undefined ? Number(params.count) : 0;
      const zeroForm = pluralMatch[1];
      const oneForm = pluralMatch[2];
      const otherForm = pluralMatch[3];

      let selected: string;
      if (count === 0 && zeroForm) {
        selected = zeroForm;
      } else if (count === 1 && oneForm) {
        selected = oneForm;
      } else {
        selected = otherForm;
      }
      result = selected.replace(/#/g, String(count));
    }

    return result;
  }

  private extractPluralForms(
    value: unknown,
    key: string,
  ): PluralForms | undefined {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (
          parsed &&
          typeof parsed === 'object' &&
          typeof parsed.one === 'string' &&
          typeof parsed.other === 'string'
        ) {
          return parsed as PluralForms;
        }
      } catch (error: any) { const err = error; const e = error;
        // not JSON
      }
    }

    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      if (typeof obj['one'] === 'string' && typeof obj['other'] === 'string') {
        return {
          one: obj['one'] as string,
          other: obj['other'] as string,
          ...(typeof obj['zero'] === 'string' ? { zero: obj['zero'] as string } : {}),
        };
      }
    }

    return undefined;
  }

  private selectPluralForm(count: number, forms: PluralForms): string {
    if (count === 0 && forms.zero) return forms.zero;
    if (count === 1) return forms.one;
    return forms.other;
  }

  private formatDateShort(date: Date, locale: string): string {
    try {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
    } catch (error: any) { const err = error; const e = error;
      return date.toISOString().slice(0, 10);
    }
  }

  private formatDateLong(date: Date, locale: string): string {
    try {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      }).format(date);
    } catch (error: any) { const err = error; const e = error;
      return date.toLocaleDateString();
    }
  }

  private formatDateRelative(date: Date, locale: string): string {
    const now = Date.now();
    const diff = date.getTime() - now;
    const absDiff = Math.abs(diff);
    const seconds = Math.floor(absDiff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    if (seconds < 60) return rtf.format(diff > 0 ? seconds : -seconds, 'second');
    if (minutes < 60) return rtf.format(diff > 0 ? minutes : -minutes, 'minute');
    if (hours < 24) return rtf.format(diff > 0 ? hours : -hours, 'hour');
    return rtf.format(diff > 0 ? days : -days, 'day');
  }

  private collectKeys(dict: TranslationDict, prefix = ''): string[] {
    const keys: string[] = [];
    for (const [k, v] of Object.entries(dict)) {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'string') {
        keys.push(fullKey);
      } else {
        keys.push(...this.collectKeys(v, fullKey));
      }
    }
    return keys;
  }

  private deepMerge(target: TranslationDict, source: TranslationDict): void {
    for (const [key, value] of Object.entries(source)) {
      if (
        typeof value === 'object' &&
        value !== null &&
        typeof target[key] === 'object' &&
        target[key] !== null
      ) {
        this.deepMerge(
          target[key] as TranslationDict,
          value as TranslationDict,
        );
      } else {
        target[key] = value;
      }
    }
  }

  private scanExistingLocales(): void {
    try {
      if (!fs.existsSync(this.localesDir)) return;
      const entries = fs.readdirSync(this.localesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const localeDir = path.join(this.localesDir, entry.name);
          const jsonFiles = fs.readdirSync(localeDir).filter((f) => f.endsWith('.json'));
          if (jsonFiles.length > 0) {
            for (const file of jsonFiles) {
              try {
                const ns = path.basename(file, '.json');
                const content = fs.readFileSync(path.join(localeDir, file), 'utf-8');
                const parsed = JSON.parse(content) as TranslationDict;
                this.loadTranslations(entry.name, { [ns]: parsed });
              } catch (error: any) { const err = error; const e = error;
                // skip corrupt files
              }
            }
          }
        }
      }
    } catch (error: any) { const err = error; const e = error;
      // directory may not exist
    }
  }

  private findLocalesDir(): string {
    let dir = process.cwd();
    for (let i = 0; i < 6; i++) {
      const candidate = path.join(dir, 'locales');
      if (fs.existsSync(candidate)) return candidate;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return path.join(process.cwd(), 'src', 'i18n', 'locales');
  }
}
