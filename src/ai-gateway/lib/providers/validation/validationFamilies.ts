import { isOpenAICompatibleProvider } from "@/shared/constants/providers";
import {
  stripAnthropicMessagesSuffix,
  stripClaudeCodeCompatibleEndpointSuffix,
} from "@zavorth/ai-gateway/open-sse/services/claudeCodeCompatible.ts";
import { normalizeBaseUrl } from "../validationHttpSupport.ts";

export const OPENAI_LIKE_FORMATS = new Set(["openai", "openai-responses"]);
export const GEMINI_LIKE_FORMATS = new Set(["gemini", "gemini-cli"]);

export function normalizeAnthropicBaseUrl(baseUrl: string) {
  return stripAnthropicMessagesSuffix(baseUrl || "");
}

export function normalizeClaudeCodeCompatibleBaseUrl(baseUrl: string) {
  return stripClaudeCodeCompatibleEndpointSuffix(baseUrl || "");
}

export function resolveBaseUrl(entry: any, providerSpecificData: any = {}) {
  if (providerSpecificData?.baseUrl) return normalizeBaseUrl(providerSpecificData.baseUrl);
  if (entry?.baseUrl) return normalizeBaseUrl(entry.baseUrl);
  return "";
}

export function resolveChatUrl(
  provider: string,
  baseUrl: string,
  providerSpecificData: any = {}
) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return "";

  if (isOpenAICompatibleProvider(provider)) {
    if (providerSpecificData?.chatPath) {
      return `${normalized}${providerSpecificData.chatPath}`;
    }
    if (providerSpecificData?.apiType === "responses") {
      return `${normalized}/responses`;
    }
    return `${normalized}/chat/completions`;
  }

  if (
    normalized.endsWith("/chat/completions") ||
    normalized.endsWith("/responses") ||
    normalized.endsWith("/chat")
  ) {
    return normalized;
  }

  if (normalized.endsWith("/v1")) {
    return `${normalized}/chat/completions`;
  }

  return normalized;
}
