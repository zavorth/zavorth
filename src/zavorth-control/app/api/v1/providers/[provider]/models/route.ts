import { getUnifiedModelsResponse } from "../../../models/catalog";

export async function GET(request: Request, { params }: { params: { provider: string } }) {
  const response = await getUnifiedModelsResponse(request);
  const payload = await response.clone().json().catch(() => null);
  if (!payload || !Array.isArray(payload.data)) return response;

  const provider = String(params.provider || "").toLowerCase();
  const data = payload.data.filter((model: any) => {
    const id = String(model.id || "").toLowerCase();
    const ownedBy = String(model.owned_by || "").toLowerCase();
    return ownedBy === provider || id.startsWith(`${provider}/`);
  });
  return Response.json({ object: "list", data }, { status: response.status, headers: response.headers });
}
