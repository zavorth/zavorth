import type { SqliteDatabase } from "./coreTypes";

declare global {
  let __ZavorthGatewayDb: SqliteDatabase | undefined;
}

export function getLegacyStoredDb(): SqliteDatabase | null {
  return globalThis.__ZavorthGatewayDb ?? null;
}

export function setLegacyStoredDb(db: SqliteDatabase): void {
  globalThis.__ZavorthGatewayDb = db;
}

export function clearLegacyStoredDb(): void {
  delete globalThis.__ZavorthGatewayDb;
}
