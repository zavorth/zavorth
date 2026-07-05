import { NextResponse } from "next/server";
import { getDbInstance } from "@/lib/db/core";
import { backupDbFile } from "@/lib/db/backup";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  asZavorthSettingsBackup,
  stripUnsafeAuthSettings,
  validateZavorthSettingsBackup,
  type ZavorthSettingsBackup,
} from "@/lib/db/jsonBackupAdapters";
import { runJsonMigration } from "@/lib/db/jsonMigration";
import { logger } from '@/shared/utils/logger';

/**
 * POST /api/settings/import-json
 *
 * Imports a Zavorth settings backup, or a supported compatibility backup,
 * into the current SQLite database. Accepts either multipart/form-data
 * (file field) or a raw JSON body.
 *
 * Auth-guarded.
 * Zero-Trust: password and requireLogin keys are stripped before insertion.
 * A pre-import backup is created automatically before any data is written.
 */
export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    let rawText: string | null = null;
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "No json file provided" }, { status: 400 });
      rawText = await file.text();
    } else {
      rawText = await request.text();
    }

    if (!rawText?.trim()) {
      return NextResponse.json({ error: "Empty request payload" }, { status: 400 });
    }

    // Parse with explicit 400 on malformed JSON.
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch (error) {
    logger.warn('[route] JSON parse failed', error);
    return NextResponse.json(
        { error: "Invalid JSON: the file could not be parsed. Please upload a valid .json backup." },
        { status: 400 }
      );
  }

    const validation = validateZavorthSettingsBackup(parsed);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    let data: ZavorthSettingsBackup = asZavorthSettingsBackup(validation.data);

    // Zero-Trust: strip authentication config before migration.
    data = stripUnsafeAuthSettings(data);

    const db = getDbInstance();

    // Create a safety backup before writing anything
    backupDbFile("pre-json-import");

    // Delegate the actual migration to the shared helper (avoids duplication with core.ts)
    const counts = runJsonMigration(db, data);

    console.log(
      `[JSON Import] Imported ${counts.connections} connections, ${counts.nodes} nodes, ` +
        `${counts.combos} combos, ${counts.apiKeys} API keys`
    );

    return NextResponse.json({
      success: true,
      message: "Settings backup imported successfully",
      ...counts,
    });
  } catch (err) {
    console.error("[API] Error importing JSON backup:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
