export type CacheEntry<T> = {
  data: T;
  cachedAt: number;
  expiresAt: number;
  hits: number;
  lastAccessAt: number;
};

export type CacheConfig = {
  ttlMs: number;
  maxEntries: number;
  staleWhileRevalidateMs: number;
};

export type CacheStats = {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
};

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttlMs: 300000,
  maxEntries: 100,
  staleWhileRevalidateMs: 60000,
};

export class DiscoveryCache<T> {
  private readonly cache = new Map<string, CacheEntry<T>>();
  private readonly config: CacheConfig;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
  }

  public get(key: string): T | undefined {
    const entry = this.cache.get(key);
    const now = Date.now();

    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (now > entry.expiresAt) {
      if (now > entry.expiresAt + this.config.staleWhileRevalidateMs) {
        this.cache.delete(key);
        this.misses++;
        return undefined;
      }
      this.hits++;
      entry.hits++;
      entry.lastAccessAt = now;
      return entry.data;
    }

    this.hits++;
    entry.hits++;
    entry.lastAccessAt = now;
    return entry.data;
  }

  public set(key: string, data: T): void {
    const now = Date.now();

    if (this.cache.size >= this.config.maxEntries) {
      this.evict();
    }

    this.cache.set(key, {
      data,
      cachedAt: now,
      expiresAt: now + this.config.ttlMs,
      hits: 0,
      lastAccessAt: now,
    });
  }

  public has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now > entry.expiresAt + this.config.staleWhileRevalidateMs) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  public isStale(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;

    const now = Date.now();
    return now > entry.expiresAt;
  }

  public delete(key: string): void {
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  public size(): number {
    return this.cache.size;
  }

  public stats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  public keys(): string[] {
    return Array.from(this.cache.keys());
  }

  private evict(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());

    entries.sort((a, b) => {
      const aExpired = now > a[1].expiresAt ? 1 : 0;
      const bExpired = now > b[1].expiresAt ? 1 : 0;
      if (aExpired !== bExpired) return bExpired - aExpired;

      const aAge = now - a[1].lastAccessAt;
      const bAge = now - b[1].lastAccessAt;
      return bAge - aAge;
    });

    const toEvict = Math.max(1, Math.floor(entries.length * 0.25));
    for (let i = 0; i < toEvict && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
      this.evictions++;
    }
  }
}
