export type JsonRecord = Record<string, unknown>;
export type PricingModels = Record<string, JsonRecord>;
export type PricingByProvider = Record<string, PricingModels>;
export type ProxyValue = JsonRecord | string | null;
export type ProxyMap = Record<string, ProxyValue>;

export interface ProxyConfig {
  global: ProxyValue;
  providers: ProxyMap;
  combos: ProxyMap;
  keys: ProxyMap;
  [key: string]: unknown;
}

export function toRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

export function toProxyMap(value: unknown): ProxyMap {
  return value && typeof value === "object" ? (value as ProxyMap) : {};
}

export function toProxyValue(value: unknown): ProxyValue {
  if (value === null || typeof value === "string") return value as string | null;
  if (value && typeof value === "object") return value as JsonRecord;
  return null;
}

export function toProxyString(value: ProxyValue): string | null {
  if (typeof value === "string") return value || null;
  if (value && typeof value === "object") {
    const type = typeof value.type === "string" ? value.type : "http";
    const host = typeof value.host === "string" ? value.host : "";
    if (!host) return null;
    const port = typeof value.port === "number" ? value.port : typeof value.port === "string" ? value.port : "";
    const user = typeof value.username === "string" && value.username ? encodeURIComponent(value.username) : "";
    const pass = typeof value.password === "string" && value.password ? encodeURIComponent(value.password) : "";
    const auth = user || pass ? `${user}${pass ? `:${pass}` : ""}@` : "";
    return `${type}://${auth}${host}${port ? `:${port}` : ""}`;
  }
  return null;
}
