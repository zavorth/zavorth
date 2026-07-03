/**
 * db/models.js — Model aliases, MITM aliases, and custom models.
 */

import { getDbInstance } from "./core";
import { backupDbFile } from "./backup";
import {
  compatByProtocolHasEntries,
  deepMergeCompatByProtocol,
  isCompatProtocolKey,
  readCompatList,
  removeModelCompatOverride,
  sanitizeUpstreamHeadersMap,
  type ModelCompatProtocolKey,
  type CompatByProtocolMap,
  type ModelCompatPerProtocol,
} from "./models/modelCompat";
import { getKeyValue, type JsonRecord } from "./models/modelRowUtils";

interface CustomModelRecord {
  id?: string;
  name?: string;
  source?: string;
  apiFormat?: string;
  supportedEndpoints?: string[];
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  description?: string;
  supportsThinking?: boolean;
  normalizeToolCallId?: boolean;
  preserveOpenAIDeveloperRole?: boolean;
  compatByProtocol?: CompatByProtocolMap;
  upstreamHeaders?: Record<string, unknown>;
  isHidden?: boolean;
}

export {
  MODEL_COMPAT_PROTOCOL_KEYS,
  getModelCompatOverrides,
  mergeModelCompatOverride,
  removeModelCompatOverride,
  sanitizeUpstreamHeadersMap,
  type ModelCompatOverride,
  type ModelCompatPatch,
  type ModelCompatPerProtocol,
  type ModelCompatProtocolKey,
} from "./models/modelCompat";

// ──────────────── Model Aliases ────────────────

export async function getModelAliases() {
  const db = getDbInstance();
  const rows = db
    .prepare("SELECT key, value FROM key_value WHERE namespace = 'modelAliases'")
    .all();
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    const { key, value } = getKeyValue(row);
    if (!key || value === null) continue;
    result[key] = JSON.parse(value);
  }
  return result;
}

export async function setModelAlias(alias: string, model: unknown) {
  const db = getDbInstance();
  db.prepare(
    "INSERT OR REPLACE INTO key_value (namespace, key, value) VALUES ('modelAliases', ?, ?)"
  ).run(alias, JSON.stringify(model));
  backupDbFile("pre-write");
}

export async function deleteModelAlias(alias: string) {
  const db = getDbInstance();
  db.prepare("DELETE FROM key_value WHERE namespace = 'modelAliases' AND key = ?").run(alias);
  backupDbFile("pre-write");
}

// ──────────────── MITM Alias ────────────────

export async function getMitmAlias(toolName?: string) {
  const db = getDbInstance();
  if (toolName) {
    const row = db
      .prepare("SELECT value FROM key_value WHERE namespace = 'mitmAlias' AND key = ?")
      .get(toolName);
    const value = getKeyValue(row).value;
    return value ? JSON.parse(value) : {};
  }
  const rows = db.prepare("SELECT key, value FROM key_value WHERE namespace = 'mitmAlias'").all();
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    const { key, value } = getKeyValue(row);
    if (!key || value === null) continue;
    result[key] = JSON.parse(value);
  }
  return result;
}

export async function setMitmAliasAll(toolName: string, mappings: unknown) {
  const db = getDbInstance();
  db.prepare(
    "INSERT OR REPLACE INTO key_value (namespace, key, value) VALUES ('mitmAlias', ?, ?)"
  ).run(toolName, JSON.stringify(mappings || {}));
  backupDbFile("pre-write");
}

// ──────────────── Custom Models ────────────────

export async function getCustomModels(providerId?: string) {
  const db = getDbInstance();
  if (providerId) {
    const row = db
      .prepare("SELECT value FROM key_value WHERE namespace = 'customModels' AND key = ?")
      .get(providerId);
    const value = getKeyValue(row).value;
    return value ? JSON.parse(value) : [];
  }
  const rows = db
    .prepare("SELECT key, value FROM key_value WHERE namespace = 'customModels'")
    .all();
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    const { key, value } = getKeyValue(row);
    if (!key || value === null) continue;
    result[key] = JSON.parse(value);
  }
  return result;
}

