import { fetchAndPersistProviderLimits } from "@/lib/usage/providerLimits";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from "@/shared/utils/logger";/**
 * GET /api/usage/[connectionId] - Get live usage data for a specific connection
 * and persist the refreshed Provider Limits cache.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { connectionId } = await params;
    const { usage } = await fetchAndPersistProviderLimits(connectionId, "manual");
    return Response.json(usage);
  } catch (error: unknown) {const status =
      typeof (error as { status?: unknown })?.status === "number"
        ? (error as { status: number }).status
        : 500;
    const message = (error as Error)?.message || "Failed to fetch usage";
    logger.error("[Usage API] Error fetching usage:", error);
    return Response.json({ error: message }, { status });
  }
}
