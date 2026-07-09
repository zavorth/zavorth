import { PROVIDER_ID_TO_ALIAS } from "@ZavorthGateway/open-sse/config/providerModels.ts";
import { backupDbFile } from "../backup";
import { getDbInstance } from "../core";
import { resolveProxyForConnectionFromRegistry } from "../proxies";
import { logger } from '@/shared/utils/logger';
import {
toProxyMap,
  toProxyValue,
  toRecord,
  type JsonRecord,
  type ProxyConfig,
  type ProxyValue,
} from "./settingsSupport";

const DEFAULT_PROXY_CONFIG: ProxyConfig = { global: null, providers: {}, combos: {}, keys: {} };
const ALIAS_TO_PROVIDER_ID = Object.entries(PROVIDER_ID_TO_ALIAS).reduce(
  (acc, [providerId, alias]) => {
    if (alias) acc[alias] = providerId;
    acc[providerId] = providerId;
    return acc;
  },
  {} as Record<string, string>
);

function resolveProviderAliasOrId(providerOrAlias: string): string {
  if (typeof providerOrAlias !== "string") return providerOrAlias;
  return ALIAS_TO_PROVIDER_ID[providerOrAlias] || providerOrAlias;
}

function getComboModelProvider(modelEntry: unknown): string | null {
  const record = toRecord(modelEntry);
  if (typeof record.provider === "string") {
    return resolveProviderAliasOrId(record.provider);
  }

  const modelValue =
    typeof modelEntry === "string"
      ? modelEntry
      : typeof record.model === "string"
        ? record.model
        : null;

  if (!modelValue) return null;

  const [providerOrAlias] = modelValue.split("/", 1);
  if (!providerOrAlias) return null;
  return resolveProviderAliasOrId(providerOrAlias);
}

function migrateProxyEntry(value: unknown): JsonRecord | null {
  if (!value) return null;
  if (typeof value === "object") {
    const record = toRecord(value);
    if (record.type) return record;
  }
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    return {
      type: url.protocol.replace(":", "") || "http",
      host: url.hostname,
      port:
        url.port ||
        (url.protocol === "socks5:" ? "1080" : url.protocol === "https:" ? "443" : "8080"),
      username: url.username ? decodeURIComponent(url.username) : "",
      password: url.password ? decodeURIComponent(url.password) : "",
    };
  } catch (error: any) { const err = error; const e = error;
    const parts = value.split(":");
    return {
      type: "http",
      host: parts[0] || value,
      port: parts[1] || "8080",
      username: "",
      password: "",
    };
  }
}

export async function getProxyConfig() {
  const db = getDbInstance();
  const rows = db.prepare("SELECT key, value FROM key_value WHERE namespace = 'proxyConfig'").all();

  const raw: ProxyConfig = { ...DEFAULT_PROXY_CONFIG };
  for (const row of rows) {
    const record = toRecord(row);
    const key = typeof record.key === "string" ? record.key : null;
    const rawValue = typeof record.value === "string" ? record.value : null;
    if (!key || rawValue === null) continue;
    raw[key] = JSON.parse(rawValue);
  }

  let migrated = false;
  if (raw.global && typeof raw.global === "string") {
    raw.global = migrateProxyEntry(raw.global);
    migrated = true;
  }
  if (raw.providers) {
    for (const [k, v] of Object.entries(raw.providers)) {
      if (typeof v === "string") {
        raw.providers[k] = migrateProxyEntry(v);
        migrated = true;
      }
    }
  }

  if (migrated) {
    const insert = db.prepare(
      "INSERT OR REPLACE INTO key_value (namespace, key, value) VALUES ('proxyConfig', ?, ?)"
    );
    if (raw.global !== undefined) insert.run("global", JSON.stringify(raw.global));
    if (raw.providers) insert.run("providers", JSON.stringify(raw.providers));
  }

  return raw;
}

export async function getProxyForLevel(level: string, id?: string | null) {
  const config = await getProxyConfig();
  if (level === "global") return config.global || null;
  const map = toProxyMap(config[level + "s"] || config[level] || {});
  return (id ? map[id] : null) || null;
}

