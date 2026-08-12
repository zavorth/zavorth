import type {
  ApiKeyRow,
  ApiKeysDbLike,
  ApiKeysStatements,
  JsonRecord,
} from "./apiKeyTypes";
import { asErrorLike } from '../../../../utils/errorLike.js';

let schemaChecked = false;
let stmtGetAllKeys: ApiKeysStatements["getAllKeys"] | null = null;
let stmtGetKeyById: ApiKeysStatements["getKeyById"] | null = null;
let stmtValidateKey: ApiKeysStatements["validateKey"] | null = null;
let stmtGetKeyMetadata: ApiKeysStatements["getKeyMetadata"] | null = null;
let stmtInsertKey: ApiKeysStatements["insertKey"] | null = null;
let stmtDeleteKey: ApiKeysStatements["deleteKey"] | null = null;

export function getPreparedStatements(db: ApiKeysDbLike): ApiKeysStatements {
  ensureApiKeysColumns(db);

  if (
    !stmtGetAllKeys ||
    !stmtGetKeyById ||
    !stmtValidateKey ||
    !stmtGetKeyMetadata ||
    !stmtInsertKey ||
    !stmtDeleteKey
  ) {
    stmtGetAllKeys = db.prepare<ApiKeyRow>(
      "SELECT * FROM api_keys ORDER BY created_at",
    );
    stmtGetKeyById = db.prepare<ApiKeyRow>(
      "SELECT * FROM api_keys WHERE id = ?",
    );
    stmtValidateKey = db.prepare<JsonRecord>(
      "SELECT 1 FROM api_keys WHERE key = ?",
    );
    stmtGetKeyMetadata = db.prepare<ApiKeyRow>(
      "SELECT id, name, machine_id, allowed_models, allowed_connections, no_log, auto_resolve, is_active, access_schedule, max_requests_per_day, max_requests_per_minute, max_sessions FROM api_keys WHERE key = ?",
    );
    stmtInsertKey = db.prepare(
      "INSERT INTO api_keys (id, name, key, machine_id, allowed_models, no_log, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    stmtDeleteKey = db.prepare("DELETE FROM api_keys WHERE id = ?");
  }

  if (
    !stmtGetAllKeys ||
    !stmtGetKeyById ||
    !stmtValidateKey ||
    !stmtGetKeyMetadata ||
    !stmtInsertKey ||
    !stmtDeleteKey
  ) {
    throw new Error("Failed to initialize API key prepared statements");
  }

  return {
    getAllKeys: stmtGetAllKeys,
    getKeyById: stmtGetKeyById,
    validateKey: stmtValidateKey,
    getKeyMetadata: stmtGetKeyMetadata,
    insertKey: stmtInsertKey,
    deleteKey: stmtDeleteKey,
  };
}

export function clearPreparedStatementCache() {
  stmtGetAllKeys = null;
  stmtGetKeyById = null;
  stmtValidateKey = null;
  stmtGetKeyMetadata = null;
  stmtInsertKey = null;
  stmtDeleteKey = null;
  schemaChecked = false;
}

function ensureApiKeysColumns(db: ApiKeysDbLike) {
  if (schemaChecked) return;

  try {
    const columns = db.prepare<ApiKeyRow>("PRAGMA table_info(api_keys)").all();
    const columnNames = new Set(
      columns.map((column) => String(column.name ?? "")),
    );
    addColumnIfMissing(
      db,
      columnNames,
      "allowed_models",
      "ALTER TABLE api_keys ADD COLUMN allowed_models TEXT",
    );
    addColumnIfMissing(
      db,
      columnNames,
      "no_log",
      "ALTER TABLE api_keys ADD COLUMN no_log INTEGER NOT NULL DEFAULT 0",
    );
    addColumnIfMissing(
      db,
      columnNames,
      "allowed_connections",
      "ALTER TABLE api_keys ADD COLUMN allowed_connections TEXT",
    );
    addColumnIfMissing(
      db,
      columnNames,
      "auto_resolve",
      "ALTER TABLE api_keys ADD COLUMN auto_resolve INTEGER NOT NULL DEFAULT 0",
    );
    addColumnIfMissing(
      db,
      columnNames,
      "is_active",
      "ALTER TABLE api_keys ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1",
    );
    addColumnIfMissing(
      db,
      columnNames,
      "access_schedule",
      "ALTER TABLE api_keys ADD COLUMN access_schedule TEXT",
    );
    addColumnIfMissing(
      db,
      columnNames,
      "max_requests_per_day",
      "ALTER TABLE api_keys ADD COLUMN max_requests_per_day INTEGER",
    );
    addColumnIfMissing(
      db,
      columnNames,
      "max_requests_per_minute",
      "ALTER TABLE api_keys ADD COLUMN max_requests_per_minute INTEGER",
    );
    addColumnIfMissing(
      db,
      columnNames,
      "max_sessions",
      "ALTER TABLE api_keys ADD COLUMN max_sessions INTEGER NOT NULL DEFAULT 0",
    );
    schemaChecked = true;
  } catch (error: unknown) {
    const err = asErrorLike(error);
    const message = error instanceof Error ? err.message : String(error);
    console.warn("[DB] Failed to verify api_keys schema:", message);
  }
}

function addColumnIfMissing(
  db: ApiKeysDbLike,
  columnNames: Set<string>,
  columnName: string,
  sql: string,
) {
  if (columnNames.has(columnName)) return;
  db.exec(sql);
  console.log(`[DB] Added api_keys.${columnName} column`);
}
