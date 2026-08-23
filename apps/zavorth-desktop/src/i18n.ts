/**
 * Zavorth Desktop Localization Facade — shared entry module for all desktop UI
 * string resolution, backed by the intelligent localization system in
 * `src/services/localization/`.
 *
 * Relationship between the localization systems present in this repository:
 *
 * 1. `src/services/localization/` (INTELLIGENT SYSTEM — single source of truth):
 *    `ZavorthLocalizationService` serves typed builtin catalogs for 17 locales
 *    plus dynamically registered catalogs; `ZavorthOnDemandTranslationService`
 *    synthesizes missing translations once through an LLM provider bridge and
 *    persists them under `~/.zavorth/locales/`, so they resolve offline
 *    thereafter. Exposed to the runtime over `GET/POST /api/v2/localization/*`.
 *    The migrated CLI/Telegram/surface/plugin-tip catalogs also live here
 *    (`legacy` and `pluginTips` sections) behind the src/i18n compat facade.
 *
 * 2. `src/i18n/` (compatibility facade over system 1): CLI, Telegram, surface
 *    command packs, and services consumers resolve their historical
 *    `<namespace>.<dotted.path>` keys through ZavorthLocalizationService.
 *    Not used by the desktop renderer.
 *
 * 3. `src/ai-gateway/i18n/messages/*.json`: static gateway API response
 *    messages owned by next-intl at the HTTP boundary. Not used by the
 *    desktop renderer.
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

/**
 * Sync the facade's default resolution locale with the UI selection so direct
 * `t(key)` consumers switch languages on re-render without a reload.
 */
export function setActiveLocale(locale: SupportedLocale): void {
  globalLocalizationService.setLocale(locale);
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
