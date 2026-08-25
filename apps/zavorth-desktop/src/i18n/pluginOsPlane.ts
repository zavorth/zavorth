/**
 * Plugin OS Plane Localization Facade.
 *
 * Delegates label resolution to the universal ZavorthLocalizationService in
 * src/services/localization/, with the desktop plane catalogs and a static
 * alias seed covering every locale accepted by the unified plugin-tip catalogs.
 */

import { ZavorthLocalizationService } from '../../../../src/services/localization/ZavorthLocalizationService.js';
import { SUPPORTED_LOCALES } from '../../../../src/services/localization/localeContracts.js';
import { lookupDesktopPlaneString, PLUGIN_OS_TITLE_SEED } from './desktopPlane';

const localizationService = new ZavorthLocalizationService();

/** Historical plugin-tip alias tags that predate the unified registry. */
const LEGACY_ALIAS_TAGS = ['pt-PT', 'zh-Hans', 'zh-Hant', 'zh-TW', 'el', 'fa', 'bn', 'already'] as const;

/** Locale set aligned with the unified plugin-tip catalog locales. */
const PLUGIN_OS_ALIAS_LOCALES: readonly string[] = [...SUPPORTED_LOCALES, ...LEGACY_ALIAS_TAGS];

/** Alias mapping for exotic tags with no direct seed entry. */
const SEED_ALIASES: Record<string, string> = {
  already: 'ja',
  'zh-Hant': 'zh-hant',
};

export function resolveDesktopLocale(language?: string | null): string {
  if (language && String(language).trim()) {
    return String(language).trim().replace(/_/g, '-');
  }
  return localizationService.getLocale();
}

function seedTitleFor(locale: string): string | undefined {
  if (PLUGIN_OS_TITLE_SEED[locale]) return PLUGIN_OS_TITLE_SEED[locale];
  const aliasTarget = SEED_ALIASES[locale];
  if (aliasTarget && PLUGIN_OS_TITLE_SEED[aliasTarget]) return PLUGIN_OS_TITLE_SEED[aliasTarget];
  return PLUGIN_OS_TITLE_SEED[locale.split('-')[0]];
}

export function tPluginOs(key: string, language?: string | null): string {
  const requested = language == null ? '' : String(language).trim();
  if (requested) {
    const normalized = localizationService.normalizeLocaleTag(
      requested.replace(/_/g, '-'),
    );
    if (normalized) {
      const fromCatalog = localizationService.t(key, {}, normalized);
      if (fromCatalog && fromCatalog !== key) return fromCatalog;
    }
  }

  const planeLocale = requested || localizationService.getLocale();
  const fromPlane =
    lookupDesktopPlaneString(planeLocale.toLowerCase(), key) ??
    lookupDesktopPlaneString('en', key);
  return fromPlane ?? key;
}

export function getPluginOsPlaneLabels(locale: string): Record<string, string> {
  return pluginOsPlaneLabels(locale);
}

