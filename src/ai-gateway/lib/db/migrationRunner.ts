import { asErrorLike } from '../../../utils/errorLike';
/**
 * Migration Runner — Versioned SQL Migrations for SQLite
 *
 * Reads numbered `.sql` files from the migrations directory and applies
 * them sequentially, tracking applied versions in the Zavorth storage ledger.
 *
 * Naming convention: `NNN_description.sql` (e.g., `001_initial_schema.sql`)
 *
 * All migrations run within a single transaction — all-or-nothing per file.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type Database from "better-sqlite3";
import { logger } from '@/shared/utils/logger';
import {
ensureZavorthMigrationLedger,
  getAppliedZavorthMigrations,
  getZavorthMigrationRows,
  recordZavorthMigration,
} from "./storagePlane";

/**
 * Resolve the migrations directory path safely across platforms.
 * On Windows with global npm installs, `import.meta.url` may not be a valid
 * `file://` URL, causing `fileURLToPath` to throw `ERR_INVALID_FILE_URL_PATH`.
 */
function resolveMigrationsDir(): string {
  try {
    const metaUrl = import.meta.url;
    if (metaUrl && metaUrl.startsWith("file://")) {
      const __filename = fileURLToPath(metaUrl);
      return path.join(path.dirname(__filename), "migrations");
    }
  } catch (error: unknown) { // fileURLToPath failed (e.g. Windows global install) — use fallback
      logger.warn('[migration Runner] lifecycle operation failed', error);
    }
  // Fallback: resolve relative to cwd (dev monorepo + packaged layouts)
  const candidates = [
    path.join(process.cwd(), "src", "ai-gateway", "lib", "db", "migrations"),
    path.join(process.cwd(), "src", "lib", "db", "migrations"),
    path.join(process.cwd(), "dist", "ai-gateway", "lib", "db", "migrations"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

const MIGRATIONS_DIR = resolveMigrationsDir();

function ensureMigrationsTable(db: Database.Database): void {
  ensureZavorthMigrationLedger(db);
}

/**
 * Get all migration files sorted by version number.
 */
function getMigrationFiles(): Array<{ version: string; name: string; path: string }> {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((filename) => {
      const match = filename.match(/^(\d+)_(.+)\.sql$/);
      if (!match) return null;
      return {
        version: match[1],
        name: match[2],
        path: path.join(MIGRATIONS_DIR, filename),
      };
    })
    .filter(Boolean) as Array<{ version: string; name: string; path: string }>;
}

/**
 * Get list of already-applied migration versions.
 */
function getAppliedVersions(db: Database.Database): Set<string> {
  return getAppliedZavorthMigrations(db);
}

/**
 * Run all pending migrations in order.
 * Returns the number of migrations applied.
 */
export function runMigrations(db: Database.Database): number {
  ensureMigrationsTable(db);

  const files = getMigrationFiles();
  const applied = getAppliedVersions(db);
  let count = 0;

  for (const migration of files) {
    if (applied.has(migration.version)) continue;

    const sql = fs.readFileSync(migration.path, "utf-8");

    const applyMigration = db.transaction(() => {
      db.exec(sql);
      recordZavorthMigration(db, migration.version, migration.name);
    });

    try {
      applyMigration();
      count++;
      console.log(`[Migration] Applied: ${migration.version}_${migration.name}`);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Migration] FAILED: ${migration.version}_${migration.name} — ${message}`);
      throw err; // Re-throw to prevent DB from starting in inconsistent state
    }
  }

  if (count > 0) {
    console.log(`[Migration] ${count} migration(s) applied successfully.`);
  }

  return count;
}

/**
 * Get migration status for diagnostics.
 */
export function getMigrationStatus(db: Database.Database): {
  applied: Array<{ version: string; name: string; applied_at: string }>;
  pending: Array<{ version: string; name: string }>;
} {
  ensureMigrationsTable(db);

  const appliedRows = getZavorthMigrationRows(db);

  const appliedVersions = new Set(appliedRows.map((r) => r.version));
  const allFiles = getMigrationFiles();
  const pending = allFiles.filter((f) => !appliedVersions.has(f.version));

  return { applied: appliedRows, pending };
}
