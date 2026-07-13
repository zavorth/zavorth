import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getVoicePreferenceService } from "../../../../../../services/voice/VoicePreferenceService.js";
import type { VoiceInteractionMode } from "../../../../../../contracts/voice/VoicePreferenceContract.js";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const service = getVoicePreferenceService();
  const preference = service.get();
  const stt = service.resolveStt();

  return Response.json({
    contractVersion: preference.version,
    preference,
    resolve: stt,
    path: service.getPreferencePath(),
    describe: service.describe(),
  });
}

export async function PUT(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const service = getVoicePreferenceService();
  if (body.clear === true) {
    const preference = service.clear();
    return Response.json({ ok: true, preference, resolve: service.resolveStt() });
  }

  const sttBody = (body.stt || {}) as Record<string, unknown>;
  const ttsBody = (body.tts || {}) as Record<string, unknown>;
  const mode = body.mode != null ? (String(body.mode) as VoiceInteractionMode) : undefined;

  const preference = service.set({
    mode,
    stt: {
      ...(sttBody.provider != null ? { provider: String(sttBody.provider) as any } : {}),
      ...(sttBody.model !== undefined
        ? { model: sttBody.model == null ? null : String(sttBody.model) }
        : {}),
      ...(sttBody.language != null ? { language: String(sttBody.language) } : {}),
    },
    tts: {
      ...(typeof ttsBody.enabled === "boolean" ? { enabled: ttsBody.enabled } : {}),
      ...(ttsBody.provider != null ? { provider: String(ttsBody.provider) as any } : {}),
      ...(ttsBody.voiceId !== undefined
        ? { voiceId: ttsBody.voiceId == null ? null : String(ttsBody.voiceId) }
        : {}),
    },
  });

  return Response.json({
    ok: true,
    preference,
    resolve: service.resolveStt(),
    describe: service.describe(),
  });
}
