import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  listVoiceSurfaceCapabilities,
  surfaceSupportsVoice,
} from "../../../../../../services/voice/VoiceSurfaceCapabilityRegistry.js";

/**
 * GET — which surfaces support voice and how (for ops + Desktop docs).
 */
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const surfaces = listVoiceSurfaceCapabilities();
  return Response.json({
    ok: true,
    contractVersion: "voice-surfaces/v1",
    count: surfaces.length,
    voiceEnabled: surfaces.filter((s) => surfaceSupportsVoice(s.surfaceId)),
    surfaces,
  });
}
