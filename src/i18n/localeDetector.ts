import type { SupportedLocale, LocaleSource } from './types.js';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './types.js';

const ENV_PRIORITY = [
  'ZAVORTH_LANG',
  'LC_ALL',
  'LC_MESSAGES',
  'LANG',
  'LANGUAGE',
  'USERLANGUAGE',
  'USER_LANGUAGE',
] as const;

const LOCALE_MAP: Record<string, SupportedLocale> = {
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
};

export function normalizeLocale(input: string | null | undefined): SupportedLocale {
  const raw = String(input || '').trim().toLowerCase().replace(/_/g, '-');
  if (!raw) return DEFAULT_LOCALE;

  const direct = LOCALE_MAP[raw];
  if (direct) return direct;

  const prefix = raw.split('-')[0];
  const byPrefix = LOCALE_MAP[prefix];
  if (byPrefix) return byPrefix;

  return DEFAULT_LOCALE;
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
  fallback: SupportedLocale = DEFAULT_LOCALE,
): SupportedLocale {
  const raw =
    source.explicitLocale ||
    source.cookie ||
    source.header ||
    resolveFromEnv(source.env);
  return normalizeLocale(raw) || fallback;
}

export function getAvailableLocaleLabels(): Array<{ locale: SupportedLocale; label: string }> {
  return [
    { locale: 'en-US', label: 'English' },
    { locale: 'pt-BR', label: 'Português (Brasil)' },
    { locale: 'es-ES', label: 'Español' },
    { locale: 'fr-FR', label: 'Français' },
    { locale: 'de-DE', label: 'Deutsch' },
    { locale: 'it-IT', label: 'Italiano' },
    { locale: 'ja-JP', label: '日本語' },
    { locale: 'zh-CN', label: '中文' },
    { locale: 'ko-KR', label: '한국어' },
    { locale: 'ru-RU', label: 'Русский' },
    { locale: 'ar-SA', label: 'العربية' },
  ];
}
