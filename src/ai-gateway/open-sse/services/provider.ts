import { REGISTRY } from "../config/providerRegistry";
import { parseModel, type ModelInfo } from "./model";

export function getModelInfo(rawModel: string): ModelInfo | null {
  return parseModel(rawModel);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function detectFormat(bodyOrEndpoint: unknown, endpointPath = ""): string {
  const endpoint = typeof bodyOrEndpoint === "string" ? bodyOrEndpoint : endpointPath;
  const normalizedEndpoint = endpoint.toLowerCase();

  if (normalizedEndpoint.includes("/v1/messages") || normalizedEndpoint.includes("/messages")) {
    return "anthropic";
  }
  if (normalizedEndpoint.includes("/embeddings")) return "openai";
  if (normalizedEndpoint.includes("/generatecontent") || normalizedEndpoint.includes(":generatecontent")) {
    return "gemini";
  }
  if (normalizedEndpoint.includes("/responses")) return "openai-responses";
  if (normalizedEndpoint.includes("/completions")) return "openai";

  if (bodyOrEndpoint && typeof bodyOrEndpoint === "object") {
    const body = asRecord(bodyOrEndpoint);
    if ("contents" in body || "systemInstruction" in body || "instances" in body) {
      return "gemini";
    }
    if ("messages" in body) {
      const messages = body.messages;
      if (Array.isArray(messages) && messages.length > 0) {
        const first = asRecord(messages[0]);
        const content = first.content;
        const hasBlockContent =
          Array.isArray(content) &&
          content.length > 0 &&
          asRecord(content[0]).type !== undefined;
        if (hasBlockContent || "content_blocks" in first) return "anthropic";
      }
      return "openai";
    }
  }

  return "openai";
}

export function detectFormatFromEndpoint(body: unknown, endpointPath = ""): string {
  return detectFormat(body, endpointPath);
}

export function getTargetFormat(provider: string, providerSpecificData?: unknown): string {
  const entry = REGISTRY[provider];
  if (entry?.type) return entry.type;
  const psd = asRecord(providerSpecificData);
  if (psd.apiType === "responses") return "openai-responses";
  if (typeof psd.apiFormat === "string" && psd.apiFormat) return psd.apiFormat;
  return "openai";
}

export function buildProviderUrl(
  provider: string,
  model: string,
  isPreview: boolean,
  options?: { baseUrlIndex?: number; baseUrl?: string; providerSpecificData?: unknown }
): string {
  const psd = asRecord(options?.providerSpecificData);
  const customBase =
    (typeof options?.baseUrl === "string" && options.baseUrl) ||
    (typeof psd.baseUrl === "string" && psd.baseUrl);
  const base = (customBase || REGISTRY[provider]?.baseUrl || `https://api.${provider}.com/v1`).replace(
    /\/+$/,
    ""
  );
  const target = getTargetFormat(provider, psd);
  if (target === "anthropic") return `${base}/v1/messages`;
  if (target === "openai-responses") return `${base}/responses`;
  if (target === "gemini") return `${base}/v1beta/models/${model}:generateContent`;
  return `${base}/chat/completions`;
}

export function buildProviderHeaders(
  provider: string,
  credentials: unknown,
  isPreview: boolean,
  body?: unknown
): Record<string, string> {
  const creds = asRecord(credentials);
  const apiKey =
    (typeof creds.apiKey === "string" && creds.apiKey) ||
    (typeof creds.accessToken === "string" && creds.accessToken) ||
    "";
  const target = getTargetFormat(provider, creds.providerSpecificData);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (target === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else {
    headers.authorization = `Bearer ${apiKey}`;
  }
  return headers;
}
