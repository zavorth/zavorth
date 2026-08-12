import { HTTP_STATUS } from "../config/constants";
import {
  bearerHeaders,
  extractApiKey,
  type HandlerCredentials,
} from "./types";

export interface HandleModerationInput {
  body: Record<string, unknown>;
  credentials?: HandlerCredentials | null;
}

const DEFAULT_MODERATION_BASE = "https://api.openai.com/v1/moderations";

function asErrorResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({
      error: { message, status, timestamp: new Date().toISOString() },
    }),
    { status, headers: { "content-type": "application/json" } }
  );
}

export async function handleModeration({
  body,
  credentials,
}: HandleModerationInput): Promise<Response> {
  const apiKey = extractApiKey(credentials);
  if (!apiKey) {
    return asErrorResponse(HTTP_STATUS.BAD_REQUEST, "Missing credentials for moderation provider");
  }

  const psd =
    credentials?.providerSpecificData && typeof credentials.providerSpecificData === "object"
      ? credentials.providerSpecificData
      : {};
  const baseUrl =
    (typeof psd.baseUrl === "string" && psd.baseUrl) || DEFAULT_MODERATION_BASE;

  try {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: bearerHeaders(apiKey),
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as unknown;
    if (res.ok) {
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    const message =
      data && typeof data === "object"
        ? (data as Record<string, unknown>).message || `Moderation provider returned HTTP ${res.status}`
        : `Moderation provider returned HTTP ${res.status}`;
    return asErrorResponse(res.status, String(message));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return asErrorResponse(HTTP_STATUS.BAD_GATEWAY, `Moderation request failed: ${message}`);
  }
}
