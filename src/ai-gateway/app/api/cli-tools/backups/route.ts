"use server";

import { NextResponse } from "next/server";
import { requireStrictManagementAuth } from "@/lib/api/requireManagementAuth";
import { listBackups, restoreBackup, deleteBackup } from "@/shared/services/backupService";
import { ensureCliConfigWriteAllowed } from "@/shared/services/cliRuntime";
import { cliBackupMutationSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";

const VALID_TOOLS = ["claude", "codex", "droid", "external-executor", "cline", "kilo"];
const LEGACY_TOOL_ALIASES: Record<string, string> = {};
const BACKUP_TOOL_ALIASES: Record<string, string[]> = {};

const normalizeToolId = (tool: string) => LEGACY_TOOL_ALIASES[tool] || tool;
const isValidTool = (tool: string) => VALID_TOOLS.includes(normalizeToolId(tool));
const getBackupToolIds = (tool: string) => {
  const normalized = normalizeToolId(tool);
  return BACKUP_TOOL_ALIASES[normalized] || [normalized];
};

const listBackupsForTool = async (tool: string) => {
  const normalized = normalizeToolId(tool);
  const backups = await Promise.all(
    getBackupToolIds(tool).map(async (backupToolId) => {
      const entries = await listBackups(backupToolId);
      return entries.map((entry) => ({ ...entry, toolId: normalized }));
    })
  );
  return backups.flat();
};

const resolveBackupToolId = async (tool: string, backupId: string) => {
  const backupToolIds = getBackupToolIds(tool);
  for (const backupToolId of backupToolIds) {
    const backups = await listBackups(backupToolId);
    if (backups.some((backup) => backup.id === backupId)) {
      return backupToolId;
    }
  }
  return normalizeToolId(tool);
};

// GET /api/cli-tools/backups?tool=claude — list backups
export async function GET(request) {
  const authError = await requireStrictManagementAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const tool = searchParams.get("tool") || searchParams.get("toolId");

    if (tool && !isValidTool(tool)) {
      return NextResponse.json({ error: `Invalid tool: ${tool}` }, { status: 400 });
    }

    if (tool) {
      const normalizedTool = normalizeToolId(tool);
      const backups = await listBackupsForTool(tool);
      return NextResponse.json({ tool: normalizedTool, backups });
    }

    // List all tools
    const result = {};
    for (const t of VALID_TOOLS) {
      result[t] = await listBackupsForTool(t);
    }
    return NextResponse.json({ backups: result });
  } catch (error) {
    console.log("Error listing backups:", error.message);
    return NextResponse.json({ error: "Failed to list backups" }, { status: 500 });
  }
}

// POST /api/cli-tools/backups { tool, backupId } — restore a backup
export async function POST(request) {
  const authError = await requireStrictManagementAuth(request);
  if (authError) return authError;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch {
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
    const writeGuard = ensureCliConfigWriteAllowed();
    if (writeGuard) {
      return NextResponse.json({ error: writeGuard }, { status: 403 });
    }

    const validation = validateBody(cliBackupMutationSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const tool = validation.data.tool || validation.data.toolId;
    const { backupId } = validation.data;

    if (!isValidTool(tool)) {
      return NextResponse.json({ error: `Invalid tool: ${tool}` }, { status: 400 });
    }

    const normalizedTool = normalizeToolId(tool);
    const backupToolId = await resolveBackupToolId(tool, backupId);
    const result = await restoreBackup(backupToolId, backupId);
    return NextResponse.json({
      success: true,
      message: `Backup restored for ${normalizedTool}`,
      ...result,
    });
  } catch (error) {
    console.log("Error restoring backup:", error.message);
    return NextResponse.json(
      { error: error.message || "Failed to restore backup" },
      { status: 500 }
    );
  }
}

// DELETE /api/cli-tools/backups { tool, backupId } — delete a backup
export async function DELETE(request) {
  const authError = await requireStrictManagementAuth(request);
  if (authError) return authError;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch {
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
    const validation = validateBody(cliBackupMutationSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const tool = validation.data.tool || validation.data.toolId;
    const { backupId } = validation.data;

    if (!isValidTool(tool)) {
      return NextResponse.json({ error: `Invalid tool: ${tool}` }, { status: 400 });
    }

    const normalizedTool = normalizeToolId(tool);
    const backupToolId = await resolveBackupToolId(tool, backupId);
    const result = await deleteBackup(backupToolId, backupId);
    return NextResponse.json({
      success: true,
      message: `Backup deleted for ${normalizedTool}`,
      ...result,
    });
  } catch (error) {
    console.log("Error deleting backup:", error.message);
    return NextResponse.json({ error: "Failed to delete backup" }, { status: 500 });
  }
}
