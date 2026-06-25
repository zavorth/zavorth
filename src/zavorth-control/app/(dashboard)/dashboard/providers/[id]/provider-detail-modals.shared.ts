"use client";

export const CC_COMPATIBLE_DETAILS_TITLE = "CC Compatible Details";
export const CC_COMPATIBLE_DEFAULT_CHAT_PATH = "/v1/messages?beta=true";
export const DEFAULT_BAILIAN_BASE_URL = "https://coding-intl.dashscope.aliyuncs.com/apps/anthropic/v1";
export const DEFAULT_VERTEX_REGION = "us-central1";

export const ERROR_TYPE_LABELS: Record<string, { labelKey: string; variant: string }> = {
  runtime_error: { labelKey: "errorTypeRuntime", variant: "warning" },
  upstream_auth_error: { labelKey: "errorTypeUpstreamAuth", variant: "error" },
  account_deactivated: { labelKey: "Account Deactivated", variant: "error" },
  auth_missing: { labelKey: "errorTypeMissingCredential", variant: "warning" },
  token_refresh_failed: { labelKey: "errorTypeRefreshFailed", variant: "warning" },
  token_expired: { labelKey: "errorTypeTokenExpired", variant: "warning" },
  upstream_rate_limited: { labelKey: "errorTypeRateLimited", variant: "warning" },
  upstream_unavailable: { labelKey: "errorTypeUpstreamUnavailable", variant: "error" },
  network_error: { labelKey: "errorTypeNetworkError", variant: "warning" },
  unsupported: { labelKey: "errorTypeTestUnsupported", variant: "default" },
  upstream_error: { labelKey: "errorTypeUpstreamError", variant: "error" },
  banned: { labelKey: "403 Banned", variant: "error" },
  credits_exhausted: { labelKey: "No Credits", variant: "warning" },
};

export function normalizeAndValidateHttpBaseUrl(rawValue: unknown, fallbackUrl: string) {
  const value = (typeof rawValue === "string" ? rawValue.trim() : "") || fallbackUrl;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { value: null, error: "Base URL must use http or https" };
    }
    return { value, error: null };
  } catch {
    return { value: null, error: "Base URL must be a valid URL" };
  }
}
