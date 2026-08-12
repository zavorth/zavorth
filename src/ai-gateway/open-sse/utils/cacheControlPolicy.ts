export type CacheControlMode = "auto" | "preserve" | "disabled";

export function isCacheControlPreserved(mode: CacheControlMode): boolean {
  return mode === "preserve";
}

export function normalizeCacheControlMode(value: unknown): CacheControlMode {
  if (value === "preserve" || value === "disabled") return value;
  return "auto";
}
