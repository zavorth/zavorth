import { readGatewayFileContent } from "@/lib/zavorthGatewayRuntimeStore";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const content = readGatewayFileContent(params.id);
  if (!content) {
    return Response.json({ error: { message: "File not found", type: "not_found" } }, { status: 404 });
  }
  return new Response(content, {
    headers: {
      "content-type": "application/octet-stream",
      "cache-control": "no-store",
    },
  });
}
