import { CORS_ORIGIN } from "@/shared/utils/cors";
import { enforceApiKeyPolicy } from "@/shared/utils/apiKeyPolicy";
import { createGatewayFile, listGatewayFiles } from "@/lib/zavorthGatewayRuntimeStore";

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": CORS_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

export async function GET(request: Request) {
  const policy = await enforceApiKeyPolicy(request, null);
  if (policy.rejection) return policy.rejection;

  return Response.json({ object: "list", data: listGatewayFiles() }, {
    headers: { "Access-Control-Allow-Origin": CORS_ORIGIN },
  });
}

export async function POST(request: Request) {
  const policy = await enforceApiKeyPolicy(request, null);
  if (policy.rejection) return policy.rejection;

  try {
    const file = await createGatewayFile(request);
    return Response.json(file, {
      status: 201,
      headers: { "Access-Control-Allow-Origin": CORS_ORIGIN },
    });
  } catch (error: any) {
    return Response.json(
      { error: { message: error?.message || "Failed to store file", type: "invalid_request_error" } },
      { status: 400, headers: { "Access-Control-Allow-Origin": CORS_ORIGIN } }
    );
  }
}
