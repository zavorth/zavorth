import { NextResponse } from "next/server";
import { getDbInstance, SQLITE_FILE } from "@/lib/db/core";
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "node:child_process";
import { requireStrictManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  sanitizeSqliteBackupFile,
  shouldIncludeSensitiveDatabaseExport,
} from "@/lib/db/backupSanitizer";
import { redactExportedLogValue } from "@/lib/logExportRedaction";
import { logger } from '@/shared/utils/logger';

/**
 * GET /api/db-backups/exportAll
 * Exports the entire database + settings as a ZIP archive
 */
export async function GET(request: Request) {
  const authError = await requireStrictManagementAuth(request);
  if (authError) return authError;

  try {
    if (!SQLITE_FILE) {
      return NextResponse.json(
        { error: "Export is only available in local (non-cloud) mode" },
        { status: 400 }
      );
    }

    const db = getDbInstance();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const includeSensitive = shouldIncludeSensitiveDatabaseExport(request.url);
    const tempDir = path.join(os.tmpdir(), `ZavorthGateway-export-${timestamp}`);
    const zipPath = path.join(os.tmpdir(), `ZavorthGateway-full-backup-${timestamp}.zip`);

    try {
      // Create temp directory
      fs.mkdirSync(tempDir, { recursive: true });

      // 1. Export database using native backup API
      const dbBackupPath = path.join(tempDir, includeSensitive ? "storage.sqlite" : "storage.safe.sqlite");
      await db.backup(dbBackupPath);
      const sanitizerReport = includeSensitive ? null : sanitizeSqliteBackupFile(dbBackupPath);

      // 2. Export settings as JSON
      const settings: Record<string, string> = {};
      try {
        const rows = db.prepare("SELECT key, value FROM key_value").all() as {
          key: string;
          value: string;
        }[];
        for (const row of rows) {
          settings[row.key] = row.value;
        }
      } catch (error: any) { const err = error; const e = error;
      // key_value table might not exist
      logger.warn('[route] operation failed', error);
    }
      fs.writeFileSync(path.join(tempDir, "settings.json"), JSON.stringify(redactExportedLogValue(settings), null, 2));

      // 3. Export combos summary
      const combos: unknown[] = [];
      try {
        const rows = db.prepare("SELECT * FROM combos").all();
        combos.push(...rows);
      } catch (error: any) { const err = error; const e = error;
      // combos table might not exist
      logger.warn('[route] filesystem operation failed', error);
    }
      fs.writeFileSync(path.join(tempDir, "combos.json"), JSON.stringify(redactExportedLogValue(combos), null, 2));

      // 4. Export provider connections (without sensitive credentials)
      const providers: unknown[] = [];
      try {
        const rows = db
          .prepare(
            "SELECT id, provider, name, auth_type, is_active, email, created_at FROM provider_connections"
          )
          .all();
        providers.push(...rows);
      } catch (error: any) { const err = error; const e = error;
      // provider_connections table might not exist
      logger.warn('[route] connection failed', error);
    }
      fs.writeFileSync(path.join(tempDir, "providers.json"), JSON.stringify(providers, null, 2));

      // 5. Export API keys summary (masked)
      const apiKeys: unknown[] = [];
      try {
        const rows = db
          .prepare(
            "SELECT id, name, substr(key, 1, 8) as prefix, machine_id, created_at FROM api_keys"
          )
          .all();
        apiKeys.push(...rows);
      } catch (error: any) { const err = error; const e = error;
      // api_keys table might not exist
      logger.warn('[route] creation failed', error);
    }
      fs.writeFileSync(path.join(tempDir, "api-keys.json"), JSON.stringify(apiKeys, null, 2));

      // 6. Export metadata
      const metadata = {
        exportedAt: new Date().toISOString(),
        version: process.env.npm_package_version || "unknown",
        format: "ZavorthGateway-full-backup-v1",
        sanitized: !includeSensitive,
        rawSecretsIncluded: includeSensitive,
        sanitizedTables: sanitizerReport?.tablesTouched || [],
        contents: [
          includeSensitive
            ? "storage.sqlite - Full raw database including local secrets"
            : "storage.safe.sqlite - Database with secrets redacted",
          "settings.json - Key-value settings (redacted)",
          "combos.json - Combo configurations (redacted)",
          "providers.json - Provider connections (no credentials)",
          "api-keys.json - API key metadata (masked)",
        ],
      };
      fs.writeFileSync(path.join(tempDir, "metadata.json"), JSON.stringify(metadata, null, 2));

      // Create ZIP using tar (available on all Linux/macOS, and the archiver npm package is not installed)
      // We'll use Node.js built-in zlib to create a simple tar.gz instead
      const tarPath = zipPath.replace(".zip", ".tar.gz");
      execFileSync("tar", ["-czf", tarPath, "-C", path.dirname(tempDir), path.basename(tempDir)], {
        timeout: 30000,
      });

      // Read the archive
      const archiveBuffer = fs.readFileSync(tarPath);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
      fs.unlinkSync(tarPath);

      return new NextResponse(archiveBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/gzip",
          "Content-Disposition": `attachment; filename="ZavorthGateway-${includeSensitive ? "raw-sensitive" : "safe"}-full-backup-${timestamp}.tar.gz"`,
          "Content-Length": archiveBuffer.length.toString(),
          "X-Zavorth-Backup-Sanitized": includeSensitive ? "false" : "true",
          "X-Zavorth-Raw-Secrets-Included": includeSensitive ? "true" : "false",
        },
      });
    } catch (innerError: any) { const error = innerError; const err = innerError; const e = innerError;
      // Cleanup on error
      try {
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      } catch (error: any) { const err = error; const e = error; /* ignore cleanup errors */ logger.warn('[route] file cleanup failed', error); }
      throw innerError;
    }
  } catch (error: any) { const err = error; const e = error;
    console.error("[ExportAll] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to create full export",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
