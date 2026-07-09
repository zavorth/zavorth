import { runWithProxyContext } from "@ZavorthGateway/open-sse/utils/proxyFetch.ts";
import type {
  ProviderModelsConfigEntry,
  ProviderModelsHandlerContext,
} from "./providerModelsRouteTypes";
import {
  GLM_MODELS_URLS,
  getCatalogModels,
} from "./providerModelsCatalog";
import {
  asRecord,
  getGlmApiRegion,
  getProviderBaseUrl,
} from "./providerModelsContext";
import { jsonError } from "./providerModelsResponse";
import { assertProviderValidationTargetAllowed } from "@/lib/security/egressGuard";
import { OpenAiCompatibleModelDiscoveryAdapter } from "../../../../../../services/providers/catalog/discovery/OpenAiCompatibleModelDiscoveryAdapter.js";
import { AnthropicCompatibleModelDiscoveryAdapter } from "../../../../../../services/providers/catalog/discovery/AnthropicCompatibleModelDiscoveryAdapter.js";

export async function fetchOpenAiCompatibleModels(
  context: ProviderModelsHandlerContext
) {
  const { apiKey, buildResponse, connection, connectionId, provider, proxy } = context;
  const baseUrl = getProviderBaseUrl(connection.providerSpecificData);
  if (!baseUrl) {
    return jsonError("No base URL configured for OpenAI compatible provider", 400);
  }

  const discovery = await new OpenAiCompatibleModelDiscoveryAdapter().discover({
    providerId: provider,
    alias: provider,
    label: provider,
    baseUrl,
    apiKey,
    fetchImpl: ((url: RequestInfo | URL, init?: RequestInit) => runWithProxyContext(proxy, () => fetch(url, init))) as typeof fetch,
  });

  if (discovery.status === 401 || discovery.status === 403) {
    return jsonError(`Auth failed: ${discovery.status}`, discovery.status);
  }

  let models: any[] = discovery.providerCatalog.models.map((model) => ({
    id: model.id,
    name: model.name || model.id,
    owned_by: provider,
  }));
  if (discovery.source !== "live_api") {
    console.warn(`[models] All endpoints failed for ${provider}, using local catalog`);
    const localModels = getCatalogModels(provider);
    models = localModels.map((model: any) => ({
      id: model.id,
      name: model.name || model.id,
      owned_by: provider,
    }));
  }

  const source = discovery.source === "live_api" ? "live_api" : "local_catalog";

  return buildResponse({
    provider,
    connectionId,
    models,
    source,
    ...(source === "local_catalog" ? { warning: "API unavailable â€” using cached catalog" } : {}),
  });
}

export async function fetchGlmModels(context: ProviderModelsHandlerContext) {
  const { accessToken, apiKey, buildResponse, connection, connectionId, provider, proxy } = context;
  const region = getGlmApiRegion(connection.providerSpecificData);
  const url = GLM_MODELS_URLS[region];
  const token = apiKey || accessToken;

  await assertProviderValidationTargetAllowed(url);
  const response = await runWithProxyContext(proxy, () =>
    fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  );

  if (!response.ok) {
    return jsonError(`Failed to fetch models: ${response.status}`, response.status);
  }

  const data = await response.json();
  return buildResponse({
    provider,
    connectionId,
    models: data.data || data.models || [],
  });
}

export async function fetchGeminiCliModels(context: ProviderModelsHandlerContext) {
  const { accessToken, buildResponse, connection, connectionId, provider, proxy } = context;
  if (!accessToken) {
    return jsonError("No access token for Gemini CLI. Please reconnect OAuth.", 400);
  }

  const providerSpecificData = asRecord(connection.providerSpecificData);
  const projectId = connection.projectId || providerSpecificData.projectId || null;
  if (!projectId) {
    return jsonError("Gemini CLI project ID not available. Please reconnect OAuth.", 400);
  }

  try {
    const quotaUrl = "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota";
    await assertProviderValidationTargetAllowed(quotaUrl);
    const quotaResponse = await runWithProxyContext(proxy, () =>
      fetch(quotaUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ project: projectId }),
        signal: AbortSignal.timeout(10000),
      })
    );

    if (!quotaResponse.ok) {
      const errorText = await quotaResponse.text();
      console.log(`[models] Gemini CLI quota fetch failed (${quotaResponse.status}):`, errorText);
      return jsonError(`Failed to fetch Gemini CLI models: ${quotaResponse.status}`, quotaResponse.status);
    }

    const quotaData = await quotaResponse.json();
    const buckets: Array<{ modelId?: string; tokenType?: string }> = quotaData.buckets || [];
    const models = buckets
      .filter((bucket) => bucket.modelId)
      .map((bucket) => ({
        id: bucket.modelId,
        name: bucket.modelId,
        owned_by: "google",
      }));

    return buildResponse({ provider, connectionId, models });
  } catch (error: any) { const err = error; const e = error;
    const message = error instanceof Error ? error.message : String(error);
    console.log("[models] Gemini CLI model fetch error:", message);
    return jsonError("Failed to fetch Gemini CLI models", 500);
  }
}

