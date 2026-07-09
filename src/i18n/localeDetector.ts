import fs from 'fs';
import path from 'path';
import { DEFAULT_LOCALE, KNOWN_LOCALES } from './types.js';
import type { LocaleSource } from './types.js';const ENV_PRIORITY = [
  'ZAVORTH_LANG',
  'LC_ALL',
  'LC_MESSAGES',
  'LANG',
  'LANGUAGE',
  'USERLANGUAGE',
  'USER_LANGUAGE',
] as const;

const LOCALE_MAP: Record<string, string> = {
  'en': 'en-US',
  'en-us': 'en-US',
  'en-gb': 'en-US',
  'pt': 'pt-BR',
  'pt-br': 'pt-BR',
  'pt-pt': 'pt-BR',
  'es': 'es-ES',
  'es-es': 'es-ES',
  'es-mx': 'es-ES',
  'es-ar': 'es-ES',
  'fr': 'fr-FR',
  'fr-fr': 'fr-FR',
  'fr-ca': 'fr-FR',
  'de': 'de-DE',
  'de-de': 'de-DE',
  'de-at': 'de-DE',
  'de-ch': 'de-DE',
  'it': 'it-IT',
  'it-it': 'it-IT',
  'ja': 'ja-JP',
  'ja-jp': 'ja-JP',
  'zh': 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh-tw': 'zh-CN',
  'zh-hans': 'zh-CN',
  'ko': 'ko-KR',
  'ko-kr': 'ko-KR',
  'ru': 'ru-RU',
  'ru-ru': 'ru-RU',
  'ar': 'ar-SA',
  'ar-sa': 'ar-SA',
  'ar-eg': 'ar-SA',
  'tr': 'tr-TR',
  'tr-tr': 'tr-TR',
  'uk': 'uk-UA',
  'uk-ua': 'uk-UA',
  'id': 'id-ID',
  'id-id': 'id-ID',
  'pl': 'pl-PL',
  'pl-pl': 'pl-PL',
  'th': 'th-TH',
  'th-th': 'th-TH',
  'vi': 'vi-VN',
  'vi-vn': 'vi-VN',
  'nl': 'nl-NL',
  'nl-nl': 'nl-NL',
  'fa': 'fa-IR',
  'fa-ir': 'fa-IR',
  'hi': 'hi-IN',
  'hi-in': 'hi-IN',
};

export function normalizeLocale(input: string | null | undefined): string {
  const raw = String(input || '').trim().toLowerCase().replace(/_/g, '-');
  if (!raw) return DEFAULT_LOCALE;

  const direct = LOCALE_MAP[raw];
  if (direct) return direct;

  const prefix = raw.split('-')[0];
  const byPrefix = LOCALE_MAP[prefix];
  if (byPrefix) return byPrefix;

  return raw || DEFAULT_LOCALE;
}

export function resolveFromEnv(env?: Record<string, string | undefined>): string {
  if (!env) return '';
  for (const key of ENV_PRIORITY) {
    const value = env[key];
    if (value && value.trim()) return value.trim();
  }
  return '';
}

export function resolveFromNavigator(): string {
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  return '';
}

export function resolveLocale(
  source: LocaleSource,
  fallback: string = DEFAULT_LOCALE,
): string {
  const raw =
    source.explicitLocale ||
    source.cookie ||
    source.header ||
    resolveFromEnv(source.env);
  return normalizeLocale(raw) || fallback;
}

export function getAvailableLocales(localesDir: string): string[] {
  const locales: string[] = [DEFAULT_LOCALE];
  try {
    if (fs.existsSync(localesDir)) {
      const entries = fs.readdirSync(localesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== DEFAULT_LOCALE) {
          const localeDir = path.join(localesDir, entry.name);
          const yamlFiles = fs.readdirSync(localeDir).filter((f) => f.endsWith('.yaml'));
          if (yamlFiles.length > 0) {
            locales.push(entry.name);
          }
        }
      }
    }
  } catch (error: unknown) {// ignore
  }
  return locales.sort();
}

export function getAvailableLocaleLabels(localesDir: string): Array<{ locale: string; label: string; hasTranslations: boolean }> {
  const labels: Record<string, string> = {
    'en-US': 'English',
    'pt-BR': 'Português (Brasil)',
    'es-ES': 'Español',
    'fr-FR': 'Français',
    'de-DE': 'Deutsch',
    'it-IT': 'Italiano',
    'ja-JP': '日本語',
    'zh-CN': '简体中文',
    'zh-TW': '繁體中文',
    'ko-KR': '한국어',
    'ru-RU': 'Русский',
    'ar-SA': 'العربية',
    'tr-TR': 'Türkçe',
    'uk-UA': 'Українська',
    'id-ID': 'Bahasa Indonesia',
    'pl-PL': 'Polski',
    'th-TH': 'ไทย',
    'vi-VN': 'Tiếng Việt',
    'nl-NL': 'Nederlands',
    'fa-IR': 'فارسی',
    'hi-IN': 'हिन्दी',
  };

  const available = getAvailableLocales(localesDir);
  return available.map((locale) => ({
    locale,
    label: labels[locale] || locale,
    hasTranslations: locale === DEFAULT_LOCALE || available.includes(locale),
  }));
}
