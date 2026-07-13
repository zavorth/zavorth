import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  getVoiceRealtimeDuplexSessionService,
} from "../../../../../../services/voice/VoiceRealtimeDuplexSession.js";

/**
 * Turn-based duplex session control.
 * POST actions: start | listen | barge_in | end | get
 */
export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const action = String(body.action || "get").toLowerCase();
  const service = getVoiceRealtimeDuplexSessionService();

  try {
    if (action === "start") {
      const surface = String(body.surface || "desktop");
      // Default agent handler echoes until desktop wires real experience ask
      const session = service.start({
        surface,
        agentHandler: async ({ agentText }) => ({
          replyText: String(body.agentReplyOverride || "").trim() ||
            `Received (duplex): ${agentText}`,
        }),
      });
      return Response.json({ ok: true, session });
    }

    if (action === "listen") {
      const sessionId = String(body.sessionId || "").trim();
      const transcript = String(body.transcript || "").trim();
      if (!sessionId || !transcript) {
        return Response.json(
          { ok: false, error: "sessionId and transcript are required for listen" },
          { status: 400 },
        );
      }
      const session = await service.completeListen(sessionId, {
        transcript,
        provider: body.provider != null ? String(body.provider) : null,
        model: body.model != null ? String(body.model) : null,
        languageCode: body.language != null ? String(body.language) : null,
        confidence:
          typeof body.confidence === "number" ? body.confidence : null,
      });
      return Response.json({ ok: true, session });
    }

    if (action === "barge_in") {
      const sessionId = String(body.sessionId || "").trim();
      const session = service.bargeIn(sessionId);
      return Response.json({ ok: true, session });
    }

    if (action === "end") {
      const sessionId = String(body.sessionId || "").trim();
      const session = service.end(sessionId);
      return Response.json({ ok: true, session });
    }

    if (action === "list") {
      return Response.json({ ok: true, sessions: service.listActive() });
    }

    if (action === "get") {
      const sessionId = String(body.sessionId || "").trim();
      const session = service.get(sessionId);
      if (!session) {
        return Response.json({ ok: false, error: "session not found" }, { status: 404 });
      }
      return Response.json({ ok: true, session });
    }

    return Response.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
