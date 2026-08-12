export interface HandlerLogger {
  debug?(tag: string, message: string, data?: unknown): void;
  info?(tag: string, message: string, data?: unknown): void;
  warn?(tag: string, message: string, data?: unknown): void;
  error?(tag: string, message: string, data?: unknown): void;
}

export interface HandlerCredentials {
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  connectionId?: string;
  providerSpecificData?: Record<string, unknown>;
  [key: string]: unknown;
}

export type HandlerResult<T> =
  | { success: true; data: T }
  | { success: false; error: unknown; status: number };

export function extractApiKey(credentials?: HandlerCredentials | null): string {
  if (!credentials) return "";
  return credentials.apiKey || credentials.accessToken || "";
}

export function resolveBaseUrl(
  providerBase?: string,
  fallbackBase?: string,
  path?: string
): string {
  const base = (providerBase || fallbackBase || "").replace(/\/+$/, "");
  if (!base) return "";
  if (!path) return base;
  if (base.endsWith(path)) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function bearerHeaders(apiKey: string, extra?: Record<string, string>): Record<string, string> {
  return { "content-type": "application/json", authorization: `Bearer ${apiKey}`, ...extra };
}

export function providerAuthHeaders(
  config: { authHeader?: string; authType?: string } | null | undefined,
  apiKey: string
): Record<string, string> {
  if (!apiKey || config?.authType === "none") return {};
  const header = (config?.authHeader || "authorization").toLowerCase();
  if (header === "authorization" || header === "bearer") {
    return { authorization: `Bearer ${apiKey}` };
  }
  return { [config?.authHeader as string]: apiKey };
}
