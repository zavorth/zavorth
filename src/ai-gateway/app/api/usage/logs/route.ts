import { NextResponse } from "next/server";
import { getRecentLogs } from "@/lib/usageDb";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const logs = await getRecentLogs(200);
    return NextResponse.json(logs);
  } catch (error: unknown) {console.error("[API ERROR] /api/usage/logs failed:", error);
    console.error("[API ERROR] Stack:", (error as Error).stack);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
