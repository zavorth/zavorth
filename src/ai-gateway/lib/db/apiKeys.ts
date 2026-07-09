import {
  parseAccessSchedule,
  parseAllowedConnections,
  parseAllowedModels,
  parseAutoResolve,
  parseIsActive,
  parseNoLog,
  toRecord,
} from "./api-keys/apiKeyParsing";
import {
  clearPreparedStatementCache,
  getPreparedStatements,
} from "./api-keys/apiKeyStatements";
import { getDbInstance, rowToCamel } from "./core";
/**
 * db/apiKeys.js - API key management.
 */

import { v4 as uuidv4 } from "uuid";
import { backupDbFile } from "./backup";
import {
  cacheKeyMetadata,
  cacheModelPermission,
  cacheValidKeyValidation,
  clearApiKeyRuntimeCaches,
  getCachedKeyMetadata,
  getCachedKeyValidation,
  getCachedModelPermission,
  getWildcardRegex,
  invalidateApiKeyCaches,
} from "./api-keys/apiKeyCache";


import type {
  AccessSchedule,
  ApiKeyMetadata,
  ApiKeyRow,
  ApiKeysDbLike,
  ApiKeyView,
} from "./api-keys/apiKeyTypes";

import { registerDbStateResetter } from "./stateReset";
import { setNoLog } from "../compliance";

export type { AccessSchedule } from "./api-keys/apiKeyTypes";

export async function getApiKeys() {
  const db = getDbInstance() as ApiKeysDbLike;
  const stmt = getPreparedStatements(db);
  const rows = stmt.getAllKeys.all();
  return rows.map((row) => normalizeApiKeyView(rowToCamel(row)));
}

export async function getApiKeyById(id: string) {
  const db = getDbInstance() as ApiKeysDbLike;
  const stmt = getPreparedStatements(db);
  const row = stmt.getKeyById.get(id);
  if (!row) return null;
  return normalizeApiKeyView(rowToCamel(row));
}

export async function createApiKey(name: string, machineId: string) {
  if (!machineId) {
    throw new Error("machineId is required");
  }

  const db = getDbInstance() as ApiKeysDbLike;
  const now = new Date().toISOString();

  const { generateApiKeyWithMachine } = await import("@/shared/utils/apiKey");
  const result = generateApiKeyWithMachine(machineId);

  const apiKey = {
    id: uuidv4(),
    name: name,
    key: result.key,
    machineId: machineId,
    allowedModels: [],
    allowedConnections: [],
    noLog: false,
    createdAt: now,
  };

  const stmt = getPreparedStatements(db);
  stmt.insertKey.run(
    apiKey.id,
    apiKey.name,
    apiKey.key,
    apiKey.machineId,
    "[]",
    0,
    apiKey.createdAt,
  );
  setNoLog(apiKey.id, false);

  backupDbFile("pre-write");
  return apiKey;
}

