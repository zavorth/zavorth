import { joinBaseUrlAndPath } from "@ZavorthGateway/open-sse/services/claudeCodeCompatible.ts";
import { assertProviderValidationTargetAllowed } from "../../security/egressGuard.ts";
import { applyCustomUserAgent } from "../validationHttpSupport.ts";
import {
  connectionFailed,
  invalidApiKey,
  validationSuccess,
} from "./validationResult.ts";
import { normalizeAnthropicBaseUrl } from "./validationFamilies.ts";

import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../utils/errorLike.js';
export async function validateAnthropicLikeProvider({
  apiKey,
  baseUrl,
  modelId,
  modelsPath,
  chatPath,
  headers = {},
  providerSpecificData = {},
}: any) {
  let normalizedBaseUrl = normalizeAnthropicBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    return connectionFailed("No base URL configured for Anthropic compatible provider");
  }

  const requestHeaders = applyCustomUserAgent(
    {
      "Content-Type": "application/json",
      ...headers,
    },
    providerSpecificData
  );

  if (!requestHeaders["x-api-key"] && !requestHeaders["X-API-Key"]) {
    requestHeaders["x-api-key"] = apiKey;
  }

  if (!requestHeaders["anthropic-version"] && !requestHeaders["Anthropic-Version"]) {
    requestHeaders["anthropic-version"] = "2023-06-01";
  }

  try {
    const modelsUrl = joinBaseUrlAndPath(normalizedBaseUrl, modelsPath || "/models");
    await assertProviderValidationTargetAllowed(modelsUrl);
    const modelsRes = await fetch(modelsUrl, {
      method: "GET",
      headers: requestHeaders,
    });

    if (modelsRes.ok) {
      return validationSuccess();
    }

    if (modelsRes.status === 401 || modelsRes.status === 403) {
      return invalidApiKey();
    }
  } catch (error: unknown) {// Fall through to messages test.
      logger.warn('[anthropic Like] network request failed', error);
    }

  const testModelId = modelId || "claude-3-5-sonnet-20241022";
  try {
    const messagesUrl = joinBaseUrlAndPath(normalizedBaseUrl, chatPath || "/messages");
    await assertProviderValidationTargetAllowed(messagesUrl);
    const messagesRes = await fetch(messagesUrl, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({
        model: testModelId,
        max_tokens: 1,
        messages: [{ role: "user", content: "test" }],
      }),
    });

    if (messagesRes.status === 401 || messagesRes.status === 403) {
      return invalidApiKey();
    }

    return validationSuccess();
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[anthropic Like] network request failed', error);
    return connectionFailed(err.message || "Connection failed");
  }
}
