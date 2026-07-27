import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  getVoiceRealtimeDuplexSessionService,
} from "../../../../../../../services/voice/VoiceRealtimeDuplexSession.js";
import {
  subscribe,
  type VoiceDuplexEvent,
} from "../../../../../../../services/voice/VoiceDuplexEventBus.js";

const KEEP_ALIVE_MS = 15_000;

/**
 * SSE stream of duplex turn/phase events for a session.
 * GET /api/experience/voice/duplex/events?sessionId=...
 *
 * On connect: emits current session snapshot (if any) as a session event.
 * Then streams live bus events until client abort or type=ended.
 */
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const sessionId = String(url.searchParams.get("sessionId") || "").trim();
  if (!sessionId) {
    return Response.json(
      { ok: false, error: "sessionId is required" },
      { status: 400 },
    );
  }

  const duplex = getVoiceRealtimeDuplexSessionService();
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      const sendEvent = (event: VoiceDuplexEvent | Record<string, unknown>) => {
        safeEnqueue(`data: ${JSON.stringify(event)}\n\n`);
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (keepAliveTimer) {
          clearInterval(keepAliveTimer);
          keepAliveTimer = null;
        }
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      // Immediate snapshot if the duplex session exists (action=get semantics).
      const current = duplex.get(sessionId);
      if (current) {
        sendEvent({
          type:
            current.phase === "ended"
              ? "ended"
              : current.phase === "error"
                ? "error"
                : "session",
          sessionId,
          at: new Date().toISOString(),
          session: current,
          ...(current.lastError ? { message: current.lastError } : {}),
        });
      }

      unsubscribe = subscribe(sessionId, (event) => {
        sendEvent(event);
        if (event.type === "ended") {
          cleanup();
        }
      });

      keepAliveTimer = setInterval(() => {
        safeEnqueue(`: keep-alive\n\n`);
      }, KEEP_ALIVE_MS);

      if (request.signal.aborted) {
        cleanup();
        return;
      }
      request.signal.addEventListener("abort", () => cleanup(), { once: true });
    },
    cancel() {
      closed = true;
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
      }
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
