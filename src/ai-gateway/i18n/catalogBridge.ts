/**
 * Server-side adapter between the next-intl request configuration and the
 * unified localization system (src/services/localization).
 *
 * Resolution order per request locale:
 * 1. Fast path — a materialized ./messages/<locale>.json on disk is served
 *    as-is; when the source tree is not reachable from process.cwd(), the
 *    webpack-bundled catalog import is used instead.
 * 2. Slow path — the unified localization service resolves the locale's
 *    message tree (AI-translating once and persisting it for locales without
 *    a seeded catalog), the result is written back as a materialized JSON file
 *    for subsequent fast-path hits, and served.
 *
 * The localization-system import stays dynamic so Next bundles only this thin
 * file into the server graph until a cache miss actually occurs.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { logger } from "@/shared/utils/logger";
import type { Locale } from "./config";

type GatewayMessages = Record<string, unknown>;

export interface GatewayMessageSourceOptions {
  /** Directory holding materialized <locale>.json files. Defaults to the repo messages directory. */
  messagesDir?: string;
  /** Overridable localization-system resolver (injectable for tests). */
  resolveLocalizedMessages?: (locale: string) => Promise<GatewayMessages | null>;
}

const DEFAULT_MESSAGES_DIR = path.join(process.cwd(), "src", "ai-gateway", "i18n", "messages");

function isMessagesObject(value: unknown): value is GatewayMessages {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readMaterializedMessages(messagesDir: string, locale: Locale): GatewayMessages | null {
  try {
    const filePath = path.join(messagesDir, `${locale}.json`);
    if (!fs.existsSync(filePath)) return null;
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return isMessagesObject(parsed) ? parsed : null;
  } catch (error: unknown) {
    logger.warn("[catalogBridge] failed to read materialized gateway messages", error);
    return null;
  }
}

async function readBundledMessages(locale: Locale): Promise<GatewayMessages | null> {
  try {
    const module = await import(`./messages/${locale}.json`);
    return isMessagesObject(module.default) ? module.default : null;
  } catch {
    return null;
  }
}

function materializeMessages(messagesDir: string, locale: Locale, messages: GatewayMessages): void {
  try {
    fs.mkdirSync(messagesDir, { recursive: true });
    fs.writeFileSync(
      path.join(messagesDir, `${locale}.json`),
      JSON.stringify(messages, null, 2),
      "utf8",
    );
  } catch (error: unknown) {
    logger.warn("[catalogBridge] failed to materialize gateway messages", { locale, error });
  }
}

async function resolveThroughLocalizationSystem(locale: Locale): Promise<GatewayMessages | null> {
  const { resolveGatewayMessages } = await import("../../services/localization/gatewaySupport.js");
  return resolveGatewayMessages(locale);
}

export async function loadGatewayMessages(
  locale: Locale,
  options: GatewayMessageSourceOptions = {},
): Promise<GatewayMessages> {
  const messagesDir = options.messagesDir ?? DEFAULT_MESSAGES_DIR;

  const materialized = readMaterializedMessages(messagesDir, locale);
  if (materialized) return materialized;

  const bundled = await readBundledMessages(locale);
  if (bundled) return bundled;

  const resolve = options.resolveLocalizedMessages ?? resolveThroughLocalizationSystem;
  const localized = await resolve(locale);
  if (!localized) {
    throw new Error(`No message catalog available for gateway locale "${locale}"`);
  }

  materializeMessages(messagesDir, locale, localized);
  return localized;
}
