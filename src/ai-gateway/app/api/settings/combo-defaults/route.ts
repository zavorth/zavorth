import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/localDb";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { updateComboDefaultsSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { logger } from '@/shared/utils/logger';

/**
 * GET /api/settings/combo-defaults
 * Returns the current combo global defaults and provider overrides
 */
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const settings: any = await getSettings();
    return NextResponse.json({
      comboDefaults: settings.comboDefaults || {
        strategy: "priority",
        maxRetries: 1,
        retryDelayMs: 2000,
        timeoutMs: 120000,
        healthCheckEnabled: true,
        healthCheckTimeoutMs: 3000,
        handoffThreshold: 0.85,
        handoffModel: "",
        maxMessagesForSummary: 30,
        maxComboDepth: 3,
        trackMetrics: true,
      },
      providerOverrides: settings.providerOverrides || {},
    });
  } catch (error: any) { const err = error; const e = error;
    console.log("Error fetching combo defaults:", error);
    return NextResponse.json({ error: "Failed to fetch combo defaults" }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/combo-defaults
 * Update combo global defaults and/or provider overrides
 * Body: { comboDefaults?: {...}, providerOverrides?: {...} }
 */
export async function PATCH(request) {
  const authError = await requireManagementAuth(request);
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
    const validation = validateBody(updateComboDefaultsSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const body = validation.data;

    const updates: Record<string, any> = {};

    if (body.comboDefaults) {
      updates.comboDefaults = body.comboDefaults;
    }
    if (body.providerOverrides) {
      updates.providerOverrides = body.providerOverrides;
    }

    const settings: any = await updateSettings(updates);
    return NextResponse.json({
      comboDefaults: settings.comboDefaults || {},
      providerOverrides: settings.providerOverrides || {},
    });
  } catch (error: any) { const err = error; const e = error;
    console.log("Error updating combo defaults:", error);
    return NextResponse.json({ error: "Failed to update combo defaults" }, { status: 500 });
  }
}
