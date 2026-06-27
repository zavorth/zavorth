import { enforceApiKeyPolicy } from "@/shared/utils/apiKeyPolicy";
import { deleteCompletedGatewayBatches } from "@/lib/zavorthGatewayRuntimeStore";

export async function POST(request: Request) {
  const policy = await enforceApiKeyPolicy(request, null);
  if (policy.rejection) return policy.rejection;

  const deleted = deleteCompletedGatewayBatches();
  return Response.json({ ok: true, deleted });
}