export async function getAllCustomModels() {
  const db = getDbInstance();
  const rows = db
    .prepare("SELECT key, value FROM key_value WHERE namespace = 'customModels'")
    .all();
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    const { key, value } = getKeyValue(row);
    if (!key || value === null) continue;
    result[key] = JSON.parse(value);
  }
  return result;
}

export async function addCustomModel(
  providerId: string,
  modelId: string,
  modelName?: string,
  source = "manual",
  apiFormat: "chat-completions" | "responses" = "chat-completions",
  supportedEndpoints: string[] = ["chat"]
) {
  const db = getDbInstance();
  const row = db
    .prepare("SELECT value FROM key_value WHERE namespace = 'customModels' AND key = ?")
    .get(providerId);
  const value = getKeyValue(row).value;
  const models = value ? JSON.parse(value) : [];

  const exists = models.find((m: JsonRecord) => m.id === modelId);
  if (exists) return exists;

  const model = {
    id: modelId,
    name: modelName || modelId,
    source,
    apiFormat,
    supportedEndpoints,
  };
  models.push(model);
  db.prepare(
    "INSERT OR REPLACE INTO key_value (namespace, key, value) VALUES ('customModels', ?, ?)"
  ).run(providerId, JSON.stringify(models));
  backupDbFile("pre-write");
  return model;
}

/**
 * Replace the entire custom models list for a provider (used by auto-sync).
 * Preserves per-model compatibility overrides for models that still exist.
 */
export async function replaceCustomModels(
  providerId: string,
  models: Array<{
    id: string;
    name?: string;
    source?: string;
    apiFormat?: string;
    supportedEndpoints?: string[];
    inputTokenLimit?: number;
    outputTokenLimit?: number;
    description?: string;
    supportsThinking?: boolean;
  }>,
  { allowEmpty = false }: { allowEmpty?: boolean } = {}
) {
  // Guard: skip destructive clear when the caller hasn't explicitly opted in.
  // This prevents auto-sync from wiping manually-imported models when the
  // upstream /models endpoint fails, times out, or returns an empty list.
  if (models.length === 0 && !allowEmpty) {
    const existing = await getCustomModels(providerId);
    return Array.isArray(existing) ? existing : [];
  }

  const db = getDbInstance();
  const existing = await getCustomModels(providerId);
  const existingMap = new Map<string, JsonRecord>();
  if (Array.isArray(existing)) {
    for (const m of existing) {
      if (m && typeof m === "object" && m.id) existingMap.set(m.id, m);
    }
  }

  // Merge: keep existing per-model compat flags if model still exists
  const merged = models.map((m) => {
    const prev = existingMap.get(m.id);
    return {
      id: m.id,
      name: m.name || m.id,
      source: m.source || "auto-sync",
      apiFormat: m.apiFormat || (prev as CustomModelRecord)?.apiFormat || "chat-completions",
      supportedEndpoints: m.supportedEndpoints || (prev as CustomModelRecord)?.supportedEndpoints || ["chat"],
      // Preserve metadata from provider API (or previous sync)
      ...(m.inputTokenLimit != null
        ? { inputTokenLimit: m.inputTokenLimit }
        : (prev as CustomModelRecord)?.inputTokenLimit != null
          ? { inputTokenLimit: (prev as CustomModelRecord).inputTokenLimit }
          : {}),
      ...(m.outputTokenLimit != null
        ? { outputTokenLimit: m.outputTokenLimit }
        : (prev as CustomModelRecord)?.outputTokenLimit != null
          ? { outputTokenLimit: (prev as CustomModelRecord).outputTokenLimit }
          : {}),
      ...(m.description != null
        ? { description: m.description }
        : (prev as CustomModelRecord)?.description != null
          ? { description: (prev as CustomModelRecord).description }
          : {}),
      ...(m.supportsThinking != null
        ? { supportsThinking: m.supportsThinking }
        : (prev as CustomModelRecord)?.supportsThinking != null
          ? { supportsThinking: (prev as CustomModelRecord).supportsThinking }
          : {}),
      // Preserve existing compat flags
      ...(prev && (prev as CustomModelRecord).normalizeToolCallId !== undefined
        ? { normalizeToolCallId: (prev as CustomModelRecord).normalizeToolCallId }
        : {}),
      ...(prev && (prev as CustomModelRecord).preserveOpenAIDeveloperRole !== undefined
        ? { preserveOpenAIDeveloperRole: (prev as CustomModelRecord).preserveOpenAIDeveloperRole }
        : {}),
      ...(prev && (prev as CustomModelRecord).compatByProtocol
        ? { compatByProtocol: (prev as CustomModelRecord).compatByProtocol }
        : {}),
      ...(prev && (prev as CustomModelRecord).upstreamHeaders
        ? { upstreamHeaders: (prev as CustomModelRecord).upstreamHeaders }
        : {}),
    };
  });

  if (merged.length === 0) {
    db.prepare("DELETE FROM key_value WHERE namespace = 'customModels' AND key = ?").run(
      providerId
    );
  } else {
    db.prepare(
      "INSERT OR REPLACE INTO key_value (namespace, key, value) VALUES ('customModels', ?, ?)"
    ).run(providerId, JSON.stringify(merged));
  }

  // Remove compat overrides for models that no longer exist
  const newIds = new Set(models.map((m) => m.id));
  const compatList = readCompatList(providerId);
  const filteredCompat = compatList.filter((e) => newIds.has(e.id));
  if (filteredCompat.length !== compatList.length) {
    writeCompatList(providerId, filteredCompat);
  }

  backupDbFile("pre-write");
  return merged;
}

