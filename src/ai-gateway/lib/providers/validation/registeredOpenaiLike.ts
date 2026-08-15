import { buildBearerHeaders } from "../validationHttpSupport.ts";
import { assertProviderValidationTargetAllowed } from "../../security/egressGuard.ts";
import { logger } from '@/shared/utils/logger';
import {
connectionFailed,
  invalidApiKey,
  providerUnavailable,
  validationSuccess,
} from "./validationResult.ts";
import { asErrorLike } from '../../../../utils/errorLike.js';

export async function validateRegisteredOpenAILikeProvider({
  provider,
  apiKey,
  baseUrl,
  providerSpecificData = {},
  modelId = "gpt-4o-mini",
  modelsUrl: customModelsUrl,
}: any) {
  if (!baseUrl) {
    return { valid: false, error: "No base URL configured for OpenAI compatible provider" };
  }

  const validationModelId =
    typeof providerSpecificData?.validationModelId === "string"
      ? providerSpecificData.validationModelId.trim()
      : "";

  let modelsReachable = false;
  try {
    const modelsUrl = customModelsUrl || `${baseUrl}/models`;
    await assertProviderValidationTargetAllowed(modelsUrl);
    const modelsRes = await fetch(modelsUrl, {
      method: "GET",
      headers: buildBearerHeaders(apiKey, providerSpecificData),
    });

    modelsReachable = true;

    if (modelsRes.ok) {
      return { valid: true, error: null, method: "models_endpoint" };
    }

    if (modelsRes.status === 401 || modelsRes.status === 403) {
      return invalidApiKey();
    }

    if (modelsRes.status === 429) {
      return {
        valid: true,
        error: null,
        method: "models_endpoint",
        warning: "Rate limited, but credentials are valid",
      };
    }
  } catch (error: unknown) {// Fall through to chat test.
      logger.warn('[registered Openai Like] validation failed', error);
    }

  if (!validationModelId) {
    return {
      valid: false,
      error: "Endpoint /models unavailable. Provide a Model ID to validate via /chat/completions.",
    };
  }

  const apiType = providerSpecificData.apiType || "chat";
  const chatSuffix = apiType === "responses" ? "/responses" : "/chat/completions";
  const chatUrl = `${baseUrl}${chatSuffix}`;

  try {
    await assertProviderValidationTargetAllowed(chatUrl);
    const chatRes = await fetch(chatUrl, {
      method: "POST",
      headers: buildBearerHeaders(apiKey, providerSpecificData),
      body: JSON.stringify({
        model: validationModelId,
        messages: [{ role: "user", content: "test" }],
        max_tokens: 1,
      }),
    });

    if (chatRes.ok) {
      return { valid: true, error: null, method: "chat_completions" };
    }

    if (chatRes.status === 401 || chatRes.status === 403) {
      return invalidApiKey();
    }

    if (chatRes.status === 429) {
      return {
        valid: true,
        error: null,
        method: "chat_completions",
        warning: "Rate limited, but credentials are valid",
      };
    }

    if (chatRes.status === 400) {
      return {
        valid: false,
        error: `Provider rejected inference request with status 400 — credentials not verified`,
        method: "inference_available",
      };
    }

    if (chatRes.status >= 400 && chatRes.status < 500) {
      return {
        valid: false,
        error: `Provider rejected inference request with status ${chatRes.status} — credentials not verified`,
        method: "inference_available",
      };
    }

    if (chatRes.status >= 500) {
      return providerUnavailable(chatRes.status);
    }
  } catch (error: unknown) {// Chat test also failed — fall through to simple connectivity check.
      logger.warn('[registered Openai Like] validation failed', error);
    }

  if (!modelsReachable) {
    return connectionFailed("Connection failed while testing /chat/completions");
  }

  try {
    await assertProviderValidationTargetAllowed(baseUrl);
    const pingRes = await fetch(baseUrl, {
      method: "GET",
      headers: buildBearerHeaders(apiKey, providerSpecificData),
      signal: AbortSignal.timeout(5000),
    });

    if (pingRes.status < 500) {
      return validationSuccess();
    }

    return providerUnavailable(pingRes.status);
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[registered Openai Like] network request failed', error);
    return connectionFailed(err.message || "Connection failed");
  }
}