export async function updateApiKeyPermissions(
  id: string,
  update:
    | string[]
    | {
        name?: string;
        allowedModels?: string[];
        allowedConnections?: string[];
        noLog?: boolean;
        autoResolve?: boolean;
        isActive?: boolean;
        accessSchedule?: AccessSchedule | null;
        maxRequestsPerDay?: number | null;
        maxRequestsPerMinute?: number | null;
        maxSessions?: number | null;
      },
) {
  const db = getDbInstance() as ApiKeysDbLike;
  getPreparedStatements(db);

  const normalized =
    Array.isArray(update) || update === undefined
      ? { allowedModels: update || [] }
      : {
          name: update.name,
          allowedModels: update.allowedModels,
          allowedConnections: update.allowedConnections,
          noLog: update.noLog,
          autoResolve: update.autoResolve,
          isActive: update.isActive,
          accessSchedule: update.accessSchedule,
          maxRequestsPerDay: update.maxRequestsPerDay,
          maxRequestsPerMinute: update.maxRequestsPerMinute,
          maxSessions: update.maxSessions,
        };

  if (
    normalized.name === undefined &&
    normalized.allowedModels === undefined &&
    normalized.allowedConnections === undefined &&
    normalized.noLog === undefined &&
    normalized.autoResolve === undefined &&
    normalized.isActive === undefined &&
    normalized.accessSchedule === undefined &&
    normalized.maxRequestsPerDay === undefined &&
    normalized.maxRequestsPerMinute === undefined &&
    normalized.maxSessions === undefined
  ) {
    return false;
  }

  const updates: string[] = [];
  const params: {
    id: string;
    name?: string;
    allowedModels?: string;
    allowedConnections?: string;
    noLog?: number;
    autoResolve?: number;
    isActive?: number;
    accessSchedule?: string | null;
    maxRequestsPerDay?: number | null;
    maxRequestsPerMinute?: number | null;
    maxSessions?: number;
  } = { id };

  if (normalized.name !== undefined) {
    updates.push("name = @name");
    params.name = normalized.name;
  }

  if (normalized.allowedModels !== undefined) {
    updates.push("allowed_models = @allowedModels");
    params.allowedModels = JSON.stringify(normalized.allowedModels || []);
  }

  if (normalized.allowedConnections !== undefined) {
    updates.push("allowed_connections = @allowedConnections");
    params.allowedConnections = JSON.stringify(
      normalized.allowedConnections || [],
    );
  }

  if (normalized.noLog !== undefined) {
    updates.push("no_log = @noLog");
    params.noLog = normalized.noLog ? 1 : 0;
  }

  if (normalized.autoResolve !== undefined) {
    updates.push("auto_resolve = @autoResolve");
    params.autoResolve = normalized.autoResolve ? 1 : 0;
  }

  if (normalized.isActive !== undefined) {
    updates.push("is_active = @isActive");
    params.isActive = normalized.isActive ? 1 : 0;
  }

  if (normalized.accessSchedule !== undefined) {
    updates.push("access_schedule = @accessSchedule");
    params.accessSchedule =
      normalized.accessSchedule !== null
        ? JSON.stringify(normalized.accessSchedule)
        : null;
  }

  if (normalized.maxRequestsPerDay !== undefined) {
    updates.push("max_requests_per_day = @maxRequestsPerDay");
    params.maxRequestsPerDay = normalized.maxRequestsPerDay;
  }

  if (normalized.maxRequestsPerMinute !== undefined) {
    updates.push("max_requests_per_minute = @maxRequestsPerMinute");
    params.maxRequestsPerMinute = normalized.maxRequestsPerMinute;
  }

  if (normalized.maxSessions !== undefined) {
    updates.push("max_sessions = @maxSessions");
    params.maxSessions =
      typeof normalized.maxSessions === "number"
        ? Math.max(0, normalized.maxSessions)
        : 0;
  }

  const result = db
    .prepare(`UPDATE api_keys SET ${updates.join(", ")} WHERE id = @id`)
    .run(params);

  if (result.changes === 0) return false;

  if (normalized.noLog !== undefined) {
    setNoLog(id, normalized.noLog);
  }

  invalidateApiKeyCaches();
  backupDbFile("pre-write");
  return true;
}

export async function deleteApiKey(id: string) {
  const db = getDbInstance() as ApiKeysDbLike;
  const stmt = getPreparedStatements(db);
  const result = stmt.deleteKey.run(id);

  if (result.changes === 0) return false;

  setNoLog(id, false);
  invalidateApiKeyCaches();
  backupDbFile("pre-write");
  return true;
}

export async function validateApiKey(key: string | null | undefined) {
  if (!key || typeof key !== "string") return false;

  const now = Date.now();
  const cached = getCachedKeyValidation(key, now);
  if (cached !== null) {
    return cached;
  }

  const db = getDbInstance() as ApiKeysDbLike;
  const stmt = getPreparedStatements(db);
  const row = stmt.validateKey.get(key);
  const valid = !!row;

  if (valid) {
    cacheValidKeyValidation(key, now);
  }

  return valid;
}

export async function getApiKeyMetadata(
  key: string | null | undefined,
): Promise<ApiKeyMetadata | null> {
  if (!key || typeof key !== "string") return null;

  const now = Date.now();
  const cached = getCachedKeyMetadata(key, now);
  if (cached) {
    return cached;
  }

  const db = getDbInstance() as ApiKeysDbLike;
  const stmt = getPreparedStatements(db);
  const row = stmt.getKeyMetadata.get(key);

  if (!row) return null;

  const metadata = normalizeApiKeyMetadata(row);
  if (!metadata) return null;

  setNoLog(metadata.id, metadata.noLog === true);
  cacheKeyMetadata(key, metadata, now);
  return metadata;
}

