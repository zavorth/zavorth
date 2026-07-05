import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getAllFallbackChains, registerFallback, removeFallback } from "@/domain/fallbackPolicy";
import { registerFallbackSchema, removeFallbackSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { logger } from '@/shared/utils/logger';

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const chains = getAllFallbackChains();
    return NextResponse.json(chains);
  } catch (error) {
    console.error("Error fetching fallback chains:", error);
    return NextResponse.json({ error: "Failed to fetch fallback chains" }, { status: 500 });
  }
}

export async function POST(request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (error) {
    logger.warn('[route] network request failed', error);
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
    const validation = validateBody(registerFallbackSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { model, chain } = validation.data;

    registerFallback(model, chain);
    return NextResponse.json({ success: true, model });
  } catch (error) {
    console.error("Error registering fallback chain:", error);
    return NextResponse.json({ error: "Failed to register fallback chain" }, { status: 500 });
  }
}

export async function DELETE(request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (error) {
    logger.warn('[route] delete operation failed', error);
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
    const validation = validateBody(removeFallbackSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { model } = validation.data;
    const removed = removeFallback(model);
    return NextResponse.json({ success: true, removed });
  } catch (error) {
    console.error("Error removing fallback chain:", error);
    return NextResponse.json({ error: "Failed to remove fallback chain" }, { status: 500 });
  }
}
