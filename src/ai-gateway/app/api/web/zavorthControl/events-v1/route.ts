import { NextResponse } from "next/server";
import { requireControlAuth } from "@/lib/api/requireManagementAuth";
import { nowIso } from "../zavorthControlApiSnapshot";
import { getRuntimeEngineApiState } from "../../runtime-engine-state";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = await requireControlAuth(request);
  if (authError) return authError;
  const { trace, registry } = getRuntimeEngineApiState();
  const traces = trace.list(50);
  return NextResponse.json({
    ok: true,
    engine: registry.getSnapshot(),
    eventsV1: {
      generatedAt: nowIso(),
      events: traces.map((event) => ({
        ...event,
        eventName: event.kind === "express-route"
          ? "zavorth.engine.decision"
          : event.kind === "diff"
            ? "zavorth.diff.ready"
            : event.kind === "canvas"
              ? "zavorth.canvas.sync"
              : event.kind === "egress-blocked"
                ? "zavorth.canvas.egress_blocked"
                : "zavorth.trace.event",
      })),
    },
  });
}
