/**
 * Zavorth Desktop Localization Facade — shared entry module for all desktop UI
 * string resolution, backed by the intelligent localization system in
 * `src/services/localization/`.
 *
 * Relationship between the localization systems present in this repository:
 *
 * 1. `src/services/localization/` (INTELLIGENT SYSTEM — consumed by desktop):
 *    `ZavorthLocalizationService` serves typed builtin catalogs for 17 locales
 *    plus dynamically registered catalogs; `ZavorthOnDemandTranslationService`
 *    synthesizes missing translations once through an LLM provider bridge and
 *    persists them under `~/.zavorth/locales/`, so they resolve offline
 *    thereafter. Exposed to the runtime over `GET/POST /api/v2/localization/*`.
 *
 * 2. `src/i18n/` (I18nManager + YAML locale catalogs): CLI, Telegram, surface
 *    command packs, and services consumers. Not used by the desktop renderer.
 *
 * 3. `src/ai-gateway/i18n/messages/*.json`: static gateway API response
 *    messages. Not used by the desktop renderer.
 *
 * 4. `src/services/plugin-i18n/`: JSON catalogs for plugin load tips shared by
 *    CLI and agent tooling. The desktop Plugin OS plane mirrors its alias set.
 *
 * Resolution chain for `t(key)` on desktop: hydrated per-locale strings, then
 * the builtin desktop plane for the requested locale (aliased, then en), then
 * the universal typed catalog (locale, then en fallback), then the raw key.
 * Missing strings hydrate once via the runtime translation endpoint and
 * persist locally, keeping subsequent launches fully offline.
 */

import { ZavorthLocalizationService } from '../../../src/services/localization/ZavorthLocalizationService.js';
import {
  type SupportedLocale,
  SUPPORTED_LOCALES,
  LOCALE_ENDONYMS,
  RTL_LOCALES,
} from '../../../src/services/localization/localeContracts.js';
import {
  lookupDesktopPlaneString,
} from './i18n/desktopPlane';
import {
  hydratedDesktopString,
  hydrateDesktopStrings,
  missingDesktopKeys,
} from './i18n/hydration';
import { tPluginOs as tPluginOsKey, resolveDesktopLocale as resolvePluginOsLocale } from './i18n/pluginOsPlane';

export type AppLanguage = SupportedLocale;
export { hydrateDesktopStrings, missingDesktopKeys };

const globalLocalizationService = new ZavorthLocalizationService();

export function resolveLanguage(language?: string | null): SupportedLocale {
  if (!language) return globalLocalizationService.getLocale();
  const normalized = globalLocalizationService.normalizeLocaleTag(language);
  return normalized || 'en';
}

/** Resolve one desktop UI string synchronously; returns the raw key when untranslated. */
export function t(key: string, language?: string | null): string {
  const requestedTag =
    typeof language === 'string' && language.trim()
      ? language.trim().replace(/_/g, '-').toLowerCase()
      : null;

  if (requestedTag) {
    const hydratedForTag = hydratedDesktopString(requestedTag, key);
    if (hydratedForTag) return hydratedForTag;
    const planeForTag = lookupDesktopPlaneString(requestedTag, key);
    if (planeForTag) return planeForTag;
  }

  const targetLocale = language ? resolveLanguage(language) : globalLocalizationService.getLocale();

  if (requestedTag !== targetLocale.toLowerCase()) {
    const hydrated = hydratedDesktopString(targetLocale, key);
    if (hydrated) return hydrated;
  }

  const plane = lookupDesktopPlaneString(targetLocale, key) ?? lookupDesktopPlaneString('en', key);
  if (plane) return plane;

  const fromCatalog = globalLocalizationService.t(key, {}, targetLocale);
  if (fromCatalog && fromCatalog !== key) {
    return fromCatalog;
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
};

export {
  tPluginOs,
  pluginOsPlaneLabels,
  getPluginOsPlaneLabels,
  resolveDesktopLocale,
  PLUGIN_OS_PLANE_I18N,
} from './i18n/pluginOsPlane';
