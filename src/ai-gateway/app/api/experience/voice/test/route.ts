import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getVoiceProbeService } from "../../../../../../services/voice/VoiceProbeService.js";

/**
 * Dry-run STT/TTS configuration probes for Desktop Settings → Voice → Test.
 * POST body: { action?: 'stt' | 'tts' | 'all', sampleText?: string }
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

  const action = String(body.action || "all").toLowerCase();
  const probe = getVoiceProbeService();
  const sampleText =
    body.sampleText != null ? String(body.sampleText) : undefined;

  if (action === "stt") {
    return Response.json({ ok: true, result: probe.probeStt() });
  }
  if (action === "tts") {
    return Response.json({ ok: true, result: probe.probeTts(sampleText) });
  }
  if (action === "all") {
    return Response.json({ ok: true, result: probe.probeAll() });
  }

  return Response.json(
    { ok: false, error: `Unknown action: ${action}` },
    { status: 400 },
  );
}
