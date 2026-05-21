import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { buildExperienceCommand, getExperienceCoreService, readJsonBody } from "../experienceRouteSupport";

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const service = getExperienceCoreService();
  const body = await readJsonBody(request);
  const command = buildExperienceCommand(body);
  if (!command.text) {
    return Response.json({ ok: false, error: "Missing text." }, { status: 400 });
  }
  return Response.json(await service.executeCommand(command));
}
