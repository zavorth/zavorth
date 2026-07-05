import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, SYSTEM_LOCALE } from "./config";
import type { Locale } from "./config";
import { logger } from '@/shared/utils/logger';

function normalizeLocale(value: string): string {
  try {
    return Intl.getCanonicalLocales(value.trim().replace(/_/g, "-"))[0] || value.trim();
  } catch (error) {
    logger.warn('[request] string operation failed', error);
    return value.trim();
  }
}

function resolveSupportedLocale(value: string): Locale | "" {
  const normalized = normalizeLocale(value);
  const exact = LOCALES.find((locale) => locale.toLowerCase() === normalized.toLowerCase());
  if (exact) return exact;
  const language = normalized.split("-")[0]?.toLowerCase();
  return LOCALES.find((locale) => locale.toLowerCase() === language) || "";
}

function parseAcceptLanguage(value: string): Locale | "" {
  return value
    .split(",")
    .map((entry) => {
      const [tag = "", ...params] = entry.trim().split(";");
      const qParam = params.find((param) => param.trim().startsWith("q="));
      const q = qParam ? Number(qParam.trim().slice(2)) : 1;
      return { tag, q: Number.isFinite(q) ? q : 0 };
    })
    .sort((left, right) => right.q - left.q)
    .map(({ tag }) => resolveSupportedLocale(tag))
    .find(Boolean) || "";
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  let locale: string = cookieStore.get(LOCALE_COOKIE)?.value || "";
  const headerStore = await headers();

  if (locale === SYSTEM_LOCALE) {
    locale = "";
  }

  if (locale) {
    locale = resolveSupportedLocale(locale);
  }

  if (!locale) {
    locale = headerStore.get("x-locale") || "";
    locale = resolveSupportedLocale(locale);
  }

  if (!locale) {
    locale = parseAcceptLanguage(headerStore.get("accept-language") || "");
  }

  if (!LOCALES.includes(locale as Locale)) {
    locale = DEFAULT_LOCALE;
  }

  const messages = (await import(`./messages/${locale}.json`)).default;

  return {
    locale,
    messages,
  };
});