export function pluginOsPlaneLabels(language?: string | null): Record<string, string> {
  return {
    title: tPluginOs('pluginOs.title', language),
    'pluginOs.title': tPluginOs('pluginOs.title', language),
    eyebrow: tPluginOs('pluginOs.eyebrow', language),
    description: tPluginOs('pluginOs.description', language),
    search: tPluginOs('pluginOs.search', language),
    all: tPluginOs('pluginOs.all', language),
    enabled: tPluginOs('pluginOs.enabled', language),
    disabled: tPluginOs('pluginOs.disabled', language),
    blocked: tPluginOs('pluginOs.blocked', language),
    enable: tPluginOs('pluginOs.enable', language),
    disable: tPluginOs('pluginOs.disable', language),
    inspect: tPluginOs('pluginOs.inspect', language),
    refresh: tPluginOs('pluginOs.refresh', language),
    empty: tPluginOs('pluginOs.empty', language),
    emptyFilter: tPluginOs('pluginOs.emptyFilter', language),
    findings: tPluginOs('pluginOs.findings', language),
    noFindings: tPluginOs('pluginOs.noFindings', language),
    trust: tPluginOs('pluginOs.trust', language),
    state: tPluginOs('pluginOs.state', language),
    eligible: tPluginOs('pluginOs.eligible', language),
    installed: tPluginOs('pluginOs.installed', language),
    offline: tPluginOs('pluginOs.offline', language),
    marketplace: tPluginOs('pluginOs.marketplace', language),
    pluginOs: tPluginOs('pluginOs.tab', language),
    health: tPluginOs('pluginOs.health', language),
    funnel: tPluginOs('pluginOs.funnel', language),
    coverage: tPluginOs('pluginOs.coverage', language),
    firstParty: tPluginOs('pluginOs.firstParty', language),
    mcp: tPluginOs('pluginOs.mcp', language),
    forge: tPluginOs('pluginOs.forge', language),
    deepLinks: tPluginOs('pluginOs.deepLinks', language),
    recommend: tPluginOs('pluginOs.recommend', language),
    recommendPlaceholder: tPluginOs('pluginOs.recommendPlaceholder', language),
    catalogApply: tPluginOs('pluginOs.catalogApply', language),
    enableHint: tPluginOs('pluginOs.enableHint', language),
    tier: tPluginOs('pluginOs.tier', language),
    summary: tPluginOs('pluginOs.summary', language),
    onboarding: tPluginOs('pluginOs.onboarding', language),
    setup: tPluginOs('pluginOs.setup', language),
    setupGuide: tPluginOs('pluginOs.setupGuide', language),
    yes: tPluginOs('pluginOs.yes', language),
    no: tPluginOs('pluginOs.no', language),
    optionals: tPluginOs('pluginOs.optionals', language),
    history: tPluginOs('pluginOs.history', language),
    statusActive: tPluginOs('pluginOs.statusActive', language),
    statusAvailable: tPluginOs('pluginOs.statusAvailable', language),
    statusNeedsSetup: tPluginOs('pluginOs.statusNeedsSetup', language),
    statusBlocked: tPluginOs('pluginOs.statusBlocked', language),
    trustReview: tPluginOs('pluginOs.trustReview', language),
    trustTrusted: tPluginOs('pluginOs.trustTrusted', language),
    trustBlocked: tPluginOs('pluginOs.trustBlocked', language),
    emptyTitle: tPluginOs('pluginOs.emptyTitle', language),
    emptyBody: tPluginOs('pluginOs.emptyBody', language),
    emptyCtaPrimary: tPluginOs('pluginOs.emptyCtaPrimary', language),
    emptyCtaSetup: tPluginOs('pluginOs.emptyCtaSetup', language),
    emptyNeverAuto: tPluginOs('pluginOs.emptyNeverAuto', language),
    emptyRecommendHint: tPluginOs('pluginOs.emptyRecommendHint', language),
    intentSearchWeb: tPluginOs('pluginOs.intentSearchWeb', language),
    intentReadMail: tPluginOs('pluginOs.intentReadMail', language),
    intentTrackTasks: tPluginOs('pluginOs.intentTrackTasks', language),
    wizardTitle: tPluginOs('pluginOs.wizardTitle', language),
    wizardSubtitle: tPluginOs('pluginOs.wizardSubtitle', language),
    wizardWelcomeTitle: tPluginOs('pluginOs.wizardWelcomeTitle', language),
    wizardWelcomeBody: tPluginOs('pluginOs.wizardWelcomeBody', language),
    wizardProfileTitle: tPluginOs('pluginOs.wizardProfileTitle', language),
    wizardProfileBody: tPluginOs('pluginOs.wizardProfileBody', language),
    wizardOptionalsTitle: tPluginOs('pluginOs.wizardOptionalsTitle', language),
    wizardOptionalsBody: tPluginOs('pluginOs.wizardOptionalsBody', language),
    wizardOptionalsEmpty: tPluginOs('pluginOs.wizardOptionalsEmpty', language),
    wizardReviewTitle: tPluginOs('pluginOs.wizardReviewTitle', language),
    wizardReviewBody: tPluginOs('pluginOs.wizardReviewBody', language),
    wizardDoneTitle: tPluginOs('pluginOs.wizardDoneTitle', language),
    wizardDoneBody: tPluginOs('pluginOs.wizardDoneBody', language),
    wizardNext: tPluginOs('pluginOs.wizardNext', language),
    wizardBack: tPluginOs('pluginOs.wizardBack', language),
    wizardSkip: tPluginOs('pluginOs.wizardSkip', language),
    wizardApply: tPluginOs('pluginOs.wizardApply', language),
    wizardClose: tPluginOs('pluginOs.wizardClose', language),
    wizardStepOf: tPluginOs('pluginOs.wizardStepOf', language),
    wizardProfileMinimal: tPluginOs('pluginOs.wizardProfileMinimal', language),
    wizardProfileMinimalSummary: tPluginOs('pluginOs.wizardProfileMinimalSummary', language),
    wizardProfileCore: tPluginOs('pluginOs.wizardProfileCore', language),
    wizardProfileCoreSummary: tPluginOs('pluginOs.wizardProfileCoreSummary', language),
    wizardProfileRecommended: tPluginOs('pluginOs.wizardProfileRecommended', language),
    wizardProfileRecommendedSummary: tPluginOs('pluginOs.wizardProfileRecommendedSummary', language),
    wizardProfileFull: tPluginOs('pluginOs.wizardProfileFull', language),
    wizardProfileFullSummary: tPluginOs('pluginOs.wizardProfileFullSummary', language),
    wizardSelectedProfile: tPluginOs('pluginOs.wizardSelectedProfile', language),
    wizardSelectedOptionals: tPluginOs('pluginOs.wizardSelectedOptionals', language),
    wizardNoneSelected: tPluginOs('pluginOs.wizardNoneSelected', language),
  };
}

/**
 * Static pre-hydration view over the alias locales. Each entry carries the
 * localized Plugin OS title so panels render meaningful chrome before any
 * runtime translation arrives.
 */
export const PLUGIN_OS_PLANE_I18N: Record<string, Record<string, string>> = Object.fromEntries(
  PLUGIN_OS_ALIAS_LOCALES.map((locale) => [
    locale,
    { 'pluginOs.title': seedTitleFor(locale) ?? PLUGIN_OS_TITLE_SEED.en },
  ]),
);
