import { NextResponse } from "next/server";
import { requireStrictManagementAuth } from "@/lib/api/requireManagementAuth";
import { listDbBackups, restoreDbBackup, backupDbFile } from "@/lib/localDb";
import { dbBackupRestoreSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { logger } from '@/shared/utils/logger';

/**
 * PUT /api/db-backups — Trigger a manual backup snapshot.
 */
export async function PUT(request: Request) {
  const authError = await requireStrictManagementAuth(request);
  if (authError) return authError;

  try {
    const result = backupDbFile("manual");
    if (!result) {
      return NextResponse.json({ message: "No changes since last backup (throttled)" });
    }
    return NextResponse.json({ created: true, ...result });
  } catch (error: any) { const err = error; const e = error;
    console.error("[API] Error creating manual backup:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/db-backups — List available database backups.
 */
export async function GET(request: Request) {
  const authError = await requireStrictManagementAuth(request);
  if (authError) return authError;

  try {
    const backups = await listDbBackups();
    return NextResponse.json({ backups });
  } catch (error: any) { const err = error; const e = error;
    console.error("[API] Error listing DB backups:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/db-backups — Restore a specific backup.
 * Body: { backupId: "db_2026-02-11T14-00-00-000Z_pre-write.json" }
 */
export async function POST(request) {
  const authError = await requireStrictManagementAuth(request);
  if (authError) return authError;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (error: any) { const err = error; const e = error;
    logger.warn('[route] filesystem check failed', error);
    return NextResponse.json(
      {
        error: {
          message: "Invalid request",
          details: [{ field: "body", message: "Invalid JSON body" }],
        },
      },
      { status: 400 }
    );
  }

  try {
    const validation = validateBody(dbBackupRestoreSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { backupId } = validation.data;

    const result = await restoreDbBackup(backupId);
    return NextResponse.json(result);
  } catch (error: any) { const err = error; const e = error;
    console.error("[API] Error restoring DB backup:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
