import { enforceApiKeyPolicy } from "@/shared/utils/apiKeyPolicy";
import { getGatewayBatch } from "@/lib/zavorthGatewayRuntimeStore";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const policy = await enforceApiKeyPolicy(request, null);
  if (policy.rejection) return policy.rejection;

  const batch = getGatewayBatch(params.id);
  if (!batch) {
    return Response.json({ error: { message: "Batch not found", type: "not_found" } }, { status: 404 });
  }
  return Response.json(batch);
}
