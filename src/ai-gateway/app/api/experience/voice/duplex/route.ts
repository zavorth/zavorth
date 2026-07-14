import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  getVoiceRealtimeDuplexSessionService,
} from "../../../../../../services/voice/VoiceRealtimeDuplexSession.js";
import { createExperienceDuplexAgentHandler } from "../../../../../../services/voice/createExperienceDuplexAgentHandler.js";
import { getVoiceMediaStreamDuplexService } from "../../../../../../services/voice/VoiceMediaStreamDuplex.js";
import { getVoiceWebRtcSignalingService } from "../../../../../../services/voice/VoiceWebRtcSignaling.js";
import { getVoiceTtsSynthesizeService } from "../../../../../../services/voice/VoiceTtsSynthesizeService.js";
import { getVoiceNativeRtpBridge } from "../../../../../../services/voice/VoiceNativeRtpBridge.js";
import { waitForEvent } from "../../../../../../services/voice/VoiceDuplexEventBus.js";
import {
  buildExperienceCommand,
  ensureExperienceAgentReady,
  getExperienceCoreService,
} from "../../experienceRouteSupport";

/**
 * Duplex session control + media stream + WebRTC signaling.
 * POST actions:
 *   start | listen | media_chunk | barge_in | end | get | list
 *   webrtc_create | webrtc_offer | webrtc_answer | webrtc_ice | webrtc_get | webrtc_close
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
  const media = getVoiceMediaStreamDuplexService();
  const webrtc = getVoiceWebRtcSignalingService();
  const nativeRtp = getVoiceNativeRtpBridge();
  const tts = getVoiceTtsSynthesizeService();

  try {
    if (action === "start") {
      const surface = String(body.surface || "desktop");
      const userId = String(body.userId || "desktop-user").trim() || "desktop-user";
      const sessionIdHint =
        typeof body.sessionId === "string" ? body.sessionId : null;
      const workspaceHint =
        typeof body.workspace === "string" ? body.workspace : null;
      const agentReplyOverride =
        body.agentReplyOverride != null
          ? String(body.agentReplyOverride)
          : null;

      const agentHandler = createExperienceDuplexAgentHandler({
        ensureReady: ensureExperienceAgentReady,
        execute: async (command) => {
          const serviceCore = getExperienceCoreService();
          const built = buildExperienceCommand({
            ...command,
            text: command.text,
            surface: command.surface || "web",
            userId: command.userId || userId,
            sessionId: command.sessionId || sessionIdHint,
            workspace: workspaceHint || (command as { workspace?: string }).workspace,
            metadata: {
              ...(command.metadata || {}),
              experienceSessionId: sessionIdHint,
              workspace: workspaceHint,
            },
          });
          return serviceCore.executeCommand(built);
        },
        userId,
        sessionId: sessionIdHint,
        agentReplyOverride,
      });

      const speakHandler = async (input: {
        sessionId: string;
        text: string;
        voiceId: string | null;
        forceProvider: "edge-tts" | "gemini";
      }) => {
        const synth = await tts.synthesize({
          text: input.text,
          force: true,
          surface,
          language: body.language != null ? String(body.language) : null,
        });
        if (!synth.ok) {
          throw new Error(synth.message);
        }
        return {
          mimeType: synth.mimeType,
          audioBase64: synth.audioBase64,
          provider: synth.provider,
        };
      };

      const session = service.start({
        surface,
        agentHandler,
        speakHandler,
        experienceSessionId: sessionIdHint,
        workspace: workspaceHint,
        ownerUserId: userId,
      });
      return Response.json({ ok: true, session });
    }

    if (action === "listen") {
      const sessionId = String(body.sessionId || "").trim();
      const transcript = String(body.transcript || "").trim();
      if (!sessionId || !transcript) {
        return Response.json(
          {
            ok: false,
            error: "sessionId and transcript are required for listen. Type your message instead.",
          },
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

    if (action === "media_chunk") {
      const sessionId = String(body.sessionId || "").trim();
      const audioBase64 = String(body.audioBase64 || body.audio || "").trim();
      if (!sessionId || !audioBase64) {
        return Response.json(
          {
            ok: false,
            error:
              "sessionId and audioBase64 are required for media_chunk. Type your message instead.",
          },
          { status: 400 },
        );
      }
      const result = await media.ingestAudioChunk({
        sessionId,
        audioBase64,
        mimeType: body.mimeType != null ? String(body.mimeType) : "audio/webm",
        fileName: body.fileName != null ? String(body.fileName) : undefined,
        language: body.language != null ? String(body.language) : null,
        runAgent: body.runAgent !== false,
        endOfUtterance: body.endOfUtterance === true || body.final === true,
        clientEnergy:
          typeof body.clientEnergy === "number" ? body.clientEnergy : null,
      });
      return Response.json({
        ok: result.ok,
        result,
        session: result.session || null,
        error: result.error || null,
      }, { status: result.ok ? 200 : 400 });
    }

    if (action === "barge_in") {
      const sessionId = String(body.sessionId || "").trim();
      const session = service.bargeIn(sessionId);
      return Response.json({ ok: true, session });
    }

    if (action === "end") {
      const sessionId = String(body.sessionId || "").trim();
      // Close any native RTP peers bound to this duplex session
      for (const signalId of nativeRtp.listActive()) {
        const sig = webrtc.get(signalId);
        if (sig?.duplexSessionId === sessionId) {
          await nativeRtp.close(signalId);
        }
      }
      const session = service.end(sessionId);
      return Response.json({ ok: true, session });
    }

    if (action === "list") {
      return Response.json({ ok: true, sessions: service.listActive() });
    }

    /**
     * Long-poll next duplex bus event (push for Desktop apiRequest bridge).
     * Prefer SSE GET /voice/duplex/events when EventSource is available.
     */
    if (action === "wait_event") {
      const sessionId = String(body.sessionId || "").trim();
      if (!sessionId) {
        return Response.json(
          { ok: false, error: "sessionId required for wait_event" },
          { status: 400 },
        );
      }
      // Gap 7 — session must exist; optional owner binding
      if (!service.get(sessionId)) {
        return Response.json(
          { ok: false, error: "session not found" },
          { status: 404 },
        );
      }
      const userId = body.userId != null ? String(body.userId) : null;
      if (userId && !service.assertOwner(sessionId, userId)) {
        return Response.json(
          { ok: false, error: "forbidden" },
          { status: 403 },
        );
      }
      const timeoutMs =
        typeof body.timeoutMs === "number" ? body.timeoutMs : 25_000;
      // Cap long-poll to avoid holding connections forever
      const capped = Math.max(500, Math.min(30_000, timeoutMs));
      const event = await waitForEvent(sessionId, capped);
      return Response.json({
        ok: true,
        event,
        timedOut: event == null,
        session: event?.session || service.get(sessionId),
      });
    }

    if (action === "get") {
      const sessionId = String(body.sessionId || "").trim();
      const session = service.get(sessionId);
      if (!session) {
        return Response.json({ ok: false, error: "session not found" }, { status: 404 });
      }
      return Response.json({ ok: true, session });
    }

    // --- WebRTC signaling foundation ---
    if (action === "webrtc_create") {
      const signal = webrtc.create({
        duplexSessionId:
          body.sessionId != null ? String(body.sessionId) : null,
        surface: String(body.surface || "desktop"),
      });
      return Response.json({ ok: true, signal });
    }

    if (action === "webrtc_offer") {
      const signalId = String(body.signalId || "").trim();
      const sdp = String(body.sdp || "").trim();
      if (!signalId || !sdp) {
        return Response.json(
          { ok: false, error: "signalId and sdp required for webrtc_offer" },
          { status: 400 },
        );
      }
      const offered = webrtc.setOffer(signalId, sdp);
      const duplexSessionId =
        webrtc.get(signalId)?.duplexSessionId ||
        (body.sessionId != null ? String(body.sessionId) : null);

      if (body.autoAnswer !== false) {
        // Prefer native wrtc: real server peer + RTCAudioSink → STT
        const native = await nativeRtp.acceptOffer({
          signalId,
          offerSdp: sdp,
          duplexSessionId,
        });
        if (native.ok && native.signal) {
          return Response.json({
            ok: true,
            signal: native.signal,
            mediaPlane: "native_wrtc",
            nativeRtp: true,
          });
        }
        // Fallback: SDP munging (no server RTP)
        try {
          const answered = webrtc.autoAnswer(signalId);
          return Response.json({
            ok: true,
            signal: answered,
            mediaPlane: "sdp_munged",
            nativeRtp: false,
            nativeError: native.error || null,
          });
        } catch {
          return Response.json({
            ok: true,
            signal: offered,
            mediaPlane: null,
            nativeRtp: false,
            nativeError: native.error || null,
          });
        }
      }
      return Response.json({ ok: true, signal: offered, mediaPlane: null });
    }

    if (action === "webrtc_auto_answer") {
      const signalId = String(body.signalId || "").trim();
      if (!signalId) {
        return Response.json(
          { ok: false, error: "signalId required for webrtc_auto_answer" },
          { status: 400 },
        );
      }
      const existing = webrtc.get(signalId);
      if (existing?.offerSdp) {
        const native = await nativeRtp.acceptOffer({
          signalId,
          offerSdp: existing.offerSdp,
          duplexSessionId: existing.duplexSessionId,
        });
        if (native.ok && native.signal) {
          return Response.json({
            ok: true,
            signal: native.signal,
            mediaPlane: "native_wrtc",
            nativeRtp: true,
          });
        }
      }
      return Response.json({
        ok: true,
        signal: webrtc.autoAnswer(signalId),
        mediaPlane: "sdp_munged",
        nativeRtp: false,
      });
    }

    if (action === "webrtc_connected") {
      const signalId = String(body.signalId || "").trim();
      if (!signalId) {
        return Response.json(
          { ok: false, error: "signalId required for webrtc_connected" },
          { status: 400 },
        );
      }
      return Response.json({ ok: true, signal: webrtc.markConnected(signalId) });
    }

    if (action === "webrtc_answer") {
      const signalId = String(body.signalId || "").trim();
      const sdp = String(body.sdp || "").trim();
      if (!signalId || !sdp) {
        return Response.json(
          { ok: false, error: "signalId and sdp required for webrtc_answer" },
          { status: 400 },
        );
      }
      return Response.json({ ok: true, signal: webrtc.setAnswer(signalId, sdp) });
    }

    if (action === "webrtc_ice") {
      const signalId = String(body.signalId || "").trim();
      if (!signalId) {
        return Response.json(
          { ok: false, error: "signalId required for webrtc_ice" },
          { status: 400 },
        );
      }
      const candidate = body.candidate as
        | { candidate?: string; sdpMid?: string; sdpMLineIndex?: number }
        | string
        | undefined;
      const ice =
        typeof candidate === "string"
          ? { candidate }
          : {
              candidate: String(candidate?.candidate || body.iceCandidate || ""),
              sdpMid: candidate?.sdpMid ?? null,
              sdpMLineIndex: candidate?.sdpMLineIndex ?? null,
            };
      // Apply to native peer when present
      if (nativeRtp.hasPeer(signalId)) {
        await nativeRtp.addRemoteIce(signalId, ice);
      } else {
        webrtc.addIce(signalId, ice);
      }
      return Response.json({
        ok: true,
        signal: webrtc.get(signalId),
        nativeRtp: nativeRtp.hasPeer(signalId),
      });
    }

    if (action === "webrtc_get") {
      const signalId = String(body.signalId || "").trim();
      const signal = webrtc.get(signalId);
      if (!signal) {
        return Response.json({ ok: false, error: "signal not found" }, { status: 404 });
      }
      return Response.json({ ok: true, signal });
    }

    if (action === "webrtc_close") {
      const signalId = String(body.signalId || "").trim();
      await nativeRtp.close(signalId);
      const signal = webrtc.close(signalId);
      return Response.json({ ok: true, signal });
    }

    return Response.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { ok: false, error: `${message}. Type your message instead.` },
      { status: 400 },
    );
  }
}
