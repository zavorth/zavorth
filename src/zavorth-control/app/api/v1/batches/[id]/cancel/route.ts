import { enforceApiKeyPolicy } from "@/shared/utils/apiKeyPolicy";
import { cancelGatewayBatch } from "@/lib/zavorthGatewayRuntimeStore";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const policy = await enforceApiKeyPolicy(request, null);
  if (policy.rejection) return policy.rejection;

  const batch = cancelGatewayBatch(params.id);
  if (!batch) {
    return Response.json({ error: { message: "Batch not found", type: "not_found" } }, { status: 404 });
  }
  return Response.json(batch);
}
