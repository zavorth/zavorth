import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getSettings, updateSettings } from "@/lib/localDb";
import { updateResilienceSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../utils/errorLike';

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * GET /api/resilience — Get current resilience configuration and status
 */
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    // Dynamic imports for open-sse modules
    const { getAllCircuitBreakerStatuses } = await import("@/shared/utils/circuitBreaker");
    const { getAllRateLimitStatus } = await import("@zavorth/ai-gateway/open-sse/services/rateLimitManager");
    const { PROVIDER_PROFILES, DEFAULT_API_LIMITS } =
      await import("@zavorth/ai-gateway/open-sse/config/constants");

    const settings = await getSettings();
    const circuitBreakers = getAllCircuitBreakerStatuses();
    const rateLimitStatus = getAllRateLimitStatus();

    return NextResponse.json({
      profiles: settings.providerProfiles || PROVIDER_PROFILES,
      defaults: {
        ...DEFAULT_API_LIMITS,
        ...asRecord(settings.rateLimitDefaults),
      },
      circuitBreakers,
      rateLimitStatus,
    });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    console.error("[API] GET /api/resilience error:", err);
    return NextResponse.json(
      { error: getErrorMessage(err, "Failed to load resilience status") },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/resilience — Update provider resilience profiles and/or rate limit defaults
 */
export async function PATCH(request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (error: unknown) {logger.warn('[route] load operation failed', error);
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
    const validation = validateBody(updateResilienceSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { profiles, defaults } = validation.data;

    const updates: Record<string, any> = {};
    if (profiles) updates.providerProfiles = profiles;
    if (defaults) updates.rateLimitDefaults = defaults;

    await updateSettings(updates);

    return NextResponse.json({
      ok: true,
      ...(profiles ? { profiles } : {}),
      ...(defaults ? { defaults } : {}),
    });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    console.error("[API] PATCH /api/resilience error:", err);
    return NextResponse.json(
      { error: getErrorMessage(err, "Failed to save resilience settings") },
      { status: 500 }
    );
  }
}
