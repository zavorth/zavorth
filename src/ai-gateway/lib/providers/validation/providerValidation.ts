import { getRegistryEntry } from "@ZavorthGateway/open-sse/config/providerRegistry.ts";
import { validateSpecialtyProvider } from "../validationSpecialtyProviders.ts";
import { isAnthropicCompatibleProvider, isClaudeCodeCompatibleProvider, isOpenAICompatibleProvider } from "@/shared/constants/providers";
import { validateAnthropicLikeProvider } from "./anthropicLike.ts";
import { validateClaudeCodeCompatibleProvider } from "./claudeCodeCompatible.ts";
import { GEMINI_LIKE_FORMATS, OPENAI_LIKE_FORMATS, resolveBaseUrl } from "./validationFamilies.ts";
import { validateGeminiLikeProvider } from "./geminiLike.ts";
import { validateOpenAILikeProvider } from "./openaiLike.ts";
import { validateRegisteredOpenAILikeProvider } from "./registeredOpenaiLike.ts";
import { normalizeBaseUrl } from "../validationHttpSupport.ts";
import { validationFailure } from "./validationResult.ts";
import type { ProviderValidationResult } from "./validationResult.ts";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../utils/errorLike.js';

export { validateClaudeCodeCompatibleProvider };

export async function validateProviderApiKey({
  provider,
  apiKey,
  providerSpecificData = {},
}: any): Promise<ProviderValidationResult> {
  if (!provider || !apiKey) {
    return { valid: false, error: "Provider and API key required", unsupported: false };
  }

  if (isOpenAICompatibleProvider(provider)) {
    try {
      const genericOpenAIProviderData = { ...providerSpecificData };
      delete genericOpenAIProviderData.chatPath;
      delete genericOpenAIProviderData.modelsUrl;

      return await validateOpenAILikeProvider({
        provider,
        apiKey,
        baseUrl: normalizeBaseUrl(providerSpecificData.baseUrl || ""),
        providerSpecificData: genericOpenAIProviderData,
        modelId: providerSpecificData?.validationModelId || "gpt-4o-mini",
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[provider Validation] delete operation failed', error);
    return { valid: false, error: err.message || "Validation failed", unsupported: false };
  }
  }

  if (isAnthropicCompatibleProvider(provider)) {
    try {
      if (isClaudeCodeCompatibleProvider(provider)) {
        return await validateClaudeCodeCompatibleProvider({ apiKey, providerSpecificData });
      }

      return await validateAnthropicLikeProvider({
        apiKey,
        baseUrl: normalizeBaseUrl(providerSpecificData.baseUrl || ""),
        modelId: providerSpecificData?.validationModelId || "claude-3-5-sonnet-20241022",
        modelsPath: providerSpecificData?.modelsPath,
        chatPath: providerSpecificData?.chatPath,
        providerSpecificData,
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[provider Validation] validation failed', error);
    return { valid: false, error: err.message || "Validation failed", unsupported: false };
  }
  }

  const specialtyResult = await validateSpecialtyProvider({ provider, apiKey, providerSpecificData });
  if (specialtyResult) {
    return specialtyResult;
  }

  const entry = getRegistryEntry(provider);
  if (!entry) {
    return { valid: false, error: "Provider validation not supported", unsupported: true };
  }

  const modelId = entry.models?.[0]?.id || null;
  const validationEntry = entry.testKeyBaseUrl ? { ...entry, baseUrl: entry.testKeyBaseUrl } : entry;
  const baseUrl = resolveBaseUrl(validationEntry, providerSpecificData);

  try {
    if (OPENAI_LIKE_FORMATS.has(entry.format)) {
      return await validateRegisteredOpenAILikeProvider({
        provider,
        apiKey,
        baseUrl,
        providerSpecificData,
        modelId,
        modelsUrl: entry.modelsUrl,
      });
    }

    if (entry.format === "claude") {
      const requestBaseUrl = `${baseUrl}${entry.urlSuffix || ""}`;
      const requestHeaders = {
        ...(entry.headers || {}),
      };

      if ((entry.authHeader || "").toLowerCase() === "x-api-key") {
        requestHeaders["x-api-key"] = apiKey;
      } else {
        requestHeaders["Authorization"] = `Bearer ${apiKey}`;
      }

      return await validateAnthropicLikeProvider({
        apiKey,
        baseUrl: requestBaseUrl,
        modelId,
        headers: requestHeaders,
        modelsPath: providerSpecificData?.modelsPath,
        chatPath: providerSpecificData?.chatPath,
        providerSpecificData,
      });
    }

    if (GEMINI_LIKE_FORMATS.has(entry.format)) {
      return await validateGeminiLikeProvider({
        apiKey,
        baseUrl,
        providerSpecificData,
        authType: entry.authType,
      });
    }

    return { valid: false, error: "Provider validation not supported", unsupported: true };
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[provider Validation] validation failed', error);
    return validationFailure(err.message || "Validation failed", { unsupported: false });
  }
}
