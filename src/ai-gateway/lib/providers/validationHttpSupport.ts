export function normalizeBaseUrl(baseUrl: string) {
  return (baseUrl || "").trim().replace(/\/$/, "");
}

export function addModelsSuffix(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return "";

  const suffixes = ["/chat/completions", "/responses", "/chat", "/messages"];
  for (const suffix of suffixes) {
    if (normalized.endsWith(suffix)) {
      return `${normalized.slice(0, -suffix.length)}/models`;
    }
  }

  return `${normalized}/models`;
}

function getCustomUserAgent(providerSpecificData: unknown = {}) {
  if (typeof providerSpecificData?.customUserAgent !== "string") return null;
  const customUserAgent = providerSpecificData.customUserAgent.trim();
  return customUserAgent || null;
}

export function applyCustomUserAgent(headers: Record<string, string>, providerSpecificData: unknown = {}) {
  const customUserAgent = getCustomUserAgent(providerSpecificData);
  if (!customUserAgent) return headers;
  headers["User-Agent"] = customUserAgent;
  if ("user-agent" in headers) {
    headers["user-agent"] = customUserAgent;
  }
  return headers;
}

export function withCustomUserAgent(init: RequestInit, providerSpecificData: unknown = {}) {
  return {
    ...init,
    headers: applyCustomUserAgent(
      { ...((init.headers as Record<string, string> | undefined) || {}) },
      providerSpecificData
    ),
  };
}

export function buildBearerHeaders(apiKey: string, providerSpecificData: unknown = {}) {
  return applyCustomUserAgent(
    {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    providerSpecificData
  );
}
