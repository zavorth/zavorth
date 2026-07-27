import { buildGatewayHealthSnapshot } from "@/lib/zavorthGatewayRuntimeStore";

export async function GET(request: Request) {
  const upgrade = request.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() === "websocket") {
    return Response.json(
      {
        error: {
          message: "Use the Zavorth Node gateway host for persistent WebSocket upgrades.",
          type: "upgrade_not_available",
        },
        gateway: buildGatewayHealthSnapshot(),
        websocket: "ws://127.0.0.1:18789/v1/ws",
        messages: [
          { type: "ping" },
          { type: "status" },
          { type: "chat.completions", body: { model: "auto", messages: [] } },
        ],
        alternatives: ["/v1/chat/completions...stream=true", "/api/experience/home"],
      },
      { status: 426, headers: { upgrade: "websocket" } }
    );
  }
  return Response.json({
    object: "zavorth.gateway.ws",
    status: "persistent-host-ready",
    persistent_upgrade: "zavorth-node-gateway-host",
    websocket: "ws://127.0.0.1:18789/v1/ws",
    supported_messages: ["ping", "status", "chat.completions"],
    streaming_alternatives: ["/v1/chat/completions", "/v1/relay/chat/completions"],
    gateway: buildGatewayHealthSnapshot(),
  });
}
