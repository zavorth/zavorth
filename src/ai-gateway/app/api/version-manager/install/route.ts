import { NextResponse } from "next/server";

"use server";

import { installTool } from "@/lib/versionManager";
import { versionManagerInstallSchema } from "@/shared/validation/schemas";
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

  const validation = validateBody(versionManagerInstallSchema, rawBody);
  if (isValidationFailure(validation)) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const { tool, version } = validation.data;
    const result = await installTool(tool, version || undefined);
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    const message = error instanceof Error ? err.message : "Installation failed";
    console.error("[version-manager] install error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
