import { NextResponse } from "next/server";
import { getRecentLogs } from "@/lib/usageDb";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from "@/shared/utils/logger";export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const logs = await getRecentLogs(200);
    return NextResponse.json(logs);
  } catch (error: unknown) {logger.error("[API ERROR] /api/usage/logs failed:", error);
    logger.error("[API ERROR] Stack:", (error as Error).stack);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
