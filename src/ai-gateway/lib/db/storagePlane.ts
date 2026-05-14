import type { SqliteDatabase } from "./core/coreTypes";

export const ZAVORTH_KEY_VALUE_NAMESPACES = {
  settings: "settings",
  modelAliases: "modelAliases",
  mitmAlias: "mitmAlias",
  pricing: "pricing",
  customModels: "customModels",
  proxyConfig: "proxyConfig",
} as const;

export const ZAVORTH_STORAGE_PLANE = {
  id: "zavorth-gateway-storage",
  schemaVersion: 1,
  migrationLedgerTable: "_zavorth_migrations",
  legacyMigrationLedgerTables: ["_ZavorthGateway_migrations"],
  settingsExportVersion: "zavorth-v1-settings-export",
  settingsBackupFilePrefix: "zavorth-settings-backup",
  keyValueNamespaces: ZAVORTH_KEY_VALUE_NAMESPACES,
} as const;

type MigrationRow = { version: string; name: string; applied_at: string };
type SqliteTableColumn = { name?: string };

function quoteSqlIdentifier(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQLite identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function getColumnNames(db: SqliteDatabase, tableName: string): Set<string> {
  const table = quoteSqlIdentifier(tableName);
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as SqliteTableColumn[];
  return new Set(rows.map((row) => String(row.name ?? "")));
}

function tableExists(db: SqliteDatabase, tableName: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(tableName);
  return Boolean(row);
}

function createLedgerTableSql(tableName: string): string {
  const table = quoteSqlIdentifier(tableName);
  return `
    CREATE TABLE IF NOT EXISTS ${table} (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `;
}

function copyLegacyLedgerRows(db: SqliteDatabase, legacyTableName: string): void {
  if (!tableExists(db, legacyTableName)) {
    return;
  }

  const legacyTable = quoteSqlIdentifier(legacyTableName);
  const canonicalTable = quoteSqlIdentifier(ZAVORTH_STORAGE_PLANE.migrationLedgerTable);
  const legacyColumns = getColumnNames(db, legacyTableName);
  const nameExpr = legacyColumns.has("name") ? "name" : "version";
  const appliedAtExpr = legacyColumns.has("applied_at") ? "applied_at" : "datetime('now')";

  db.exec(`
    INSERT OR IGNORE INTO ${canonicalTable} (version, name, applied_at)
    SELECT
      CAST(version AS TEXT),
      COALESCE(CAST(${nameExpr} AS TEXT), CAST(version AS TEXT)),
      COALESCE(CAST(${appliedAtExpr} AS TEXT), datetime('now'))
    FROM ${legacyTable}
    WHERE version IS NOT NULL;
  `);
}

export function ensureZavorthMigrationLedger(db: SqliteDatabase): void {
  db.exec(createLedgerTableSql(ZAVORTH_STORAGE_PLANE.migrationLedgerTable));

  for (const legacyTable of ZAVORTH_STORAGE_PLANE.legacyMigrationLedgerTables) {
    copyLegacyLedgerRows(db, legacyTable);
  }
}

export function getAppliedZavorthMigrations(db: SqliteDatabase): Set<string> {
  ensureZavorthMigrationLedger(db);

  const table = quoteSqlIdentifier(ZAVORTH_STORAGE_PLANE.migrationLedgerTable);
  const rows = db.prepare(`SELECT version FROM ${table}`).all() as Array<{ version: string }>;
  return new Set(rows.map((row) => row.version));
}

export function getZavorthMigrationRows(db: SqliteDatabase): MigrationRow[] {
  ensureZavorthMigrationLedger(db);

  const table = quoteSqlIdentifier(ZAVORTH_STORAGE_PLANE.migrationLedgerTable);
  return db
    .prepare(`SELECT version, name, applied_at FROM ${table} ORDER BY version`)
    .all() as MigrationRow[];
}

export function recordZavorthMigration(
  db: SqliteDatabase,
  version: string,
  name: string
): void {
  ensureZavorthMigrationLedger(db);

  const table = quoteSqlIdentifier(ZAVORTH_STORAGE_PLANE.migrationLedgerTable);
  db.prepare(`INSERT OR IGNORE INTO ${table} (version, name) VALUES (?, ?)`).run(version, name);
}
