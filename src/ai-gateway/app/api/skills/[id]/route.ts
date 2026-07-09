import { NextResponse } from "next/server";
import { getDbInstance } from "@/lib/db/core";
import { skillRegistry } from "@/lib/skills/registry";
import { z } from "zod";
import { validateBody, isValidationFailure } from "@/shared/validation/helpers";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';

const updateSkillSchema = z.object({
  enabled: z.boolean(),
});

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { id } = await props.params;
    const deleted = await skillRegistry.unregisterById(id);
    if (!deleted) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) { const err = error; const e = error;
    logger.warn('[route] delete operation failed', error);
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 500 });
  }
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { id } = await props.params;
    const rawBody = await request.json();
    const validation = validateBody(updateSkillSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json(validation.error, { status: 400 });
    }

    const db = getDbInstance();
    db.prepare("UPDATE skills SET enabled = ? WHERE id = ?").run(
      validation.data.enabled ? 1 : 0,
      id
    );

    await skillRegistry.loadFromDatabase();

    return NextResponse.json({ success: true, enabled: validation.data.enabled });
  } catch (error: any) { const err = error; const e = error;
    logger.warn('[route] load operation failed', error);
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
