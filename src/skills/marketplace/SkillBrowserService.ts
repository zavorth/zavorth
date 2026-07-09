import { asErrorLike } from '../../utils/errorLike';
/**
 * SkillBrowserService - Generic, dynamic, intelligent skill browsing.
 *
 * Navigates any skill source/index (marketplaces, Git repos, registries, APIs)
 * without being tied to specific sites. Uses LLM for semantic matching when
 * user requests are generic.
 *
 * Capabilities:
 * 1. Browse - Fetch skill listings from any configured source
 * 2. Multi-source search - Search across multiple sources in parallel
 * 3. Semantic matching - Understand generic requests via LLM
 * 4. Catalog cache - Cache external skill listings locally
 */

import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../logger.js';
import type { ILlmProvider, ChatMessage } from '../../providers/ILlmProvider.js';
import { ProviderFactory } from '../../providers/ProviderFactory.js';

// Types

export interface SkillSourceConfig {
  /** Unique identifier for this source */
  id: string;
  /** Human-readable name */
  name: string;
  /** Source type determines how to fetch and parse */
  type: 'git-repo' | 'registry-api' | 'npm-registry' | 'github-topic' | 'custom-api' | 'web-scraper';
  /** Base URL or path for the source */
  baseUrl: string;
  /** Authentication configuration */
  auth?: {
    type: 'bearer' | 'api-key' | 'basic' | 'oauth';
    token?: string;
    headerName?: string;
  };
  /** Source-specific configuration */
  config?: Record<string, unknown>;
  /** Whether this source is enabled */
  enabled: boolean;
  /** Priority for search ordering (lower = higher priority) */
  priority: number;
}

export interface SkillCatalogEntry {
  /** Unique skill identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Author/publisher */
  author: string;
  /** Version */
  version: string;
  /** Tags for categorization */
  tags: string[];
  /** Source ID where this skill was found */
  sourceId: string;
  /** Source-specific URL */
  sourceUrl: string;
  /** Install URL (Git, npm, etc.) */
  installUrl: string;
  /** Rating (0-5) */
  rating: number;
  /** Download count */
  downloads: number;
  /** Last updated timestamp */
  updatedAt: string;
  /** License */
  license?: string;
  /** Source-specific metadata */
  metadata?: Record<string, unknown>;
}

export interface SkillBrowserSearchInput {
  /** Search query (natural language or keywords) */
  query: string;
  /** Optional category filter */
  category?: string;
  /** Optional tags filter */
  tags?: string[];
  /** Maximum results per source */
  limitPerSource?: number;
  /** Total maximum results */
  totalLimit?: number;
  /** Source IDs to search (empty = all enabled) */
  sourceIds?: string[];
  /** Use semantic matching (LLM) for generic queries */
  useSemanticMatch?: boolean;
}

export interface SkillBrowserSearchResult {
  /** Found skills */
  entries: SkillCatalogEntry[];
  /** Total found across all sources */
  total: number;
  /** Sources searched */
  sourcesSearched: string[];
  /** Sources that failed */
  sourcesFailed: Array<{ sourceId: string; error: string }>;
  /** Whether semantic matching was used */
  semanticMatchUsed: boolean;
  /** Search duration in ms */
  durationMs: number;
}

export interface SkillBrowserConfig {
  /** Data directory for cache */
  dataDir: string;
  /** LLM provider name for semantic matching */
  llmProviderName?: string;
  /** Cache TTL in ms (default: 1 hour) */
  cacheTtlMs?: number;
  /** Max concurrent source requests */
  maxConcurrency?: number;
  /** Request timeout in ms */
  requestTimeoutMs?: number;
}

interface CacheEntry {
  entries: SkillCatalogEntry[];
  timestamp: number;
}

// Source Fetchers

/**
 * Fetches skills from a Git repository by scanning for SKILL.md files.
 */
