import type { AudioProviderConfig } from "../config/audioRegistry";
import { HTTP_STATUS } from "../config/constants";
import {
  extractApiKey,
  providerAuthHeaders,
  type HandlerCredentials,
} from "./types";

export interface HandleAudioTranscriptionInput {
  formData: FormData;
  credentials?: HandlerCredentials | null;
  resolvedProvider?: AudioProviderConfig | null;
  resolvedModel?: string;
}

const DEFAULT_TRANSCRIPTION_BASE = "https://api.openai.com/v1/audio/transcriptions";

function asJsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function handleAudioTranscription({
  formData,
  credentials,
  resolvedProvider,
  resolvedModel,
}: HandleAudioTranscriptionInput): Promise<Response> {
  const psd =
    credentials?.providerSpecificData && typeof credentials.providerSpecificData === "object"
      ? credentials.providerSpecificData
      : {};
  const url =
    resolvedProvider?.baseUrl ||
    (typeof psd.baseUrl === "string" && psd.baseUrl) ||
    DEFAULT_TRANSCRIPTION_BASE;
  const apiKey = extractApiKey(credentials);

  if (resolvedModel) {
    formData.set("model", resolvedModel);
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: providerAuthHeaders(resolvedProvider, apiKey),
      body: formData,
    });
    const data = (await res.json().catch(() => ({}))) as unknown;
    return asJsonResponse(data, res.status);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return asJsonResponse(
      { error: { message, status: HTTP_STATUS.BAD_GATEWAY } },
      HTTP_STATUS.BAD_GATEWAY
    );
  }
}
