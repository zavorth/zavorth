/**
 * DuckDuckGoSearchAdapter â€” Adapter Zavorth-nativo para busca web via DuckDuckGo.
 *
 * Este adapter encapsula a comunicaÃ§Ã£o com o motor de busca DuckDuckGo,
 * isolando todos os detalhes do provedor. TambÃ©m inclui um fallback
 * para Bing Web scraping quando o DuckDuckGo estÃ¡ indisponÃ­vel.
 *
 * O adapter Ã© responsÃ¡vel por:
 * - Executar a busca via duck-duck-scrape.
 * - Aplicar backoff/rate-limiting sequencial.
 * - Fazer fallback para Bing Web se DuckDuckGo falhar.
 * - Converter resultados para AdapterSearchOutput.
 * - NUNCA retornar dados como autoridade do domÃ­nio.
 *
 * ReferÃªncias arquiteturais:
 * - docs/327-zavorth-native-absorption-execution-plan.md (Wave 2)
 * - src/contracts/SearchQueryContract.ts
 *
 * @module adapters/search/DuckDuckGoSearchAdapter
 * @since 2026-05-03
 * @author Zavorth Core Team
 */

import { search, SafeSearchType } from 'duck-duck-scrape';
import type {
  ISearchQueryAdapter,
  SearchQueryMode,
  SearchQueryRequest,
  AdapterSearchOutput,
  AdapterSearchItem,
} from '../../contracts/SearchQueryContract.js';
import { logger } from '../../logger.js';
import { safeFetch } from '../../security/SafeFetchService.js';

// ---------------------------------------------------------------------------
// Rate-limiting state (singleton per process)
// ---------------------------------------------------------------------------

let ddgQueue: Promise<void> = Promise.resolve();
let nextDdgAt = 0;

type DuckDuckGoResultItem = {
  title?: string | null;
  url?: string | null;
  description?: string | null;
};

type DuckDuckGoSearchResponse = {
  results?: DuckDuckGoResultItem[];
};

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class DuckDuckGoSearchAdapter implements ISearchQueryAdapter {
  public readonly adapterId = 'duckduckgo';
  public readonly supportedModes: SearchQueryMode[] = ['quick', 'deep'];

  public async search(request: SearchQueryRequest): Promise<AdapterSearchOutput> {
    const query = request.query;
    const limit = Math.min(request.limit || 5, 10);

    logger.info(`[DuckDuckGoSearchAdapter] Searching: "${query}" (limit=${limit})`);

    try {
      const results = await this.searchWithBackoff(query);

      if (!results?.results?.length) {
        return { items: [], providerId: this.adapterId };
      }

      const items: AdapterSearchItem[] = results.results
        .slice(0, limit)
        .map((result: DuckDuckGoResultItem, index: number) => ({
          title: String(result.title || 'Sem titulo').trim(),
          url: String(result.url || '').trim(),
          description: String(result.description || '').trim(),
          originalRank: index + 1,
          sourceQuery: query,
        }));

      return { items, providerId: this.adapterId };
    } catch (err) {
      logger.warn(`[DuckDuckGoSearchAdapter] DuckDuckGo failed, trying Bing fallback: ${err instanceof Error ? err.message : String(err)}`);

      const bingItems = await this.searchBingFallback(query, limit);
      if (bingItems.length > 0) {
        return { items: bingItems, providerId: 'bing-fallback' };
      }

      throw new SearchAdapterError(this.adapterId, err instanceof Error ? err.message : String(err));
    }
  }

  // -------------------------------------------------------------------------
  // DuckDuckGo com backoff
  // -------------------------------------------------------------------------

  private async searchWithBackoff(query: string): Promise<DuckDuckGoSearchResponse> {
    return this.enqueue(async () => {
      const runSearch = () => search(query, { safeSearch: SafeSearchType.MODERATE });

      try {
        return await runSearch() as DuckDuckGoSearchResponse;
      } catch (err: any) {
        const message = String(err?.message || err || '');
        if (!/too quickly|anomaly|rate|429/i.test(message)) {
          throw err;
        }
        await this.delay(2_500);
        return await runSearch() as DuckDuckGoSearchResponse;
      }
    });
  }

  private async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const previous = ddgQueue;
    let release: () => void = () => undefined;
    ddgQueue = new Promise<void>((resolve) => { release = resolve; });

    await previous.catch(() => undefined);
    try {
      const now = Date.now();
      const waitMs = Math.max(0, nextDdgAt - now);
      if (waitMs > 0) {
        await this.delay(waitMs);
      }
      nextDdgAt = Date.now() + 1_500;
      return await operation();
    } finally {
      release();
    }
  }

  // -------------------------------------------------------------------------
  // Bing Web fallback
  // -------------------------------------------------------------------------

  private async searchBingFallback(query: string, limit: number): Promise<AdapterSearchItem[]> {
    try {
      const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en-US`;
      const response = await safeFetch(url, {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Zavorth/1.0',
          'accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(10_000),
      }, {
        serviceName: 'DuckDuckGo Bing fallback',
      });

      if (!response.ok) {
        return [];
      }

      const html = await response.text();
      return this.parseBingResults(html, query).slice(0, limit);
    } catch {
      return [];
    }
  }

  private parseBingResults(html: string, sourceQuery: string): AdapterSearchItem[] {
    return Array.from(String(html || '').matchAll(/<li\b[^>]*class=["'][^"']*\bb_algo\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi))
      .map((match, index) => {
        const block = match[1] || '';
        const linkMatch = block.match(/<h2\b[^>]*>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i);
        if (!linkMatch?.[1] || !linkMatch?.[2]) {
          return null;
        }
        const descMatch = block.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
        return {
          title: this.stripHtml(linkMatch[2]),
          url: this.normalizeBingUrl(this.stripHtml(linkMatch[1])),
          description: descMatch?.[1] ? this.stripHtml(descMatch[1]) : 'Trecho indisponivel.',
          originalRank: index + 1,
          sourceQuery,
        };
      })
      .filter((item): item is AdapterSearchItem => Boolean(item?.url && item.title))
      .filter((item, idx, arr) => arr.findIndex((c) => c.url === item.url) === idx)
      .slice(0, 8);
  }

  private normalizeBingUrl(url: string): string {
    const raw = String(url || '').trim();
    try {
      const parsed = new URL(raw);
      if (!parsed.hostname.endsWith('bing.com')) {
        return raw;
      }
      const encoded = parsed.searchParams.get('u');
      if (!encoded) {
        return raw;
      }
      const base64 = encoded.startsWith('a1') ? encoded.slice(2) : encoded;
      const decoded = Buffer.from(base64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
      return /^https?:\/\//i.test(decoded) ? decoded : raw;
    } catch {
      return raw;
    }
  }

  private stripHtml(text: string): string {
    return String(text || '')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}

// ---------------------------------------------------------------------------
// Erros tipados
// ---------------------------------------------------------------------------

export class SearchAdapterError extends Error {
  public readonly adapterId: string;

  constructor(adapterId: string, detail: string) {
    super(`[${adapterId}] Search adapter error: ${detail}`);
    this.name = 'SearchAdapterError';
    this.adapterId = adapterId;
  }
}
