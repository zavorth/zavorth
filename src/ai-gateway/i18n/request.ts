/**
 * Gateway API request-scoped locale negotiation (next-intl).
 *
 * Messages resolve through the unified localization system via catalogBridge:
 * a materialized ./messages/<locale>.json is served on the fast path, while
 * locales without one are resolved (and AI-translated once, then persisted) by
 * src/services/localization and written back as materialized JSON for later
 * requests. The files under ./messages/ are therefore regenerable artifacts of
 * scripts/sync-gateway-i18n-catalogs.mjs rather than hand-owned sources.
 *
 * Negotiation stays per-request (cookie → x-locale → accept-language) and
 * never touches process-wide localization state.
 */

import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, SYSTEM_LOCALE } from "./config";
import type { Locale } from "./config";
import { loadGatewayMessages } from "./catalogBridge";
import { logger } from '@/shared/utils/logger';function normalizeLocale(value: string): string {
  try {
    return Intl.getCanonicalLocales(value.trim().replace(/_/g, "-"))[0] || value.trim();
  } catch (error: unknown) {logger.warn('[request] string operation failed', error);
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

  const messages = await loadGatewayMessages(locale as Locale);

  return {
    locale,
    messages,
  };
});
