export const LOCALES = [
  "ar",
  "bg",
  "cs",
  "da",
  "de",
  "en",
  "es",
  "fi",
  "fr",
  "he",
  "hi",
  "hu",
  "id",
  "it",
  "ja",
  "ko",
  "ms",
  "nl",
  "no",
  "phi",
  "pl",
  "pt",
  "pt-BR",
  "ro",
  "ru",
  "sk",
  "sv",
  "th",
  "tr",
  "uk-UA",
  "vi",
  "zh-CN",
] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const SYSTEM_LOCALE = "system";

export const LANGUAGES: readonly {
  code: Locale;
  label: string;
  name: string;
  flag: string;
}[] = [
  { code: "en", label: "EN", name: "English", flag: "US" },
  { code: "pt-BR", label: "PT", name: "Português (Brasil)", flag: "BR" },
  { code: "pt", label: "PT", name: "Português", flag: "PT" },
  { code: "es", label: "ES", name: "Español", flag: "ES" },
  { code: "fr", label: "FR", name: "Français", flag: "FR" },
  { code: "de", label: "DE", name: "Deutsch", flag: "DE" },
  { code: "it", label: "IT", name: "Italiano", flag: "IT" },
  { code: "ja", label: "JA", name: "日本語", flag: "JP" },
  { code: "ko", label: "KO", name: "한국어", flag: "KR" },
  { code: "zh-CN", label: "ZH", name: "简体中文", flag: "CN" },
  { code: "ar", label: "AR", name: "العربية", flag: "AR" },
  { code: "he", label: "HE", name: "עברית", flag: "IL" },
] as const;

export const RTL_LOCALES = ["ar", "he"] as const;

export const LOCALE_COOKIE = "NEXT_LOCALE";
