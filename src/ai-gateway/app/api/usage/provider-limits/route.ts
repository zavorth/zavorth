import { NextResponse } from "next/server";
import {
  getCachedProviderLimitsMap,
  getLastProviderLimitsAutoSyncTime,
  getProviderLimitsSyncIntervalMinutes,
  syncAllProviderLimits,
} from "@/lib/usage/providerLimits";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
/**
 * GET /api/usage/provider-limits
 * Returns cached Provider Limits data without triggering live refreshes.
 */
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    return NextResponse.json({
      caches: getCachedProviderLimitsMap(),
      intervalMinutes: getProviderLimitsSyncIntervalMinutes(),
      lastAutoSyncAt: await getLastProviderLimitsAutoSyncTime(),
    });
  } catch (error: unknown) {console.error("[API] GET /api/usage/provider-limits error:", error);
    return NextResponse.json({ error: "Failed to fetch cached provider limits" }, { status: 500 });
  }
}

/**
 * POST /api/usage/provider-limits
 * Manually refresh all supported Provider Limits entries.
 */
export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const result = await syncAllProviderLimits({ source: "manual" });
    const caches = getCachedProviderLimitsMap();
    return NextResponse.json({
      ...result,
      caches,
      intervalMinutes: getProviderLimitsSyncIntervalMinutes(),
      lastAutoSyncAt: await getLastProviderLimitsAutoSyncTime(),
    });
  } catch (error: unknown) {console.error("[API] POST /api/usage/provider-limits error:", error);
    return NextResponse.json({ error: "Failed to refresh provider limits" }, { status: 500 });
  }
}
