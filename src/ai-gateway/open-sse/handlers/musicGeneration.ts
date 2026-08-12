import { HTTP_STATUS } from "../config/constants";
import {
  bearerHeaders,
  extractApiKey,
  resolveBaseUrl,
  type HandlerCredentials,
  type HandlerLogger,
  type HandlerResult,
} from "./types";

export interface HandleMusicGenerationInput {
  body: Record<string, unknown>;
  credentials?: HandlerCredentials | null;
  log?: HandlerLogger;
}

const DEFAULT_MUSIC_BASE = "https://api.openai.com/v1/audio/music";

export async function handleMusicGeneration({
  body,
  credentials,
  log,
}: HandleMusicGenerationInput): Promise<HandlerResult<Record<string, unknown>>> {
  const psd =
    credentials?.providerSpecificData && typeof credentials.providerSpecificData === "object"
      ? credentials.providerSpecificData
      : {};
  const customBase =
    (typeof body.base_url === "string" && body.base_url) ||
    (typeof psd.baseUrl === "string" && psd.baseUrl) ||
    "";
  const url = resolveBaseUrl(customBase, DEFAULT_MUSIC_BASE);
  const apiKey = extractApiKey(credentials);
  const model = typeof body.model === "string" ? body.model : "suno-v4";

  if (!url) {
    const message = "No base URL configured for music provider";
    log?.warn?.("MUSIC", message);
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
    log?.error?.("MUSIC", `Music generation failed: ${err.message}`);
    return { success: false, error: err, status: HTTP_STATUS.BAD_GATEWAY };
  }
}
