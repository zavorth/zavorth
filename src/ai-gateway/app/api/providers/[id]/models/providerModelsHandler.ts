import { getProviderConnectionById } from "@/models";
import { resolveProxyForProvider } from "@/lib/localDb";
import {
  isAnthropicCompatibleProvider,
  isClaudeCodeCompatibleProvider,
  isOpenAICompatibleProvider,
} from "@/shared/constants/providers";
import type {
  ProviderModelsHandlerContext,
  ProviderModelsRouteContext,
} from "./providerModelsRouteTypes";
import {
  getCatalogModels,
  getStaticModelsForProvider,
  PROVIDER_MODELS_CONFIG,
} from "./providerModelsCatalog";
import {
  getAccessToken,
  getApiKey,
  getConnectionId,
  getExcludeHiddenFlag,
  getNormalizedProvider,
} from "./providerModelsContext";
import { createModelsResponseBuilder, jsonError } from "./providerModelsResponse";



import {
  fetchAnthropicCompatibleModels,
  fetchGenericProviderModels,
  fetchGeminiCliModels,
  fetchGlmModels,
  fetchOpenAiCompatibleModels,
} from "./providerModelsFetchers";function buildModelsContext(
  request: Request,
  id: string,
  excludeHidden: boolean,
  connection: NonNullable<Awaited<ReturnType<typeof getProviderConnectionById>>>,
  provider: string,
  proxy: Awaited<ReturnType<typeof resolveProxyForProvider>>
): ProviderModelsHandlerContext {
  return {
    request,
    id,
    connection,
    provider,
    connectionId: getConnectionId(connection, id),
    apiKey: getApiKey(connection),
    accessToken: getAccessToken(connection),
    excludeHidden,
    proxy,
    buildResponse: createModelsResponseBuilder(provider, excludeHidden),
  };
}

export async function handleProviderModelsGet(
  request: Request,
  context: ProviderModelsRouteContext
) {
  try {
    const params = await context.params;
    const id = params.id;
    const excludeHidden = getExcludeHiddenFlag(request);
    const connection = await getProviderConnectionById(id);

    if (!connection) {
      return jsonError("Connection not found", 404);
    }

    const provider = getNormalizedProvider(connection);
    if (!provider) {
      return jsonError("Invalid connection provider", 400);
    }

    const proxy = await resolveProxyForProvider(provider);
    const modelsContext = buildModelsContext(
      request,
      id,
      excludeHidden,
      connection,
      provider,
      proxy
    );

    if (isOpenAICompatibleProvider(provider)) {
      return fetchOpenAiCompatibleModels(modelsContext);
    }

    if (provider === "claude") {
      return modelsContext.buildResponse({
        provider,
        connectionId: modelsContext.connectionId,
        models: getStaticModelsForProvider("claude") || [],
      });
    }

    if (provider === "glm") {
      return fetchGlmModels(modelsContext);
    }

    if (provider === "gemini-cli") {
      return fetchGeminiCliModels(modelsContext);
    }

    if (isAnthropicCompatibleProvider(provider)) {
      if (isClaudeCodeCompatibleProvider(provider)) {
        return jsonError(`Provider ${provider} does not support models listing`, 400);
      }
      return fetchAnthropicCompatibleModels(modelsContext);
    }

    const staticModels = getStaticModelsForProvider(provider);
    if (staticModels) {
      return modelsContext.buildResponse({
        provider,
        connectionId: modelsContext.connectionId,
        models: staticModels,
      });
    }

    if (provider === "qwen" && connection.authType === "oauth") {
      return modelsContext.buildResponse({
        provider,
        connectionId: modelsContext.connectionId,
        models: getCatalogModels("qwen").map((model: any) => ({
          id: model.id,
          name: model.name || model.id,
          owned_by: "qwen",
        })),
        source: "local_catalog",
      });
    }

    const config =
      provider in PROVIDER_MODELS_CONFIG
        ? PROVIDER_MODELS_CONFIG[provider as keyof typeof PROVIDER_MODELS_CONFIG]
        : undefined;
    if (!config) {
      return jsonError(`Provider ${provider} does not support models listing`, 400);
    }

    return fetchGenericProviderModels(modelsContext, config);
  } catch (error: unknown) {console.log("Error fetching provider models:", error);
    return jsonError("Failed to fetch models", 500);
  }
}
