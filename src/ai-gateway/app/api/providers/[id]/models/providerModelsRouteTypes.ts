import { getProviderConnectionById } from "@/models";
import { resolveProxyForProvider } from "@/lib/localDb";

export type JsonRecord = Record<string, unknown>;

export type ProviderConnection = NonNullable<
  Awaited<ReturnType<typeof getProviderConnectionById>>
>;

export type ProviderProxy = Awaited<ReturnType<typeof resolveProxyForProvider>>;

export type ProviderModelsConfigEntry = {
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  authHeader?: string;
  authPrefix?: string;
  authQuery?: string;
  body?: unknown;
  parseResponse: (data: unknown) => unknown;
};

export type ProviderModelsRouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export type BuildModelsResponse = (payload: unknown, statusConfig?: ResponseInit) => Response;

export type ProviderModelsHandlerContext = {
  request: Request;
  id: string;
  connection: ProviderConnection;
  provider: string;
  connectionId: string;
  apiKey: string;
  accessToken: string;
  excludeHidden: boolean;
  proxy: ProviderProxy;
  buildResponse: BuildModelsResponse;
};
