/**
 * AI-gateway locale surface.
 *
 * The negotiated locale set, RTL list, and display metadata are re-exported
 * from the unified locale registry (src/services/localization/localeContracts);
 * this module keeps only gateway-owned HTTP concerns: cookie name, system
 * sentinel, default locale, and the curated language-picker order.
 */

import {
  LOCALE_ENDONYMS,
  LOCALE_FLAGS,
  SUPPORTED_LOCALES,
  RTL_LOCALES as REGISTRY_RTL_LOCALES,
  type SupportedLocale,
} from "../../services/localization/localeContracts";

export type Locale = SupportedLocale;

export const LOCALES: readonly Locale[] = SUPPORTED_LOCALES;

export const DEFAULT_LOCALE: Locale = "en";
export const SYSTEM_LOCALE = "system";

/** Curated picker order; labels and flags derive from registry metadata. */
const LANGUAGE_DISPLAY_ORDER = [
  "en",
  "pt-BR",
  "pt",
  "es",
  "fr",
  "de",
  "it",
  "ja",
  "ko",
  "zh-CN",
  "ar",
  "he",
] as const satisfies readonly Locale[];

export const LANGUAGES: readonly {
  code: Locale;
  label: string;
  name: string;
  flag: string;
}[] = LANGUAGE_DISPLAY_ORDER.map((code) => ({
  code,
  label: code.split("-")[0].toUpperCase(),
  name: LOCALE_ENDONYMS[code],
  flag: LOCALE_FLAGS[code],
}));

export const RTL_LOCALES = [...REGISTRY_RTL_LOCALES] as const;

export const LOCALE_COOKIE = "NEXT_LOCALE";
