import { asErrorLike } from '../utils/errorLike';
import { BaseTool } from './BaseTool.js';
import { search, SearchResults, SafeSearchType } from 'duck-duck-scrape';
import { config } from '../config/index.js';
import { safeFetch } from '../security/SafeFetchService.js';
import { wrapUntrustedContent } from '../security/UntrustedContent.js';
import {
  getEvidenceDomainProfile,
  inferEvidenceDomainFromText,
  normalizeEvidenceText,
  normalizeHost,
  scoreEvidenceSource,
  type EvidenceDomainProfile,
  type EvidenceSearchDomain,
} from '../agents/EvidenceDomainProfiles.js';
import { logger } from '../logger.js';

import {
buildEvidenceSearchPlan,
  buildEvidenceTrackQueries,
  weighEvidenceSource,
  type EvidenceTrackQuery,
} from '../agents/EvidenceSearchPlan.js';

type RankedSearchCandidate = {
  title: string;
  url: string;
  description: string;
  sourceQuery: string;
  sourceTrack?: EvidenceTrackQuery['track'];
  sourceRole?: EvidenceTrackQuery['role'];
  originalRank: number;
  evidenceScore: number;
  highSignal: boolean;
  scoreReasons: string[];
  extracted?: ExtractedPage;
};

type ExtractedPage = {
  title?: string;
  excerpt?: string;
  publishedAt?: string;
  error?: string;
};

type NewsTopic = 'ai' | 'global_politics';

type SearchEngineResult = {
  title: string;
  url: string;
  description: string;
};

interface WebSearchArgs {
  query?: string;
  limit?: number;
  domainProfile?: string;
  domain_profile?: string;
  deep?: boolean;
  extractPages?: boolean;
  extract_pages?: boolean;
}

/** Minimal shape matching duck-duck-scrape SearchResults results item */
interface DuckDuckGoResult {
  title: string;
  url: string;
  description: string;
  [key: string]: unknown;
}

function toDuckDuckGoResults(results: SearchEngineResult[]): DuckDuckGoResult[] {
  return results.map((r) => ({ ...r }));
}

/**
 * WebSearchTool - allows the agent to search the web in real time.
 */
export class WebSearchTool extends BaseTool {
  private static duckDuckGoQueue: Promise<void> = Promise.resolve();
  private static nextDuckDuckGoAt = 0;

  public readonly name = 'web_search';
  public readonly description = 'Searches current internet information such as news, quotes, and general data through DuckDuckGo. Returns top results with title, URL, and page snippet.';
  
