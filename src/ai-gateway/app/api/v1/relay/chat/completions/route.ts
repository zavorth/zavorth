import { handleChat, buildClientRawRequest } from "@/sse/handlers/chat";

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => ({}));
  const body = {
    ...rawBody,
    zavorth_gateway: {
      ...(rawBody?.zavorth_gateway || {}),
      relay: true,
      relayMode: "zavorth-native",
    },
  };
  const forwarded = new Request(request.url.replace("/v1/relay/chat/completions", "/v1/chat/completions"), {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(body),
  });
  return handleChat(forwarded, buildClientRawRequest(request, body));
}
