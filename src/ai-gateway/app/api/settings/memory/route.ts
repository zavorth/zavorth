import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSettings, updateSettings } from "@/lib/localDb";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { logger } from '@/shared/utils/logger';
import {
invalidateMemorySettingsCache,
  normalizeMemorySettings,
  toMemorySettingsUpdates,
} from "@/lib/memory/settings";

const memorySettingsUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    maxTokens: z.number().int().min(0).max(16000).optional(),
    retentionDays: z.number().int().min(1).max(365).optional(),
    strategy: z.enum(["recent", "semantic", "hybrid"]).optional(),
    skillsEnabled: z.boolean().optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const settings = (await getSettings()) as Record<string, unknown>;
    return NextResponse.json(normalizeMemorySettings(settings));
  } catch (error: any) { const err = error; const e = error;
    logger.warn('[route] string operation failed', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch (error: any) { const err = error; const e = error;
    logger.warn('[route] filesystem check failed', error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

    const validation = validateBody(memorySettingsUpdateSchema, rawBody);
    if (isValidationFailure(validation)) {
      return validation.response;
    }

    const updates = toMemorySettingsUpdates(validation.data);
    const settings = (await updateSettings(updates)) as Record<string, unknown>;
    invalidateMemorySettingsCache();

    return NextResponse.json(normalizeMemorySettings(settings));
  } catch (error: any) { const err = error; const e = error;
    logger.warn('[route] cache operation failed', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
