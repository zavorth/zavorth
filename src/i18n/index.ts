export type {
  SupportedLocale,
  LocaleNamespace,
  InterpolationVars,
  NestedDict,
  I18nRuntime,
  TranslationOptions,
  LocaleSource,
} from './types.js';

export {
  DEFAULT_LOCALE,
  KNOWN_LOCALES,
  NAMESPACE_LIST,
} from './types.js';

export { interpolate } from './interpolation.js';

export {
  normalizeLocale,
  resolveFromEnv,
  resolveLocale,
  getAvailableLocales,
  getAvailableLocaleLabels,
} from './localeDetector.js';

export {
  ZavorthI18nService,
  getI18nService,
  resetI18nService,
} from './ZavorthI18nService.js';
