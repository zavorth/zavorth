import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getExperienceCoreService, readExperienceQuery } from "../experienceRouteSupport";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const service = getExperienceCoreService();
  return Response.json(service.buildHome({
    surface: "web",
    ...readExperienceQuery(request),
  }));
}
