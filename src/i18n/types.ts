export type SupportedLocale = string;

export type LocaleNamespace =
  | 'common'
  | 'cli'
  | 'errors'
  | 'zavorthControl'
  | 'desktop'
  | 'telegram'
  | 'services'
  | 'onboarding'
  | 'quickstart';

export type InterpolationVars = Record<string, string | number>;

export interface NestedDict {
  [key: string]: string | NestedDict;
}

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

export const DEFAULT_LOCALE = 'en-US';

export const KNOWN_LOCALES: readonly string[] = [
  'en-US', 'pt-BR', 'es-ES', 'fr-FR', 'de-DE',
  'it-IT', 'ja-JP', 'zh-CN', 'ko-KR', 'ru-RU', 'ar-SA',
] as const;

export const NAMESPACE_LIST: readonly LocaleNamespace[] = [
  'common', 'cli', 'errors', 'zavorthControl',
  'desktop', 'telegram', 'services', 'onboarding', 'quickstart',
] as const;
