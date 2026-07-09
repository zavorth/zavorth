import { NextResponse } from "next/server";
import { isDraining, getActiveRequestCount, STARTUP_EPOCH } from "@/lib/gracefulShutdown";

export async function GET() {
  try {
    return NextResponse.json({
      shuttingDown: isDraining(),
      activeRequests: getActiveRequestCount(),
      epoch: STARTUP_EPOCH,
    });
  } catch (error: any) { const err = error; const e = error;
    console.error("[Status API] Error handling request:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
export const dynamic = "force-dynamic";