export async function removeCustomModel(providerId: string, modelId: string) {
  const db = getDbInstance();
  const row = db
    .prepare("SELECT value FROM key_value WHERE namespace = 'customModels' AND key = ?")
    .get(providerId);
  if (!row) return false;

  const value = getKeyValue(row).value;
  if (!value) return false;
  const models = JSON.parse(value);
  const before = models.length;
  const filtered = models.filter((m: JsonRecord) => m.id !== modelId);

  if (filtered.length === before) return false;

  if (filtered.length === 0) {
    db.prepare("DELETE FROM key_value WHERE namespace = 'customModels' AND key = ?").run(
      providerId
    );
  } else {
    db.prepare("UPDATE key_value SET value = ? WHERE namespace = 'customModels' AND key = ?").run(
      JSON.stringify(filtered),
      providerId
    );
  }

  removeModelCompatOverride(providerId, modelId);
  backupDbFile("pre-write");
  return true;
}

// ──────────────── Synced Available Models ────────────────
// Storage: namespace = 'syncedAvailableModels', key = '<providerId>:<connectionId>'
// Each connection stores its own model list. Reads union across all connections
// for a provider. Deleting a connection removes only its models.

export interface SyncedAvailableModel {
  id: string;
  name: string;
  source: "api-sync";
  supportedEndpoints?: string[];
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  description?: string;
  supportsThinking?: boolean;
}

/**
 * Get all synced available models for a provider, unioned across all connections.
 */
export async function getSyncedAvailableModels(
  providerId: string
): Promise<SyncedAvailableModel[]> {
  const db = getDbInstance();
  const rows = db
    .prepare(
      "SELECT key, value FROM key_value WHERE namespace = 'syncedAvailableModels' AND key LIKE ?"
    )
    .all(`${providerId}:%`);
  const map = new Map<string, SyncedAvailableModel>();
  for (const row of rows) {
    const { key, value } = getKeyValue(row);
    if (!key || value === null) continue;
    const models: SyncedAvailableModel[] = JSON.parse(value);
    for (const m of models) {
      if (m.id) map.set(m.id, m);
    }
  }
  return Array.from(map.values());
}

/**
 * Get all synced available models across all providers.
 */
export async function getAllSyncedAvailableModels(): Promise<
  Record<string, SyncedAvailableModel[]>
