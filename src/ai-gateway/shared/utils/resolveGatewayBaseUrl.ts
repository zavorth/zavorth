const DEFAULT_ZavorthGateway_BASE_URL = "http://localhost:20128";

type ZavorthGatewayBaseUrlEnv = {
  ZavorthGateway_BASE_URL?: string;
  BASE_URL?: string;
  NEXT_PUBLIC_BASE_URL?: string;
};

function normalizeBaseUrl(value?: string): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

export function resolveZavorthGatewayBaseUrl(env: ZavorthGatewayBaseUrlEnv = process.env as ZavorthGatewayBaseUrlEnv): string {
  return (
    normalizeBaseUrl(env.ZavorthGateway_BASE_URL) ||
    normalizeBaseUrl(env.BASE_URL) ||
    normalizeBaseUrl(env.NEXT_PUBLIC_BASE_URL) ||
    DEFAULT_ZavorthGateway_BASE_URL
  );
}

export { DEFAULT_ZavorthGateway_BASE_URL };
