import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import os from "os";
import { getDbInstance, SQLITE_FILE } from "@/lib/db/core";
import { requireStrictManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';
import {
sanitizeSqliteBackupFile,
  shouldIncludeSensitiveDatabaseExport,
} from "@/lib/db/backupSanitizer";
import { asErrorLike } from '../../../../../utils/errorLike.js';

/**
 * GET /api/db-backups/export — Download the current database as a .sqlite file.
 *
 * Uses SQLite's native backup API to create a consistent snapshot,
 * then streams it as a downloadable attachment.
 *
 * 🔒 Auth-guarded: requires JWT cookie or Bearer API key (finding #258-2).
 */
export async function GET(request: Request) {
  const authError = await requireStrictManagementAuth(request);
  if (authError) return authError;

  try {
    if (!SQLITE_FILE || !fs.existsSync(SQLITE_FILE)) {
      return NextResponse.json({ error: "Database file not found" }, { status: 404 });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const includeSensitive = shouldIncludeSensitiveDatabaseExport(request.url);
    const exportFilename = `ZavorthGateway-${includeSensitive ? "raw-sensitive" : "safe"}-backup-${timestamp}.sqlite`;
    const tmpDir = os.tmpdir();
    const tmpPath = path.join(tmpDir, exportFilename);

    // Use native SQLite backup API for a consistent snapshot
    const db = getDbInstance();
    await db.backup(tmpPath);
    const sanitizerReport = includeSensitive ? null : sanitizeSqliteBackupFile(tmpPath);

    const fileBuffer = fs.readFileSync(tmpPath);

    // Cleanup temp file
    try {
      fs.unlinkSync(tmpPath);
    } catch (error: unknown) {/* best effort */ logger.warn('[route] file cleanup failed', error); }

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${exportFilename}"`,
        "Content-Length": String(fileBuffer.length),
        "Cache-Control": "no-cache, no-store",
        "X-Zavorth-Backup-Sanitized": includeSensitive ? "false" : "true",
        "X-Zavorth-Raw-Secrets-Included": includeSensitive ? "true" : "false",
        ...(sanitizerReport
          ? { "X-Zavorth-Sanitized-Tables": sanitizerReport.tablesTouched.join(",") }
          : {}),
      },
    });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    console.error("[API] Error exporting database:", error);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
