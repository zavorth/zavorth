import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { resolveDataDir } from "@/lib/dataPaths";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';
import {
getAppLogRetentionDays,
  getCallLogRetentionDays,
  getCallLogsTableMaxRows,
  getProxyLogsTableMaxRows,
} from "@/lib/logEnv";

/**
 * GET /api/storage/health — Return database storage information.
 * Provides: driver, dbPath, sizeBytes, lastBackupAt, retentionDays
 */
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const dataDir = resolveDataDir({});
    const dbFilePath = path.join(dataDir, "storage.sqlite");
    const backupsDir = path.join(dataDir, "db_backups");

    // Get DB file size
    let sizeBytes = 0;
    try {
      if (fs.existsSync(dbFilePath)) {
        const stat = fs.statSync(dbFilePath);
        sizeBytes = stat.size;
      }
    } catch (error: any) { const err = error; const e = error; /* ignore */ logger.warn('[route] filesystem operation failed', error); }

    // Get last backup info
    let lastBackupAt = null;
    let backupCount = 0;
    try {
      if (fs.existsSync(backupsDir)) {
        const files = fs
          .readdirSync(backupsDir)
          .filter((f) => f.startsWith("db_") && f.endsWith(".sqlite"))
          .sort()
          .reverse();
        backupCount = files.length;
        if (files.length > 0) {
          const latestStat = fs.statSync(path.join(backupsDir, files[0]));
          lastBackupAt = latestStat.mtime.toISOString();
        }
      }
    } catch (error: any) { const err = error; const e = error; /* ignore */ logger.warn('[route] filesystem operation failed', error); }

    // Get the display path (abbreviated with ~)
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    const displayPath = dbFilePath.startsWith(homeDir)
      ? "~" + dbFilePath.slice(homeDir.length)
      : dbFilePath;

    return NextResponse.json({
      driver: "sqlite",
      dbPath: displayPath,
      sizeBytes,
      lastBackupAt,
      backupCount,
      retentionDays: {
        app: getAppLogRetentionDays(),
        call: getCallLogRetentionDays(),
      },
      tableMaxRows: {
        callLogs: getCallLogsTableMaxRows(),
        proxyLogs: getProxyLogsTableMaxRows(),
      },
      dataDir: dataDir.startsWith(homeDir) ? "~" + dataDir.slice(homeDir.length) : dataDir,
    });
  } catch (error: any) { const err = error; const e = error;
    console.error("[API] Error getting storage health:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
