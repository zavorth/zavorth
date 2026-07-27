/**
 * CLI i18n integration.
 * Provides a thin wrapper for CLI commands to use the shared i18n service.
 */

import { getI18nService } from './ZavorthI18nService.js';
import type { InterpolationVars } from './types.js';

const i18n = getI18nService();

export function tCli(key: string, vars?: InterpolationVars): string {
  return i18n.t(`cli.${key}`, { vars });
}

export function tCommon(key: string, vars?: InterpolationVars): string {
  return i18n.t(`common.${key}`, { vars });
}

export function tError(key: string, vars?: InterpolationVars): string {
  return i18n.t(`errors.${key}`, { vars });
}

export function detectCliLanguage(env: Record<string, string | undefined> = process.env): 'en' | 'pt' {
  const detected = i18n.resolveFromSource({ env });
  try {
    return new Intl.Locale(detected).language === 'pt' ? 'pt' : 'en';
  } catch {
    return detected === 'pt' ? 'pt' : 'en';
  }
}

export function initCliLocale(env?: Record<string, string | undefined>): void {
  const locale = i18n.resolveFromSource({ env: env || process.env });
  i18n.setLocale(locale);
}
