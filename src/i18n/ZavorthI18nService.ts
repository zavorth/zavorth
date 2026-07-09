import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

import type {
  SupportedLocale,
  LocaleNamespace,
  NestedDict,
  I18nRuntime,
  TranslationOptions,
  LocaleSource,
  InterpolationVars,
} from './types.js';
import { DEFAULT_LOCALE, NAMESPACE_LIST } from './types.js';
import { resolveLocale, normalizeLocale } from './localeDetector.js';
import { interpolate } from './interpolation.js';

const BASE: SupportedLocale = DEFAULT_LOCALE;

export class ZavorthI18nService {
  private cache: Map<string, NestedDict> = new Map();
  private locale: SupportedLocale = BASE;
  private localesDir: string;

  constructor(runtime: I18nRuntime = {}) {
    this.locale = normalizeLocale(
      runtime.config?.zavorthLocale || runtime.locale,
    );
    this.localesDir = this.findLocalesDir();
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
    const loc = options.locale
      ? normalizeLocale(options.locale)
      : this.locale;
    const dotIndex = key.indexOf('.');
    if (dotIndex === -1) {
      const resolved = options.fallback ?? key;
      return options.vars ? interpolate(resolved, options.vars) : resolved;
    }

    const ns = key.slice(0, dotIndex) as LocaleNamespace;
    const rest = key.slice(dotIndex + 1);
    const value = this.lookup(loc, ns, rest);
    const resolved = value ?? options.fallback ?? key;
    return options.vars ? interpolate(resolved, options.vars) : resolved;
  }

  catalogFor<T extends Record<string, string>>(
    namespace: LocaleNamespace,
    keys: (keyof T)[],
    locale?: string,
  ): T {
    const loc = locale ? normalizeLocale(locale) : this.locale;
    const dict = this.load(loc, namespace);
    const base = loc !== BASE ? this.load(BASE, namespace) : dict;
    const result: Record<string, string> = {};
    for (const k of keys) {
      const s = String(k);
      result[s] = this.getNested(dict, s) ?? this.getNested(base, s) ?? s;
    }
    return result as T;
  }

  has(key: string): boolean {
    const dotIndex = key.indexOf('.');
    if (dotIndex === -1) return false;
    const ns = key.slice(0, dotIndex) as LocaleNamespace;
    const rest = key.slice(dotIndex + 1);
    return this.lookup(this.locale, ns, rest) !== undefined;
  }

  getAvailableLocales(): SupportedLocale[] {
    const locales: SupportedLocale[] = [];
    for (const locale of ['en-US', 'pt-BR'] as SupportedLocale[]) {
      const dir = path.join(this.localesDir, locale);
      if (fs.existsSync(dir)) locales.push(locale);
    }
    return locales;
  }

  getLoadedNamespaces(): LocaleNamespace[] {
    return NAMESPACE_LIST.filter((ns) => {
      const fp = path.join(this.localesDir, this.locale, `${ns}.yaml`);
      return fs.existsSync(fp);
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  private lookup(
    locale: SupportedLocale,
    ns: LocaleNamespace,
    dotPath: string,
  ): string | undefined {
    const val = this.getNested(this.load(locale, ns), dotPath);
    if (val !== undefined) return val;
    if (locale !== BASE) {
      return this.getNested(this.load(BASE, ns), dotPath);
    }
    return undefined;
  }

  private load(locale: SupportedLocale, ns: LocaleNamespace): NestedDict {
    const cacheKey = `${locale}:${ns}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const fp = path.join(this.localesDir, locale, `${ns}.yaml`);
    let dict: NestedDict = {};
    if (fs.existsSync(fp)) {
      try {
        const content = fs.readFileSync(fp, 'utf-8');
        dict = (yaml.load(content) as NestedDict) ?? {};
      } catch (error: any) { const err = error; const e = error;
        dict = {};
      }
    }
    this.cache.set(cacheKey, dict);
    return dict;
  }

  private getNested(obj: NestedDict, dotPath: string): string | undefined {
    let cur: unknown = obj;
    for (const segment of dotPath.split('.')) {
      if (cur === null || typeof cur !== 'object') return undefined;
      cur = (cur as Record<string, unknown>)[segment];
    }
    return typeof cur === 'string' ? cur : undefined;
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

let _instance: ZavorthI18nService | null = null;

export function getI18nService(runtime?: I18nRuntime): ZavorthI18nService {
  if (!_instance) _instance = new ZavorthI18nService(runtime);
  return _instance;
}

export function resetI18nService(): void {
  _instance = null;
}