export async function isModelAllowedForKey(
  key: string | null | undefined,
  modelId: string | null | undefined,
) {
  if (!key) return true;
  if (!modelId) return false;

  const cacheKey = `${key}:${modelId}`;
  const now = Date.now();
  const cached = getCachedModelPermission(cacheKey, now);
  if (cached !== null) {
    return cached;
  }

  const metadata = await getApiKeyMetadata(key);
  if (!metadata) return false;

  const { allowedModels } = metadata;
  const allowed =
    !allowedModels || allowedModels.length === 0
      ? true
      : allowedModels.some((pattern) =>
          isModelPatternAllowed(pattern, modelId),
        );

  cacheModelPermission(cacheKey, allowed, now);
  return allowed;
}

export function clearApiKeyCaches() {
  clearApiKeyRuntimeCaches();
}

export function resetApiKeyState() {
  clearPreparedStatementCache();
  clearApiKeyCaches();
}

function normalizeApiKeyView(row: unknown): ApiKeyView {
  const camelRow = toRecord(row) as ApiKeyView;
  camelRow.allowedModels = parseAllowedModels(camelRow.allowedModels);
  camelRow.allowedConnections = parseAllowedConnections(
    camelRow.allowedConnections,
  );
  camelRow.noLog = parseNoLog(camelRow.noLog);
  camelRow.autoResolve = parseAutoResolve(camelRow.autoResolve);
  camelRow.isActive = parseIsActive(camelRow.isActive);
  camelRow.accessSchedule = parseAccessSchedule(camelRow.accessSchedule);
  if (typeof camelRow.id === "string" && camelRow.id.length > 0) {
    setNoLog(camelRow.id, camelRow.noLog === true);
  }
  return camelRow;
}

function normalizeApiKeyMetadata(row: ApiKeyRow): ApiKeyMetadata | null {
  const record = toRecord(row) as ApiKeyRow;
  const metadataId = typeof record.id === "string" ? record.id : "";
  const metadataName = typeof record.name === "string" ? record.name : "";
  const machineIdRaw = record.machine_id ?? record.machineId;
  const metadataMachineId =
    typeof machineIdRaw === "string" ? machineIdRaw : null;
  const rawMaxRPD = record.max_requests_per_day ?? record.maxRequestsPerDay;
  const rawMaxRPM =
    record.max_requests_per_minute ?? record.maxRequestsPerMinute;
  const rawMaxSessions = record.max_sessions ?? record.maxSessions;

  if (!metadataId) {
    return null;
  }

  return {
    id: metadataId,
    name: metadataName,
    machineId: metadataMachineId,
    allowedModels: parseAllowedModels(
      record.allowed_models ?? record.allowedModels,
    ),
    allowedConnections: parseAllowedConnections(
      record.allowed_connections ?? record.allowedConnections,
    ),
    noLog: parseNoLog(record.no_log ?? record.noLog),
    autoResolve: parseAutoResolve(record.auto_resolve ?? record.autoResolve),
    isActive: parseIsActive(record.is_active ?? record.isActive),
    accessSchedule: parseAccessSchedule(
      record.access_schedule ?? record.accessSchedule,
    ),
    maxRequestsPerDay:
      typeof rawMaxRPD === "number" && rawMaxRPD > 0 ? rawMaxRPD : null,
    maxRequestsPerMinute:
      typeof rawMaxRPM === "number" && rawMaxRPM > 0 ? rawMaxRPM : null,
    maxSessions:
      typeof rawMaxSessions === "number" && rawMaxSessions > 0
        ? rawMaxSessions
        : 0,
  };
}

function isModelPatternAllowed(pattern: string, modelId: string): boolean {
  if (pattern === modelId) return true;
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -2);
    if (modelId.startsWith(prefix + "/") || modelId.startsWith(prefix)) {
      return true;
    }
  }
  return pattern.includes("*") && getWildcardRegex(pattern).test(modelId);
}

registerDbStateResetter(resetApiKeyState);
