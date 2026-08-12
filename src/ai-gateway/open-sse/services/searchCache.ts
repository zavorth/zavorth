export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

export const SEARCH_CACHE_DEFAULT_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const searchCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();
let hits = 0;
let misses = 0;

export function getCachedSearch(key: string): unknown | undefined {
  const entry = searchCache.get(key);
  if (!entry) {
    misses++;
    return undefined;
  }
  if (Date.now() > entry.expiresAt) {
    searchCache.delete(key);
    misses++;
    return undefined;
  }
  hits++;
  return entry.value;
}

export function setCachedSearch(key: string, value: unknown, ttlMs: number): void {
  searchCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function computeCacheKey(...parts: unknown[]): string {
  const stable = parts.map((part) => {
    if (part === undefined || part === null) return "";
    if (typeof part === "object") {
      try {
        return JSON.stringify(part);
      } catch {
        return String(part);
      }
    }
    return String(part);
  });
  return stable.join("::");
}

export async function getOrCoalesce<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<{ data: T; cached: boolean }> {
  const cached = getCachedSearch(key);
  if (cached !== undefined) {
    return { data: cached as T, cached: true };
  }

  const existing = inflight.get(key);
  if (existing) {
    const value = (await existing) as T;
    return { data: value, cached: false };
  }

  const promise = loader()
    .then((value) => {
      setCachedSearch(key, value, ttlMs);
      inflight.delete(key);
      return value;
    })
    .catch((error: unknown) => {
      inflight.delete(key);
      throw error;
    });

  inflight.set(key, promise);
  const data = (await promise) as T;
  return { data, cached: false };
}

export function getCacheStats(): CacheStats {
  const total = hits + misses;
  return {
    hits,
    misses,
    size: searchCache.size,
    hitRate: total > 0 ? hits / total : 0,
  };
}

export function clearSearchCache(): void {
  searchCache.clear();
  inflight.clear();
  hits = 0;
  misses = 0;
}
