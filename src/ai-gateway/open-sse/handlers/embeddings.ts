import type { EmbeddingProvider } from "../config/embeddingRegistry";
import { HTTP_STATUS } from "../config/constants";
import {
  bearerHeaders,
  extractApiKey,
  resolveBaseUrl,
  type HandlerCredentials,
  type HandlerLogger,
  type HandlerResult,
} from "./types";

export interface HandleEmbeddingInput {
  body: Record<string, unknown>;
  credentials?: HandlerCredentials | null;
  log?: HandlerLogger;
  resolvedProvider?: EmbeddingProvider | null;
  resolvedModel?: string;
}

const DEFAULT_EMBEDDING_BASE = "https://api.openai.com/v1/embeddings";

export async function handleEmbedding({
  body,
  credentials,
  log,
  resolvedProvider,
  resolvedModel,
}: HandleEmbeddingInput): Promise<HandlerResult<Record<string, unknown>>> {
  const psd =
    credentials?.providerSpecificData && typeof credentials.providerSpecificData === "object"
      ? credentials.providerSpecificData
      : {};
  const url = resolveBaseUrl(
    resolvedProvider?.baseUrl,
    (typeof psd.baseUrl === "string" && psd.baseUrl) || DEFAULT_EMBEDDING_BASE,
    "/embeddings"
  );
  const apiKey = extractApiKey(credentials);
  const model = resolvedModel || (typeof body.model === "string" ? body.model : "text-embedding-3-small");

  if (!url) {
    const message = "No base URL configured for embedding provider";
    log?.warn?.("EMBED", message);
    return { success: false, error: new Error(message), status: HTTP_STATUS.BAD_REQUEST };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: bearerHeaders(apiKey),
      body: JSON.stringify({ ...body, model }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) {
      return { success: true, data };
    }
    return { success: false, error: data, status: res.status };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    log?.error?.("EMBED", `Embedding request failed: ${err.message}`);
    return { success: false, error: err, status: HTTP_STATUS.BAD_GATEWAY };
  }
}
