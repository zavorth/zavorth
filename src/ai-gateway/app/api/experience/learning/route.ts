import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getExperienceCoreService, readExperienceQuery } from "../experienceRouteSupport";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const service = getExperienceCoreService();
  const snapshot = service.buildHome({
    surface: "web",
    ...readExperienceQuery(request),
  });
  return Response.json({
    contractVersion: "LearningCandidate/v1",
    generatedAt: snapshot.generatedAt,
    learning: snapshot.learning,
  });
}
