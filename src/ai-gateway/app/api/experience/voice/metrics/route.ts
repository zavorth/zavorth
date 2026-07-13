import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getVoiceMetricsSnapshot } from "../../../../../../services/voice/VoiceMetricsService.js";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") || 40);
  return Response.json(getVoiceMetricsSnapshot(limit));
}
