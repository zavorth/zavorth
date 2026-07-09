import fs from "fs";
import path from "path";
import { resolveDataDir } from "../../dataPaths";
import { asErrorLike } from '../../../../utils/errorLike.js';

export const isCloud = typeof globalThis.caches === "object" && globalThis.caches !== null;
export const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

export const DATA_DIR = resolveDataDir({ isCloud });
export const SQLITE_FILE = isCloud ? null : path.join(DATA_DIR, "storage.sqlite");
export const JSON_DB_FILE = isCloud ? null : path.join(DATA_DIR, "db.json");
export const DB_BACKUPS_DIR = isCloud ? null : path.join(DATA_DIR, "db_backups");

function ensureDataDirectory(): void {
  if (isCloud || fs.existsSync(DATA_DIR)) {
    return;
  }

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (error: unknown) {
 const err = asErrorLike(error); const message = error instanceof Error ? err.message : String(error);
    console.warn(
        `[DB] Cannot create data directory '${DATA_DIR}': ${message}\n` +
        "[DB] Set the DATA_DIR environment variable to a writable path, e.g.:\n" +
        "[DB]   DATA_DIR=/path/to/writable/dir zavorth"
    );
  }
}

ensureDataDirectory();
