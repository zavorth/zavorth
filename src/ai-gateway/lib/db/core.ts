import { cleanNulls, objToSnake, rowToCamel, toCamelCase, toSnakeCase } from "./core/coreRowMapping";

/**
 * db/core.ts - Database composition root for shared SQLite infrastructure.
 *
 * All domain modules import `getDbInstance` and helpers from here.
 */

import {
  DATA_DIR,
  DB_BACKUPS_DIR,
  SQLITE_FILE,
  isBuildPhase,
  isCloud,
} from "./core/coreEnvironment";

import { checkpointDb, createDbInstance } from "./core/coreRuntime";
import { getStoredDb, setStoredDb } from "./core/coreSingleton";
import type { CheckpointMode, SqliteDatabase } from "./core/coreTypes";
import { asErrorLike } from '../../../utils/errorLike.js';

export { DATA_DIR, DB_BACKUPS_DIR, SQLITE_FILE, isBuildPhase, isCloud };
export { cleanNulls, objToSnake, rowToCamel, toCamelCase, toSnakeCase };

export function getDbInstance(): SqliteDatabase {
  const existing = getStoredDb();
  if (existing) {
    return existing;
  }

  const db = createDbInstance();
  setStoredDb(db);
  return db;
}

export function closeDbInstance(options?: { checkpointMode?: CheckpointMode | null }): boolean {
  const db = getStoredDb();
  if (!db) {
    return false;
  }

  const checkpointMode = options?.checkpointMode ?? "TRUNCATE";

  try {
    if (checkpointMode) {
      try {
        if (checkpointDb(db, checkpointMode)) {
          console.log(`[DB] SQLite WAL checkpoint completed (${checkpointMode}).`);
        }
      } catch (error: unknown) {
        const err = asErrorLike(error);
        const message = error instanceof Error ? err.message : String(error);
        console.warn(`[DB] WAL checkpoint failed during close (${checkpointMode}):`, message);
      }
    }
  } finally {
    try {
      if (db.open) {
        db.close();
      }
    } finally {
      setStoredDb(null);
    }
  }

  return true;
}

export function resetDbInstance(): void {
  closeDbInstance();
}