> {
  const db = getDbInstance();
  const rows = db
    .prepare("SELECT key, value FROM key_value WHERE namespace = 'syncedAvailableModels'")
    .all();
  // Group by providerId (before the colon)
  const byProvider = new Map<string, Map<string, SyncedAvailableModel>>();
  for (const row of rows) {
    const { key, value } = getKeyValue(row);
    if (!key || value === null) continue;
    const providerId = key.split(":")[0];
    if (!byProvider.has(providerId)) byProvider.set(providerId, new Map());
    const models: SyncedAvailableModel[] = JSON.parse(value);
    const map = byProvider.get(providerId)!;
    for (const m of models) {
      if (m.id) map.set(m.id, m);
    }
  }
  const result: Record<string, SyncedAvailableModel[]> = {};
  for (const [providerId, map] of byProvider) {
    result[providerId] = Array.from(map.values());
  }
  return result;
}

/**
 * Replace the model list for a specific connection.
 * Key format: '<providerId>:<connectionId>'
 */
export async function replaceSyncedAvailableModelsForConnection(
  providerId: string,
  connectionId: string,
  models: SyncedAvailableModel[]
): Promise<SyncedAvailableModel[]> {
  const db = getDbInstance();
  const key = `${providerId}:${connectionId}`;
  if (models.length === 0) {
    db.prepare("DELETE FROM key_value WHERE namespace = 'syncedAvailableModels' AND key = ?").run(
      key
    );
  } else {
    db.prepare(
      "INSERT OR REPLACE INTO key_value (namespace, key, value) VALUES ('syncedAvailableModels', ?, ?)"
    ).run(key, JSON.stringify(models));
  }
  backupDbFile("pre-write");
  // Return the full unioned list for the provider
  return getSyncedAvailableModels(providerId);
}

/**
 * Delete all synced models for a specific connection.
 * Returns the remaining unioned list for the provider.
 */
export async function deleteSyncedAvailableModelsForConnection(
  providerId: string,
  connectionId: string
): Promise<SyncedAvailableModel[]> {
  const db = getDbInstance();
  const key = `${providerId}:${connectionId}`;
  db.prepare("DELETE FROM key_value WHERE namespace = 'syncedAvailableModels' AND key = ?").run(
    key
  );
  backupDbFile("pre-write");
  return getSyncedAvailableModels(providerId);
}

export async function updateCustomModel(
  providerId: string,
  modelId: string,
  updates: Record<string, unknown> = {}
) {
  const db = getDbInstance();
  const row = db
    .prepare("SELECT value FROM key_value WHERE namespace = 'customModels' AND key = ?")
    .get(providerId);
  if (!row) return null;

  const value = getKeyValue(row).value;
  if (!value) return null;

  const models = JSON.parse(value);
  const index = models.findIndex((m: JsonRecord) => m.id === modelId);
  if (index === -1) return null;

  const current = models[index];
  const currentCompat = (current as JsonRecord).compatByProtocol as CompatByProtocolMap | undefined;
  let mergedCompat: CompatByProtocolMap | undefined = currentCompat;
  if (
    updates.compatByProtocol !== undefined &&
    typeof updates.compatByProtocol === "object" &&
    updates.compatByProtocol !== null &&
    !Array.isArray(updates.compatByProtocol)
  ) {
    mergedCompat = deepMergeCompatByProtocol(
      currentCompat,
      updates.compatByProtocol as Partial<
        Record<ModelCompatProtocolKey, Partial<ModelCompatPerProtocol>>
      >
    );
    if (!compatByProtocolHasEntries(mergedCompat)) mergedCompat = undefined;
  }

  const next: JsonRecord = {
    ...current,
    ...(updates.modelName !== undefined ? { name: updates.modelName || current.name } : {}),
    ...(updates.apiFormat !== undefined ? { apiFormat: updates.apiFormat } : {}),
    ...(updates.supportedEndpoints !== undefined
      ? { supportedEndpoints: updates.supportedEndpoints }
      : {}),
    ...(updates.normalizeToolCallId !== undefined
      ? { normalizeToolCallId: Boolean(updates.normalizeToolCallId) }
      : {}),
    ...(updates.isHidden !== undefined ? { isHidden: Boolean(updates.isHidden) } : {}),
  };
  if (Object.prototype.hasOwnProperty.call(updates, "preserveOpenAIDeveloperRole")) {
    if (updates.preserveOpenAIDeveloperRole === null) {
      delete next.preserveOpenAIDeveloperRole;
    } else {
      next.preserveOpenAIDeveloperRole = Boolean(updates.preserveOpenAIDeveloperRole);
    }
  }
  if (updates.compatByProtocol !== undefined) {
    if (mergedCompat && compatByProtocolHasEntries(mergedCompat)) {
      next.compatByProtocol = mergedCompat;
    } else {
      delete next.compatByProtocol;
    }
  }

  if (Object.prototype.hasOwnProperty.call(updates, "upstreamHeaders")) {
    const uh = updates.upstreamHeaders;
    if (uh === null || uh === undefined) {
      delete next.upstreamHeaders;
    } else if (typeof uh === "object" && !Array.isArray(uh)) {
      const s = sanitizeUpstreamHeadersMap(uh as Record<string, unknown>);
      if (Object.keys(s).length === 0) delete next.upstreamHeaders;
      else next.upstreamHeaders = s;
    }
  }

  models[index] = next;

  db.prepare("UPDATE key_value SET value = ? WHERE namespace = 'customModels' AND key = ?").run(
    JSON.stringify(models),
    providerId
  );

  backupDbFile("pre-write");
  return next;
}

