import type { JsonRecord, ProviderConnection } from "./providerModelsRouteTypes";
import { GLM_MODELS_URLS } from "./providerModelsCatalog";

export function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

export function getProviderBaseUrl(providerSpecificData: unknown): string | null {
  const data = asRecord(providerSpecificData);
  const baseUrl = data.baseUrl;
  return typeof baseUrl === "string" && baseUrl.trim().length > 0 ? baseUrl : null;
}

export function getGlmApiRegion(
  providerSpecificData: unknown
): keyof typeof GLM_MODELS_URLS {
  const data = asRecord(providerSpecificData);
  return data.apiRegion === "china" ? "china" : "international";
}

export function getExcludeHiddenFlag(request: Request): boolean {
  return new URL(request.url).searchParams.get("excludeHidden") === "true";
}

export function getNormalizedProvider(connection: ProviderConnection): string | null {
  return typeof connection.provider === "string" && connection.provider.trim().length > 0
    ? connection.provider
    : null;
}

export function getConnectionId(connection: ProviderConnection, fallbackId: string): string {
  return typeof connection.id === "string" ? connection.id : fallbackId;
}

export function getApiKey(connection: ProviderConnection): string {
  return typeof connection.apiKey === "string" ? connection.apiKey : "";
}

export function getAccessToken(connection: ProviderConnection): string {
  return typeof connection.accessToken === "string" ? connection.accessToken : "";
}
