import { getGatewayBatch } from "@/lib/zavorthGatewayRuntimeStore";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const batch = getGatewayBatch(params.id);
  if (!batch) {
    return Response.json({ error: { message: "Batch not found", type: "not_found" } }, { status: 404 });
  }
  return Response.json(batch);
}
