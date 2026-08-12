export const CLAUDE_CODE_COMPATIBLE_DEFAULT_CHAT_PATH = "/v1/messages";
export const CLAUDE_CODE_COMPATIBLE_DEFAULT_MODELS_PATH = "/models";

function stripSuffixes(value: string, suffixes: string[]): string {
  let result = value;
  for (const suffix of suffixes) {
    if (result.endsWith(suffix)) {
      result = result.slice(0, -suffix.length);
      break;
    }
  }
  return result.replace(/\/+$/, "");
}

export function stripAnthropicMessagesSuffix(url: string): string {
  return stripSuffixes(url || "", ["/v1/messages", "/messages"]);
}

export function stripClaudeCodeCompatibleEndpointSuffix(url: string): string {
  return stripSuffixes(url || "", ["/v1/messages", "/messages"]);
}

export function joinBaseUrlAndPath(baseUrl: string, path: string): string {
  const base = (baseUrl || "").replace(/\/+$/, "");
  const p = (path || "").replace(/^\/+/, "");
  return p ? `${base}/${p}` : base;
}

export function joinClaudeCodeCompatibleUrl(baseUrl: string, path: string): string {
  return joinBaseUrlAndPath(baseUrl, path);
}

export function buildClaudeCodeCompatibleHeaders(
  apiKey: string,
  isBridgeRequest: boolean,
  sessionId?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "anthropic-version": "2023-06-01",
  };
  if (isBridgeRequest) {
    headers.authorization = `Bearer ${apiKey}`;
    headers["anthropic-beta"] = "oauth-2025-04-20";
    if (sessionId) {
      headers["anthropic-session-id"] = sessionId;
    }
  } else {
    headers["x-api-key"] = apiKey;
  }
  return headers;
}

export function buildClaudeCodeCompatibleValidationPayload(
  modelId: string
): {
  model: string;
  max_tokens: number;
  messages: Array<{ role: string; content: string }>;
  metadata: { user_id: string };
} {
  const sessionId = `validate-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    model: modelId || "claude-sonnet-4-5",
    max_tokens: 1,
    messages: [{ role: "user", content: "test" }],
    metadata: { user_id: JSON.stringify({ session_id: sessionId }) },
  };
}
