import { buildBearerHeaders, addModelsSuffix } from "../validationHttpSupport.ts";
import { assertProviderValidationTargetAllowed } from "../../security/egressGuard.ts";
import {
  connectionFailed,
  invalidApiKey,
  providerUnavailable,
  validationSuccess,
} from "./validationResult.ts";
import { resolveChatUrl } from "./validationFamilies.ts";

export async function validateOpenAILikeProvider({
  provider,
  apiKey,
  baseUrl,
  providerSpecificData = {},
  modelId = "gpt-4o-mini",
  modelsUrl: customModelsUrl,
}: any) {
  if (!baseUrl) {
    return connectionFailed("Missing base URL");
  }

  const modelsUrl = customModelsUrl || addModelsSuffix(baseUrl);
  if (!modelsUrl) {
    return connectionFailed("Invalid models endpoint");
  }

  await assertProviderValidationTargetAllowed(modelsUrl);
  const modelsRes = await fetch(modelsUrl, {
    method: "GET",
    headers: buildBearerHeaders(apiKey, providerSpecificData),
  });

  if (modelsRes.ok) {
    return validationSuccess();
  }

  if (modelsRes.status === 401 || modelsRes.status === 403) {
    return invalidApiKey();
  }

  const chatUrl = resolveChatUrl(provider, baseUrl, providerSpecificData);
  if (!chatUrl) {
    return { valid: false, error: `Validation failed: ${modelsRes.status}` };
  }

  await assertProviderValidationTargetAllowed(chatUrl);
  const testModelId = providerSpecificData?.validationModelId || modelId;
  const testBody = {
    model: testModelId,
    messages: [{ role: "user", content: "test" }],
    max_tokens: 1,
  };

  const chatRes = await fetch(chatUrl, {
    method: "POST",
    headers: buildBearerHeaders(apiKey, providerSpecificData),
    body: JSON.stringify(testBody),
  });

  if (chatRes.ok) {
    return validationSuccess();
  }

  if (chatRes.status === 401 || chatRes.status === 403) {
    return invalidApiKey();
  }

  if (chatRes.status === 404 || chatRes.status === 405) {
    return connectionFailed("Provider validation endpoint not supported");
  }

  if (chatRes.status >= 500) {
    return providerUnavailable(chatRes.status);
  }

  return validationSuccess();
}
