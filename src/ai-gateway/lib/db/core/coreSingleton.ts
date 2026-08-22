import type { SqliteDatabase } from "./coreTypes";
import {
  clearLegacyStoredDb,
  getLegacyStoredDb,
  setLegacyStoredDb,
} from "./legacyDbSingletonCompat";

declare global {
  let __ZavorthDb: SqliteDatabase | undefined;
}

export function getStoredDb(): SqliteDatabase | null {
  return globalThis.__ZavorthDb ?? getLegacyStoredDb();
}

export function setStoredDb(db: SqliteDatabase | null): void {
  if (db) {
    globalThis.__ZavorthDb = db;
    setLegacyStoredDb(db);
    return;
  }

  delete globalThis.__ZavorthDb;
  clearLegacyStoredDb();
}
