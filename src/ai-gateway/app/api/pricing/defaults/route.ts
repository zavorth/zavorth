import { NextResponse } from "next/server";
import { getDefaultPricing } from "@/shared/constants/pricing";
import { logger } from "@/shared/utils/logger";/**
 * GET /api/pricing/defaults
 * Get default pricing configuration
 */
export async function GET() {
  try {
    const defaultPricing = getDefaultPricing();
    return NextResponse.json(defaultPricing);
  } catch (error: unknown) {logger.error("Error fetching default pricing:", error);
    return NextResponse.json({ error: "Failed to fetch default pricing" }, { status: 500 });
  }
}