  public readonly parameters = {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Search query, for example "latest artificial intelligence news 2024" or "USD exchange rate today".',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 3, max: 5).',
      },
      domainProfile: {
        type: 'string',
        description: 'Optional evidence profile: auto, medical, legal, scientific, finance, consumer, technical, public_policy, ai_news, or general.',
      },
      domain_profile: {
        type: 'string',
        description: 'Alias for domainProfile for clients using snake_case.',
      },
      deep: {
        type: 'boolean',
        description: 'When true, runs profile-directed searches and ranks sources.',
      },
      extractPages: {
        type: 'boolean',
        description: 'When true, tries to extract short excerpts from top pages to reduce hallucination.',
      },
      extract_pages: {
        type: 'boolean',
        description: 'Alias for extractPages for clients using snake_case.',
      },
    },
    required: ['query'],
  };

  public async execute(args: WebSearchArgs): Promise<string> {
    const query = this.sanitizeSearchQuery(String(args.query || '').trim());
    const effectiveLimit = Math.min(args.limit || 5, 8);
    const domain = this.resolveDomainProfile(args, query);
    const profile = getEvidenceDomainProfile(domain);
    const deep = args.deep === true || args.extractPages === true || args.extract_pages === true || domain !== 'general';
    const extractPages = args.extractPages !== false && args.extract_pages !== false && deep;

    if (!query || typeof query !== 'string') {
      return 'Error: the "query" parameter is required and must be a string.';
    }

    const shouldUseFreshNewsFallback =
      this.isFreshNewsQuery(query)
      && (domain === 'general' || domain === 'ai_news' || this.isGlobalPoliticsNewsQuery(query));
    if (shouldUseFreshNewsFallback) {
      const newsResult = await this.searchNewsFallback(query, effectiveLimit);
      if (newsResult) {
        return newsResult;
      }
      return `QUALITY_GATE: insufficient_news_results\nI did not find enough recent news results for "${query}" inside the requested freshness window. Do not produce a factual briefing without new sources.`;
    }

    try {
      console.log(`🔍 [WebSearchTool] Pesquisando: "${query}"`);
      
      const rankedResults = await this.searchRankedResults(query, effectiveLimit, profile, {
        deep,
        extractPages,
      });

      if (rankedResults.length > 0) {
        return this.formatRankedResults(query, rankedResults, profile, { deep, extractPages });
      }

      return `No results found for search: "${query}".`;

    } catch (error: unknown) {
      const err = asErrorLike(error);
      const errorMessage = error instanceof Error ? err.message : String(error);
      console.error(`[WebSearchTool] Search error:`, errorMessage);
      const fallbackResult = this.shouldUseNewsRssFallback(query)
        ? await this.searchNewsFallback(query, effectiveLimit)
        : null;

      if (fallbackResult) {
        return [
          fallbackResult,
          '',
          `Note: the main DuckDuckGo search failed (${errorMessage}); these results came from the news RSS fallback.`,
        ].join('\n');
      }

      return [
        'QUALITY_GATE: search_unavailable',
        `Query: "${query}"`,
        `Main search failed: ${errorMessage}`,
        'Do not treat this as verified current information. If the request is stable general knowledge, answer from general knowledge and state that online verification failed. If it depends on current information, say there are not enough sources right now.',
      ].join('\n');
    }
  }

  private resolveDomainProfile(args: WebSearchArgs, query: string): EvidenceSearchDomain {
    const explicit = String(args.domainProfile || args.domain_profile || '').trim().toLowerCase();
    if (explicit && explicit !== 'auto') {
      return getEvidenceDomainProfile(explicit).domain;
    }

    return inferEvidenceDomainFromText(query);
  }

  private sanitizeSearchQuery(query: string): string {
    return String(query || '')
      .replace(/\bopen\s+eye\b/gi, 'OpenAI')
      .replace(/\bopeneye\b/gi, 'OpenAI')
      .replace(/\banttropic\b/gi, 'Anthropic')
      .replace(/\banthropi[ck]\b/gi, 'Anthropic')
      .replace(/\bmeta\s+al\b/gi, 'Meta AI')
      .replace(/\bgoogle\s+deep\s+mind\b/gi, 'Google DeepMind')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b(Qual foi o placar do ultimo jogo do Flamengo\??)$/i, '$1 futebol resultado data');
  }

  private async searchRankedResults(
    query: string,
    limit: number,
    profile: EvidenceDomainProfile,
    options: { deep: boolean; extractPages: boolean },
  ): Promise<RankedSearchCandidate[]> {
    const evidencePlanInput = {
        query,
        domain: profile.domain,
      };
    const queries = options.deep
      ? buildEvidenceTrackQueries(evidencePlanInput, 3)
      : [{ query, track: 'profile', role: 'baseline', rationale: 'plain search query' } satisfies EvidenceTrackQuery];
    const plan = options.deep ? buildEvidenceSearchPlan(evidencePlanInput) : null;
    const seenUrls = new Set<string>();
    const candidates: RankedSearchCandidate[] = this.buildKnownSourceCandidates(query, profile)
      .filter((candidate) => {
        if (seenUrls.has(candidate.url)) {
          return false;
        }
        seenUrls.add(candidate.url);
        return true;
      });
    let firstError: Error | null = null;

    for (const source of queries) {
      try {
        const searchResults = await this.searchWebWithFallback(source.query);
        if (searchResults.noResults || searchResults.results.length === 0) {
          continue;
        }

        searchResults.results.slice(0, Math.max(limit, 5)).forEach((res, index) => {
          const url = String(res.url || '').trim();
          if (!url || seenUrls.has(url)) {
            return;
          }
          seenUrls.add(url);
          const title = String(res.title || 'Sem titulo').trim();
          const description = String(res.description || '').trim();
          const score = scoreEvidenceSource({ title, url, description }, profile.domain);
          const weighted = plan
            ? weighEvidenceSource({
              baseScore: score.score,
              highSignal: score.highSignal,
              track: source.track,
              role: source.role,
              plan,
            })
            : { score: score.score, highSignal: score.highSignal, reasons: [] };
          candidates.push({
            title,
            url,
            description,
            sourceQuery: source.query,
            sourceTrack: source.track,
            sourceRole: source.role,
            originalRank: index + 1,
            evidenceScore: weighted.score,
            highSignal: weighted.highSignal,
            scoreReasons: [...score.reasons, ...weighted.reasons].slice(0, 8),
          });
        });
      } catch (error: unknown) {
        const err = asErrorLike(error);
        firstError ||= new Error(error instanceof Error ? err.message : String(error));
      }
    }

    if (candidates.length === 0 && firstError) {
      throw firstError;
    }

    const sorted = candidates
      .sort((left, right) => {
        const byScore = right.evidenceScore - left.evidenceScore;
        if (byScore !== 0) {
          return byScore;
        }
        return left.originalRank - right.originalRank;
      });
    const ranked = this.diversifyHosts(sorted, limit);

    if (options.extractPages) {
      await Promise.all(
        ranked.slice(0, Math.min(3, ranked.length)).map(async (candidate) => {
          candidate.extracted = await this.extractPageExcerpt(candidate.url);
        }),
      );
    }

    return ranked;
  }
  private buildKnownSourceCandidates(query: string, profile: EvidenceDomainProfile): RankedSearchCandidate[] {
    const normalized = normalizeEvidenceText(query);
    const sources: Array<{ title: string; url: string; description: string }> = [];

    if (/\b(gemini|google\s+ai|google\s+deepmind)\b/.test(normalized) && /\b(model|modelo|developer|desenvolvedor|docs?|documentacao|latest|recente|mais\s+recente)\b/.test(normalized)) {
      sources.push(
        {
          title: 'Gemini API models - Google AI for Developers',
          url: 'https://ai.google.dev/gemini-api/docs/models',
          description: 'Official Google AI developer documentation listing Gemini API models and capabilities.',
        },
        {
          title: 'Gemini API documentation - Google AI for Developers',
          url: 'https://ai.google.dev/gemini-api/docs',
          description: 'Official Gemini API documentation for developers.',
        },
      );
    }

    if (profile.domain === 'ai_news' || /\b(openai|anthropic|deepmind|meta\s+ai|meta ai|lancamentos?|releases?)\b/.test(normalized)) {
      sources.push(
        {
          title: 'OpenAI news and product updates',
          url: 'https://openai.com/news/',
          description: 'Official OpenAI announcements, product updates and research news.',
        },
        {
          title: 'Anthropic news',
          url: 'https://www.anthropic.com/news',
          description: 'Official Anthropic announcements and product news.',
        },
        {
          title: 'Google DeepMind blog',
          url: 'https://deepmind.google/discover/blog/',
          description: 'Official Google DeepMind research and product updates.',
        },
        {
          title: 'Meta AI blog',
          url: 'https://ai.meta.com/blog/',
          description: 'Official Meta AI research and product updates.',
        },
      );
    }

    if (profile.domain === 'consumer' && /\b(notebook|laptop|programacao|programming|brasil|custo\s*beneficio)\b/.test(normalized)) {
      sources.push(
        {
          title: 'Notebookcheck laptop reviews and benchmarks',
          url: 'https://www.notebookcheck.net/',
          description: 'Independent notebook reviews, benchmarks and technical analysis.',
        },
        {
          title: 'Zoom notebooks price comparison Brazil',
          url: 'https://www.zoom.com.br/notebook',
          description: 'Brazilian notebook price comparison and shopping results.',
        },
        {
          title: 'Buscape notebooks price comparison Brazil',
          url: 'https://www.buscape.com.br/notebook',
          description: 'Brazilian notebook price comparison and product listings.',
        },
      );
    }

    if (/\bflamengo\b/.test(normalized) && /\b(placar|resultado|ultimo\s+jogo|last\s+match|score)\b/.test(normalized)) {
      sources.push(
        {
          title: 'Flamengo - ge.globo',
          url: 'https://ge.globo.com/futebol/times/flamengo/',
          description: 'Brazilian football coverage for Flamengo, including match reports and fixtures.',
        },
        {
          title: 'Flamengo scores and fixtures - ESPN',
          url: 'https://www.espn.com.br/futebol/time/_/id/819/flamengo',
          description: 'Flamengo football scores, fixtures and squad information.',
        },
        {
          title: 'Flamengo live scores - Flashscore',
          url: 'https://www.flashscore.com.br/equipe/flamengo/ppjDR086/',
          description: 'Flamengo live scores, recent results and fixtures.',
        },
      );
    }

    return sources.map((source, index) => {
      const score = scoreEvidenceSource(source, profile.domain);
      return {
        title: source.title,
        url: source.url,
        description: source.description,
        sourceQuery: 'known-source',
        originalRank: index + 1,
        evidenceScore: Math.max(score.score, 80),
        highSignal: true,
        scoreReasons: Array.from(new Set(['known-source', ...score.reasons])).slice(0, 6),
        sourceTrack: 'profile',
        sourceRole: 'baseline',
      };
    });
  }

  private diversifyHosts(candidates: RankedSearchCandidate[], limit: number): RankedSearchCandidate[] {
    const selected: RankedSearchCandidate[] = [];
    const deferred: RankedSearchCandidate[] = [];
    const hostCounts = new Map<string, number>();

    for (const candidate of candidates) {
      const host = normalizeHost(candidate.url) || 'unknown';
      const count = hostCounts.get(host) || 0;
      const maxPerHost = candidate.highSignal ? 2 : 1;

      if (count < maxPerHost) {
        selected.push(candidate);
        hostCounts.set(host, count + 1);
      } else {
        deferred.push(candidate);
      }
    }

    return [...selected, ...deferred].slice(0, limit);
  }

  private async searchDuckDuckGoWithBackoff(query: string): Promise<SearchResults> {
    return this.enqueueDuckDuckGoSearch(async () => {
      const runSearch = async () => search(query, {
        safeSearch: SafeSearchType.MODERATE,
      });

      try {
        return await runSearch();
      } catch (error: unknown) {
        const err = asErrorLike(error);
        const message = error instanceof Error ? err.message : String(error);
        if (!/too quickly|anomaly|rate|429/i.test(message)) {
          throw error;
        }
        if (process.env.NODE_ENV !== 'test') {
          await this.delay(2_500);
        }
        return await runSearch();
      }
    });
  }

  private async searchWebWithFallback(query: string): Promise<SearchResults> {
    try {
      const duckDuckGoResults = await this.searchDuckDuckGoWithBackoff(query);
      return duckDuckGoResults;
    } catch (error: unknown) {const bingResults = await this.searchBingWeb(query);
      if (bingResults.length > 0) {
        return {
          noResults: false,
          results: toDuckDuckGoResults(bingResults),
        } as unknown as SearchResults;
      }
      throw error;
    }
  }

  private async searchBingWeb(query: string): Promise<SearchEngineResult[]> {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en-US`;
    const response = await safeFetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Zavorth/1.0',
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    }, {
      serviceName: 'WebSearch Bing fallback',
    });

    if (!response.ok) {
      throw new Error(`Bing web retornou HTTP ${response.status}`);
    }

    return this.parseBingWebResults(await response.text());
  }

  private parseBingWebResults(html: string): SearchEngineResult[] {
    return Array.from(String(html || '').matchAll(/<li\b[^>]*class=["'][^"']*\bb_algo\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi))
      .map((match) => {
        const block = match[1] || '';
        const linkMatch = block.match(/<h2\b[^>]*>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i);
        if (!linkMatch?.[1] || !linkMatch?.[2]) {
          return null;
        }
        const descriptionMatch =
          block.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)
          || block.match(/<div\b[^>]*class=["'][^"']*\bb_caption\b[^"']*["'][^>]*>[\s\S]*?<p\b[^>]*>([\s\S]*?)<\/p>/i);
        return {
          title: this.decodeRssText(linkMatch[2]),
          url: this.normalizeBingResultUrl(this.decodeRssText(linkMatch[1])),
          description: descriptionMatch?.[1] ? this.decodeRssText(descriptionMatch[1]) : 'Snippet unavailable.',
        };
      })
      .filter((result): result is SearchEngineResult => Boolean(result?.url && result.title))
      .filter((result, index, results) => results.findIndex((candidate) => candidate.url === result.url) === index)
      .slice(0, 8);
  }

  private normalizeBingResultUrl(url: string): string {
    const raw = String(url || '').trim();
    try {
      const parsed = new URL(raw);
      if (!/bing\.com$/i.test(parsed.hostname) && !parsed.hostname.endsWith('.bing.com')) {
        return raw;
      }

      const encodedTarget = parsed.searchParams.get('u');
      if (!encodedTarget) {
        return raw;
      }

      const maybeBase64 = encodedTarget.startsWith('a1')
        ? encodedTarget.slice(2)
        : encodedTarget;
      const decoded = Buffer.from(
        maybeBase64.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString('utf8');
      return /^https?:\/\//i.test(decoded) ? decoded : raw;
    } catch (error: unknown) {logger.warn('[Web Search] network request failed', error); return raw; }
  }

  private async enqueueDuckDuckGoSearch<T>(operation: () => Promise<T>): Promise<T> {
    const previous = WebSearchTool.duckDuckGoQueue;
    let release: () => void = () => undefined;
    WebSearchTool.duckDuckGoQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous.catch(() => undefined);
    try {
      if (process.env.NODE_ENV !== 'test') {
        const now = Date.now();
        const waitMs = Math.max(0, WebSearchTool.nextDuckDuckGoAt - now);
        if (waitMs > 0) {
          await this.delay(waitMs);
        }
        WebSearchTool.nextDuckDuckGoAt = Date.now() + 1_500;
      }
      return await operation();
    } finally {
      release();
    }
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private formatRankedResults(
    query: string,
    results: RankedSearchCandidate[],
    profile: EvidenceDomainProfile,
    options: { deep: boolean; extractPages: boolean },
  ): string {
    const highSignalCount = results.filter((result) => result.highSignal).length;
    const hostDiversityCount = new Set(results.map((result) => normalizeHost(result.url))).size;
    const qualityGate = highSignalCount >= profile.minHighSignalResults
      ? 'QUALITY_GATE: evidence_sources_ranked'
      : 'QUALITY_GATE: weak_domain_sources';
    const lines = [
      qualityGate,
      `EVIDENCE_PROFILE: ${profile.domain} (${profile.label})`,
      `Query: "${query}"`,
      `Strong sources found: ${highSignalCount}/${Math.max(profile.minHighSignalResults, 0)}.`,
      `Host diversity: ${hostDiversityCount}/${results.length}.`,
      options.deep
        ? 'Ranking applied: preferred sources, official/academic domains, authority terms, and host diversity.'
        : 'Ranking applied: search order with light source scoring.',
      profile.guidance,
    ];

    if (qualityGate === 'QUALITY_GATE: weak_domain_sources') {
      lines.push(
        'Warning: returned sources did not meet the minimum authority threshold for this domain. Do not present this as a definitive or exhaustive answer.',
      );
    }

    lines.push('');
    results.forEach((result, index) => {
      lines.push(`${index + 1}. **${result.title}**`);
      lines.push(`   URL: ${result.url}`);
      lines.push(`   Host: ${normalizeHost(result.url)}`);
      lines.push(`   Source strength: ${result.highSignal ? 'high' : result.evidenceScore >= 20 ? 'medium' : 'low'} (${result.evidenceScore})`);
      if (result.scoreReasons.length > 0) {
        lines.push(`   Ranking reasons: ${result.scoreReasons.join(', ')}`);
      }
      if (result.sourceTrack) {
        lines.push(`   Search track: ${result.sourceTrack} (${result.sourceRole || 'baseline'})`);
      }
      lines.push(`   Search snippet: ${this.wrapUntrustedWebEvidence(result.description || 'Snippet unavailable.', result.url, 'search_snippet')}`);
      if (result.extracted?.excerpt) {
        if (result.extracted.title && result.extracted.title !== result.title) {
          lines.push(`   Extracted title: ${result.extracted.title}`);
        }
        if (result.extracted.publishedAt) {
          lines.push(`   Data extraida: ${result.extracted.publishedAt}`);
        }
        lines.push(`   Extrato da pagina: ${this.wrapUntrustedWebEvidence(result.extracted.excerpt, result.url, 'page_excerpt')}`);
      } else if (result.extracted?.error) {
        lines.push(`   Page extraction: unavailable (${result.extracted.error})`);
      }
      lines.push(`   Query used: ${result.sourceQuery}`);
      lines.push('');
    });

    return lines.join('\n').trim();
  }

  private async extractPageExcerpt(url: string): Promise<ExtractedPage> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6_000);
    timeout.unref?.();

    try {
      const response = await safeFetch(url, {
        signal: controller.signal,
        headers: {
          'user-agent': 'Zavorth/1.0 (+local assistant; evidence extraction)',
          accept: 'text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.2',
        },
      }, {
        serviceName: 'WebSearch evidence extraction',
      });
      if (!response.ok) {
        return { error: `HTTP ${response.status}` };
      }

      const contentLength = Number(response.headers.get('content-length') || 0);
      if (Number.isFinite(contentLength) && contentLength > 1_500_000) {
        return { error: 'page too large' };
      }

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (contentType && !/(text\/html|text\/plain|application\/xhtml\+xml)/.test(contentType)) {
        return { error: `unsupported content-type ${contentType}` };
      }

      const raw = await response.text();
      const title = this.extractHtmlTitle(raw);
      const publishedAt = this.extractPublishedDate(raw);
      const excerpt = this.htmlToReadableText(raw).slice(0, 1400).trim();
      if (!excerpt) {
        return { title, publishedAt, error: 'empty extracted text' };
      }
      return { title, excerpt, publishedAt };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Web Search] operation failed', error);
    return { error: error instanceof Error ? (err.name === 'AbortError' ? 'timeout' : err.message) : String(error) };
  } finally {
      clearTimeout(timeout);
    }
  }

  private extractHtmlTitle(raw: string): string {
    const match = String(raw || '').match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    return match?.[1] ? this.decodeRssText(match[1]).slice(0, 180) : '';
  }

  private extractPublishedDate(raw: string): string {
    const text = String(raw || '');
    const timeMatch = text.match(/<time\b[^>]*datetime=["']([^"']+)["']/i);
    if (timeMatch?.[1]) {
      return this.decodeRssText(timeMatch[1]).slice(0, 80);
    }

    const metaMatch = text.match(
      /<meta\b[^>]*(?:property|name|itemprop)=["'](?:article:published_time|datePublished|date|pubdate|publishdate)["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    );
    return metaMatch?.[1] ? this.decodeRssText(metaMatch[1]).slice(0, 80) : '';
  }

  private htmlToReadableText(raw: string): string {
    return this.decodeRssText(
      String(raw || '')
        .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
        .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
        .replace(/<header\b[\s\S]*?<\/header>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|li|h1|h2|h3|section|article|div)>/gi, '\n')
        .replace(/<[^>]+>/g, ' '),
    )
      .replace(/\s+\n/g, '\n')
      .replace(/\n\s+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  private wrapUntrustedWebEvidence(content: string, sourceUrl: string, kind: string): string {
    return wrapUntrustedContent('untrusted_web_evidence', content, {
      source_url: sourceUrl,
      kind,
    });
  }

  private async searchNewsFallback(query: string, limit: number): Promise<string | null> {
    if (this.isAiNewsQuery(query)) {
      const aiNewsResult = await this.searchAiNewsFallback(query, limit);
      if (aiNewsResult) {
        return aiNewsResult;
      }
    }

    if (this.isGlobalPoliticsNewsQuery(query)) {
      const politicsResult = await this.searchGlobalPoliticsNewsFallback(query, limit);
      if (politicsResult) {
        return politicsResult;
      }
    }

    try {
      const googleResult = await this.searchGoogleNewsFallback(query, limit);
      if (googleResult) {
        return googleResult;
      }
    } catch (fallbackError: unknown) {
      const err = asErrorLike(fallbackError);
      const error = err;
      const errorMessage = fallbackError instanceof Error ? err.message : String(fallbackError);
      console.error(`[WebSearchTool] Google News fallback failed:`, errorMessage);
    }

    try {
      return await this.searchBingNewsFallback(query, limit);
    } catch (fallbackError: unknown) {
      const err = asErrorLike(fallbackError);
      const error = err;
      const errorMessage = fallbackError instanceof Error ? err.message : String(fallbackError);
      console.error(`[WebSearchTool] Bing News fallback failed:`, errorMessage);
      return null;
    }
  }

  private async searchAiNewsFallback(query: string, limit: number): Promise<string | null> {
    const when = this.resolveGoogleNewsWhen(query);
    let lastQualityGate: string | null = null;
    const candidates = [
      {
        query: `artificial intelligence AI latest news worldwide ${when}`,
        locale: { hl: 'en-US', gl: 'US', ceid: 'US:en' },
        label: 'Google News RSS (global AI)',
      },
      {
        query: `OpenAI Anthropic Google DeepMind Meta AI Nvidia latest artificial intelligence news ${when}`,
        locale: { hl: 'en-US', gl: 'US', ceid: 'US:en' },
        label: 'Google News RSS (AI companies)',
      },
      {
        query: `inteligencia artificial IA ultimas noticias mundo ${when}`,
        locale: { hl: 'en-US', gl: 'BR', ceid: 'BR:pt-419' },
        label: 'Google News RSS (IA global en-US)',
      },
    ];

    for (const candidate of candidates) {
      try {
        const result = await this.searchGoogleNewsFallback(query, limit, {
          effectiveQuery: candidate.query,
          locale: candidate.locale,
          sourceLabel: candidate.label,
          topic: 'ai',
        });
        if (result && !result.includes('QUALITY_GATE: insufficient_news_results')) {
          return result;
        }
        if (result) {
          lastQualityGate = result;
        }
      } catch (fallbackError: unknown) {
        const err = asErrorLike(fallbackError);
        const error = err;
        const errorMessage = fallbackError instanceof Error ? err.message : String(fallbackError);
        console.error(`[WebSearchTool] Fallback ${candidate.label} failed:`, errorMessage);
      }
    }

    return lastQualityGate || [
      'QUALITY_GATE: insufficient_news_results',
      `Query: "${query}"`,
      'I did not find enough recent artificial intelligence results in global searches.',
      'Do not produce a factual AI briefing without recent sources directly related to the topic.',
    ].join('\n');
  }

  private async searchGlobalPoliticsNewsFallback(query: string, limit: number): Promise<string | null> {
    const when = this.resolveGoogleNewsWhen(query);
    const candidates = [
      {
        topic: 'WORLD',
        locale: { hl: 'en-US', gl: 'US', ceid: 'US:en' },
      },
      {
        query: `global politics international relations elections diplomacy conflict summit government ${when}`,
        locale: { hl: 'en-US', gl: 'US', ceid: 'US:en' },
      },
      {
        query: `world politics Reuters AP BBC Al Jazeera France24 DW government election diplomacy ${when}`,
        locale: { hl: 'en-US', gl: 'US', ceid: 'US:en' },
      },
      {
        query: `politica global internacional eleicoes governo diplomacia conflito cupula ${when}`,
        locale: { hl: 'en-US', gl: 'BR', ceid: 'BR:pt-419' },
      },
    ];
    const itemBlocks: string[] = [];

    for (const candidate of candidates) {
      try {
        const xml = candidate.topic
          ? await this.fetchGoogleNewsTopicRssXml(candidate.topic, candidate.locale)
          : await this.fetchGoogleNewsRssXml(String(candidate.query || ''), candidate.locale);
        itemBlocks.push(...Array.from(xml.matchAll(/<item\b[^>]*>[\s\S]*?<\/item>/gi)).map((match) => match[0]));
      } catch (fallbackError: unknown) {
        const err = asErrorLike(fallbackError);
        const error = err;
        const errorMessage = fallbackError instanceof Error ? err.message : String(fallbackError);
        console.error(`[WebSearchTool] Global politics fallback failed:`, errorMessage);
      }
    }

    if (itemBlocks.length === 0) {
      return null;
    }

    return this.formatGlobalPoliticsRssResults(
      query,
      `<rss><channel>${itemBlocks.join('\n')}</channel></rss>`,
      limit,
      'Google News RSS (global politics multi-query)',
    );
  }

  private formatGlobalPoliticsRssResults(
    query: string,
    xml: string,
    limit: number,
    sourceLabel: string,
  ): string | null {
    const freshnessWindowHours = this.resolveFreshnessWindowHours(query) || 192;
    const nowMs = Date.now();
    const seenLinks = new Set<string>();
    const items = Array.from(xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi))
      .map((match) => {
        const item = match[1] || '';
        const title = this.extractRssField(item, 'title') || 'Sem titulo';
        const link = this.extractRssField(item, 'link') || 'URL unavailable';
        const source = this.extractRssField(item, 'source');
        const sourceUrl = this.extractRssSourceUrl(item);
        const description = this.extractRssField(item, 'description') || 'Snippet unavailable';
        const pubDate = this.extractRssField(item, 'pubDate');
        const publishedAt = pubDate ? Date.parse(pubDate) : Number.NaN;
        return {
          title,
          link,
          source,
          sourceUrl,
          description,
          pubDate,
          publishedAt: Number.isFinite(publishedAt) ? publishedAt : null,
        };
      })
      .filter((item) => this.isTopicalNewsItem('global_politics', item.title, item.description))
      .filter((item) => {
        if (!item.link || seenLinks.has(item.link)) {
          return false;
        }
        seenLinks.add(item.link);
        return true;
      })
      .filter((item) => {
        if (!item.publishedAt) {
          return false;
        }
        const ageHours = (nowMs - item.publishedAt) / 3_600_000;
        return ageHours >= -2 && ageHours <= freshnessWindowHours;
      })
      .sort((left, right) => (right.publishedAt || 0) - (left.publishedAt || 0))
      .slice(0, limit);

    const minResults = Math.min(5, Math.max(4, limit));
    const minHosts = Math.min(4, Math.max(3, limit - 1));
    const hostDiversityCount = new Set(items.map((item) => this.getRssSourceKey(item)).filter(Boolean)).size;
    if (items.length < minResults || hostDiversityCount < minHosts) {
      return [
        'QUALITY_GATE: insufficient_news_results',
        `Query: "${query}"`,
        `Recent results found: ${items.length}/${minResults}.`,
        `Diversidade de hosts: ${hostDiversityCount}/${minHosts}.`,
        'Filtro temporal: resultados publicados recentemente conforme o pedido.',
        'Do not produce a broad global politics briefing from this data; try a new search, a more specific topic, or say that sources were insufficient.',
        '',
        ...items.map((item, index) => [
          `${index + 1}. **${item.title}**`,
          `   URL: ${item.link}`,
          item.source ? `   Source: ${item.source}` : '',
          item.pubDate ? `   Published: ${item.pubDate}` : '',
          `   Snippet: ${this.wrapUntrustedWebEvidence(item.description, item.link, 'rss_snippet')}`,
        ].filter(Boolean).join('\n')),
      ].filter(Boolean).join('\n');
    }

    return [
      'QUALITY_GATE: fresh_news_results_ok',
      `Global politics results for "${query}" (fallback ${sourceLabel}):`,
      '',
      'Filtro temporal: resultados publicados recentemente conforme o pedido.',
      `Diversidade de hosts: ${hostDiversityCount}/${items.length}.`,
      '',
      ...items.map((item, index) => [
        `${index + 1}. **${item.title}**`,
        `   URL: ${item.link}`,
        item.source ? `   Source: ${item.source}` : '',
        item.pubDate ? `   Published: ${item.pubDate}` : '',
        `   Snippet: ${this.wrapUntrustedWebEvidence(item.description, item.link, 'rss_snippet')}`,
      ].filter(Boolean).join('\n')),
    ].join('\n');
  }

  private async searchGoogleNewsFallback(query: string, limit: number): Promise<string | null>;
  private async searchGoogleNewsFallback(
    query: string,
    limit: number,
    options: {
      effectiveQuery?: string;
      locale?: { hl: string; gl: string; ceid: string };
      sourceLabel?: string;
      topic?: NewsTopic;
    },
  ): Promise<string | null>;
  private async searchGoogleNewsFallback(
    query: string,
    limit: number,
    options: {
      effectiveQuery?: string;
      locale?: { hl: string; gl: string; ceid: string };
      sourceLabel?: string;
      topic?: NewsTopic;
    } = {},
  ): Promise<string | null> {
    const locale = options.locale || this.resolveGoogleNewsLocale(query);
    const genericBriefing = this.isGenericNewsBriefingQuery(query);
    const effectiveQuery = options.effectiveQuery || (genericBriefing ? this.buildGenericNewsBriefingQuery(locale.hl) : query);
    const xml = await this.fetchGoogleNewsRssXml(effectiveQuery, locale);
    return this.formatRssResults(
      query,
      xml,
      limit,
      options.sourceLabel || (genericBriefing ? 'Google News RSS (generic briefing)' : 'Google News RSS'),
      { topic: options.topic },
    );
  }

  private async fetchGoogleNewsRssXml(
    effectiveQuery: string,
    locale: { hl: string; gl: string; ceid: string },
  ): Promise<string> {
    const baseUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(effectiveQuery)}`;
    const separator = '&';
    const url = [
      `${baseUrl}${separator}hl=${encodeURIComponent(locale.hl)}`,
      `gl=${encodeURIComponent(locale.gl)}`,
      `ceid=${encodeURIComponent(locale.ceid)}`,
    ].join('&');
    const response = await safeFetch(url, {
      headers: {
        'user-agent': 'Zavorth/1.0 (+local assistant; news fallback)',
        accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
    }, {
      serviceName: 'WebSearch Google News RSS',
    });

    if (!response.ok) {
      throw new Error(`Google News RSS retornou HTTP ${response.status}`);
    }

    return await response.text();
  }

  private async fetchGoogleNewsTopicRssXml(
    topic: string,
    locale: { hl: string; gl: string; ceid: string },
  ): Promise<string> {
    const safeTopic = encodeURIComponent(topic.toUpperCase());
    const url = [
      `https://news.google.com/rss/headlines/section/topic/${safeTopic}?hl=${encodeURIComponent(locale.hl)}`,
      `gl=${encodeURIComponent(locale.gl)}`,
      `ceid=${encodeURIComponent(locale.ceid)}`,
    ].join('&');
    const response = await safeFetch(url, {
      headers: {
        'user-agent': 'Zavorth/1.0 (+local assistant; news fallback)',
        accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
    }, {
      serviceName: 'WebSearch Google News topic RSS',
    });

    if (!response.ok) {
      throw new Error(`Google News ${topic} RSS retornou HTTP ${response.status}`);
    }

    return await response.text();
  }

  private async searchBingNewsFallback(query: string, limit: number): Promise<string | null> {
    const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss`;
    const response = await safeFetch(url, {
      headers: {
        'user-agent': 'Zavorth/1.0 (+local assistant; news fallback)',
        accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
    }, {
      serviceName: 'WebSearch Bing News RSS',
    });

    if (!response.ok) {
      throw new Error(`Bing News RSS retornou HTTP ${response.status}`);
    }

    return this.formatRssResults(query, await response.text(), limit, 'Bing News RSS');
  }

  private formatRssResults(
    query: string,
    xml: string,
    limit: number,
    sourceLabel: string,
    options: { topic?: NewsTopic } = {},
  ): string | null {
    const itemMatches = Array.from(xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi));
    if (itemMatches.length === 0) {
      return null;
    }
    const freshnessWindowHours = this.resolveFreshnessWindowHours(query);
    const broadNewsQuery = this.isBroadNewsQuery(query);
    const nowMs = Date.now();
    const items = itemMatches
      .map((match) => {
        const item = match[1] || '';
        const title = this.extractRssField(item, 'title') || 'Sem titulo';
        const link = this.extractRssField(item, 'link') || 'URL unavailable';
        const description = this.extractRssField(item, 'description') || 'Snippet unavailable';
        const pubDate = this.extractRssField(item, 'pubDate');
        const publishedAt = pubDate ? Date.parse(pubDate) : Number.NaN;
        return {
          title,
          link,
          description,
          pubDate,
          publishedAt: Number.isFinite(publishedAt) ? publishedAt : null,
        };
      })
      .filter((item) => !/feed nao esta disponivel|feed não está disponível/i.test(item.title))
      .filter((item) => !broadNewsQuery || !this.isLowSignalBroadNewsItem(item.title, item.description))
      .filter((item) => !options.topic || this.isTopicalNewsItem(options.topic, item.title, item.description))
      .filter((item) => {
        if (!freshnessWindowHours) {
          return true;
        }
        if (!item.publishedAt) {
          return false;
        }
        const ageHours = (nowMs - item.publishedAt) / 3_600_000;
        return ageHours >= -2 && ageHours <= freshnessWindowHours;
      })
      .slice(0, limit);

    if (items.length === 0) {
      return null;
    }

    const minResults = Math.min(config.tools.media.audio.newsMinResults, limit);
    if (freshnessWindowHours && items.length < minResults) {
      return [
        'QUALITY_GATE: insufficient_news_results',
        `Query: "${query}"`,
        `Recent results found: ${items.length}/${minResults}.`,
        'Temporal filter: results were published recently according to the request.',
        'Do not produce a broad briefing from this data; request a new search, a more specific topic, or say that sources were insufficient.',
        '',
        ...items.map((item, index) => [
          `${index + 1}. **${item.title}**`,
          `   URL: ${item.link}`,
          item.pubDate ? `   Published: ${item.pubDate}` : '',
          `   Snippet: ${this.wrapUntrustedWebEvidence(item.description, item.link, 'rss_snippet')}`,
        ].filter(Boolean).join('\n')),
      ].join('\n');
    }

    let formattedOutput = `QUALITY_GATE: fresh_news_results_ok\nNews results for "${query}" (fallback ${sourceLabel}):\n\n`;
    if (freshnessWindowHours) {
      formattedOutput += 'Temporal filter: results were published recently according to the request.\n\n';
    }
    items.forEach((item, index) => {
      formattedOutput += `${index + 1}. **${item.title}**\n`;
      formattedOutput += `   URL: ${item.link}\n`;
      if (item.pubDate) {
        formattedOutput += `   Published: ${item.pubDate}\n`;
      }
      formattedOutput += `   Snippet: ${this.wrapUntrustedWebEvidence(item.description, item.link, 'rss_snippet')}\n\n`;
    });

    return formattedOutput.trim();
  }

  private resolveGoogleNewsLocale(query: string): { hl: string; gl: string; ceid: string } {
    const normalized = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (/\b(noticias|ultimas|ultimos|hoje|cotacao|preco|brasil)\b/.test(normalized)) {
      return { hl: 'en-US', gl: 'BR', ceid: 'BR:pt-419' };
    }
    if (/\b(hoy|ahora|precio|espana|mexico|argentina|chile|colombia)\b/.test(normalized)) {
      return { hl: 'es-419', gl: 'US', ceid: 'US:es-419' };
    }
    return { hl: 'en-US', gl: 'US', ceid: 'US:en' };
  }

  private isGenericNewsBriefingQuery(query: string): boolean {
    const normalized = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const asksNews =
      /\b(noticias?|manchetes|news|headlines)\b/.test(normalized)
      && /\b(ultimas?|ultimos?|24\s*h|24\s*horas|semana|semanal|ultimas?\s+semana|ultimos?\s+7\s+dias|latest|last\s+24\s+hours?|last\s+week|last\s+7\s+days|today|week|weekly)\b/.test(normalized);
    const broadDateNews =
      /\b(noticias?|manchetes|news|headlines)\b/.test(normalized)
      && this.hasDateAnchor(normalized);
    const hasSpecificTopic = /\b(sobre|about|acerca\s+de|regarding)\b/.test(normalized);
    return (asksNews || broadDateNews) && !hasSpecificTopic;
  }

  private isFreshNewsQuery(query: string): boolean {
    const normalized = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return /\b(noticias?|manchetes|news|headlines)\b/.test(normalized)
      && (
        /\b(ultimas?|ultimos?|24\s*h|24\s*horas|hoje|semana|semanal|ultima\s+semana|ultimas?\s+semana|ultimos?\s+7\s+dias|latest|recent|today|week|weekly|last\s+week|last\s+7\s+days|last\s+24\s+hours?)\b/.test(normalized)
        || this.hasDateAnchor(normalized)
      );
  }

  private isAiNewsQuery(query: string): boolean {
    const normalized = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const newsMarker = /\b(noticias?|manchetes|news|headlines|ultimas?|ultimos?|latest|recent)\b/.test(normalized);
    const aiMarker =
      /\b(ia|ai|inteligencia\s+artificial|artificial\s+intelligence|machine\s+learning|aprendizado\s+de\s+maquina|llm|openai|chatgpt|anthropic|claude|deepmind|gemini|nvidia|mistral|llama|meta\s+ai)\b/.test(normalized);
    return newsMarker && aiMarker;
  }

  private isGlobalPoliticsNewsQuery(query: string): boolean {
    const normalized = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const newsMarker = /\b(noticias?|manchetes|news|headlines|ultimas?|ultimos?|latest|recent|semana|weekly)\b/.test(normalized);
    const politicsMarker =
      /\b(politica\s+global|politica\s+internacional|politics|world\s+politics|global\s+politics|international\s+relations|geopolitica|geopolitics|diplomacia|diplomacy|governo|government|eleicoes?|elections?|parlamento|parliament|congresso|congress|senado|senate|presidente|president|prime\s+minister|ministro|minister|onu|un|nato|otan|g7|g20|guerra|war|conflito|conflict|sancoes|sanctions|cupula|summit)\b/.test(normalized);
    return newsMarker && politicsMarker;
  }

  private shouldUseNewsRssFallback(query: string): boolean {
    const normalized = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const newsMarker = /\b(noticias?|manchetes|news|headlines)\b/.test(normalized);
    const currentMarker =
      /\b(hoje|agora|atual|atuais|ultimas?|ultimos?|24\s*h|24\s*horas|semana|semanal|ultima\s+semana|ultimas?\s+semana|ultimos?\s+7\s+dias|tempo\s+real|today|now|current|latest|recent|week|weekly|last\s+week|last\s+7\s+days|last\s+24\s+hours?)\b/.test(normalized);
    const publicInterestMarker =
      /\b(governo|presidente|stf|supremo|congresso|senado|camara|eleicao|politica|politics|diplomacia|geopolitica|onu|un|nato|otan|g7|g20|economia|mercado|bolsa|dolar|bitcoin|cripto|empresa|tecnologia|lancamento|release|versao|cotacao|preco|clima|placar|resultado|tendencias?|guerra|crise|ia|ai|inteligencia\s+artificial|artificial\s+intelligence|openai|chatgpt|anthropic|deepmind|nvidia)\b/.test(normalized);
    return newsMarker || (currentMarker && publicInterestMarker);
  }

  private isBroadNewsQuery(query: string): boolean {
    const normalized = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const hasNews = /\b(noticias?|manchetes|news|headlines)\b/.test(normalized);
    const hasSpecificTopic = /\b(sobre|about|acerca\s+de|regarding)\b/.test(normalized);
    return hasNews && !hasSpecificTopic;
  }

  private resolveFreshnessWindowHours(query: string): number | null {
    const normalized = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (/\b(24\s*h|24\s*horas|last\s+24\s+hours?)\b/.test(normalized)) {
      return 36;
    }
    if (/\b(semana|semanal|ultima\s+semana|ultimas?\s+semana|ultimos?\s+7\s+dias|week|weekly|last\s+week|last\s+7\s+days)\b/.test(normalized)) {
      return 192;
    }
    if (/\b(hoje|today|ultimas?|ultimos?|latest|recent)\b/.test(normalized)) {
      return 72;
    }
    if (/\b(noticias?|manchetes|news|headlines)\b/.test(normalized) && this.hasDateAnchor(normalized)) {
      return 72;
    }
    return null;
  }

  private hasDateAnchor(normalizedQuery: string): boolean {
    return /\b\d{4}-\d{2}-\d{2}\b/.test(normalizedQuery)
      || /\b\d{1,2}\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4}\b/.test(normalizedQuery)
      || /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(normalizedQuery);
  }

  private isLowSignalBroadNewsItem(title: string, description: string): boolean {
    const normalized = `${title} ${description}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return /\b(lotofacil|mega-sena|quina|concurso\s+\d+|resultado\s+deste|jornal\s+[a-z0-9]+|ed\.\s*\d+|videos?:|video\.|horoscopo|previsao\s+do\s+tempo)\b/.test(normalized);
  }

  private isTopicalNewsItem(topic: NewsTopic, title: string, description: string): boolean {
    const normalized = `${title} ${description}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (topic === 'ai') {
      const negativeAiMention =
        /\b(sem\s+relacao|nao\s+relacionad[oa]|unrelated|not\s+related)\b.{0,80}\b(ia|ai|inteligencia\s+artificial|artificial\s+intelligence)\b/.test(normalized)
        || /\b(ia|ai|inteligencia\s+artificial|artificial\s+intelligence)\b.{0,80}\b(sem\s+relacao|nao\s+relacionad[oa]|unrelated|not\s+related)\b/.test(normalized);
      if (negativeAiMention) {
        return false;
      }
      return /\b(ia|ai|inteligencia\s+artificial|artificial\s+intelligence|machine\s+learning|aprendizado\s+de\s+maquina|generative\s+ai|ia\s+generativa|llm|large\s+language\s+model|openai|chatgpt|anthropic|claude|google\s+deepmind|deepmind|gemini|nvidia|meta\s+ai|llama|mistral|xai|grok|perplexity|copilot)\b/.test(normalized);
    }

    if (topic === 'global_politics') {
      return /\b(politica|politics|political|governo|government|presidente|president|prime\s+minister|ministro|minister|parlamento|parliament|congresso|congress|senado|senate|eleicoes?|elections?|diplomacia|diplomacy|sanctions?|sancoes|war|guerra|conflict|conflito|ceasefire|truce|coup|golpe|summit|cupula|g7|g20|un|onu|nato|otan|european\s+union|china|russia|ukraine|ucrania|israel|gaza|iran|venezuela|argentina|united\s+states|eua|europa)\b/.test(normalized);
    }

    return true;
  }

  private resolveGoogleNewsWhen(query: string): string {
    const normalized = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (/\b(24\s*h|24\s*horas|last\s+24\s+hours?)\b/.test(normalized)) {
      return 'when:1d';
    }
    if (/\b(semana|semanal|ultima\s+semana|ultimas?\s+semana|ultimos?\s+7\s+dias|week|weekly|last\s+week|last\s+7\s+days)\b/.test(normalized)) {
      return 'when:7d';
    }
    return 'when:3d';
  }

  private buildGenericNewsBriefingQuery(locale: string): string {
    if (locale.startsWith('pt')) {
      return 'noticias Brasil mundo when:1d';
    }
    if (locale.startsWith('es')) {
      return 'noticias mundo when:1d';
    }
    return 'top headlines world when:1d';
  }

  private extractRssField(itemXml: string, field: string): string {
    const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = itemXml.match(new RegExp(`<${escapedField}\\b[^>]*>([\\s\\S]*?)<\\/${escapedField}>`, 'i'));
    if (!match?.[1]) {
      return '';
    }
    return this.decodeRssText(match[1]);
  }

  private extractRssSourceUrl(itemXml: string): string {
    const match = String(itemXml || '').match(/<source\b[^>]*url=["']([^"']+)["'][^>]*>/i);
    return match?.[1] ? this.decodeRssText(match[1]) : '';
  }

  private getRssSourceKey(item: { link: string; source?: string; sourceUrl?: string }): string {
    return normalizeHost(item.sourceUrl || '')
      || normalizeEvidenceText(item.source || '')
      || normalizeHost(item.link || '');
  }

  private decodeRssText(value: string): string {
    return String(value || '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
