/**
 * Zavorth Desktop Localization Facade.
 *
 * Connects Desktop components to the universal localization engine
 * with support for 18 native global locales, endonyms, RTL, and on-demand fallback.
 */

import { ZavorthLocalizationService } from '../../../src/services/localization/ZavorthLocalizationService.js';
import {
  type SupportedLocale,
  SUPPORTED_LOCALES,
  LOCALE_ENDONYMS,
  RTL_LOCALES,
} from '../../../src/services/localization/localeContracts.js';
import { tPluginOs as tPluginOsKey, resolveDesktopLocale as resolvePluginOsLocale } from './i18n/pluginOsPlane';

export type AppLanguage = SupportedLocale;

const globalLocalizationService = new ZavorthLocalizationService();

export function resolveLanguage(language?: string | null): SupportedLocale {
  if (!language) return globalLocalizationService.getLocale();
  const normalized = globalLocalizationService.normalizeLocaleTag(language);
  return normalized || 'en';
}

export function t(key: string, language?: string | null): string {
  const targetLocale = language ? resolveLanguage(language) : globalLocalizationService.getLocale();
  const result = globalLocalizationService.t(key, {}, targetLocale);

  if (result && result !== key) {
    return result;
  }

  // Fall through to Plugin OS catalogs
  const resolvedPluginOs = tPluginOsKey(key, resolvePluginOsLocale(language));
  if (resolvedPluginOs && resolvedPluginOs !== key) {
    return resolvedPluginOs;
  }

  return key;
}

export function panelLabel(panel: string, language?: string | null): string {
  const map: Record<string, string> = {
    chat: 'app.chat',
    approvals: 'app.approvals',
    memory: 'app.memory',
    skills: 'app.plugins',
    channels: 'app.channels',
    settings: 'app.settings',
    files: 'app.files',
    preview: 'app.workboard',
    automations: 'app.automations',
    agents: 'app.chat',
    profiles: 'app.settings',
    analytics: 'app.analytics',
    marketplace: 'app.plugins',
    workboard: 'app.workboard',
    receipts: 'app.approvals',
    vibe: 'app.tagline',
  };
  return t(map[panel] || panel, language);
}

export {
  LocalizationProvider,
  useLocalization,
} from './i18n/LocalizationProvider';

export {
  SUPPORTED_LOCALES,
  LOCALE_ENDONYMS,
  RTL_LOCALES,
  ZavorthLocalizationService,
};

export {
  tPluginOs,
  pluginOsPlaneLabels,
  getPluginOsPlaneLabels,
  resolveDesktopLocale,
  PLUGIN_OS_PLANE_I18N,
} from './i18n/pluginOsPlane';
