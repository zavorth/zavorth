import { NextResponse } from "next/server";
import { getUsageStats } from "@/lib/usageDb";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const stats = await getUsageStats();
    return NextResponse.json(stats);
  } catch (error: unknown) {console.error("Error fetching usage stats:", error);
    return NextResponse.json({ error: "Failed to fetch usage stats" }, { status: 500 });
  }
}
