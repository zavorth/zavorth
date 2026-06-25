import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getExperienceCoreService, readExperienceQuery, resolveRouteParams } from "../../../experienceRouteSupport";

export async function GET(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id } = await resolveRouteParams(context.params);
  const service = getExperienceCoreService();
  return Response.json({
    contractVersion: "ExperienceTimeline/v1",
    generatedAt: new Date().toISOString(),
    runId: id,
    timeline: service.buildTimelineForRun({
      runId: id,
      surface: "web",
      ...readExperienceQuery(request),
    }),
  });
}
