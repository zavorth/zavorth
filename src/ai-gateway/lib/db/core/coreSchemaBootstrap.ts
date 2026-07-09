import { SCHEMA_SQL } from "./coreSchema";
import type { SqliteColumnInfo, SqliteDatabase } from "./coreTypes";
import { ensureZavorthMigrationLedger, recordZavorthMigration } from "../storagePlane";
import { asErrorLike } from '../../../../utils/errorLike.js';

function getColumnNames(db: SqliteDatabase, tableName: string): Set<string> {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as SqliteColumnInfo[];
  return new Set(columns.map((column) => String(column.name ?? "")));
}

function ensureProviderConnectionsColumns(db: SqliteDatabase): void {
  try {
    const columnNames = getColumnNames(db, "provider_connections");
    if (!columnNames.has("rate_limit_protection")) {
      db.exec(
        "ALTER TABLE provider_connections ADD COLUMN rate_limit_protection INTEGER DEFAULT 0"
      );
      console.log("[DB] Added provider_connections.rate_limit_protection column");
    }
    if (!columnNames.has("last_used_at")) {
      db.exec("ALTER TABLE provider_connections ADD COLUMN last_used_at TEXT");
      console.log("[DB] Added provider_connections.last_used_at column");
    }
    if (!columnNames.has("group")) {
      db.exec('ALTER TABLE provider_connections ADD COLUMN "group" TEXT');
      console.log('[DB] Added provider_connections."group" column');
    }
  } catch (error: unknown) {
    const err = asErrorLike(error);
    const message = error instanceof Error ? err.message : String(error);
    console.warn("[DB] Failed to verify provider_connections schema:", message);
  }
}

function ensureUsageHistoryColumns(db: SqliteDatabase): void {
  try {
    const columnNames = getColumnNames(db, "usage_history");
    if (!columnNames.has("success")) {
      db.exec("ALTER TABLE usage_history ADD COLUMN success INTEGER DEFAULT 1");
      console.log("[DB] Added usage_history.success column");
    }
    if (!columnNames.has("latency_ms")) {
      db.exec("ALTER TABLE usage_history ADD COLUMN latency_ms INTEGER DEFAULT 0");
      console.log("[DB] Added usage_history.latency_ms column");
    }
    if (!columnNames.has("ttft_ms")) {
      db.exec("ALTER TABLE usage_history ADD COLUMN ttft_ms INTEGER DEFAULT 0");
      console.log("[DB] Added usage_history.ttft_ms column");
    }
    if (!columnNames.has("error_code")) {
      db.exec("ALTER TABLE usage_history ADD COLUMN error_code TEXT");
      console.log("[DB] Added usage_history.error_code column");
    }
  } catch (error: unknown) {
    const err = asErrorLike(error);
    const message = error instanceof Error ? err.message : String(error);
    console.warn("[DB] Failed to verify usage_history schema:", message);
  }
}

function ensureCallLogsColumns(db: SqliteDatabase): void {
  try {
    const columnNames = getColumnNames(db, "call_logs");
    if (!columnNames.has("artifact_relpath")) {
      db.exec("ALTER TABLE call_logs ADD COLUMN artifact_relpath TEXT");
      console.log("[DB] Added call_logs.artifact_relpath column");
    }
    if (!columnNames.has("has_pipeline_details")) {
      db.exec("ALTER TABLE call_logs ADD COLUMN has_pipeline_details INTEGER DEFAULT 0");
      console.log("[DB] Added call_logs.has_pipeline_details column");
    }
  } catch (error: unknown) {
    const err = asErrorLike(error);
    const message = error instanceof Error ? err.message : String(error);
    console.warn("[DB] Failed to verify call_logs schema:", message);
  }
}

export function hasColumn(db: SqliteDatabase, tableName: string, columnName: string): boolean {
  return getColumnNames(db, tableName).has(columnName);
}

export function bootstrapCoreSchema(db: SqliteDatabase): void {
  db.exec(SCHEMA_SQL);
  ensureProviderConnectionsColumns(db);
  ensureUsageHistoryColumns(db);
  ensureCallLogsColumns(db);
}

export function bootstrapMigrationLedger(db: SqliteDatabase): void {
  ensureZavorthMigrationLedger(db);
  recordZavorthMigration(db, "001", "initial_schema");

  if (hasColumn(db, "combos", "sort_order")) {
    recordZavorthMigration(db, "020", "combo_sort_order");
  }
}

export function persistSchemaVersion(db: SqliteDatabase): void {
  db.prepare("INSERT OR REPLACE INTO db_meta (key, value) VALUES ('schema_version', '1')").run();
}
