import { deleteCompletedGatewayBatches } from "@/lib/zavorthGatewayRuntimeStore";

export async function POST() {
  const deleted = deleteCompletedGatewayBatches();
  return Response.json({ ok: true, deleted });
}
