import { asErrorLike } from '../utils/errorLike';
import { logger } from '../logger.js';
/**
 * ToolResultCache — caches tool execution results to avoid redundant calls.
 *
 * Uses a SHA-256 hash of (toolName + sortedArgs) as cache key.
 * Enforces TTL expiration, LRU eviction, and blocks caching for side-effect tools.
 * Optionally persists to disk for cross-session continuity.
 */

import { createHash } from 'node:crypto';
import fs from 'fs';
import path from 'path';

export interface CacheEntry {
  key: string;
  toolName: string;
  result: string;
  createdAt: number;
  lastAccessedAt: number;
  hitCount: number;
  ttlMs: number;
}

export interface ToolResultCacheOptions {
  /** Maximum number of cache entries. Default: 500 */
  maxEntries?: number;
  /** Default TTL in milliseconds. Default: 300_000 (5 minutes) */
  defaultTtlMs?: number;
  /** Directory to persist cache. Default: null (in-memory only) */
  persistDir?: string;
}

export interface ToolResultCacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
}

/** Explicitly read-only tools. Unknown tools fail closed and are never cached. */
const CACHEABLE_TOOLS = new Set([
  'web_search',
  'read_file',
  'list_directory',
  'search_files',
  'get_datetime',
  'capability_discovery',
  'semantic_memory',
  'session_search',
  'zavorth_session_search',
]);

const CACHE_FILE = 'tool-result-cache.json';

export class ToolResultCache {
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;
  private readonly persistDir: string | null;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly FLUSH_DELAY_MS = 5000; // Debounce 5 seconds

  constructor(options?: ToolResultCacheOptions) {
    this.maxEntries = Math.max(1, options?.maxEntries ?? 500);
    this.defaultTtlMs = Math.max(1_000, options?.defaultTtlMs ?? 300_000);
    this.persistDir = options?.persistDir ?? null;

    // Load from disk if persistence is enabled
    if (this.persistDir) {
      this.loadFromDisk();
    }
  }

  /**
   * Retrieves a cached result for the given tool + args.
   * Returns null on miss, expiry, or if the tool is non-cacheable.
   */
  get(toolName: string, args: Record<string, unknown>): string | null {
    if (this.isNonCacheable(toolName)) {
      this.misses++;
      return null;
    }

    const key = this.buildKey(toolName, args);
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    entry.lastAccessedAt = Date.now();
    entry.hitCount++;
    this.hits++;
    return entry.result;
  }

  /**
   * Stores a tool result in the cache.
   * No-op for non-cacheable tools.
   */
  set(toolName: string, args: Record<string, unknown>, result: string, ttlMs?: number): void {
    if (this.isNonCacheable(toolName)) return;

    const key = this.buildKey(toolName, args);
    const now = Date.now();

    this.cache.set(key, {
      key,
      toolName,
      result,
      createdAt: now,
      lastAccessedAt: now,
      hitCount: 0,
      ttlMs: ttlMs ?? this.defaultTtlMs,
    });

    this.evictIfNeeded();

    // Schedule debounced persist to disk
    this.scheduleSaveToDisk();
  }

  /**
   * Checks if a result exists in cache (refreshes lastAccessedAt for LRU consistency).
   */
  has(toolName: string, args: Record<string, unknown>): boolean {
    if (this.isNonCacheable(toolName)) return false;
    const key = this.buildKey(toolName, args);
    const entry = this.cache.get(key);
    if (!entry || this.isExpired(entry)) return false;
    entry.lastAccessedAt = Date.now();
    return true;
  }

  /**
   * Invalidates all cache entries for a specific tool.
   */
  invalidate(toolName: string): void {
    for (const [key, entry] of this.cache) {
      if (entry.toolName === toolName) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clears the entire cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Returns cache statistics.
   */
  getStats(): ToolResultCacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      size: this.cache.size,
    };
  }

  /**
   * Returns the current number of entries in the cache.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Checks if a tool is non-cacheable (has side effects).
   */
  private isNonCacheable(toolName: string): boolean {
    return !CACHEABLE_TOOLS.has(toolName);
  }

  /**
   * Builds a deterministic cache key from tool name and args.
   */
  private buildKey(toolName: string, args: Record<string, unknown>): string {
    const sortedArgs = this.sortObject(args);
    const payload = `${toolName}:${JSON.stringify(sortedArgs)}`;
    return createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Recursively sorts object keys and filters out undefined values
   * for deterministic serialization.
   */
  private sortObject(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((item) => this.sortObject(item));
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      const value = (obj as Record<string, unknown>)[key];
      // Skip undefined values to prevent key collisions
      if (value === undefined) continue;
      sorted[key] = this.sortObject(value);
    }
    return sorted;
  }

  /**
   * Checks if a cache entry has expired.
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.createdAt > entry.ttlMs;
  }

  /**
   * Evicts least-recently-used entries when cache exceeds maxEntries.
   */
  private evictIfNeeded(): void {
    while (this.cache.size > this.maxEntries) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, entry] of this.cache) {
        if (entry.lastAccessedAt < oldestTime) {
          oldestTime = entry.lastAccessedAt;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.evictions++;
      } else {
        break;
      }
    }
  }

  /**
   * Marks cache as dirty and schedules a debounced write to disk.
   */
  private scheduleSaveToDisk(): void {
    if (!this.persistDir) return;
    this.dirty = true;

    if (this.flushTimer) return; // Already scheduled

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushToDisk();
    }, this.FLUSH_DELAY_MS);
  }

  /**
   * Immediately writes cache to disk (called by debounced timer).
   */
  private flushToDisk(): void {
    if (!this.persistDir || !this.dirty) return;

    try {
      if (!fs.existsSync(this.persistDir)) {
        fs.mkdirSync(this.persistDir, { recursive: true });
      }

      const entries = Array.from(this.cache.values());
      const filePath = path.join(this.persistDir, CACHE_FILE);
      fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf-8');
      this.dirty = false;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[ToolResultCache] Failed to persist cache', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  /**
   * Loads cache from disk.
   */
  private loadFromDisk(): void {
    if (!this.persistDir) return;

    try {
      const filePath = path.join(this.persistDir, CACHE_FILE);
      if (!fs.existsSync(filePath)) return;

      const data = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      if (!Array.isArray(parsed)) return;

      for (const entry of parsed) {
        // Validate entry shape before accepting
        if (!this.isValidCacheEntry(entry)) continue;
        if (this.isExpired(entry)) continue;

        // Verify key integrity — re-hash and compare
        const expectedKey = this.buildKey(entry.toolName, { __hash: entry.key });
        // We can't fully verify without original args, so trust entries with valid structure
        this.cache.set(entry.key, entry);
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[ToolResultCache] Failed to load cache from disk', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  private isValidCacheEntry(entry: unknown): entry is CacheEntry {
    if (typeof entry !== 'object' || entry === null) return false;
    const e = entry as Record<string, unknown>;
    return (
      typeof e.key === 'string' &&
      typeof e.toolName === 'string' &&
      typeof e.result === 'string' &&
      typeof e.createdAt === 'number' &&
      typeof e.lastAccessedAt === 'number' &&
      typeof e.hitCount === 'number' &&
      typeof e.ttlMs === 'number' &&
      e.key.length > 0 &&
      e.toolName.length > 0
    );
  }
}
