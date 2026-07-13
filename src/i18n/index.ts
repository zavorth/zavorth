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

export { tService, tError as tServiceError } from './services.js';
export { tSurface } from './surface.js';
export { t as tTelegram, getTelegramLocale, setTelegramLocale } from './telegram.js';
export { tCli, tCommon, tError, detectCliLanguage, initCliLocale } from './cli.js';