/** Single custom model row from key_value customModels, or null */
function getCustomModelRow(providerId: string, modelId: string): JsonRecord | null {
  const db = getDbInstance();
  const row = db
    .prepare("SELECT value FROM key_value WHERE namespace = 'customModels' AND key = ?")
    .get(providerId);
  const value = getKeyValue(row).value;
  if (!value) return null;
  try {
    const models = JSON.parse(value) as unknown;
    if (!Array.isArray(models)) return null;
    const m = models.find((x: unknown) => {
      if (!x || typeof x !== "object" || Array.isArray(x)) return false;
      return (x as { id?: string }).id === modelId;
    }) as JsonRecord | undefined;
    return m ?? null;
  } catch {
    return null;
  }
}

/**
 * Whether the given provider/model has "normalize tool call id" (9-char Mistral-style) enabled.
 * Custom model row wins; otherwise {@link getModelCompatOverrides}.
 * When `sourceFormat` is one of `openai` | `openai-responses` | `claude`, per-protocol
 * `compatByProtocol[sourceFormat].normalizeToolCallId` overrides the legacy top-level flag.
 */
export function getModelNormalizeToolCallId(
  providerId: string,
  modelId: string,
  sourceFormat?: string | null
): boolean {
  const m = getCustomModelRow(providerId, modelId);
  const protocol = sourceFormat && isCompatProtocolKey(sourceFormat) ? sourceFormat : null;

  if (m) {
    if (protocol) {
      const pc = (m.compatByProtocol as CompatByProtocolMap | undefined)?.[protocol];
      if (pc && Object.prototype.hasOwnProperty.call(pc, "normalizeToolCallId")) {
        return Boolean(pc.normalizeToolCallId);
      }
    }
    return Boolean(m.normalizeToolCallId);
  }
  const co = readCompatList(providerId).find((e) => e.id === modelId);
  if (protocol && co?.compatByProtocol?.[protocol]) {
    const pc = co.compatByProtocol[protocol]!;
    if (Object.prototype.hasOwnProperty.call(pc, "normalizeToolCallId")) {
      return Boolean(pc.normalizeToolCallId);
    }
  }
  return Boolean(co?.normalizeToolCallId);
}

/**
 * Explicit preserve-openai-developer preference for this provider/model.
 * `undefined` = unset → routing keeps legacy default (preserve developer for OpenAI format).
 * `false` = map developer → system (e.g. MiniMax). `true` = keep developer.
 * Per-protocol overrides live under `compatByProtocol[sourceFormat]` when `sourceFormat` matches.
 */
