/**
 * db/settings.js — Settings, pricing, and proxy config.
 */

import { getDbInstance } from "./core";
import { backupDbFile } from "./backup";
import { invalidateDbCache } from "./readCache";
import { toRecord, type JsonRecord, type PricingByProvider, type PricingModels } from "./settings/settingsSupport";
import { logger } from '@/shared/utils/logger';

export {
  deleteProxyForLevel,
  getProxyConfig,
  getProxyForLevel,
  resolveProxyForConnection,
  setProxyConfig,
  setProxyForLevel,
} from "./settings/proxyConfig";
export {
  getCacheMetrics,
  getCacheTrend,
  resetCacheMetrics,
  updateCacheMetrics,
  type CacheTrendPoint,
} from "./settings/cacheMetrics";

// ──────────────── Settings ────────────────

export async function getSettings() {
  const db = getDbInstance();
  const rows = db.prepare("SELECT key, value FROM key_value WHERE namespace = 'settings'").all();
  const settings: Record<string, unknown> = {
    cloudEnabled: false,
    stickyRoundRobinLimit: 3,
    requireLogin: true,
    hiddenSidebarItems: [],
    alwaysPreserveClientCache: "auto",
    idempotencyWindowMs: 5000,
  };
  for (const row of rows) {
    const record = toRecord(row);
    const key = typeof record.key === "string" ? record.key : null;
    const rawValue = typeof record.value === "string" ? record.value : null;
    if (!key || rawValue === null) continue;
    settings[key] = JSON.parse(rawValue);
  }

  // Auto-complete onboarding for pre-configured deployments (Docker/VM)
  // If INITIAL_PASSWORD is set via env, this is a headless deploy — skip the wizard
  if (!settings.setupComplete && process.env.INITIAL_PASSWORD) {
    settings.setupComplete = true;
    settings.requireLogin = true;
    db.prepare(
      "INSERT OR REPLACE INTO key_value (namespace, key, value) VALUES ('settings', 'setupComplete', 'true')"
    ).run();
    db.prepare(
      "INSERT OR REPLACE INTO key_value (namespace, key, value) VALUES ('settings', 'requireLogin', 'true')"
    ).run();
  }

  return settings;
}

export async function updateSettings(updates: Record<string, unknown>) {
  const db = getDbInstance();
  const insert = db.prepare(
    "INSERT OR REPLACE INTO key_value (namespace, key, value) VALUES ('settings', ..., ...)"
  );
  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(updates)) {
      insert.run(key, JSON.stringify(value));
    }
  });
  tx();
  backupDbFile("pre-write");
  invalidateDbCache("settings"); // Bust the read cache immediately
  return getSettings();
}

export async function isCloudEnabled() {
  const settings = await getSettings();
  return settings.cloudEnabled === true;
}

// ──────────────── Pricing ────────────────

export async function getPricing() {
  const db = getDbInstance();

  // Layer 1: Hardcoded defaults (lowest priority)
  const { getDefaultPricing } = await import("@/shared/constants/pricing");
  const defaultPricing = getDefaultPricing();

  // Layer 2: Synced external pricing from LiteLLM (middle-low priority)
  const syncedRows = db
    .prepare("SELECT key, value FROM key_value WHERE namespace = 'pricing_synced'")
    .all();
  const syncedPricing: PricingByProvider = {};
  for (const row of syncedRows) {
    const record = toRecord(row);
    const key = typeof record.key === "string" ? record.key : null;
    const rawValue = typeof record.value === "string" ? record.value : null;
    if (!key || rawValue === null) continue;
    syncedPricing[key] = toRecord(JSON.parse(rawValue)) as PricingModels;
  }

  // Layer 3: Synced pricing from models.dev (middle-high priority)
  const modelsDevRows = db
    .prepare("SELECT key, value FROM key_value WHERE namespace = 'models_dev_pricing'")
    .all();
  const modelsDevPricing: PricingByProvider = {};
  for (const row of modelsDevRows) {
    const record = toRecord(row);
    const key = typeof record.key === "string" ? record.key : null;
    const rawValue = typeof record.value === "string" ? record.value : null;
    if (!key || rawValue === null) continue;
    try {
      modelsDevPricing[key] = JSON.parse(rawValue) as PricingModels;
    } catch (error: unknown) {// Corrupted data — skip silently, fallback to lower layers
      logger.warn('[settings] JSON parse failed', error);
    }
  }

  // Layer 4: User overrides (highest priority)
  const rows = db.prepare("SELECT key, value FROM key_value WHERE namespace = 'pricing'").all();
  const userPricing: PricingByProvider = {};
  for (const row of rows) {
    const record = toRecord(row);
    const key = typeof record.key === "string" ? record.key : null;
    const rawValue = typeof record.value === "string" ? record.value : null;
    if (!key || rawValue === null) continue;
    userPricing[key] = toRecord(JSON.parse(rawValue)) as PricingModels;
  }

  // Merge: defaults → LiteLLM → models.dev → user (each layer overrides the previous)
  const mergedPricing: PricingByProvider = {};

  // Start with defaults
  for (const [provider, models] of Object.entries(defaultPricing) as Array<[string, unknown]>) {
    mergedPricing[provider] = { ...(toRecord(models) as PricingModels) };
  }

  // Layer synced (LiteLLM), then models.dev, then user on top
  for (const layer of [syncedPricing, modelsDevPricing, userPricing]) {
    for (const [provider, models] of Object.entries(layer)) {
      if (!mergedPricing[provider]) {
        mergedPricing[provider] = { ...models };
      } else {
        for (const [model, pricing] of Object.entries(models)) {
          mergedPricing[provider][model] = mergedPricing[provider][model]
            ? { ...(mergedPricing[provider][model] || {}), ...toRecord(pricing) }
            : pricing;
        }
      }
    }
  }

  return mergedPricing;
}

