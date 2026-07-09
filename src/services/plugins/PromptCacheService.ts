import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface CachedPrompt {
  id: string;
  prompt_hash: string;
  prefix_tokens: string[];
  cache_hits: number;
  last_used: string;
  created_at: string;
  token_count: number;
  provider: string;
  model: string;
}

export interface CacheStats {
  total_prompts: number;
  total_cache_hits: number;
  total_tokens_saved: number;
  hit_rate: number;
  avg_prefix_length: number;
}

export class PromptCacheService {
  private readonly storageDir: string;
  private cache: Map<string, CachedPrompt> = new Map();
  private stats = { hits: 0, misses: 0, tokens_saved: 0 };

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'prompt-cache');
    this.ensureStorageDir();
    this.loadCache();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private loadCache(): void {
    const cachePath = path.join(this.storageDir, 'cache.json');
    if (!fs.existsSync(cachePath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      for (const [key, value] of Object.entries(data)) {
        this.cache.set(key, value as CachedPrompt);
      }
    } catch (error: unknown) {/* ignore */ logger.warn('[Prompt Cache] JSON parse failed', error); }
  }

  private saveCache(): void {
    fs.writeFileSync(
      path.join(this.storageDir, 'cache.json'),
      JSON.stringify(Object.fromEntries(this.cache), null, 2),
      'utf-8',
    );
  }

  public computeHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  public checkCache(prompt: string, provider: string, model: string): {
    hit: boolean;
    cache_id: string | null;
    prefix_tokens: string[];
    tokens_saved: number;
  } {
    const hash = this.computeHash(prompt);
    const key = `${provider}:${model}:${hash}`;

    const cached = this.cache.get(key);
    if (cached) {
      cached.cache_hits++;
      cached.last_used = new Date().toISOString();
      this.stats.hits++;
      this.stats.tokens_saved += cached.token_count;
      this.saveCache();

      return {
        hit: true,
        cache_id: cached.id,
        prefix_tokens: cached.prefix_tokens,
        tokens_saved: cached.token_count,
      };
    }

    this.stats.misses++;
    return { hit: false, cache_id: null, prefix_tokens: [], tokens_saved: 0 };
  }

  public addToCache(prompt: string, provider: string, model: string, tokenCount: number): string {
    const hash = this.computeHash(prompt);
    const key = `${provider}:${model}:${hash}`;
    const id = `cache_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const prefixTokens = this.extractPrefixTokens(prompt);

    const cached: CachedPrompt = {
      id,
      prompt_hash: hash,
      prefix_tokens: prefixTokens,
      cache_hits: 0,
      last_used: new Date().toISOString(),
      created_at: new Date().toISOString(),
      token_count: tokenCount,
      provider,
      model,
    };

    this.cache.set(key, cached);
    this.saveCache();

    return id;
  }

  public store(hash: string, prefixTokens: string[], tokenCount: number, provider: string, model: string): void {
    const key = `${provider}:${model}:${hash}`;
    const cached: CachedPrompt = {
      id: `cache_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      prompt_hash: hash,
      prefix_tokens: prefixTokens,
      cache_hits: 0,
      last_used: new Date().toISOString(),
      created_at: new Date().toISOString(),
      token_count: tokenCount,
      provider,
      model,
    };
    this.cache.set(key, cached);
    this.saveCache();
  }

  public lookup(hash: string): CachedPrompt | null {
    for (const cached of this.cache.values()) {
      if (cached.prompt_hash === hash) {
        cached.cache_hits++;
        cached.last_used = new Date().toISOString();
        this.stats.hits++;
        this.stats.tokens_saved += cached.token_count;
        this.saveCache();
        return cached;
      }
    }
    this.stats.misses++;
    return null;
  }

  public findCommonPrefix(prompts: string[]): string[] {
    if (prompts.length === 0) return [];

    const tokenized = prompts.map((p) => p.split(/\s+/));
    const minLength = Math.min(...tokenized.map((t) => t.length));
    const common: string[] = [];

    for (let i = 0; i < minLength; i++) {
      const token = tokenized[0][i];
      if (tokenized.every((t) => t[i] === token)) {
        common.push(token);
      } else {
        break;
      }
    }

    return common;
  }

  public optimizePromptOrder(prompts: string[]): string[] {
    if (prompts.length <= 1) return prompts;

    const scored = prompts.map((p) => {
      const hash = this.computeHash(p);
      let cacheHits = 0;
      for (const [, cached] of this.cache) {
        if (cached.prompt_hash === hash) cacheHits = cached.cache_hits;
      }
      return { prompt: p, score: cacheHits };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.prompt);
  }

  private extractPrefixTokens(prompt: string): string[] {
    const lines = prompt.split('\n');
    const prefix: string[] = [];
    for (const line of lines.slice(0, 5)) {
      prefix.push(...line.split(/\s+/).slice(0, 10));
    }
    return prefix;
  }

  public evict(maxAge: number = 7 * 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let evicted = 0;

    for (const [key, cached] of this.cache) {
      const age = now - new Date(cached.last_used).getTime();
      if (age > maxAge && cached.cache_hits < 3) {
        this.cache.delete(key);
        evicted++;
      }
    }

    if (evicted > 0) this.saveCache();
    return evicted;
  }

  public getStats(): string {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    return [
      'Prompt Cache Stats:',
      `  Cached prompts: ${this.cache.size}`,
      `  Total requests: ${totalRequests}`,
      `  Cache hits: ${this.stats.hits}`,
      `  Cache misses: ${this.stats.misses}`,
      `  Hit rate: ${(hitRate * 100).toFixed(1)}%`,
      `  Tokens saved: ${this.stats.tokens_saved}`,
    ].join('\n');
  }

  public clear(): void {
    this.cache.clear();
    this.saveCache();
  }

  public getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }

  public listCached(): string {
    if (this.cache.size === 0) return 'No cached prompts.';

    const sorted = Array.from(this.cache.values()).sort((a, b) => b.cache_hits - a.cache_hits);
    const lines: string[] = ['Cached Prompts:'];
    for (const c of sorted.slice(0, 20)) {
      lines.push(`  ${c.id}: ${c.provider}/${c.model} hits:${c.cache_hits} tokens:${c.token_count}`);
    }
    return lines.join('\n');
  }
}