export function getModelPreserveOpenAIDeveloperRole(
  providerId: string,
  modelId: string,
  sourceFormat?: string | null
): boolean | undefined {
  const m = getCustomModelRow(providerId, modelId);
  const protocol = sourceFormat && isCompatProtocolKey(sourceFormat) ? sourceFormat : null;

  if (m) {
    if (protocol) {
      const pc = (m.compatByProtocol as CompatByProtocolMap | undefined)?.[protocol];
      if (pc && Object.prototype.hasOwnProperty.call(pc, "preserveOpenAIDeveloperRole")) {
        return Boolean(pc.preserveOpenAIDeveloperRole);
      }
    }
    if (Object.prototype.hasOwnProperty.call(m, "preserveOpenAIDeveloperRole")) {
      return Boolean(m.preserveOpenAIDeveloperRole);
    }
    return undefined;
  }
  const co = readCompatList(providerId).find((e) => e.id === modelId);
  if (protocol && co?.compatByProtocol?.[protocol]) {
    const pc = co.compatByProtocol[protocol]!;
    if (Object.prototype.hasOwnProperty.call(pc, "preserveOpenAIDeveloperRole")) {
      return Boolean(pc.preserveOpenAIDeveloperRole);
    }
  }
  if (co && Object.prototype.hasOwnProperty.call(co, "preserveOpenAIDeveloperRole")) {
    return Boolean(co.preserveOpenAIDeveloperRole);
  }
  return undefined;
}

/**
 * Check if the model is flagged as hidden from the public catalog.
 */
export function getModelIsHidden(providerId: string, modelId: string): boolean {
  const m = getCustomModelRow(providerId, modelId);
  if (m && Object.prototype.hasOwnProperty.call(m, "isHidden")) {
    return Boolean(m.isHidden);
  }
  const co = readCompatList(providerId).find((e) => e.id === modelId);
  return Boolean(co?.isHidden);
}

function readUpstreamFromJsonRecord(
  row: JsonRecord | null | undefined,
  key: "upstreamHeaders"
): Record<string, string> | undefined {
  if (!row) return undefined;
  const raw = row[key];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const s = sanitizeUpstreamHeadersMap(raw as Record<string, unknown>);
  return Object.keys(s).length > 0 ? s : undefined;
}

/**
 * Extra HTTP headers to send to the upstream provider for this model (after executor auth headers).
 * Order: top-level `upstreamHeaders` on the custom model row (override list merged under custom),
 * then per-protocol `compatByProtocol[sourceFormat].upstreamHeaders` (wins on key conflict).
 * Use for gateways that expect `Authentication`, `X-API-Key`, etc. alongside Bearer.
 *
 * `modelId` should be the **canonical** model id when known. Callers that accept client aliases
 * (e.g. chat proxy) should merge results for both alias and `resolveModelAlias(alias)` so UI
 * config on the resolved id still applies — see `chatCore` merge.
 */
export function getModelUpstreamExtraHeaders(
  providerId: string,
  modelId: string,
  sourceFormat?: string | null
): Record<string, string> {
  const protocol = sourceFormat && isCompatProtocolKey(sourceFormat) ? sourceFormat : null;
  const m = getCustomModelRow(providerId, modelId);

  const base: Record<string, string> = {};
  if (m) {
    const fromModel = readUpstreamFromJsonRecord(m, "upstreamHeaders");
    if (fromModel) Object.assign(base, fromModel);
    if (protocol) {
      const pc = (m.compatByProtocol as CompatByProtocolMap | undefined)?.[protocol];
      const fromProto = pc?.upstreamHeaders;
      if (fromProto && typeof fromProto === "object") {
        Object.assign(base, sanitizeUpstreamHeadersMap(fromProto as Record<string, unknown>));
      }
    }
    return base;
  }

  const co = readCompatList(providerId).find((e) => e.id === modelId);
  if (co?.upstreamHeaders) {
    Object.assign(base, sanitizeUpstreamHeadersMap(co.upstreamHeaders as Record<string, unknown>));
  }
  if (protocol && co?.compatByProtocol?.[protocol]?.upstreamHeaders) {
    Object.assign(
      base,
      sanitizeUpstreamHeadersMap(
        co.compatByProtocol[protocol]!.upstreamHeaders as Record<string, unknown>
      )
    );
  }
  return base;
}
