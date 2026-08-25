/**
 * Telegram channel string resolution.
 *
 * Thin consumer of the unified localization system: every `telegram.*` key
 * resolves through src/i18n/ZavorthI18nService (migrated telegram catalogs),
 * which cascades requested tag -> base language -> English. Catalog content
 * for locales without seeded translations is AI-translated once and persisted
 * by ZavorthOnDemandTranslationService.
 *
 * Locale selection keeps the historical environment override chain
 * ZAVORTH_LANG / ZAVORTH_LOCALE; tags are validated by Intl and resolved
 * against the single locale registry by the localization facade.
 *
 * Usage:
 *   import { t } from '../../../gateways/channels/telegram/i18n.js';
 *   await ctx.reply(t('auth.access_restricted'));
 */

import { getI18nService } from '../../../i18n/ZavorthI18nService.js';
import type { LegacyTelegramTranslations } from '../../../services/localization/localeContracts.js';

/** Dotted message keys of the migrated telegram catalog section. */
export type TelegramMessageKey = {
  [K in keyof LegacyTelegramTranslations]: LegacyTelegramTranslations[K] extends string
    ? K & string
    : `${K & string}.${keyof LegacyTelegramTranslations[K] & string}`;
}[keyof LegacyTelegramTranslations];

/**
 * Resolve the active telegram locale from the environment.
 * Defaults to `en-US`; malformed tags are passed through verbatim and degrade
 * to English inside the localization facade.
 */
export function resolveTelegramLocale(): string {
  const raw = String(process.env.ZAVORTH_LANG || process.env.ZAVORTH_LOCALE || 'en-US').trim();
  if (!raw) return 'en-US';
  try {
    return new Intl.Locale(raw).toString();
  } catch {
    return raw;
  }
}

export function t(key: TelegramMessageKey, vars?: Record<string, string | number>): string {
  return getI18nService().t(`telegram.${key}`, {
    locale: resolveTelegramLocale(),
    ...(vars ? { vars } : {}),
  });
}
