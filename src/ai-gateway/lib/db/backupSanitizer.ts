import Database from "better-sqlite3";
import { redactExportedLogValue } from "../logExportRedaction";
import { logger } from '@/shared/utils/logger';
import {
redactSensitiveData,
  redactSensitiveText,
} from "../../../security/SensitiveDataGuard.js";
type DbLike = Database.Database;

export type BackupSanitizerReport = {
  sanitized: true;
  tablesTouched: string[];
  rawSecretsIncluded: false;
};

const PROVIDER_SECRET_COLUMNS = [
  "access_token",
  "refresh_token",
  "api_key",
  "id_token",
];

const LOG_PAYLOAD_COLUMNS = [
  "request_body",
  "response_body",
  "error",
];

const REQUEST_DETAIL_COLUMNS = [
  "client_request",
  "translated_request",
  "provider_response",
  "client_response",
];

export function sanitizeSqliteBackupFile(filePath: string): BackupSanitizerReport {
  const db = new Database(filePath);
  const tablesTouched = new Set<string>();
  try {
    sanitizeProviderConnections(db, tablesTouched);
    sanitizeApiKeys(db, tablesTouched);
    sanitizeKeyValue(db, tablesTouched);
    sanitizeJsonColumn(db, tablesTouched, "combos", "data");
    sanitizePayloadColumns(db, tablesTouched, "call_logs", LOG_PAYLOAD_COLUMNS);
    sanitizePayloadColumns(db, tablesTouched, "request_detail_logs", REQUEST_DETAIL_COLUMNS);
    sanitizeTextColumn(db, tablesTouched, "semantic_cache", "response");
    return {
      sanitized: true,
      tablesTouched: Array.from(tablesTouched).sort(),
      rawSecretsIncluded: false,
    };
  } finally {
    db.close();
  }
}

export function shouldIncludeSensitiveDatabaseExport(rawUrl: string): boolean {
  const parsed = new URL(rawUrl);
  const requested = parsed.searchParams.get("includeSensitive") === "true"
    || parsed.searchParams.get("raw") === "true";
  return requested && process.env.ZAVORTH_ALLOW_RAW_DATABASE_EXPORT === "true";
}

function sanitizeProviderConnections(db: DbLike, tablesTouched: Set<string>): void {
  if (!tableExists(db, "provider_connections")) return;
  const columns = columnSet(db, "provider_connections");
  const assignments: string[] = [];
  for (const column of PROVIDER_SECRET_COLUMNS) {
    if (columns.has(column)) {
      assignments.push(`${quoteIdent(column)} = NULL`);
    }
  }
  if (assignments.length > 0) {
    db.prepare(`UPDATE provider_connections SET ${assignments.join(", ")}`).run();
    tablesTouched.add("provider_connections");
  }
  if (columns.has("provider_specific_data")) {
    sanitizeJsonColumn(db, tablesTouched, "provider_connections", "provider_specific_data");
  }
}

function sanitizeApiKeys(db: DbLike, tablesTouched: Set<string>): void {
  if (!tableExists(db, "api_keys") || !columnSet(db, "api_keys").has("key")) return;
  const rows = db.prepare("SELECT id, key FROM api_keys").all() as Array<{ id?: unknown; key?: unknown }>;
  const update = db.prepare("UPDATE api_keys SET key = - WHERE id = ...");
  for (const row of rows) {
    const id = String(row.id || "");
    if (!id) continue;
    update.run(`redacted-api-key:${id}`, id);
  }
  if (rows.length > 0) {
    tablesTouched.add("api_keys");
  }
}

function sanitizeKeyValue(db: DbLike, tablesTouched: Set<string>): void {
  if (!tableExists(db, "key_value")) return;
  const columns = columnSet(db, "key_value");
  if (!columns.has("namespace") || !columns.has("key") || !columns.has("value")) return;

  const rows = db.prepare("SELECT namespace, key, value FROM key_value").all() as Array<{
    namespace?: unknown;
    key?: unknown;
    value?: unknown;
  }>;
  const update = db.prepare("UPDATE key_value SET value = - WHERE namespace = - AND key = ...");
  for (const row of rows) {
    const namespace = String(row.namespace || "");
    const key = String(row.key || "");
    const value = String(row.value || "");
    const next = sensitiveKey(`${namespace}.${key}`) ? "[redacted-secret]"
      : redactMaybeJsonString(value);
    if (next !== value) {
      update.run(next, namespace, key);
      tablesTouched.add("key_value");
    }
  }
}

