import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getVoiceTtsSynthesizeService } from "../../../../../../services/voice/VoiceTtsSynthesizeService.js";

/**
 * Preference-aware TTS synthesis (edge-tts / gemini) → base64 audio for Desktop playback.
 * POST body: { text, language?, force?, surface... }
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

  const text = String(body.text || body.sampleText || "").trim();
  if (!text) {
    return Response.json(
      { ok: false, error: "text is required for TTS. Type your message instead." },
      { status: 400 },
    );
  }

  const service = getVoiceTtsSynthesizeService();
  const result = await service.synthesize({
    text,
    language: body.language != null ? String(body.language) : null,
    surface: body.surface != null ? String(body.surface) : "desktop",
    force: body.force !== false,
  });

  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.message, code: result.code, result },
      { status: 400 },
    );
  }

  return Response.json({ ok: true, result });
}
