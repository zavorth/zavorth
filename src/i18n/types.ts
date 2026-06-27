// @ts-nocheck
export type SupportedLocale =
  | 'en-US'
  | 'pt-BR'
  | 'es-ES'
  | 'fr-FR'
  | 'de-DE'
  | 'it-IT'
  | 'ja-JP'
  | 'zh-CN'
  | 'ko-KR'
  | 'ru-RU'
  | 'ar-SA';

export type LocaleNamespace =
  | 'common'
  | 'cli'
  | 'errors'
  | 'dashboard'
  | 'desktop'
  | 'telegram'
  | 'services'
  | 'onboarding';

export type InterpolationVars = Record<string, string | number>;

export type NestedDict = Record<string, string | NestedDict>;

export type I18nRuntime = {
  locale?: string | null;
  config?: { zavorthLocale?: string | null };
};

export type TranslationOptions = {
  vars?: InterpolationVars;
  fallback?: string;
  locale?: string | null;
};

export type LocaleSource = {
  explicitLocale?: string | null;
  env?: Record<string, string | undefined>;
  cookie?: string | null;
  header?: string | null;
};

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = [
  'en-US', 'pt-BR', 'es-ES', 'fr-FR', 'de-DE',
  'it-IT', 'ja-JP', 'zh-CN', 'ko-KR', 'ru-RU', 'ar-SA',
] as const;

export const DEFAULT_LOCALE: SupportedLocale = 'en-US';

export const NAMESPACE_LIST: readonly LocaleNamespace[] = [
  'common', 'cli', 'errors', 'dashboard',
  'desktop', 'telegram', 'services', 'onboarding',
] as const;
