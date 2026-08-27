import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { asErrorLike } from '../../../../../utils/errorLike';
import { logger } from "@/shared/utils/logger";

/**
 * POST /api/resilience/reset — Reset all circuit breakers and clear cooldowns
 */
export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    // Reset all circuit breakers
    const { getAllCircuitBreakerStatuses, getCircuitBreaker } =
      await import("@/shared/utils/circuitBreaker");

    const statuses = getAllCircuitBreakerStatuses();
    let resetCount = 0;

    for (const { name } of statuses) {
      const breaker = getCircuitBreaker(name);
      breaker.reset();
      resetCount++;
    }

    return NextResponse.json({
      ok: true,
      resetCount,
      message: `Reset ${resetCount} circuit breaker(s)`,
    });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    const message = err instanceof Error ? err.message : "Failed to reset resilience state";
    logger.error("[API] POST /api/resilience/reset error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
