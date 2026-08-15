import { NextResponse } from "next/server";
import { detectFormat } from "@zavorth/ai-gateway/open-sse/services/provider.ts";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { translatorDetectSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { logger } from '@/shared/utils/logger';/**
 * POST /api/translator/detect
 * Detect the format of a request body.
 * Body: { body: object }
 * Returns: { format, label }
 */
export async function POST(request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (error: unknown) {logger.warn('[route] validation failed', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Invalid request",
          details: [{ field: "body", message: "Invalid JSON body" }],
        },
      },
      { status: 400 }
    );
  }

  try {
    const validation = validateBody(translatorDetectSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }
    const { body } = validation.data;

    const format = detectFormat(body);

    return NextResponse.json({
      success: true,
      format,
    });
  } catch (error: unknown) {console.error("Error detecting format:", error);
    return NextResponse.json({ success: false, error: "Failed to detect format" }, { status: 500 });
  }
}
