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
