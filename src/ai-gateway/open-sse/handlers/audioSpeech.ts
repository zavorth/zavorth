import type { AudioProviderConfig } from "../config/audioRegistry";
import { HTTP_STATUS } from "../config/constants";
import {
  extractApiKey,
  providerAuthHeaders,
  type HandlerCredentials,
} from "./types";

export interface HandleAudioSpeechInput {
  body: Record<string, unknown>;
  credentials?: HandlerCredentials | null;
  resolvedProvider?: AudioProviderConfig | null;
  resolvedModel?: string;
}

const DEFAULT_SPEECH_BASE = "https://api.openai.com/v1/audio/speech";

function asErrorResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({
      error: { message, status, timestamp: new Date().toISOString() },
    }),
    { status, headers: { "content-type": "application/json" } }
  );
}

export async function handleAudioSpeech({
  body,
  credentials,
  resolvedProvider,
  resolvedModel,
}: HandleAudioSpeechInput): Promise<Response> {
  const psd =
    credentials?.providerSpecificData && typeof credentials.providerSpecificData === "object"
      ? credentials.providerSpecificData
      : {};
  const url =
    resolvedProvider?.baseUrl ||
    (typeof psd.baseUrl === "string" && psd.baseUrl) ||
    DEFAULT_SPEECH_BASE;
  const apiKey = extractApiKey(credentials);
  const payload: Record<string, unknown> = { ...body };
  if (resolvedModel) {
    payload.model = resolvedModel;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...providerAuthHeaders(resolvedProvider, apiKey),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const message =
        typeof data.error === "object" && data.error !== null
          ? String((data.error as Record<string, unknown>).message ?? `Speech provider returned HTTP ${res.status}`)
          : `Speech provider returned HTTP ${res.status}`;
      return asErrorResponse(res.status, message);
    }

    return new Response(res.body, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") || "audio/mpeg" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return asErrorResponse(HTTP_STATUS.BAD_GATEWAY, `Speech synthesis failed: ${message}`);
  }
}
