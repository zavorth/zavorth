import type { OAuthCallbackData } from "./oauthModalTypes";

const GOOGLE_OAUTH_PROVIDERS = new Set(["zavorthBridge", "gemini-cli"]);
const DEVICE_CODE_PROVIDERS = new Set(["github", "qwen", "kiro", "kimi-coding", "kilocode"]);
const MANUAL_INPUT_PROVIDERS = new Set(["claude", "cline"]);

type OAuthErrorDetail = {
  field?: string;
  message?: string;
};

type OAuthErrorObject = {
  message?: string;
  details?: OAuthErrorDetail[];
};

export function isGoogleOAuthProvider(provider?: string): boolean {
  return typeof provider === "string" && GOOGLE_OAUTH_PROVIDERS.has(provider);
}

export function isDeviceCodeProvider(provider?: string): boolean {
  return typeof provider === "string" && DEVICE_CODE_PROVIDERS.has(provider);
}

export function shouldForceManualInput(provider?: string): boolean {
  return typeof provider === "string" && MANUAL_INPUT_PROVIDERS.has(provider);
}

export function readOAuthErrorMessage(data: unknown, fallback: string): string {
  const payload = data as { error?: string | OAuthErrorObject } | null;
  const error = payload?.error;
  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  if (error && typeof error === "object") {
    const errorObject = error as OAuthErrorObject;
    const message = errorObject.message || JSON.stringify(errorObject);
    const details = Array.isArray(errorObject.details)
      ? errorObject.details
          .map((detail) => {
            if (!detail?.message) return null;
            return detail.field ? `${detail.field}: ${detail.message}` : detail.message;
          })
          .filter((detail): detail is string => Boolean(detail))
          .join("; ")
      : "";
    return details ? `${message} (${details})` : message;
  }

  return fallback;
}

export function buildGoogleRedirectMismatchMessage(provider?: string): string {
  const credentialVars =
    provider === "zavorthBridge"
      ? "ZAVORTH_BRIDGE_OAUTH_CLIENT_ID and ZAVORTH_BRIDGE_OAUTH_CLIENT_SECRET"
      : "GEMINI_CLI_OAUTH_CLIENT_ID and GEMINI_CLI_OAUTH_CLIENT_SECRET";
  return (
    "redirect_uri_mismatch: The default Google OAuth credentials only work on localhost. " +
    "For remote use, configure your own OAuth credentials via environment variables: " +
    credentialVars +
    ". See the README section 'OAuth on a Remote Server'."
  );
}

export function buildRedirectUri(provider: string, isLocalhost: boolean): string {
  if (provider === "codex" || provider === "openai") {
    return "http://localhost:1455/auth/callback";
  }

  if (isGoogleOAuthProvider(provider)) {
    const port = window.location.port || "20128";
    return `http://localhost:${port}/callback`;
  }

  if (!isLocalhost) {
    const publicUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const origin =
      publicUrl && publicUrl !== "http://localhost:20128"
        ? publicUrl.replace(/\/$/, "")
        : window.location.origin;
    return `${origin}/callback`;
  }

  const port = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
  return `http://localhost:${port}/callback`;
}

export function isAcceptedCallbackOrigin(
  eventOrigin: string,
  currentOrigin: string,
  currentPort: string
): boolean {
  if (eventOrigin === currentOrigin) {
    return true;
  }

  return (
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(eventOrigin) &&
    new URL(eventOrigin).port === currentPort
  );
}

export function parseCallbackInput(
  input: string,
  fallbackState?: string | null
): OAuthCallbackData {
  try {
    const url = new URL(input);
    return {
      code: url.searchParams.get("code"),
      state: url.searchParams.get("state") || url.hash.replace(/^#/, "") || fallbackState || null,
      error: url.searchParams.get("error"),
      errorDescription: url.searchParams.get("error_description"),
    };
  } catch (error: any) { const err = error; const e = error;
    const [rawCode, rawState] = input.split("#", 2);
    return {
      code: rawCode || null,
      state: rawState || fallbackState || null,
    };
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
