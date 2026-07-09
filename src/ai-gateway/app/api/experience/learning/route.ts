import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { ZavorthLearningPlaneService } from "../../../../../services/ZavorthLearningPlaneService";
import { getExperienceCoreService, readExperienceQuery } from "../experienceRouteSupport";
import { asErrorLike } from '../../../../../utils/errorLike.js';

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const query = readExperienceQuery(request);
  try {
    const service = getExperienceCoreService();
    const snapshot = service.buildHome({
      surface: "web",
      ...query,
    });
    return Response.json({
      contractVersion: "LearningCandidate/v1",
      generatedAt: snapshot.generatedAt,
      learning: snapshot.learning,
    });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    const learningPlane = new ZavorthLearningPlaneService();
    const snapshot = learningPlane.buildSnapshot({
      workspace: query.workspace,
    });
    return Response.json({
      contractVersion: "LearningCandidate/v1",
      generatedAt: snapshot.generatedAt,
      learning: {
        candidates: snapshot.candidates,
        summary: snapshot.summary,
        pending: snapshot.summary.pending,
      },
      fallback: {
        source: "learning-plane",
        reason: error instanceof Error ? err.message : "Experience Core unavailable",
      },
    });
  }
}
