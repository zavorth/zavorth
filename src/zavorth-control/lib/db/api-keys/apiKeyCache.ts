import type { ApiKeyMetadata, CacheEntry } from "./apiKeyTypes";

export const CACHE_TTL = 60 * 1000;
const MAX_CACHE_SIZE = 1000;

const keyValidationCache = new Map<
  string,
  { valid: boolean; timestamp: number }
>();
const keyMetadataCache = new Map<string, CacheEntry<ApiKeyMetadata>>();
const regexCache = new Map<string, RegExp>();
const modelPermissionCache = new Map<
  string,
  { allowed: boolean; timestamp: number }
>();

export function invalidateApiKeyCaches() {
  keyValidationCache.clear();
  keyMetadataCache.clear();
  modelPermissionCache.clear();
}

export function getCachedKeyValidation(
  key: string,
  now: number,
): boolean | null {
  const cached = keyValidationCache.get(key);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.valid;
  }
  return null;
}

export function cacheValidKeyValidation(key: string, now: number) {
  evictIfNeeded(keyValidationCache);
  keyValidationCache.set(key, { valid: true, timestamp: now });
}

export function getCachedKeyMetadata(
  key: string,
  now: number,
): ApiKeyMetadata | null {
  const cached = keyMetadataCache.get(key);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.value;
  }
  return null;
}

export function cacheKeyMetadata(
  key: string,
  value: ApiKeyMetadata,
  now: number,
) {
  evictIfNeeded(keyMetadataCache);
  keyMetadataCache.set(key, { value, timestamp: now });
}

export function getCachedModelPermission(
  cacheKey: string,
  now: number,
): boolean | null {
  const cached = modelPermissionCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.allowed;
  }
  return null;
}

export function cacheModelPermission(
  cacheKey: string,
  allowed: boolean,
  now: number,
) {
  evictIfNeeded(modelPermissionCache);
  modelPermissionCache.set(cacheKey, { allowed, timestamp: now });
}

export function getWildcardRegex(pattern: string): RegExp {
  let regex = regexCache.get(pattern);
  if (!regex) {
    const regexStr = pattern.replace(/\*/g, ".*");
    regex = new RegExp(`^${regexStr}$`);
    regexCache.set(pattern, regex);
    if (regexCache.size > 100) {
      const firstKey = regexCache.keys().next().value;
      if (firstKey) regexCache.delete(firstKey);
    }
  }
  return regex;
}

export function clearApiKeyRuntimeCaches() {
  invalidateApiKeyCaches();
  modelPermissionCache.clear();
  regexCache.clear();
}

function evictIfNeeded<TKey, TValue>(cache: Map<TKey, TValue>) {
  if (cache.size > MAX_CACHE_SIZE) {
    const entriesToRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
    let i = 0;
    for (const key of cache.keys()) {
      if (i++ >= entriesToRemove) break;
      cache.delete(key);
    }
  }
}
