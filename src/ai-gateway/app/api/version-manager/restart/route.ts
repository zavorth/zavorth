"use server";

import { NextResponse } from "next/server";
import { restartTool } from "@/lib/versionManager";
import { versionManagerToolSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { requireStrictManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';

export async function POST(request: Request) {
  const authError = await requireStrictManagementAuth(request);
  if (authError) return authError;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (error: unknown) {logger.warn('[route] validation failed', error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(versionManagerToolSchema, rawBody);
  if (isValidationFailure(validation)) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const { tool } = validation.data;
    const result = await restartTool(tool);
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to restart";
    console.error("[version-manager] restart error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
