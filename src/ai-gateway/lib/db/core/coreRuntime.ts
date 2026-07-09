import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { runMigrations } from "../migrationRunner";
import {
  DATA_DIR,
  JSON_DB_FILE,
  SQLITE_FILE,
  isBuildPhase,
  isCloud,
} from "./coreEnvironment";
import { migrateFromJson } from "./coreJsonMigration";
import {
  bootstrapCoreSchema,
  bootstrapMigrationLedger,
  persistSchemaVersion,
} from "./coreSchemaBootstrap";
import type { CheckpointMode, SqliteDatabase } from "./coreTypes";
import { logger } from '@/shared/utils/logger';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createMemoryDb(): SqliteDatabase {
  if (isBuildPhase) {
    console.log("[DB] Build phase detected - using in-memory SQLite (read-only)");
  }

  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  bootstrapCoreSchema(db);
  return db;
}

function prepareExistingSqliteFile(sqliteFile: string): void {
  if (!fs.existsSync(sqliteFile)) {
    return;
  }

  try {
    const probe = new Database(sqliteFile, { readonly: true });
    const hasOldSchema = probe
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
      .get();

    if (!hasOldSchema) {
      probe.close();
      return;
    }

    let hasData = false;
    try {
      const count = probe.prepare("SELECT COUNT(*) as c FROM provider_connections").get() as
        | { c: number }
        | undefined;
      hasData = Boolean(count && count.c > 0);
    } catch (error: any) { const err = error; const e = error;
    logger.warn('[core Runtime] resource cleanup failed', error);
    hasData = false;
  }
    probe.close();

    if (hasData) {
      console.log("[DB] Old schema_migrations table found but data exists - preserving data (#146)");
      const fixDb = new Database(sqliteFile);
      try {
        fixDb.exec("DROP TABLE IF EXISTS schema_migrations");
        fixDb.pragma("wal_checkpoint(TRUNCATE)");
      } catch (error: any) { const err = error; const e = error;
        console.warn("[DB] Could not clean up old schema table:", getErrorMessage(error));
      } finally {
        fixDb.close();
      }
      return;
    }

    const oldPath = `${sqliteFile}.old-schema`;
    console.log(
      `[DB] Old incompatible schema detected (empty) - renaming to ${path.basename(oldPath)}`
    );
    fs.renameSync(sqliteFile, oldPath);
    for (const ext of ["-wal", "-shm"]) {
      try {
        if (fs.existsSync(sqliteFile + ext)) {
          fs.unlinkSync(sqliteFile + ext);
        }
      } catch (error: any) { const err = error; const e = error;
      // Ignore stale sidecar cleanup failures.
      logger.warn('[core Runtime] file cleanup failed', error);
    }
    }
  } catch (error: any) { const err = error; const e = error;
    console.warn("[DB] Could not probe existing DB, will create fresh:", getErrorMessage(error));
    try {
      fs.unlinkSync(sqliteFile);
    } catch (error: any) { const err = error; const e = error;
      // Ignore best-effort cleanup failures.
      logger.warn('[core Runtime] file cleanup failed', error);
    }
  }
}

function createLocalDb(sqliteFile: string, jsonDbFile: string | null): SqliteDatabase {
  prepareExistingSqliteFile(sqliteFile);

  const db = new Database(sqliteFile);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");

  bootstrapCoreSchema(db);
  bootstrapMigrationLedger(db);
  runMigrations(db);

  if (jsonDbFile && fs.existsSync(jsonDbFile)) {
    migrateFromJson(db, jsonDbFile, { dataDir: DATA_DIR });
  }

  persistSchemaVersion(db);
  console.log(`[DB] SQLite database ready: ${sqliteFile}`);
  return db;
}

export function createDbInstance(): SqliteDatabase {
  if (isCloud || isBuildPhase) {
    return createMemoryDb();
  }

  if (!SQLITE_FILE) {
    throw new Error("SQLITE_FILE is unavailable for local mode");
  }

  return createLocalDb(SQLITE_FILE, JSON_DB_FILE);
}

export function checkpointDb(
  db: SqliteDatabase,
  mode: CheckpointMode = "TRUNCATE"
): boolean {
  if (isCloud || isBuildPhase || !SQLITE_FILE) {
    return false;
  }

  db.pragma(`wal_checkpoint(${mode})`);
  return true;
}
