import { HTTP_STATUS } from "../config/constants";

export function errorResponse(
  status: number,
  message: string,
  details?: Record<string, unknown>
): Response {
  const body: Record<string, unknown> = {
    error: {
      message,
      status,
      timestamp: new Date().toISOString(),
    },
  };
  if (details) {
    (body.error as Record<string, unknown>).details = details;
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function unavailableResponse(
  status: number,
  message: string,
  retryAfterMs?: number,
  retryAfterHuman?: string
): Response {
  const retrySeconds = retryAfterMs ? Math.ceil(retryAfterMs / 1000) : undefined;
  const body: Record<string, unknown> = {
    error: {
      message,
      status,
      timestamp: new Date().toISOString(),
      retryAfterMs: retryAfterMs ?? null,
      retryAfterHuman: retryAfterHuman ?? null,
    },
  };
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (retrySeconds !== undefined) {
    headers["retry-after"] = String(retrySeconds);
  }
  return new Response(JSON.stringify(body), {
    status: status || HTTP_STATUS.SERVICE_UNAVAILABLE,
    headers,
  });
}
