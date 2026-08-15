import { requireControlAuth } from "@/lib/api/requireManagementAuth";
import { getExperienceCoreService } from "@/app/api/experience/experienceRouteSupport";

export async function GET(request: Request) {
  const authError = await requireControlAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const surface = url.searchParams.get("surface") || "web";

  const snapshot = getExperienceCoreService().buildHome({
    surface,
    generatedAt: new Date(),
  });

  return Response.json({
    ...snapshot,
    version: "ExperienceSnapshot/v1",
    surface,
    generatedAt: new Date().toISOString(),
  });
}
