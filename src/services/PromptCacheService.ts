/**
 * PromptCacheService — In-memory LRU cache for computed system prompts.
 *
 * Caches prompts keyed by intent category to avoid recomputing them on every
 * request. Entries expire after a configurable TTL (default 5 minutes).
 * When the cache exceeds the maximum entry count the least-recently-used
 * entry is evicted.
 */

export type PromptCacheOptions = {
  maxEntries?: number;
  defaultTtlMs?: number;
};

export type PromptCacheStats = {
  hits: number;
  misses: number;
  size: number;
};

type CacheEntry = {
  prompt: string;
  expiresAt: number;
  lastAccessed: number;
  createdAt: number;
};

const DEFAULT_MAX_ENTRIES = 100;
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class PromptCacheService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;
  private hits = 0;
  private misses = 0;

  constructor(options?: PromptCacheOptions) {
    this.maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.defaultTtlMs = options?.defaultTtlMs ?? DEFAULT_TTL_MS;
  }

  /**
   * Build a deterministic cache key from an intent and optional user id.
   */
  buildCacheKey(intent: string, userId?: string): string {
    if (userId) {
      return `${intent}::${userId}`;
    }
    return intent;
  }

  /**
   * Retrieve a cached prompt for the given intent.
   * Returns null on cache miss or if the entry has expired.
   */
  getCachedPrompt(intent: string): string | null {
    const entry = this.cache.get(intent);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(intent);
      this.misses++;
      return null;
    }
    entry.lastAccessed = Date.now();
    this.hits++;
    return entry.prompt;
  }

  /**
   * Store a prompt in the cache with an optional custom TTL.
   */
  setCachedPrompt(intent: string, prompt: string, ttlMs?: number): void {
    if (prompt === null || prompt === undefined) {
      return;
    }
    const ttl = ttlMs ?? this.defaultTtlMs;
    if (!this.cache.has(intent)) {
      this.evictIfNeeded();
    }
    const now = Date.now();
    this.cache.set(intent, {
      prompt,
      expiresAt: now + ttl,
      lastAccessed: now,
      createdAt: now,
    });
  }

  /**
   * Invalidate a specific intent or clear the entire cache.
   */
  invalidate(intent?: string): void {
    if (intent) {
      this.cache.delete(intent);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Return current cache statistics.
   */
  getStats(): PromptCacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
    };
  }

  /**
   * Evict the least-recently-used entry when the cache is full.
   */
  private evictIfNeeded(): void {
    if (this.cache.size < this.maxEntries) {
      return;
    }
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    let oldestCreated = Infinity;
    for (const [key, entry] of this.cache) {
      if (
        entry.lastAccessed < oldestTime ||
        (entry.lastAccessed === oldestTime && entry.createdAt < oldestCreated)
      ) {
        oldestTime = entry.lastAccessed;
        oldestCreated = entry.createdAt;
        oldestKey = key;
      }
    }
    if (oldestKey !== null) {
      this.cache.delete(oldestKey);
    }
  }
}
