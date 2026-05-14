import { NextResponse } from "next/server";
import { getTelemetrySummary } from "@/shared/utils/requestTelemetry";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export async function GET(request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const windowMs = parseInt(searchParams.get("windowMs") || "300000", 10);
    const summary = getTelemetrySummary(windowMs);
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