export async function fetchAnthropicCompatibleModels(
  context: ProviderModelsHandlerContext
) {
  const { accessToken, apiKey, buildResponse, connection, connectionId, provider, proxy } = context;
  const baseUrl = getProviderBaseUrl(connection.providerSpecificData);
  if (!baseUrl) {
    return jsonError("No base URL configured for Anthropic compatible provider", 400);
  }

  const discovery = await new AnthropicCompatibleModelDiscoveryAdapter().discover({
    providerId: provider,
    alias: provider,
    label: provider,
    baseUrl,
    apiKey,
    accessToken,
    fetchImpl: ((url: RequestInfo | URL, init?: RequestInit) => runWithProxyContext(proxy, () => fetch(url, init))) as typeof fetch,
  });

  if (discovery.source !== "live_api") {
    console.log(`Error fetching models from ${provider}:`, discovery.warning);
    return jsonError(`Failed to fetch models: ${discovery.status}`, discovery.status || 500);
  }

  return buildResponse({
    provider,
    connectionId,
    models: discovery.providerCatalog.models.map((model) => ({
      id: model.id,
      name: model.name || model.id,
      owned_by: provider,
    })),
    source: "live_api",
  });
}

export async function fetchGenericProviderModels(
  context: ProviderModelsHandlerContext,
  config: ProviderModelsConfigEntry
) {
  const { accessToken, apiKey, buildResponse, connectionId, provider, proxy } = context;
  const token = accessToken || apiKey;
  if (!token) {
    return jsonError(
      "No API key configured for this provider. Please add an API key in the provider settings.",
      400
    );
  }

  let url = config.url;
  if (config.authQuery) {
    url += `${url.includes("?") ? "&" : "?"}${config.authQuery}=${token}`;
  }

  const headers: Record<string, string> = { ...config.headers };
  if (config.authHeader && !config.authQuery) {
    headers[config.authHeader] = (config.authPrefix || "") + token;
  }

  const fetchOptions: RequestInit = {
    method: config.method,
    headers,
  };
  if (config.body && config.method === "POST") {
    fetchOptions.body = JSON.stringify(config.body);
  }

  let allModels: any[] = [];
  let pageUrl = url;
  let pageCount = 0;
  const MAX_PAGES = 20;
  const seenTokens = new Set<string>();

  while (pageUrl && pageCount < MAX_PAGES) {
    pageCount++;
    await assertProviderValidationTargetAllowed(pageUrl);
    const response = await runWithProxyContext(proxy, () =>
      fetch(pageUrl, {
        ...fetchOptions,
        signal: AbortSignal.timeout(15000),
      })
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Error fetching models from ${provider}:`, errorText);
      return jsonError(`Failed to fetch models: ${response.status}`, response.status);
    }

    const data = await response.json();
    allModels = allModels.concat(config.parseResponse(data));

    const nextPageToken = data.nextPageToken;
    if (!nextPageToken) {
      break;
    }
    if (seenTokens.has(nextPageToken)) {
      console.warn(`[models] ${provider}: duplicate nextPageToken detected, stopping pagination`);
      break;
    }

    seenTokens.add(nextPageToken);
    pageUrl = `${config.url}${config.url.includes("?") ? "&" : "?"}pageToken=${encodeURIComponent(nextPageToken)}`;
    if (config.authQuery) {
      pageUrl += `&${config.authQuery}=${token}`;
    }
  }

  if (pageCount > 1) {
    console.log(`[models] ${provider}: fetched ${allModels.length} models across ${pageCount} pages`);
  }

  return buildResponse({
    provider,
    connectionId,
    models: allModels,
  });
}
