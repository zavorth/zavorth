import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  buildExperienceCommand,
  getExperienceCoreService,
  readJsonBody,
  resolveRouteParams,
} from "../../../experienceRouteSupport";

export async function POST(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id } = await resolveRouteParams(context.params);
  const body = await readJsonBody(request);
  const rawDecision = String(body.decision || body.action || "").trim().toLowerCase();
  const decision = rawDecision === "reject" || rawDecision === "rejected" ? "reject" : "approve";
  const service = getExperienceCoreService();
  const choice = String(body.choice || body.permissionChoice || decision || "once").trim().toLowerCase();
  return Response.json(await service.executeCommand({
    ...buildExperienceCommand({
      ...body,
      text: `${decision} ${id}`,
      intent: decision,
      metadata: {
        ...(typeof body.metadata === "object" && body.metadata ? body.metadata : {}),
        choice: choice === "reject" ? "deny" : choice === "approve" ? "once" : choice,
        source: "experience-approvals-api",
      },
    }),
    approval: {
      id,
      decision,
    },
  }));
}