export async function setProxyForLevel(level: string, id: string | null, proxy: ProxyValue) {
  const db = getDbInstance();
  const config = await getProxyConfig();

  if (level === "global") {
    config.global = proxy || null;
    db.prepare(
      "INSERT OR REPLACE INTO key_value (namespace, key, value) VALUES ('proxyConfig', 'global', ?)"
    ).run(JSON.stringify(config.global));
  } else {
    const mapKey = level + "s";
    const map = toProxyMap(config[mapKey] || {});
    if (proxy && id) {
      map[id] = proxy;
    } else {
      if (id) delete map[id];
    }
    config[mapKey] = map;
    db.prepare(
      "INSERT OR REPLACE INTO key_value (namespace, key, value) VALUES ('proxyConfig', ?, ?)"
    ).run(mapKey, JSON.stringify(map));
  }

  backupDbFile("pre-write");
  return config;
}

export async function deleteProxyForLevel(level: string, id: string | null) {
  return setProxyForLevel(level, id, null);
}

export async function resolveProxyForConnection(connectionId: string) {
  const registryResolved = await resolveProxyForConnectionFromRegistry(connectionId);
  if (registryResolved?.proxy) {
    return registryResolved;
  }

  const config = await getProxyConfig();

  if (connectionId && config.keys?.[connectionId]) {
    return { proxy: config.keys[connectionId], level: "key", levelId: connectionId };
  }

  const db = getDbInstance();
  const connection = db
    .prepare("SELECT provider FROM provider_connections WHERE id = ?")
    .get(connectionId);

  if (connection) {
    const connectionRecord = toRecord(connection);
    const provider =
      typeof connectionRecord.provider === "string" ? connectionRecord.provider : null;
    if (config.combos && Object.keys(config.combos).length > 0) {
      const combos = db.prepare("SELECT id, data FROM combos").all();
      for (const comboRow of combos) {
        const comboRecord = toRecord(comboRow);
        const comboId = typeof comboRecord.id === "string" ? comboRecord.id : null;
        if (comboId && config.combos[comboId]) {
          try {
            const comboRaw = typeof comboRecord.data === "string" ? comboRecord.data : null;
            if (!comboRaw) continue;
            const combo = toRecord(JSON.parse(comboRaw));
            const comboModels = Array.isArray(combo.models) ? combo.models : [];
            const usesProvider = comboModels.some(
              (entry) => getComboModelProvider(entry) === provider
            );
            if (usesProvider) {
              return { proxy: config.combos[comboId], level: "combo", levelId: comboId };
            }
          } catch (error: any) { const err = error; const e = error;
      // Ignore malformed combo records during proxy resolution.
      logger.warn('[proxy] JSON parse failed', error);
    }
        }
      }
    }

    if (provider && config.providers?.[provider]) {
      return {
        proxy: config.providers[provider],
        level: "provider",
        levelId: provider,
      };
    }
  }

  if (config.global) {
    return { proxy: config.global, level: "global", levelId: null };
  }

  return { proxy: null, level: "direct", levelId: null };
}

export async function setProxyConfig(config: Record<string, unknown>) {
  if (config.level !== undefined) {
    const level = typeof config.level === "string" ? config.level : "global";
    const id = typeof config.id === "string" ? config.id : null;
    const proxy = (config.proxy as ProxyValue) || null;
    return setProxyForLevel(level, id, proxy);
  }

  const db = getDbInstance();
  const current = await getProxyConfig();
  const insert = db.prepare(
    "INSERT OR REPLACE INTO key_value (namespace, key, value) VALUES ('proxyConfig', ?, ?)"
  );

  const tx = db.transaction(() => {
    if (config.global !== undefined) {
      current.global = toProxyValue(config.global);
      insert.run("global", JSON.stringify(current.global));
    }
    for (const mapKey of ["providers", "combos", "keys"]) {
      if (config[mapKey]) {
        const merged = { ...toProxyMap(current[mapKey]), ...toProxyMap(config[mapKey]) };
        for (const [k, v] of Object.entries(merged)) {
          if (!v) delete merged[k];
        }
        current[mapKey] = merged;
        insert.run(mapKey, JSON.stringify(merged));
      }
    }
  });
  tx();

  backupDbFile("pre-write");
  return current;
}