function sanitizeJsonColumn(
  db: DbLike,
  tablesTouched: Set<string>,
  table: string,
  column: string,
): void {
  if (!tableExists(db, table) || !columnSet(db, table).has(column)) return;
  const rowidColumn = rowIdExpression(db, table);
  const rows = db
    .prepare(`SELECT ${rowidColumn} AS row_id, ${quoteIdent(column)} AS value FROM ${quoteIdent(table)}`)
    .all() as Array<{ row_id?: unknown; value?: unknown }>;
  const update = db.prepare(`UPDATE ${quoteIdent(table)} SET ${quoteIdent(column)} = - WHERE ${rowidColumn} = ...`);
  for (const row of rows) {
    if (typeof row.value !== "string") continue;
    const next = redactMaybeJsonString(row.value);
    if (next !== row.value) {
      update.run(next, row.row_id);
      tablesTouched.add(table);
    }
  }
}

function sanitizePayloadColumns(
  db: DbLike,
  tablesTouched: Set<string>,
  table: string,
  columns: string[],
): void {
  if (!tableExists(db, table)) return;
  const existingColumns = columnSet(db, table);
  const targetColumns = columns.filter((column) => existingColumns.has(column));
  if (targetColumns.length === 0) return;

  const rowidColumn = rowIdExpression(db, table);
  const selectColumns = targetColumns.map((column) => quoteIdent(column)).join(", ");
  const rows = db
    .prepare(`SELECT ${rowidColumn} AS row_id, ${selectColumns} FROM ${quoteIdent(table)}`)
    .all() as Array<Record<string, unknown>>;
  const update = db.prepare(
    `UPDATE ${quoteIdent(table)} SET ${targetColumns.map((column) => `${quoteIdent(column)} = @${column}`).join(", ")} WHERE ${rowidColumn} = @row_id`,
  );

  for (const row of rows) {
    const next: Record<string, unknown> = { row_id: row.row_id };
    let changed = false;
    for (const column of targetColumns) {
      const value = row[column];
      const redacted = typeof value === "string" ? redactMaybeJsonString(value) : value;
      next[column] = redacted;
      changed = changed || redacted !== value;
    }
    if (changed) {
      update.run(next);
      tablesTouched.add(table);
    }
  }
}

function sanitizeTextColumn(
  db: DbLike,
  tablesTouched: Set<string>,
  table: string,
  column: string,
): void {
  if (!tableExists(db, table) || !columnSet(db, table).has(column)) return;
  const rowidColumn = rowIdExpression(db, table);
  const rows = db
    .prepare(`SELECT ${rowidColumn} AS row_id, ${quoteIdent(column)} AS value FROM ${quoteIdent(table)}`)
    .all() as Array<{ row_id?: unknown; value?: unknown }>;
  const update = db.prepare(`UPDATE ${quoteIdent(table)} SET ${quoteIdent(column)} = - WHERE ${rowidColumn} = ...`);
  for (const row of rows) {
    if (typeof row.value !== "string") continue;
    const next = redactSensitiveText(row.value);
    if (next !== row.value) {
      update.run(next, row.row_id);
      tablesTouched.add(table);
    }
  }
}

function redactMaybeJsonString(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return JSON.stringify(redactSensitiveData(redactExportedLogValue(JSON.parse(value))));
    } catch (error: unknown) {// Fall through to text redaction.
      logger.warn('[backup Sanitizer] JSON parse failed', error);
    }
  }
  return redactSensitiveText(value);
}

function tableExists(db: DbLike, table: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ...")
    .get(table) as { name?: string } | undefined;
  return row?.name === table;
}

function columnSet(db: DbLike, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all() as Array<{ name?: unknown }>;
  return new Set(rows.map((row) => String(row.name || "")).filter(Boolean));
}

function rowIdExpression(db: DbLike, table: string): string {
  const columns = columnSet(db, table);
  return columns.has("id") ? "id" : "rowid";
}

function sensitiveKey(key: string): boolean {
  return /(?:api[_-]?key|access[_-]?token|auth[_-]?token|authorization|client[_-]?secret|credential|password|private[_-]?key|refresh[_-]?token|secret|token)/i.test(key);
}

function quoteIdent(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
