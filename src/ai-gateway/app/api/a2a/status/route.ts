import { NextResponse } from "next/server";
import { getTaskManager } from "@/lib/a2a/taskManager";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../../utils/errorLike.js';

export async function GET() {
  try {
    const tm = getTaskManager();
    const stats = tm.getStats();

    let agentCard: unknown = null;
    try {
      const agentModule = await import("@/app/.well-known/agent.json/route");
      const cardResponse = await agentModule.GET();
      agentCard = await cardResponse.json();
    } catch (error: unknown) {logger.warn('[route] filesystem check failed', error);
    agentCard = null;
  }

    return NextResponse.json({
      status: "ok",
      tasks: stats,
      agent: agentCard
        ? {
            name: agentCard.name,
            description: agentCard.description,
            version: agentCard.version,
            url: agentCard.url,
          }
        : null,
      capabilities: agentCard?.capabilities || null,
      skills: Array.isArray(agentCard?.skills) ? agentCard.skills : [],
    });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] filesystem check failed', error);
    const message = error instanceof Error ? err.message : "Failed to load A2A status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
