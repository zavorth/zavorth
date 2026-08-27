import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getPricing, updatePricing, resetPricing, resetAllPricing } from "@/lib/localDb";
import { updatePricingSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { logger } from '@/shared/utils/logger';/**
 * GET /api/pricing
 * Get current pricing configuration (merged user + defaults)
 */
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const pricing = await getPricing();
    return NextResponse.json(pricing);
  } catch (error: unknown) {logger.error("Error fetching pricing:", error);
    return NextResponse.json({ error: "Failed to fetch pricing" }, { status: 500 });
  }
}

/**
 * PATCH /api/pricing
 * Update pricing configuration
 * Body: { provider: { model: { input: number, output: number, cached: number, ? } } }
 */
export async function PATCH(request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (error: unknown) {logger.warn('[route] cache operation failed', error);
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
    const validation = validateBody(updatePricingSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const body = validation.data;

    const updatedPricing = await updatePricing(body);
    return NextResponse.json(updatedPricing);
  } catch (error: unknown) {logger.error("Error updating pricing:", error);
    return NextResponse.json({ error: "Failed to update pricing" }, { status: 500 });
  }
}

/**
 * DELETE /api/pricing
 * Reset pricing to defaults
 * Query params: ...provider=xxx&model=yyy (optional)
 */
export async function DELETE(request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");
    const model = searchParams.get("model");

    if (provider && model) {
      // Reset specific model
      await resetPricing(provider, model);
    } else if (provider) {
      // Reset entire provider
      await resetPricing(provider);
    } else {
      // Reset all pricing
      await resetAllPricing();
    }

    const pricing = await getPricing();
    return NextResponse.json(pricing);
  } catch (error: unknown) {logger.error("Error resetting pricing:", error);
    return NextResponse.json({ error: "Failed to reset pricing" }, { status: 500 });
  }
}
