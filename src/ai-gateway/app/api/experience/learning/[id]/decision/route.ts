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
  const decision = rawDecision === "reject" || rawDecision === "promote" || rawDecision === "revoke"
    ? rawDecision
    : "approve";
  const service = getExperienceCoreService();
  return Response.json(await service.executeCommand({
    ...buildExperienceCommand({
      ...body,
      text: `learn ${decision} ${id}`,
      intent: "learn",
    }),
    learning: {
      candidateId: id,
      decision,
    },
  }));
}