async function fetchFromGitRepo(
  source: SkillSourceConfig,
  timeoutMs: number,
): Promise<SkillCatalogEntry[]> {
  const entries: SkillCatalogEntry[] = [];

  try {
    const { execSync } = await import('node:child_process');
    const os = await import('node:os');
    const tmpDir = path.join(os.tmpdir(), `zavorth-browse-${Date.now()}`);

    execSync(`git clone --depth 1 ${source.baseUrl} ${tmpDir}`, {
      stdio: 'pipe',
      timeout: timeoutMs,
    });

    // Scan for SKILL.md files
    const scanDir = (dir: string, depth: number) => {
      if (depth > 5) return;
      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
            const skillMd = path.join(dir, item.name, 'SKILL.md');
            if (fs.existsSync(skillMd)) {
              const content = fs.readFileSync(skillMd, 'utf-8');
              const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
              let name = item.name;
              let description = '';
              let tags: string[] = [];

              if (frontmatterMatch) {
                const fm = frontmatterMatch[1];
                const nameMatch = fm.match(/name:\s*["']?(.+?)["']?\s*$/m);
                const descMatch = fm.match(/description:\s*["']?(.+?)["']?\s*$/m);
                const tagsMatch = fm.match(/tags:\s*\[(.+?)\]/);
                if (nameMatch) name = nameMatch[1].trim();
                if (descMatch) description = descMatch[1].trim();
                if (tagsMatch) tags = tagsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, ''));
              }

              if (!description) {
                const firstParagraph = content.replace(/^#[^\n]*\n/, '').split('\n\n')[0]?.trim() || '';
                description = firstParagraph.slice(0, 200);
              }

              entries.push({
                id: `${source.id}/${item.name}`,
                name,
                description,
                author: source.config?.author as string || 'unknown',
                version: '1.0.0',
                tags,
                sourceId: source.id,
                sourceUrl: source.baseUrl,
                installUrl: `${source.baseUrl}/${item.name}`,
                rating: 0,
                downloads: 0,
                updatedAt: new Date().toISOString(),
              });
            } else {
              scanDir(path.join(dir, item.name), depth + 1);
            }
          }
        }
      } catch { /* skip */ }
    };

    scanDir(tmpDir, 0);

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (error: unknown) {
    logger.warn(`[SkillBrowser] Git repo fetch failed for ${source.id}:`, error);
  }

  return entries;
}

/**
 * Fetches skills from npm registry search API.
 */
async function fetchFromNpmRegistry(
  source: SkillSourceConfig,
  timeoutMs: number,
): Promise<SkillCatalogEntry[]> {
  const entries: SkillCatalogEntry[] = [];

  try {
    const searchUrl = `https://registry.npmjs.org/-/v1/search?text=keyword:zavorth-skill&size=250`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(searchUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return entries;

    const data = await res.json() as { objects?: Array<{ package: { name: string; version: string; description: string; keywords?: string[]; author?: { name: string }; links?: { npm?: string } } }> };

    for (const obj of data.objects || []) {
      const pkg = obj.package;
      entries.push({
        id: `npm/${pkg.name}`,
        name: pkg.name,
        description: pkg.description || '',
        author: pkg.author?.name || 'unknown',
        version: pkg.version,
        tags: pkg.keywords || [],
        sourceId: source.id,
        sourceUrl: `https://www.npmjs.com/package/${pkg.name}`,
        installUrl: `npm:${pkg.name}`,
        rating: 0,
        downloads: 0,
        updatedAt: new Date().toISOString(),
        license: (pkg as Record<string, unknown>).license as string || 'unknown',
      });
    }
  } catch (error: unknown) {
    logger.warn(`[SkillBrowser] npm registry fetch failed for ${source.id}:`, error);
  }

  return entries;
}

/**
 * Fetches skills from GitHub topic search.
 */
async function fetchFromGitHubTopic(
  source: SkillSourceConfig,
  timeoutMs: number,
): Promise<SkillCatalogEntry[]> {
  const entries: SkillCatalogEntry[] = [];

  try {
    const topic = (source.config?.topic as string) || 'zavorth-skill';
    const searchUrl = `https://api.github.com/search/repositories?q=topic:${topic}&sort=stars&per_page=100`;

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
    };

    if (source.auth?.token) {
      headers['Authorization'] = `Bearer ${source.auth.token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(searchUrl, { headers, signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return entries;

    const data = await res.json() as { items?: Array<{ full_name: string; description: string; html_url: string; stargazers_count: number; updated_at: string; license?: { spdx_id: string }; owner?: { login: string }; topics?: string[] }> };

    for (const repo of data.items || []) {
      entries.push({
        id: `github/${repo.full_name}`,
        name: repo.full_name.split('/').pop() || repo.full_name,
        description: repo.description || '',
        author: repo.owner?.login || 'unknown',
        version: 'latest',
        tags: repo.topics || [],
        sourceId: source.id,
        sourceUrl: repo.html_url,
        installUrl: repo.html_url,
        rating: 0,
        downloads: repo.stargazers_count,
        updatedAt: repo.updated_at,
        license: repo.license?.spdx_id || 'unknown',
      });
    }
  } catch (error: unknown) {
    logger.warn(`[SkillBrowser] GitHub topic fetch failed for ${source.id}:`, error);
  }

  return entries;
}

/**
 * Fetches skills from a custom API endpoint.
 * Expected format: { skills: SkillCatalogEntry[] } or SkillCatalogEntry[]
 */
async function fetchFromCustomApi(
  source: SkillSourceConfig,
  timeoutMs: number,
): Promise<SkillCatalogEntry[]> {
  const entries: SkillCatalogEntry[] = [];

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (source.auth) {
      if (source.auth.type === 'bearer' && source.auth.token) {
        headers['Authorization'] = `Bearer ${source.auth.token}`;
      } else if (source.auth.type === 'api-key' && source.auth.token) {
        headers[source.auth.headerName || 'X-API-Key'] = source.auth.token;
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(source.baseUrl, { headers, signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return entries;

    const data = await res.json();
    const skills = Array.isArray(data) ? data : (data.skills || data.entries || []);

    for (const skill of skills) {
      entries.push({
        id: `${source.id}/${skill.id || skill.name}`,
        name: skill.name || skill.title || 'unknown',
        description: skill.description || '',
        author: skill.author || skill.publisher || 'unknown',
        version: skill.version || '1.0.0',
        tags: skill.tags || skill.keywords || [],
        sourceId: source.id,
        sourceUrl: skill.url || skill.sourceUrl || source.baseUrl,
        installUrl: skill.installUrl || skill.url || skill.sourceUrl || source.baseUrl,
        rating: skill.rating || 0,
        downloads: skill.downloads || 0,
        updatedAt: skill.updatedAt || new Date().toISOString(),
        license: skill.license || 'unknown',
      });
    }
  } catch (error: unknown) {
    logger.warn(`[SkillBrowser] Custom API fetch failed for ${source.id}:`, error);
  }

  return entries;
}

// Main Service

export class SkillBrowserService {
  private readonly sources: Map<string, SkillSourceConfig> = new Map();
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly dataDir: string;
  private readonly llmProviderName: string;
  private readonly cacheTtlMs: number;
  private readonly maxConcurrency: number;
  private readonly requestTimeoutMs: number;
  private llmProvider: ILlmProvider | null = null;

  constructor(config: SkillBrowserConfig) {
    this.dataDir = config.dataDir;
    this.llmProviderName = config.llmProviderName || 'default';
    this.cacheTtlMs = config.cacheTtlMs ?? 60 * 60 * 1000; // 1 hour
    this.maxConcurrency = config.maxConcurrency ?? 5;
    this.requestTimeoutMs = config.requestTimeoutMs ?? 30000;

    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  // Source Management

  /**
   * Register a new skill source.
   */
  addSource(config: SkillSourceConfig): void {
    this.sources.set(config.id, config);
    logger.info(`[SkillBrowser] Added source: ${config.name} (${config.type})`);
  }

  /**
   * Remove a skill source.
   */
  removeSource(id: string): boolean {
    const removed = this.sources.delete(id);
    if (removed) {
      this.invalidateCache(id);
      logger.info(`[SkillBrowser] Removed source: ${id}`);
    }
    return removed;
  }

  /**
   * Get all registered sources.
   */
  getSources(): SkillSourceConfig[] {
    return Array.from(this.sources.values());
  }

  /**
   * Enable/disable a source.
   */
  setSourceEnabled(id: string, enabled: boolean): void {
    const source = this.sources.get(id);
    if (source) {
      source.enabled = enabled;
    }
  }

  // Capability 1: Browse

  /**
   * Fetch all skills from a specific source.
   */
  async browseSource(sourceId: string): Promise<SkillCatalogEntry[]> {
    const source = this.sources.get(sourceId);
    if (!source || !source.enabled) {
      return [];
    }

    // Check cache
    const cached = this.cache.get(sourceId);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.entries;
    }

    // Fetch from source
    let entries: SkillCatalogEntry[] = [];
    switch (source.type) {
      case 'git-repo':
        entries = await fetchFromGitRepo(source, this.requestTimeoutMs);
        break;
      case 'npm-registry':
        entries = await fetchFromNpmRegistry(source, this.requestTimeoutMs);
        break;
      case 'github-topic':
        entries = await fetchFromGitHubTopic(source, this.requestTimeoutMs);
        break;
      case 'custom-api':
        entries = await fetchFromCustomApi(source, this.requestTimeoutMs);
        break;
      default:
        logger.warn(`[SkillBrowser] Unknown source type: ${source.type}`);
    }

    // Cache results
    this.cache.set(sourceId, { entries, timestamp: Date.now() });
    this.persistCache(sourceId, entries);

    return entries;
  }

  /**
   * Fetch skills from all enabled sources.
   */
  async browseAll(): Promise<SkillCatalogEntry[]> {
    const enabledSources = Array.from(this.sources.values()).filter(s => s.enabled);
    const results = await Promise.allSettled(
      enabledSources.map(source => this.browseSource(source.id))
    );

    const allEntries: SkillCatalogEntry[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allEntries.push(...result.value);
      }
    }

    return allEntries;
  }

  // Capability 2: Multi-source Search

  /**
   * Search across multiple sources in parallel.
   */
  async search(input: SkillBrowserSearchInput): Promise<SkillBrowserSearchResult> {
    const startTime = Date.now();
    const sourcesSearched: string[] = [];
    const sourcesFailed: Array<{ sourceId: string; error: string }> = [];
    const allEntries: SkillCatalogEntry[] = [];

    // Determine which sources to search
    const targetSources = Array.from(this.sources.values()).filter(s => {
      if (!s.enabled) return false;
      if (input.sourceIds && input.sourceIds.length > 0) {
        return input.sourceIds.includes(s.id);
      }
      return true;
    }).sort((a, b) => a.priority - b.priority);

    // Semantic matching for generic queries
    let semanticTerms: string[] = [];
    if (input.useSemanticMatch !== false && this.isGenericQuery(input.query)) {
      semanticTerms = await this.extractSemanticTerms(input.query);
    }

    // Search sources in parallel (with concurrency limit)
    const searchPromises = targetSources.map(async (source) => {
      try {
        sourcesSearched.push(source.id);
        const entries = await this.browseSource(source.id);

        // Filter by query
        const queryTerms = input.query.toLowerCase().split(/\s+/);
        const searchTerms = [...queryTerms, ...semanticTerms];

        const filtered = entries.filter(entry => {
          const searchText = `${entry.name} ${entry.description} ${entry.tags.join(' ')}`.toLowerCase();
          return searchTerms.some(term => searchText.includes(term));
        });

        // Filter by category
        let categoryFiltered = filtered;
        const category = input.category;
        if (category) {
          const categoryNeedle = category.toLowerCase();
          categoryFiltered = filtered.filter(e =>
            e.tags.some(t => t.toLowerCase().includes(categoryNeedle)) ||
            e.description.toLowerCase().includes(categoryNeedle)
          );
        }

        // Filter by tags
        let tagFiltered = categoryFiltered;
        if (input.tags && input.tags.length > 0) {
          tagFiltered = categoryFiltered.filter(e =>
            input.tags!.some(tag => e.tags.includes(tag))
          );
        }

        return tagFiltered.slice(0, input.limitPerSource || 50);
      } catch (error: unknown) {
        const err = asErrorLike(error);
        sourcesFailed.push({
          sourceId: source.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    });

    const results = await Promise.allSettled(searchPromises);
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allEntries.push(...result.value);
      }
    }

    // Deduplicate by skill ID
    const seen = new Set<string>();
    const uniqueEntries = allEntries.filter(entry => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });

    // Sort by relevance (rating + downloads)
    uniqueEntries.sort((a, b) => {
      const scoreA = a.rating * 100 + Math.log10(a.downloads + 1);
      const scoreB = b.rating * 100 + Math.log10(b.downloads + 1);
      return scoreB - scoreA;
    });

    const durationMs = Date.now() - startTime;

    return {
      entries: uniqueEntries.slice(0, input.totalLimit || 100),
      total: uniqueEntries.length,
      sourcesSearched,
      sourcesFailed,
      semanticMatchUsed: semanticTerms.length > 0,
      durationMs,
    };
  }

  // Capability 3: Semantic Matching

  /**
   * Check if a query is generic (needs semantic matching).
   */
  private isGenericQuery(query: string): boolean {
    const trimmed = query.trim();
    // If it is a direct URL, npm package prefix, or local file path, it's not a generic query
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('git@') || trimmed.startsWith('npm:')) {
      return false;
    }
    if (trimmed.includes('/') || trimmed.includes('\\')) {
      return false;
    }
    return true;
  }

  /**
   * Use LLM to extract semantic terms from a generic query.
   */
  private async extractSemanticTerms(query: string): Promise<string[]> {
    try {
      const provider = this.getLlmProvider();

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `You are a technical concept extractor. Translate and extract 2-5 technical search terms in English from the user's query.
The user query may be in any language (English, Portuguese, French, Spanish, etc.). Translate conceptual terms to English and include common synonyms or related tech stacks.
Return ONLY a JSON array of lowercase strings, nothing else.

Examples:
- "install a skill for data analysis" → ["data", "analysis", "csv", "visualization"]
- "preciso de uma skill para planilha de excel" → ["spreadsheet", "excel", "csv", "table"]
- "trouver un outil pour le web scraping" → ["web", "scrape", "crawl", "html", "fetch"]`,
        },
        {
          role: 'user',
          content: query,
        },
      ];

      const response = await provider.chat(messages);
      const content = response.content || '[]';

      // Parse JSON array
      const match = content.match(/\[[\s\S]*?\]/);
      if (match) {
        const terms = JSON.parse(match[0]);
        if (Array.isArray(terms)) {
          return terms.filter((t): t is string => typeof t === 'string').slice(0, 5);
        }
      }
    } catch (error: unknown) {
      logger.warn('[SkillBrowser] Semantic term extraction failed:', error);
    }

    return [];
  }

  /**
   * Get or create LLM provider instance.
   */
  private getLlmProvider(): ILlmProvider {
    if (!this.llmProvider) {
      this.llmProvider = ProviderFactory.create(this.llmProviderName);
    }
    return this.llmProvider;
  }

  // Capability 4: Catalog Cache

  /**
   * Invalidate cache for a specific source.
   */
  invalidateCache(sourceId: string): void {
    this.cache.delete(sourceId);
    const cachePath = this.getCachePath(sourceId);
    if (fs.existsSync(cachePath)) {
      fs.rmSync(cachePath);
    }
  }

  /**
   * Invalidate all caches.
   */
  invalidateAllCache(): void {
    this.cache.clear();
    try {
      const files = fs.readdirSync(this.dataDir);
      for (const file of files) {
        if (file.startsWith('cache-') && file.endsWith('.json')) {
          fs.rmSync(path.join(this.dataDir, file));
        }
      }
    } catch { /* skip */ }
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): { sources: number; totalEntries: number; hitRate: number } {
    let totalEntries = 0;
    for (const entry of this.cache.values()) {
      totalEntries += entry.entries.length;
    }

    return {
      sources: this.cache.size,
      totalEntries,
      hitRate: 0, // Would need to track hits/misses
    };
  }

  private getCachePath(sourceId: string): string {
    const safeId = sourceId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.dataDir, `cache-${safeId}.json`);
  }

  private persistCache(sourceId: string, entries: SkillCatalogEntry[]): void {
    try {
      const cachePath = this.getCachePath(sourceId);
      fs.writeFileSync(cachePath, JSON.stringify({
        sourceId,
        entries,
        timestamp: Date.now(),
      }, null, 2), 'utf-8');
    } catch (error: unknown) {
      logger.warn(`[SkillBrowser] Failed to persist cache for ${sourceId}:`, error);
    }
  }

  private loadPersistedCache(sourceId: string): CacheEntry | null {
    try {
      const cachePath = this.getCachePath(sourceId);
      if (fs.existsSync(cachePath)) {
        const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        if (data.entries && data.timestamp) {
          return { entries: data.entries, timestamp: data.timestamp };
        }
      }
    } catch { /* skip */ }
    return null;
  }

  /**
   * Load all persisted caches on startup.
   */
  loadPersistedCaches(): void {
    try {
      const files = fs.readdirSync(this.dataDir);
      for (const file of files) {
        if (file.startsWith('cache-') && file.endsWith('.json')) {
          const sourceId = file.replace('cache-', '').replace('.json', '');
          const entry = this.loadPersistedCache(sourceId);
          if (entry) {
            this.cache.set(sourceId, entry);
          }
        }
      }
      logger.info(`[SkillBrowser] Loaded ${this.cache.size} persisted caches`);
    } catch { /* skip */ }
  }
}
