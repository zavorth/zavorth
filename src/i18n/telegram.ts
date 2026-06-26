/**
 * Telegram i18n wrapper.
 * Migrates the inline dictionary pattern to the shared i18n service.
 * Falls back to the legacy inline dict if YAML files are not yet populated.
 */

import { getI18nService } from './ZavorthI18nService.js';

const i18n = getI18nService();

export function t(key: string, vars?: Record<string, string | number>): string {
  return i18n.t(`telegram.${key}`, { vars, fallback: key });
}

export function getTelegramLocale(): string {
  return i18n.getLocale();
}

export function setTelegramLocale(locale: string): void {
  i18n.setLocale(locale);
}
