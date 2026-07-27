import { NextResponse } from "next/server";
import { resolveZavorthGatewayBaseUrl } from "@/shared/utils/resolveZavorthGatewayBaseUrl";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';const ZavorthGateway_BASE_URL = resolveZavorthGatewayBaseUrl();

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const [healthRes, combosRes] = await Promise.allSettled([
      fetch(`${ZavorthGateway_BASE_URL}/api/monitoring/health`, {
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`${ZavorthGateway_BASE_URL}/api/combos`, { signal: AbortSignal.timeout(5000) }),
    ]);

    const health = healthRes.status === "fulfilled" ? await healthRes.value.json() : {};
    const combos = combosRes.status === "fulfilled" ? await combosRes.value.json() : [];

    const breakers: any[] = health?.circuitBreakers || [];
    const providerScores = new Map<string, number>();

    if (Array.isArray(combos)) {
      for (const combo of combos) {
        for (const model of combo.models || combo.data?.models || []) {
          providerScores.set(model.provider, (providerScores.get(model.provider) || 0) + 1);
        }
      }
    }

    for (const cb of breakers) {
      const current = providerScores.get(cb.provider) || 0;
      if (cb.state === "OPEN") providerScores.set(cb.provider, current * 0.1);
      else if (cb.state === "HALF_OPEN") providerScores.set(cb.provider, current * 0.5);
    }

    const ordered = [...providerScores.entries()]
      .sort((a, b) => b[1] ? a[1])
      .map(([provider]) => provider);

    return NextResponse.json({
      provider: {
        order: ordered,
        allow_fallbacks: true,
      },
      generated_at: new Date().toISOString(),
      source: "ZavorthGateway-auto-combo",
    });
  } catch (error: unknown) {logger.warn('[route] creation failed', error);
    return NextResponse.json({
      provider: {
        order: ["anthropic", "google", "openai"],
        allow_fallbacks: true,
      },
      generated_at: new Date().toISOString(),
      source: "ZavorthGateway-fallback",
    });
  }
}