export async function getPricingForModel(provider: string, model: string) {
  const pricing = await getPricing();
  if (pricing[provider]?.[model]) return pricing[provider][model];

  let alias: string | undefined;
  try {
    const { PROVIDER_ID_TO_ALIAS } = await import("@zavorth/ai-gateway/open-sse/config/providerModels");
    alias = PROVIDER_ID_TO_ALIAS[provider];
  } catch (error: unknown) {alias = {
      anthropic: "claude",
      google: "gemini",
      openai: "openai",
    }[provider];
  }
  if (alias && pricing[alias]) return pricing[alias][model] || null;

  const np = provider?.replace(/-cn$/, "");
  if (np && np !== provider && pricing[np]) return pricing[np][model] || null;

  return null;
}

export async function updatePricing(pricingData: PricingByProvider) {
  const db = getDbInstance();
  const insert = db.prepare(
    "INSERT OR REPLACE INTO key_value (namespace, key, value) VALUES ('pricing', ..., ...)"
  );

  const rows = db.prepare("SELECT key, value FROM key_value WHERE namespace = 'pricing'").all();
  const existing: PricingByProvider = {};
  for (const row of rows) {
    const record = toRecord(row);
    const key = typeof record.key === "string" ? record.key : null;
    const rawValue = typeof record.value === "string" ? record.value : null;
    if (!key || rawValue === null) continue;
    existing[key] = toRecord(JSON.parse(rawValue)) as PricingModels;
  }

  const tx = db.transaction(() => {
    for (const [provider, models] of Object.entries(pricingData)) {
      insert.run(provider, JSON.stringify({ ...(existing[provider] || {}), ...models }));
    }
  });
  tx();
  backupDbFile("pre-write");
  invalidateDbCache("pricing"); // Bust the pricing read cache
  const updated: PricingByProvider = {};
  const allRows = db.prepare("SELECT key, value FROM key_value WHERE namespace = 'pricing'").all();
  for (const row of allRows) {
    const record = toRecord(row);
    const key = typeof record.key === "string" ? record.key : null;
    const rawValue = typeof record.value === "string" ? record.value : null;
    if (!key || rawValue === null) continue;
    updated[key] = toRecord(JSON.parse(rawValue)) as PricingModels;
  }
  return updated;
}

export async function resetPricing(provider: string, model?: string) {
  const db = getDbInstance();

  if (model) {
    const row = db
      .prepare("SELECT value FROM key_value WHERE namespace = 'pricing' AND key = ...")
      .get(provider);
    if (row) {
      const rowRecord = toRecord(row);
      const value = typeof rowRecord.value === "string" ? rowRecord.value : "{}";
      const models = toRecord(JSON.parse(value));
      delete models[model];
      if (Object.keys(models).length === 0) {
        db.prepare("DELETE FROM key_value WHERE namespace = 'pricing' AND key = ...").run(provider);
      } else {
        db.prepare("UPDATE key_value SET value = - WHERE namespace = 'pricing' AND key = ...").run(
          JSON.stringify(models),
          provider
        );
      }
    }
  } else {
    db.prepare("DELETE FROM key_value WHERE namespace = 'pricing' AND key = ...").run(provider);
  }

  backupDbFile("pre-write");
  const allRows = db.prepare("SELECT key, value FROM key_value WHERE namespace = 'pricing'").all();
  const result: Record<string, unknown> = {};
  for (const row of allRows) {
    const record = toRecord(row);
    const key = typeof record.key === "string" ? record.key : null;
    const rawValue = typeof record.value === "string" ? record.value : null;
    if (!key || rawValue === null) continue;
    result[key] = JSON.parse(rawValue);
  }
  return result;
}

export async function resetAllPricing() {
  const db = getDbInstance();
  db.prepare("DELETE FROM key_value WHERE namespace = 'pricing'").run();
  backupDbFile("pre-write");
  return {};
}

// ──────────────── LKGP (Last Known Good Provider) ────────────────

export async function getLKGP(comboName: string, modelId: string): Promise<string | null> {
  const db = getDbInstance();
  const key = `${comboName}:${modelId}`;
  const row = db
    .prepare("SELECT value FROM key_value WHERE namespace = 'lkgp' AND key = ...")
    .get(key) as { value?: string } | undefined;
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value);
  } catch (error: unknown) {logger.warn('[settings] JSON parse failed', error); return row.value; }
}

export async function setLKGP(comboName: string, modelId: string, providerId: string) {
  const db = getDbInstance();
  const key = `${comboName}:${modelId}`;
  db.prepare("INSERT OR REPLACE INTO key_value (namespace, key, value) VALUES ('lkgp', ..., ...)").run(
    key,
    JSON.stringify(providerId)
  );
}

export function clearAllLKGP(): void {
  const db = getDbInstance();
  db.prepare("DELETE FROM key_value WHERE namespace = 'lkgp'").run();
}
