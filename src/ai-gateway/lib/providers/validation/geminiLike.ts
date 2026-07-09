import { assertProviderValidationTargetAllowed } from "../../security/egressGuard.ts";
import { applyCustomUserAgent } from "../validationHttpSupport.ts";
import { connectionFailed, invalidApiKey, validationFailed, validationSuccess } from "./validationResult.ts";

export async function validateGeminiLikeProvider({
  apiKey,
  baseUrl,
  authType,
  providerSpecificData = {},
}: any) {
  if (!baseUrl) {
    return connectionFailed("Missing base URL");
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authType === "oauth") {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else {
    headers["x-goog-api-key"] = apiKey;
  }
  applyCustomUserAgent(headers, providerSpecificData);

  await assertProviderValidationTargetAllowed(baseUrl);
  const response = await fetch(baseUrl, { method: "GET", headers });

  if (response.ok) {
    return validationSuccess();
  }

  if (response.status === 429) {
    return validationSuccess();
  }

  if (response.status === 400 || response.status === 401 || response.status === 403) {
    const isAuthError = (body: any) => {
      const message = (body?.error?.message || "").toLowerCase();
      const reason = body?.error?.details?.[0]?.reason || "";
      const status = body?.error?.status || "";
      const authPatterns = [
        "api key not valid",
        "api key expired",
        "api key invalid",
        "API_KEY_INVALID",
        "API_KEY_EXPIRED",
        "PERMISSION_DENIED",
        "UNAUTHENTICATED",
      ];
      return authPatterns.some(
        (pattern) => message.includes(pattern.toLowerCase()) || reason === pattern || status === pattern
      );
    };

    try {
      const body = await response.json();
      if (isAuthError(body)) {
        return invalidApiKey();
      }
      if (response.status === 401 || response.status === 403) {
        return invalidApiKey();
      }
    } catch (error: any) { const err = error; const e = error;
      if (response.status === 401 || response.status === 403) {
        return invalidApiKey();
      }
      return invalidApiKey();
    }
  }

  return validationFailed(response.status);
}
