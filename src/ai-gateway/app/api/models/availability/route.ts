import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  getAvailabilityReport,
  clearModelUnavailability,
  getUnavailableCount,
} from "@/domain/modelAvailability";
import { clearModelAvailabilitySchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { logger } from '@/shared/utils/logger';

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const report = getAvailabilityReport();
    const count = getUnavailableCount();
    return NextResponse.json({ unavailableCount: count, models: report });
  } catch (error) {
    console.error("Error getting model availability:", error);
    return NextResponse.json({ error: "Failed to get model availability" }, { status: 500 });
  }
}

export async function POST(request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (error) {
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
    const validation = validateBody(clearModelAvailabilitySchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { provider, model } = validation.data;

    const removed = clearModelUnavailability(provider, model);
    return NextResponse.json({ success: true, removed });
  } catch (error) {
    console.error("Error clearing model availability:", error);
    return NextResponse.json({ error: "Failed to clear model availability" }, { status: 500 });
  }
}
