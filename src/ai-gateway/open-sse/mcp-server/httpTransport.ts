import { logger } from "@/shared/utils/logger";

interface McpSession {
  sessionId: string;
  createdAt: number;
  lastActivityAt: number;
}

interface McpHttpTransportStatus {
  online: boolean;
  activeSessions: number;
  lastActivityAt: number | null;
}

const sessions = new Map<string, McpSession>();
const JSON_RPC_VERSION = "2.0";
const SSE_CONTENT_TYPE = "text/event-stream; charset=utf-8";
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

function now(): number {
  return Date.now();
}

function createSessionId(): string {
  const random = Math.random().toString(36).slice(2, 14);
  return `mcp-${now().toString(36)}-${random}`;
}

function trackSession(sessionId: string): McpSession {
  const existing = sessions.get(sessionId);
  if (existing) {
    existing.lastActivityAt = now();
    return existing;
  }
  const session: McpSession = {
    sessionId,
    createdAt: now(),
    lastActivityAt: now(),
  };
  sessions.set(sessionId, session);
  return session;
}

function endSession(sessionId: string): void {
  sessions.delete(sessionId);
}

function handleJsonRpcRequest(rawBody: string): Record<string, unknown> {
  let message: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody);
    message = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch (error: unknown) {
    return {
      jsonrpc: JSON_RPC_VERSION,
      id: null,
      error: { code: -32700, message: "Parse error" },
    };
  }

  const method = typeof message.method === "string" ? message.method : "";
  const id = message.id ?? null;
  const params = message.params && typeof message.params === "object" ? message.params : {};

  if (method === "initialize") {
    return {
      jsonrpc: JSON_RPC_VERSION,
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: "zavorth-gateway-mcp", version: "1.0.0" },
      },
    };
  }

  if (method === "notifications/initialized") {
    return { jsonrpc: JSON_RPC_VERSION, id: null };
  }

  if (method === "tools/list") {
    return { jsonrpc: JSON_RPC_VERSION, id, result: { tools: [] } };
  }

  if (method === "tools/call") {
    const toolName = (params as Record<string, unknown>).name;
    return {
      jsonrpc: JSON_RPC_VERSION,
      id,
      error: {
        code: -32601,
        message: `Tool not found: ${typeof toolName === "string" ? toolName : "unknown"}`,
      },
    };
  }

  if (method === "ping") {
    return { jsonrpc: JSON_RPC_VERSION, id, result: {} };
  }

  return { jsonrpc: JSON_RPC_VERSION, id, error: { code: -32601, message: "Method not found" } };
}

function sseEventLines(payload: Record<string, unknown>): string {
  const serialized = JSON.stringify(payload);
  const lines = serialized.split("\n");
  return `event: message\ndata: ${lines.join("\ndata: ")}\n\n`;
}

export function getMcpHttpStatus(): McpHttpTransportStatus {
  if (sessions.size === 0) {
    return { online: false, activeSessions: 0, lastActivityAt: null };
  }
  const lastActivityAt = Math.max(...Array.from(sessions.values()).map((s) => s.lastActivityAt));
  return { online: true, activeSessions: sessions.size, lastActivityAt };
}

export async function handleMcpSSE(request: Request): Promise<Response> {
  const sessionId =
    request.headers.get("mcp-session-id") ??
    new URL(request.url).searchParams.get("sessionId") ??
    createSessionId();
  trackSession(sessionId);

  if (request.method === "GET") {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            `event: endpoint\ndata: ${JSON.stringify({ sessionId, endpoint: "/api/mcp/sse" })}\n\n`
          )
        );
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": SSE_CONTENT_TYPE,
        "cache-control": "no-cache",
        "x-accel-buffering": "no",
        "mcp-session-id": sessionId,
      },
    });
  }

  if (request.method === "POST") {
    const rawBody = await request.text();
    const result = handleJsonRpcRequest(rawBody);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "content-type": JSON_CONTENT_TYPE,
        "mcp-session-id": sessionId,
      },
    });
  }

  return new Response("Method not allowed", { status: 405 });
}

export async function handleMcpStreamableHTTP(request: Request): Promise<Response> {
  const sessionId =
    request.headers.get("mcp-session-id") ??
    new URL(request.url).searchParams.get("sessionId") ??
    createSessionId();
  trackSession(sessionId);

  if (request.method === "DELETE") {
    endSession(sessionId);
    return new Response(null, {
      status: 204,
      headers: { "mcp-session-id": sessionId },
    });
  }

  if (request.method === "GET") {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(sseEventLines({ jsonrpc: JSON_RPC_VERSION, method: "notifications/message" }))
        );
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": SSE_CONTENT_TYPE,
        "cache-control": "no-cache",
        "mcp-session-id": sessionId,
      },
    });
  }

  if (request.method === "POST") {
    const rawBody = await request.text();
    const result = handleJsonRpcRequest(rawBody);
    const accept = request.headers.get("accept") ?? "";
    if (accept.includes("text/event-stream")) {
      return new Response(sseEventLines(result), {
        status: 200,
        headers: {
          "content-type": SSE_CONTENT_TYPE,
          "mcp-session-id": sessionId,
        },
      });
    }
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "content-type": JSON_CONTENT_TYPE,
        "mcp-session-id": sessionId,
      },
    });
  }

  return new Response("Method not allowed", { status: 405 });
}
