import { NextResponse } from "next/server";
import { getTelemetrySummary } from "@/shared/utils/requestTelemetry";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { safeParseInt } from "@/shared/utils/safeParseInt";
import { logger } from '@/shared/utils/logger';

export async function GET(request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const windowMs = safeParseInt(searchParams.get("windowMs"), 300000);
    const summary = getTelemetrySummary(windowMs);
    return NextResponse.json(summary);
  } catch (error: any) { const err = error; const e = error;
    logger.warn('[route] parsing failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
