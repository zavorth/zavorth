import type { ImageProviderConfig } from "../config/imageRegistry";
import { HTTP_STATUS } from "../config/constants";
import {
  bearerHeaders,
  extractApiKey,
  resolveBaseUrl,
  type HandlerCredentials,
  type HandlerLogger,
  type HandlerResult,
} from "./types";

export interface HandleImageGenerationInput {
  body: Record<string, unknown>;
  credentials?: HandlerCredentials | null;
  log?: HandlerLogger;
  resolvedProvider?: ImageProviderConfig | string | null;
}

const DEFAULT_IMAGE_BASE = "https://api.openai.com/v1/images/generations";

export async function handleImageGeneration({
  body,
  credentials,
  log,
  resolvedProvider,
}: HandleImageGenerationInput): Promise<HandlerResult<Record<string, unknown>>> {
  const providerConfig =
    typeof resolvedProvider === "string"
      ? { id: resolvedProvider, baseUrl: "" }
      : resolvedProvider || undefined;
  const psd =
    credentials?.providerSpecificData && typeof credentials.providerSpecificData === "object"
      ? credentials.providerSpecificData
      : {};
  const customBase =
    (typeof body.base_url === "string" && body.base_url) ||
    (typeof psd.baseUrl === "string" && psd.baseUrl) ||
    "";
  const url = resolveBaseUrl(providerConfig?.baseUrl || customBase, DEFAULT_IMAGE_BASE);
  const apiKey = extractApiKey(credentials);
  const model = typeof body.model === "string" ? body.model : "dall-e-3";

  if (!url) {
    const message = "No base URL configured for image provider";
    log?.warn?.("IMAGE", message);
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
    log?.error?.("IMAGE", `Image generation failed: ${err.message}`);
    return { success: false, error: err, status: HTTP_STATUS.BAD_GATEWAY };
  }
}
