import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { probeVoiceMediaPlane } from "../../../../../../services/voice/VoiceMediaPlane.js";
import {
  publicVoiceIceConfig,
  resolveVoiceIceConfig,
} from "../../../../../../services/voice/VoiceWebRtcIceConfig.js";

/**
 * GET — media plane capability (native wrtc vs HTTP+VAD) + ICE config for Desktop.
 * Credentials are only returned when management-authenticated (same as other voice routes).
 */
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const plane = await probeVoiceMediaPlane();
  // Full ICE (with TURN credentials) only for authenticated management clients
  const ice = resolveVoiceIceConfig();
  const icePublic = publicVoiceIceConfig();
  return Response.json({
    ok: true,
    plane,
    ice: {
      iceServers: ice.iceServers,
      hasTurn: ice.hasTurn,
      source: ice.source,
      public: icePublic,
    },
  });
}
