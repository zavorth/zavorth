import { NextResponse } from "next/server";
import { isDraining, getActiveRequestCount, STARTUP_EPOCH } from "@/lib/gracefulShutdown";
import { asErrorLike } from '../../../../../utils/errorLike.js';
import { logger } from "@/shared/utils/logger";

export async function GET() {
  try {
    return NextResponse.json({
      shuttingDown: isDraining(),
      activeRequests: getActiveRequestCount(),
      epoch: STARTUP_EPOCH,
    });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.error("[Status API] Error handling request:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
export const dynamic = "force-dynamic";
