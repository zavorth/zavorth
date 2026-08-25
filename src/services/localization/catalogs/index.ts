import type { SupportedLocale, LocalizationCatalog } from '../localeContracts.js';
import { en } from './en.js';
import { pt } from './pt.js';
import { es } from './es.js';
import { zh } from './zh.js';
import { zhHant } from './zh-hant.js';
import { ja } from './ja.js';
import { de } from './de.js';
import { fr } from './fr.js';
import { ru } from './ru.js';
import { ko } from './ko.js';
import { it } from './it.js';
import { ar } from './ar.js';
import { tr } from './tr.js';
import { uk } from './uk.js';
import { af } from './af.js';
import { ga } from './ga.js';
import { hu } from './hu.js';

/**
 * Builtin catalogs for the registry locales that ship hand-curated content.
 * Intentionally partial: locales without a builtin catalog resolve through the
 * English fallback until seeded or AI-translated once at runtime.
 */
export const BUILTIN_CATALOGS: Partial<Record<SupportedLocale, LocalizationCatalog>> = {
  en,
  pt,
  es,
  zh,
  'zh-hant': zhHant,
  ja,
  de,
  fr,
  ru,
  ko,
  it,
  ar,
  tr,
  uk,
  af,
  ga,
  hu,
};

export {
  en,
  pt,
  es,
  zh,
  zhHant,
  ja,
  de,
  fr,
  ru,
  ko,
  it,
  ar,
  tr,
  uk,
  af,
  ga,
  hu,
};
