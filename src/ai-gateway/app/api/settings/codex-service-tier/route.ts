import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/localDb";
import { setDefaultFastServiceTierEnabled } from "@ZavorthGateway/open-sse/executors/codex.ts";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { updateCodexServiceTierSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { logger } from '@/shared/utils/logger';export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const settings = await getSettings();
    const persisted =
      typeof settings.codexServiceTier === "string"
        ? JSON.parse(settings.codexServiceTier)
        : settings.codexServiceTier;

    return NextResponse.json({
      enabled: typeof persisted?.enabled === "boolean" ? persisted.enabled : false,
    });
  } catch (error: unknown) {console.error("[API ERROR] /api/settings/codex-service-tier GET:", error);
    return NextResponse.json({ error: "Failed to get config" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (error: unknown) {logger.warn('[route] filesystem check failed', error);
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
    const validation = validateBody(updateCodexServiceTierSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const config = validation.data;
    await updateSettings({ codexServiceTier: config });
    setDefaultFastServiceTierEnabled(config.enabled);

    return NextResponse.json(config);
  } catch (error: unknown) {console.error("[API ERROR] /api/settings/codex-service-tier PUT:", error);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}
