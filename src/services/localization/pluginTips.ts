/**
 * Plugin load tips resolution backed by the unified localization system.
 *
 * The tip copy migrated from the retired src/services/plugin-i18n JSON loader
 * lives under `pluginTips` sections of the localization catalogs; lookups fall
 * back to English exactly like the former locale-then-en catalog chain.
 */

import type { PluginTipTranslations } from './localeContracts.js';
import { createLegacyAwareLocalizationService } from './legacySupport.js';

export type PluginLoadTipId = `tip.${keyof PluginTipTranslations['tip'] & string}`;

const localizationService = createLegacyAwareLocalizationService();

/** Exotic tags preserved from the retired loader's alias table. */
const TIP_TAG_ALIASES: Record<string, string> = {
  'pt-pt': 'pt',
  'zh-cn': 'zh',
  'zh-hans': 'zh',
  'zh-tw': 'zh-hant',
  already: 'ja',
};

function normalizeLocaleTag(value?: string | null): string | null {
  if (!value) return null;
  let tag = String(value).trim().replace(/_/g, '-');
  tag = tag.split('.')[0] || tag;
  tag = tag.split('@')[0] || tag;
  return tag.toLowerCase() || null;
}

export function resolvePluginLoadLocale(
  preferred?: string | null,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const candidates = [preferred, env.ZAVORTH_LOCALE, env.LANG, env.LC_ALL]
    .map((value) => normalizeLocaleTag(value))
    .filter(Boolean) as string[];

  for (const candidate of candidates) {
    const aliased = TIP_TAG_ALIASES[candidate];
    if (aliased) return aliased;
    const canonical = localizationService.normalizeLocaleTag(candidate);
    if (canonical) return canonical;
  }
  return 'en';
}

function lookupTipTemplate(id: PluginLoadTipId, tag: string): string | undefined {
  const tipPath = `pluginTips.tip.${id.slice('tip.'.length)}`;
  if (tag !== 'en') {
    const localized = localizationService.t(tipPath, {}, tag);
    if (localized !== tipPath) return localized;
  }
  const english = localizationService.t(tipPath, {}, 'en');
  return english !== tipPath ? english : undefined;
}

export function formatPluginLoadTip(
  id: PluginLoadTipId,
  vars: Record<string, string> = {},
  locale?: string | null,
): string {
  const tag = resolvePluginLoadLocale(locale);
  const template = lookupTipTemplate(id, tag) ?? id;
  return template.replace(/\{\{(\w+)\}\}/g, (_match: string, key: string) => {
    return vars[key] !== undefined ? vars[key] : `{{${key}}}`;
  });
}
