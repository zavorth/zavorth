import { getI18nService } from '../../../../src/i18n/ZavorthI18nService.js';

const i18n = getI18nService();

export function tDesktop(key: string, vars?: Record<string, string | number>): string {
  return i18n.t(`desktop.${key}`, { vars });
}

export function initDesktopLocale(): void {
  const systemLang = typeof navigator !== 'undefined'
    ? navigator.language || 'en-US'
    : 'en-US';
  i18n.setLocale(systemLang);
}

export function getDesktopLocale(): string {
  return i18n.getLocale();
}

export function setDesktopLocale(locale: string): void {
  i18n.setLocale(locale);
}
