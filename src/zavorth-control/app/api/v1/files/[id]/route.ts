import { CORS_ORIGIN } from "@/shared/utils/cors";
import { enforceApiKeyPolicy } from "@/shared/utils/apiKeyPolicy";
import { deleteGatewayFile, getGatewayFile } from "@/lib/zavorthGatewayRuntimeStore";

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": CORS_ORIGIN,
      "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const policy = await enforceApiKeyPolicy(request, null);
  if (policy.rejection) return policy.rejection;

  const file = getGatewayFile(params.id);
  if (!file) {
    return Response.json({ error: { message: "File not found", type: "not_found" } }, { status: 404 });
  }
  return Response.json(file, { headers: { "Access-Control-Allow-Origin": CORS_ORIGIN } });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const policy = await enforceApiKeyPolicy(request, null);
  if (policy.rejection) return policy.rejection;

  const deleted = deleteGatewayFile(params.id);
  return Response.json({
    id: params.id,
    object: "file",
    deleted,
  }, { status: deleted ? 200 : 404, headers: { "Access-Control-Allow-Origin": CORS_ORIGIN } });
}
