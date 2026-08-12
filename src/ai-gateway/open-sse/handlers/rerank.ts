import { HTTP_STATUS } from "../config/constants";
import {
  bearerHeaders,
  extractApiKey,
  type HandlerCredentials,
} from "./types";

export interface HandleRerankInput {
  model: string;
  query: string;
  documents: Array<string | Record<string, unknown>>;
  top_n?: number;
  return_documents?: boolean;
  credentials?: HandlerCredentials | null;
}

const DEFAULT_RERANK_BASE = "https://api.cohere.com/v1/rerank";

function asErrorResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({
      error: { message, status, timestamp: new Date().toISOString() },
    }),
    { status, headers: { "content-type": "application/json" } }
  );
}

export async function handleRerank({
  model,
  query,
  documents,
  top_n,
  return_documents,
  credentials,
}: HandleRerankInput): Promise<Response> {
  const apiKey = extractApiKey(credentials);
  if (!apiKey) {
    return asErrorResponse(HTTP_STATUS.BAD_REQUEST, "Missing credentials for rerank provider");
  }

  const psd =
    credentials?.providerSpecificData && typeof credentials.providerSpecificData === "object"
      ? credentials.providerSpecificData
      : {};
  const baseUrl =
    (typeof psd.baseUrl === "string" && psd.baseUrl) || DEFAULT_RERANK_BASE;

  try {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: bearerHeaders(apiKey),
      body: JSON.stringify({
        model,
        query,
        documents,
        top_n: top_n ?? documents.length,
        return_documents: return_documents !== false,
      }),
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
        ? (data as Record<string, unknown>).message || `Rerank provider returned HTTP ${res.status}`
        : `Rerank provider returned HTTP ${res.status}`;
    return asErrorResponse(res.status, String(message));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return asErrorResponse(HTTP_STATUS.BAD_GATEWAY, `Rerank request failed: ${message}`);
  }
}
