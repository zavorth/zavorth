import { getRegistryEntry } from "../config/providerRegistry";
import { buildProviderUrl, getTargetFormat } from "../services/provider";
import type { HandlerCredentials, HandlerLogger } from "./types";

export interface ChatCoreModelInfo {
  provider: string;
  model: string;
  extendedContext?: boolean;
}

export interface ChatCoreResult {
  success: boolean;
  response: Response;
  status: number;
  error?: unknown;
}

export interface ChatCoreOptions {
  body: Record<string, unknown>;
  modelInfo: ChatCoreModelInfo;
  credentials: HandlerCredentials;
  log?: HandlerLogger;
  clientRawRequest?: unknown;
  connectionId?: string;
  apiKeyInfo?: unknown;
  userAgent?: string;
  comboName?: string;
  comboStrategy?: string;
  isCombo?: boolean;
  onCredentialsRefreshed?: (credentials: HandlerCredentials) => Promise<void>;
  onRequestSuccess?: () => Promise<void>;
}

function providerBaseUrl(provider: string, credentials: HandlerCredentials): string {
  const entry = getRegistryEntry(provider);
  const psd =
    credentials.providerSpecificData && typeof credentials.providerSpecificData === "object"
      ? credentials.providerSpecificData
      : {};
  const customBase = typeof psd.baseUrl === "string" && psd.baseUrl ? psd.baseUrl : "";
  return customBase || entry?.baseUrl || `https://api.${provider}.com/v1`;
}

export async function handleChatCore(options: ChatCoreOptions): Promise<ChatCoreResult> {
  const { body, modelInfo, credentials, log } = options;
  const provider = modelInfo.provider;
  const model = modelInfo.model;
  const apiKey =
    (typeof credentials.apiKey === "string" && credentials.apiKey) ||
    (typeof credentials.accessToken === "string" && credentials.accessToken) ||
    "";

  let url = "";
  let headers: Record<string, string> = {};
  try {
    const baseUrl = providerBaseUrl(provider, credentials);
    const target = getTargetFormat(provider, credentials.providerSpecificData);
    url = buildProviderUrl(provider, model, false, {
      baseUrl,
      providerSpecificData: credentials.providerSpecificData,
    });
    headers = { "content-type": "application/json" };
    if (target === "anthropic") {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers.authorization = `Bearer ${apiKey}`;
    }
    if (options.userAgent) {
      headers["user-agent"] = options.userAgent;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log?.error?.("CHAT_CORE", `Failed to build upstream request: ${message}`);
    const response = new Response(
      JSON.stringify({ error: { message, status: 500, timestamp: new Date().toISOString() } }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
    return { success: false, response, status: 500, error: message };
  }

  try {
    const payload = { ...body, model };
    const upstream = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (upstream.ok) {
      await options.onRequestSuccess?.();
      return { success: true, response: upstream, status: upstream.status };
    }

    const raw = await upstream.text().catch(() => "");
    const errorMessage = raw || `Upstream returned HTTP ${upstream.status}`;
    log?.warn?.("CHAT_CORE", `Upstream HTTP ${upstream.status} for ${provider}/${model}`);
    if (upstream.status === 401 && options.onCredentialsRefreshed) {
      await options.onCredentialsRefreshed(credentials).catch(() => undefined);
    }
    return {
      success: false,
      response: upstream,
      status: upstream.status,
      error: errorMessage,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log?.error?.("CHAT_CORE", `Upstream request failed for ${provider}/${model}: ${message}`);
    const response = new Response(
      JSON.stringify({ error: { message, status: 502, timestamp: new Date().toISOString() } }),
      { status: 502, headers: { "content-type": "application/json" } }
    );
    return { success: false, response, status: 502, error: message };
  }
}
