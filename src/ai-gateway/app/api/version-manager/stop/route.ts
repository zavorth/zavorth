import { NextResponse } from "next/server";

"use server";

import { stopTool } from "@/lib/versionManager";
import { versionManagerToolSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { requireStrictManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../../utils/errorLike.js';

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
    await stopTool(tool);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    const message = error instanceof Error ? err.message : "Failed to stop";
    console.error("[version-manager] stop error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
