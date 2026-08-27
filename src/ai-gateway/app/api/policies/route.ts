import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getAllCircuitBreakerStatuses } from "@/shared/utils/circuitBreaker";
import { getLockedIdentifiers, forceUnlock } from "@/domain/lockoutPolicy";
import { policyActionSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { logger } from '@/shared/utils/logger';export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const circuitBreakers = getAllCircuitBreakerStatuses();
    const lockedIdentifiers = getLockedIdentifiers();
    return NextResponse.json({ circuitBreakers, lockedIdentifiers });
  } catch (error: unknown) {logger.error("Error loading policies:", error);
    return NextResponse.json({ error: "Failed to load policies" }, { status: 500 });
  }
}

export async function POST(request) {
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
    const validation = validateBody(policyActionSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { action, identifier } = validation.data;

    if (action === "unlock" && identifier) {
      forceUnlock(identifier);
      return NextResponse.json({ success: true, action: "unlocked", identifier });
    }

    return NextResponse.json({ error: "Unknown action. Supported: unlock" }, { status: 400 });
  } catch (error: unknown) {logger.error("Error updating policies:", error);
    return NextResponse.json({ error: "Failed to update policies" }, { status: 500 });
  }
}
