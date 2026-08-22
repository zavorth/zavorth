import { asErrorLike } from '../utils/errorLike';
import {
  DuckDuckGoSearchAdapter,
  SearchAdapterError,
} from '../adapters/search/DuckDuckGoSearchAdapter.js';
import {
  GeminiGroundingSearchAdapter,
  GroundingAdapterError,
} from '../adapters/search/GeminiGroundingSearchAdapter.js';
import {
  SearchProviderLiveAdapter,
} from '../adapters/web/WebResearchLiveAdapters.js';
import { safeFetch } from '../security/SafeFetchService.js';
/**
 * SearchQueryService - Zavorth-native unified web search orchestration service.
 *
 * This service is the core of the `search.query` capability. It unifies the surfaces
 * de busca que antes estavam dispersas entre WebSearchTool e DeepSearchService,
 * behind a canonical pipeline:
 *
    // 1. Validation.
 * 2. Evaluate network/content policy.
 * 3. Resolve effective evidence mode and domain.
 * 4. Selecionar e invocar o adapter correto.
 * 5. Normalize results with evidence scoring.
 * 6. Apply host diversification.
 * 7. Extract page content when requested.
 * 8. Montar quality gate e resultado final.
 *
 * The service NEVER:
 * - Retorna dados do provedor como autoridade.
 * - Accepts an endpoint as the canonical source.
 * - Bypasses network policy.
 *
 * Architectural references:
 * - docs/native-absorption-execution-plan.md
 * - src/contracts/SearchQueryContract.ts
 *
 * @module services/SearchQueryService
 * @since 2026-05-03
 * @author Zavorth Core Team
 */

import { logger } from '../logger.js';
import {
  inferEvidenceDomainFromText,
  getEvidenceDomainProfile,
  scoreEvidenceSource,
  normalizeHost,
  type EvidenceDomainProfile,
} from '../agents/EvidenceDomainProfiles.js';
import {
  NewsRssAdapter,
  NEWS_RSS_ADAPTER_ID,
} from '../adapters/search/NewsRssAdapter.js';
import {
  buildSeedSourceItems,
  resolveSeedSourceRedirects,
} from '../adapters/search/SeedSourceRegistry.js';
import { augmentSearchQuery } from '../adapters/search/SearchQueryAugmentor.js';
import type {
  SearchQueryRequest,
  SearchQueryResult,
  SearchQueryPolicyDecision,
  SearchResultItem,
  SearchQualityGate,
  SearchQueryError,
  SearchQueryMode,
  SearchEvidenceDomain,
  ISearchQueryAdapter,
  AdapterSearchOutput,
  AdapterSearchItem,
} from '../contracts/SearchQueryContract.js';
import type {
  ISemanticIntentClassifier,
  IRelevanceScorer,
  SemanticIntent,
  RelevanceScore,
} from '../contracts/search/SemanticIntentContract.js';
import type {
  ISearchAdapter,
} from '../contracts/search/SearchAdapterContract.js';
import { StructuralIntentClassifier } from './search/StructuralIntentClassifier.js';
import { StructuralRelevanceScorer } from './search/StructuralRelevanceScorer.js';


import { wrapUntrustedContent } from '../security/UntrustedContent.js';

const MAX_RESULTS = 10;

const NEWS_INTENT_TOPICS: ReadonlyArray<SemanticIntent['topic']> = [
  'news',
  'public_policy',
];

export interface SearchQueryServiceOptions {
  readonly adapters?: ReadonlyArray<ISearchQueryAdapter | ISearchAdapter>;
  readonly intentClassifier?: ISemanticIntentClassifier;
  readonly relevanceScorer?: IRelevanceScorer;
  readonly relevanceMinScore?: number;
}

export class SearchQueryService {
  private readonly adapters: Map<string, ISearchQueryAdapter | ISearchAdapter>;
  private readonly intentClassifier: ISemanticIntentClassifier;
  private readonly relevanceScorer: IRelevanceScorer;
  private readonly relevanceMinScore: number;

  constructor(options: SearchQueryServiceOptions = {}) {
    this.adapters = new Map();
    const adapterList = options.adapters || createDefaultSearchAdapters();
    for (const adapter of adapterList) {
      this.adapters.set(adapter.adapterId, adapter as ISearchQueryAdapter | ISearchAdapter);
    }
    this.intentClassifier = options.intentClassifier ?? new StructuralIntentClassifier();
    this.relevanceScorer = options.relevanceScorer ?? new StructuralRelevanceScorer();
    this.relevanceMinScore = options.relevanceMinScore ?? 0.35;
  }

  /**
   * Executa busca web de ponta a ponta.
   *
   * Flow: request -> validate -> policy -> adapter -> normalize -> quality gate -> result
   */
  public async search(request: SearchQueryRequest): Promise<SearchQueryResult> {
    const processedAt = new Date().toISOString();

    // 1. Validation.
    const validationError = this.validateRequest(request);
    if (validationError) {
      return this.buildErrorResult(validationError, request, processedAt);
    }

    // 2. Policy.
    const policyDecision = this.evaluatePolicy(request);
    if (!policyDecision.allowed) {
      return this.buildPolicyBlockedResult(policyDecision, request, processedAt);
    }

    // 3. Resolve effective mode and domain.
    const mode = request.mode || 'deep';
    const evidenceDomain = this.resolveEvidenceDomain(request);
    const profile = getEvidenceDomainProfile(evidenceDomain);

    // 4. Seleciona e invoca adapter.
    const effectiveQuery = policyDecision.queryModified && policyDecision.sanitizedQuery
      ? policyDecision.sanitizedQuery
      : request.query;

    const augmentation = augmentSearchQuery(effectiveQuery, request.evidenceDomain || 'auto');
    const augmentedRequest = augmentation.augmentationApplied
      ? { ...request, query: augmentation.effectiveQuery }
      : request;

    const intent = await this.intentClassifier.classify({
      query: augmentedRequest.query,
      explicitDomain: evidenceDomain,
      mode,
      providerHints: augmentedRequest.providerHints,
    });

    let adapterOutput: AdapterSearchOutput;
    try {
      adapterOutput = await this.invokeAdapterWithFallback(augmentedRequest, mode, evidenceDomain, intent);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Search Query] search failed', error);
      return this.buildAdapterErrorResult(err, request, policyDecision, processedAt);
    }

    const seedItems = buildSeedSourceItems(request, intent);
    const resolvedSeedItems = seedItems.length > 0 ? await resolveSeedSourceRedirects(seedItems) : [];

    // 5. Normalize results with evidence scoring + relevance filtering.
    const limit = Math.min(request.limit || 5, MAX_RESULTS);
    const scoredItems = resolvedSeedItems.length > 0
      ? this.mergeAdapterOutputs(adapterOutput, resolvedSeedItems, evidenceDomain)
      : this.scoreAndNormalize(adapterOutput, evidenceDomain);
    const combinedItems = await this.applyRelevanceFilter(scoredItems, augmentedRequest.query, intent);

    // 6. Diversifica hosts.
    const diversified = this.diversifyHosts(combinedItems, limit);

    // 7. Extract page content (if deep + extractPages, but skip for RSS/news items).
    const shouldExtract = request.extractPages !== false && mode === 'deep';
    const isRssResult = adapterOutput.providerId === NEWS_RSS_ADAPTER_ID;
    if (shouldExtract && !isRssResult) {
      await this.extractTopPages(diversified, 3);
    }

    // 8. Monta quality gate.
    const isNewsQuery = this.isNewsIntent(intent);
    const qualityGate = this.buildQualityGate(diversified, profile, isNewsQuery, limit);

    // 9. Resultado final.
    return {
      ok: true,
      mode,
      evidenceDomain,
      items: diversified,
      groundedSynthesis: adapterOutput.groundedSynthesis || null,
      policyDecision,
      qualityGate,
      summary: `${diversified.length} result(s) found for "${effectiveQuery}" (mode: ${mode}, domain: ${evidenceDomain}).`,
      processedAt,
    };
  }

  private isNewsIntent(intent: SemanticIntent): boolean {
    return NEWS_INTENT_TOPICS.includes(intent.topic);
  }

  private async applyRelevanceFilter(
    items: SearchResultItem[],
    query: string,
    intent: SemanticIntent,
  ): Promise<SearchResultItem[]> {
    if (items.length === 0) return items;
    if (this.isNewsIntent(intent)) {
      return items;
    }
    const minScore = this.relevanceMinScore;
    const scored = await Promise.all(
      items.map(async (item) => {
        const result: RelevanceScore = await this.relevanceScorer.score({
          itemTitle: item.title,
          itemSnippet: item.snippet,
          itemUrl: item.url,
          query,
          intent,
        });
        return { item, result };
      }),
    );
    return scored
      .filter((entry) => entry.result.score >= minScore)
      .map((entry) => entry.item);
  }

  private validateRequest(request: SearchQueryRequest): SearchQueryError | null {
    if (!request.query || typeof request.query !== 'string' || request.query.trim().length === 0) {
      return {
        code: 'INVALID_REQUEST',
        message: 'The query field is required and must be a non-empty string.',
      };
    }
    return null;
  }

  private evaluatePolicy(request: SearchQueryRequest): SearchQueryPolicyDecision {
    // Sanitize the query (fix common name transcription errors).
    const sanitized = this.sanitizeQuery(request.query);
    const modified = sanitized !== request.query;

    return {
      allowed: true,
      reason: 'Search allowed by network policy.',
      policySource: 'network-scope',
      queryModified: modified,
      sanitizedQuery: modified ? sanitized : null,
    };
  }

  private sanitizeQuery(query: string): string {
    return String(query || '')
      .replace(/\bopen\s+eye\b/gi, 'OpenAI')
      .replace(/\bopeneye\b/gi, 'OpenAI')
      .replace(/\banttropic\b/gi, 'Anthropic')
      .replace(/\banthropi[ck]\b/gi, 'Anthropic')
      .replace(/\bmeta\s+al\b/gi, 'Meta AI')
      .replace(/\bgoogle\s+deep\s+mind\b/gi, 'Google DeepMind')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private resolveEvidenceDomain(request: SearchQueryRequest): SearchEvidenceDomain {
    if (request.evidenceDomain && request.evidenceDomain !== 'auto') {
      return request.evidenceDomain;
    }
    return inferEvidenceDomainFromText(request.query) as SearchEvidenceDomain;
  }

  private async invokeAdapterWithFallback(
    request: SearchQueryRequest,
    mode: SearchQueryMode,
    evidenceDomain: SearchEvidenceDomain,
    intent: SemanticIntent,
  ): Promise<AdapterSearchOutput> {
    const requestedProvider = this.requestedProviderId(request);
    if (requestedProvider === 'google' || requestedProvider === 'gemini') {
      const groundingAdapter = this.findAdapterForMode('grounded', 'gemini-grounding')
        || this.findAdapterForMode('grounded');
      if (groundingAdapter) {
        return this.invokeAdapter(groundingAdapter, request, intent);
      }
    }

    const useRssFirst = this.isNewsIntent(intent);
    let rssAlreadyCalled = false;
    if (useRssFirst) {
      const rssAdapter = this.adapters.get(NEWS_RSS_ADAPTER_ID);
      if (rssAdapter) {
        try {
          const rssOutput = await this.invokeAdapter(rssAdapter, request, intent);
          rssAlreadyCalled = true;
          if (rssOutput.items.length > 0) {
            return rssOutput;
          }
        } catch (error: unknown) {
          logger.warn('[SearchQueryService] RSS adapter failed, falling back', error);
          rssAlreadyCalled = true;
        }
      }
    }

    if (mode === 'grounded') {
      const groundingAdapter = this.findAdapterForMode('grounded', requestedProvider);
      if (groundingAdapter) {
        try {
          const result = await this.invokeAdapter(groundingAdapter, request, intent);
          if (result.groundedSynthesis?.synthesizedText && result.groundedSynthesis.synthesizedText.length > 50) {
            return result;
          }
        } catch (error: unknown) {
          const err = asErrorLike(error);
          logger.warn(`[SearchQueryService] Grounding failed, falling back to DDG: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    const ddgAdapter = (mode === 'grounded' ? null : this.findAdapterForMode(mode, requestedProvider))
      || this.findAdapterForMode('quick', requestedProvider)
      || this.findAdapterForMode('deep', requestedProvider)
      || this.findAdapterForMode('quick')
      || this.findAdapterForMode('deep');

    let ddgOutput: AdapterSearchOutput | null = null;
    if (ddgAdapter) {
      try {
        ddgOutput = await this.invokeAdapter(ddgAdapter, request, intent);
        if (ddgOutput.items.length > 0) {
          return ddgOutput;
        }
      } catch (error: unknown) {
        logger.warn('[SearchQueryService] DDG failed, attempting Bing fallback', error);
      }
    }

    const needsBingFallback = evidenceDomain === 'general' || useRssFirst;
    if (needsBingFallback && !rssAlreadyCalled) {
      const rssAdapter = this.adapters.get(NEWS_RSS_ADAPTER_ID);
      if (rssAdapter) {
        try {
          const rssOutput = await this.invokeAdapter(rssAdapter, request, intent);
          if (rssOutput.items.length > 0) {
            return rssOutput;
          }
        } catch (error: unknown) {
          logger.warn('[SearchQueryService] Bing-style RSS fallback failed', error);
        }
      }
    }

    if (ddgOutput) {
      return ddgOutput;
    }

    if (!ddgAdapter) {
      throw new Error('No search adapter available.');
    }

    return this.invokeAdapter(ddgAdapter, request, intent);
  }

  private async invokeAdapter(
    adapter: ISearchQueryAdapter | ISearchAdapter,
    request: SearchQueryRequest,
    intent: SemanticIntent,
  ): Promise<AdapterSearchOutput> {
    const candidate = adapter as unknown as { search: (req: SearchQueryRequest, intent?: SemanticIntent) => Promise<AdapterSearchOutput> };
    return candidate.search(request, intent);
  }

  private mergeAdapterOutputs(
    primary: AdapterSearchOutput,
    seedItems: AdapterSearchItem[],
    evidenceDomain: SearchEvidenceDomain,
  ): SearchResultItem[] {
    const allItems: AdapterSearchItem[] = [
      ...seedItems.map((item) => ({ ...item, originalRank: item.originalRank - 1000 })),
      ...primary.items,
    ];

    const scored = allItems.map((item) => {
      const score = scoreEvidenceSource(
        { title: item.title, url: item.url, description: item.description },
        evidenceDomain,
      );
      return {
        title: item.title,
        url: item.url,
        snippet: this.wrapUntrustedWebEvidence(item.description, item.url, 'search_snippet'),
        host: normalizeHost(item.url) || 'unknown',
        evidenceScore: score.score,
        highSignal: score.highSignal,
        scoreReasons: score.reasons,
        providerEvidence: {
          providerId: item.metadata?.sourceType === 'seed-source' ? 'seed-sources' : primary.providerId,
          effectiveQuery: item.sourceQuery,
          originalRank: item.originalRank,
          metadata: item.metadata,
        },
      } as SearchResultItem;
    });

    return scored.sort((a, b) => {
      const byScore = b.evidenceScore - a.evidenceScore;
      if (byScore !== 0) return byScore;
      return a.providerEvidence.originalRank - b.providerEvidence.originalRank;
    });
  }

  private findAdapterForMode(mode: SearchQueryMode, providerId: string | null = null): ISearchQueryAdapter | ISearchAdapter | null {
    if (providerId) {
      const direct = this.adapters.get(providerId);
      if (direct?.adapterId === NEWS_RSS_ADAPTER_ID) return null;
      if (direct?.supportedModes.includes(mode)) {
        return direct;
      }
      for (const adapter of this.adapters.values()) {
        if (adapter.adapterId === NEWS_RSS_ADAPTER_ID) continue;
        if (adapter.adapterId.toLowerCase() === providerId.toLowerCase() && adapter.supportedModes.includes(mode)) {
          return adapter;
        }
      }
      return null;
    }
    for (const adapter of this.adapters.values()) {
      if (adapter.adapterId === NEWS_RSS_ADAPTER_ID) continue;
      if (adapter.supportedModes.includes(mode)) {
        return adapter;
      }
    }
    return null;
  }

  private requestedProviderId(request: SearchQueryRequest): string | null {
    const hints = request.providerHints || {};
    const value = hints.providerId
      || hints.searchProvider
      || hints.preferredProvider
      || process.env.ZAVORTH_SEARCH_PROVIDER;
    const normalized = String(value || '').trim();
    return normalized
      && normalized !== 'local'
      && normalized !== 'skip'
      && normalized !== 'ollama-web'
      ? normalized
      : null;
  }

  private scoreAndNormalize(
    output: AdapterSearchOutput,
    evidenceDomain: SearchEvidenceDomain,
  ): SearchResultItem[] {
    return output.items.filter((item) => !this.isPrivateUrl(item.url)).map((item) => {
      const score = scoreEvidenceSource(
        { title: item.title, url: item.url, description: item.description },
        evidenceDomain,
      );

      return {
        title: item.title,
        url: item.url,
        snippet: this.wrapUntrustedWebEvidence(item.description, item.url, 'search_snippet'),
        host: normalizeHost(item.url) || 'unknown',
        evidenceScore: score.score,
        highSignal: score.highSignal,
        scoreReasons: score.reasons,
        providerEvidence: {
          providerId: output.providerId,
          effectiveQuery: item.sourceQuery,
          originalRank: item.originalRank,
          metadata: item.metadata,
        },
      };
    }).sort((a, b) => {
      const byScore = b.evidenceScore - a.evidenceScore;
      if (byScore !== 0) return byScore;
      return a.providerEvidence.originalRank - b.providerEvidence.originalRank;
    });
  }

  private isPrivateUrl(url: string): boolean {
    return typeof url === 'string' && /^(https?:\/\/)?(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.0\.0\.0|::1|localhost)/i.test(url);
  }

  private diversifyHosts(items: SearchResultItem[], limit: number): SearchResultItem[] {
    const seenHosts = new Set<string>();
    const selected: SearchResultItem[] = [];
    const remaining: SearchResultItem[] = [];

    for (const item of items) {
      if (!seenHosts.has(item.host) && selected.length < limit) {
        selected.push(item);
        seenHosts.add(item.host);
      } else {
        remaining.push(item);
      }
    }

    const hostCounts = new Map<string, number>();
    for (const item of selected) {
      hostCounts.set(item.host, (hostCounts.get(item.host) || 0) + 1);
    }

    for (const item of remaining) {
      if (selected.length >= limit) break;
      const count = hostCounts.get(item.host) || 0;
      const maxPerHost = item.highSignal ? 2 : 1;
      if (count < maxPerHost) {
        selected.push(item);
        hostCounts.set(item.host, count + 1);
      }
    }

    return selected.slice(0, limit);
  }

  private async extractTopPages(items: SearchResultItem[], maxExtract: number): Promise<void> {
    const targets = items.slice(0, maxExtract);

    await Promise.all(targets.map(async (item) => {
      try {
        item.extractedContent = await this.extractPageExcerpt(item.url);
      } catch (error: unknown) {item.extractedContent = { error: 'extraction_failed' };
      }
    }));
  }

  private async extractPageExcerpt(url: string): Promise<SearchResultItem['extractedContent']> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6_000);
    if (typeof (timeout as unknown as { unref?: () => void }).unref === 'function') {
      (timeout as unknown as { unref: () => void }).unref();
    }

    const isPrivateUrl = typeof url === 'string' && /^(https?:\/\/)?(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.0\.0\.0|::1|localhost)/i.test(url);
    if (isPrivateUrl) {
      clearTimeout(timeout);
      return { error: 'Page extraction: unavailable (private or loopback)' };
    }

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'user-agent': 'Zavorth/1.0 (+local assistant; evidence extraction)',
          'accept': 'text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.2',
        },
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
      const excerpt = this.htmlToText(raw).slice(0, 1400).trim();

      if (!excerpt) {
        return { title, publishedAt, error: 'empty extracted text' };
      }

      return {
        title,
        excerpt: this.wrapUntrustedWebEvidence(excerpt, url, 'page_excerpt'),
        publishedAt,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Search Query] operation failed', error);
    const rawMessage = err?.name === 'AbortError' ? 'timeout' : (err?.message || String(err));
      const isPrivate = typeof rawMessage === 'string' && /private or loopback/i.test(rawMessage);
      return { error: isPrivate ? 'Page extraction: unavailable (private or loopback)' : rawMessage };
  } finally {
      clearTimeout(timeout);
    }
  }

  private extractHtmlTitle(raw: string): string {
    const match = raw.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    return match?.[1] ? this.stripHtml(match[1]).slice(0, 180) : '';
  }

  private extractPublishedDate(raw: string): string {
    const timeMatch = raw.match(/<time\b[^>]*datetime=["']([^"']+)["']/i);
    if (timeMatch?.[1]) return timeMatch[1].slice(0, 80);

    const metaMatch = raw.match(
      /<meta\b[^>]*(?:property|name|itemprop)=["'](?:article:published_time|datePublished|date|pubdate|publishdate)["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    );
    return metaMatch?.[1] ? metaMatch[1].slice(0, 80) : '';
  }

  private htmlToText(raw: string): string {
    return this.stripHtml(
      raw
        .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
        .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
        .replace(/<header\b[\s\S]*?<\/header>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|li|h1|h2|h3|section|article|div)>/gi, '\n'),
    )
      .replace(/\s+\n/g, '\n')
      .replace(/\n\s+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  private stripHtml(text: string): string {
    return String(text || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private wrapUntrustedWebEvidence(content: string, sourceUrl: string, kind: string): string {
    return wrapUntrustedContent('untrusted_web_evidence', content, {
      source_url: sourceUrl,
      kind,
    });
  }

  private buildQualityGate(items: SearchResultItem[], profile: EvidenceDomainProfile, isNewsQuery: boolean = false, requestedLimit: number = 0): SearchQualityGate {
    const highSignalCount = items.filter((item) => item.highSignal).length;
    const hostDiversity = new Set(items.map((item) => item.host)).size;
    const highSignalRequired = profile.minHighSignalResults || 0;

    let status: SearchQualityGate['status'];
    if (items.length === 0) {
      status = 'insufficient_results';
    } else if (highSignalCount >= highSignalRequired) {
      status = 'evidence_sources_ranked';
    } else {
      status = 'weak_domain_sources';
    }

    const isNewsDomain = profile.domain === 'public_policy' || profile.domain === 'ai_news' || isNewsQuery;
    if (isNewsDomain) {
      const minNewsResults = Math.max(2, Math.min(requestedLimit || 3, 5));
      const minHostDiversity = Math.min(items.length, 3);
      if (items.length < minNewsResults) {
        status = 'insufficient_news_results';
      } else if (status === 'weak_domain_sources' && hostDiversity < minHostDiversity) {
        status = 'insufficient_news_results';
      } else if (status === 'weak_domain_sources' && hostDiversity >= minHostDiversity) {
        status = 'fresh_news_results_ok';
      } else if (status === 'evidence_sources_ranked' && hostDiversity >= minHostDiversity) {
        status = 'fresh_news_results_ok';
      }
    }

    return {
      status,
      highSignalCount,
      highSignalRequired,
      hostDiversity,
      guidance: profile.guidance || '',
      requestedLimit,
    };
  }

  private buildErrorResult(
    error: SearchQueryError,
    request: SearchQueryRequest,
    processedAt: string,
  ): SearchQueryResult {
    return {
      ok: false,
      mode: request.mode || 'deep',
      evidenceDomain: 'general',
      items: [],
      policyDecision: {
        allowed: true,
        reason: 'Search unavailable after adapter failure.',
        policySource: 'network-scope',
        queryModified: false,
      },
      error,
      qualityGate: { status: 'search_unavailable', highSignalCount: 0, highSignalRequired: 0, hostDiversity: 0, guidance: '' },
      summary: error.message,
      processedAt,
    };
  }

  private buildPolicyBlockedResult(
    policyDecision: SearchQueryPolicyDecision,
    request: SearchQueryRequest,
    processedAt: string,
  ): SearchQueryResult {
    return {
      ok: false,
      mode: request.mode || 'deep',
      evidenceDomain: 'general',
      items: [],
      policyDecision,
      error: { code: 'POLICY_BLOCKED', message: policyDecision.reason },
      qualityGate: { status: 'search_unavailable', highSignalCount: 0, highSignalRequired: 0, hostDiversity: 0, guidance: '' },
      summary: policyDecision.reason,
      processedAt,
    };
  }

  private buildAdapterErrorResult(
    err: unknown,
    request: SearchQueryRequest,
    policyDecision: SearchQueryPolicyDecision,
    processedAt: string,
  ): SearchQueryResult {
    const code = (err instanceof SearchAdapterError || err instanceof GroundingAdapterError)
      ? 'ALL_PROVIDERS_FAILED' as const
      : 'UNKNOWN_ERROR' as const;
    const message = err instanceof Error ? err.message : String(err);

    return {
      ok: false,
      mode: request.mode || 'deep',
      evidenceDomain: 'general',
      items: [],
      policyDecision,
      error: { code, message, providerDetail: message },
      qualityGate: { status: 'search_unavailable', highSignalCount: 0, highSignalRequired: 0, hostDiversity: 0, guidance: '' },
      summary: 'Search unavailable.',
      processedAt,
    };
  }
}

function createDefaultSearchAdapters(): Array<ISearchQueryAdapter | ISearchAdapter> {
  const adapters: Array<ISearchQueryAdapter | ISearchAdapter> = [
    new DuckDuckGoSearchAdapter(),
    new GeminiGroundingSearchAdapter(),
    new NewsRssAdapter(),
  ];

  const braveKey = envValue('BRAVE_SEARCH_API_KEY');
  if (braveKey) {
    adapters.push(new SearchProviderLiveAdapter({
      adapterId: 'brave',
      providerId: 'brave',
      searchUrl: envValue('BRAVE_SEARCH_URL') || 'https://api.search.brave.com/res/v1/web/search',
      apiKey: braveKey,
      requestStyle: 'brave',
      authHeaderName: 'X-Subscription-Token',
      authScheme: null,
    }));
  }

  const exaKey = envValue('EXA_API_KEY');
  if (exaKey) {
    adapters.push(new SearchProviderLiveAdapter({
      adapterId: 'exa',
      providerId: 'exa',
      searchUrl: envValue('EXA_SEARCH_URL') || 'https://api.exa.ai/search',
      apiKey: exaKey,
      requestStyle: 'exa',
    }));
  }

  const searxngUrl = envValue('SEARXNG_BASE_URL');
  if (searxngUrl) {
    adapters.push(new SearchProviderLiveAdapter({
      adapterId: 'searxng',
      providerId: 'searxng',
      searchUrl: searxngUrl,
      apiKey: envValue('SEARXNG_API_KEY'),
      requestStyle: 'searxng',
      authScheme: envValue('SEARXNG_API_KEY') ? 'Bearer' : null,
    }));
  }

  const tavilyKey = envValue('TAVILY_API_KEY');
  if (tavilyKey) {
    adapters.push(new SearchProviderLiveAdapter({
      adapterId: 'tavily',
      providerId: 'tavily',
      searchUrl: envValue('TAVILY_SEARCH_URL') || 'https://api.tavily.com/search',
      apiKey: tavilyKey,
      requestStyle: 'tavily',
    }));
  }

  const perplexityKey = envValue('PERPLEXITY_API_KEY');
  if (perplexityKey) {
    adapters.push(new ChatCompletionsSearchAdapter({
      adapterId: 'perplexity',
      providerId: 'perplexity',
      apiKey: perplexityKey,
      url: envValue('PERPLEXITY_SEARCH_URL') || 'https://api.perplexity.ai/chat/completions',
      model: envValue('PERPLEXITY_SEARCH_MODEL') || 'sonar',
    }));
  }

  const xaiKey = envValue('XAI_API_KEY');
  if (xaiKey) {
    adapters.push(new ChatCompletionsSearchAdapter({
      adapterId: 'grok',
      providerId: 'grok',
      apiKey: xaiKey,
      url: envValue('XAI_SEARCH_URL') || 'https://api.x.ai/v1/chat/completions',
      model: envValue('XAI_SEARCH_MODEL') || 'grok-4-1-fast',
      extraBody: {
        search_parameters: { mode: 'auto' },
      },
    }));
  }

  const kimiKey = envValue('KIMI_API_KEY') || envValue('MOONSHOT_API_KEY');
  if (kimiKey) {
    adapters.push(new ChatCompletionsSearchAdapter({
      adapterId: 'kimi',
      providerId: 'kimi',
      apiKey: kimiKey,
      url: envValue('KIMI_SEARCH_URL') || envValue('MOONSHOT_SEARCH_URL') || 'https://api.moonshot.ai/v1/chat/completions',
      model: envValue('KIMI_SEARCH_MODEL') || 'kimi-k2.5',
      extraBody: {
        tools: [{
          type: 'builtin_function',
          function: { name: '$web_search' },
        }],
      },
    }));
  }

  const minimaxKey = envValue('MINIMAX_CODE_PLAN_KEY')
    || envValue('MINIMAX_CODING_API_KEY')
    || envValue('MINIMAX_API_KEY');
  if (minimaxKey) {
    const baseUrl = envValue('MINIMAX_BASE_URL');
    adapters.push(new ChatCompletionsSearchAdapter({
      adapterId: 'minimax',
      providerId: 'minimax',
      apiKey: minimaxKey,
      url: envValue('MINIMAX_SEARCH_URL') || (baseUrl ? `${baseUrl.replace(/\/$/, '')}/chat/completions` : 'https://api.minimax.io/v1/chat/completions'),
      model: envValue('MINIMAX_SEARCH_MODEL') || envValue('MINIMAX_MODEL') || 'MiniMax-M2.7',
    }));
  }

  return adapters;
}

type ChatCompletionsSearchAdapterConfig = {
  adapterId: string;
  providerId: string;
  apiKey: string;
  url: string;
  model: string;
  extraBody?: Record<string, unknown>;
};

class ChatCompletionsSearchAdapter implements ISearchQueryAdapter {
  public readonly supportedModes: SearchQueryMode[] = ['quick', 'deep'];
  public readonly adapterId: string;
  private readonly config: ChatCompletionsSearchAdapterConfig;

  constructor(config: ChatCompletionsSearchAdapterConfig) {
    this.adapterId = config.adapterId;
    this.config = config;
  }

  public async search(request: SearchQueryRequest): Promise<AdapterSearchOutput> {
    const response = await safeFetch(this.config.url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'Return a concise web search answer with source URLs. Do not invent citations.',
          },
          {
            role: 'user',
            content: request.query,
          },
        ],
        temperature: 0,
        ...this.config.extraBody,
      }),
    }, { serviceName: `${this.config.providerId} search adapter` });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`${this.adapterId} search failed: ${readProviderError(payload, response.status)}`);
    }
    const text = String(readPath(payload, 'choices.0.message.content') || '').trim();
    const citations = collectCitationUrls(payload, text).slice(0, Math.min(request.limit || 5, 10));
    if (citations.length === 0) {
      throw new Error(`${this.adapterId} did not return verifiable web citations.`);
    }
    return {
      providerId: this.config.providerId,
      groundedSynthesis: {
        synthesizedText: text || `Search completed by ${this.config.providerId}.`,
        citations: citations.map((url) => ({
          title: titleFromUrl(url),
          url,
        })),
        modelId: this.config.model,
      },
      items: citations.map((url, index) => ({
        title: titleFromUrl(url),
        url,
        description: text.slice(0, 300) || `${this.config.providerId} citation ${index + 1}`,
        originalRank: index + 1,
        sourceQuery: request.query,
        metadata: {
          providerId: this.config.providerId,
          model: this.config.model,
        },
      })),
    };
  }
}

function envValue(name: string): string {
  return String(process.env[name] || '').trim();
}

function collectCitationUrls(payload: unknown, text: string): string[] {
  const urls = new Set<string>();
  for (const value of [
    readPath(payload, 'citations'),
    readPath(payload, 'search_results'),
    readPath(payload, 'choices.0.message.citations'),
    readPath(payload, 'choices.0.message.search_results'),
    readPath(payload, 'choices.0.message.context.search_results'),
  ]) {
    for (const url of extractUrls(value)) {
      urls.add(url);
    }
  }
  for (const match of text.matchAll(/https?:\/\/[^\s)\]}>"']+/g)) {
    urls.add(match[0]);
  }
  return Array.from(urls);
}

function extractUrls(value: unknown): string[] {
  if (!value) {
    return [];
  }
  if (typeof value === 'string') {
    return Array.from(value.matchAll(/https?:\/\/[^\s)\]}>"']+/g)).map((match) => match[0]);
  }
  if (Array.isArray(value)) {
    return value.flatMap(extractUrls);
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return [
      ...extractUrls(record.url),
      ...extractUrls(record.link),
      ...extractUrls(record.href),
      ...extractUrls(record.source_url),
    ];
  }
  return [];
}

function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch (error: unknown) {logger.warn('[Search Query] parsing failed', error); return url; }
}

function readProviderError(payload: unknown, status: number): string {
  return String(readPath(payload, 'error.message') || readPath(payload, 'message') || `HTTP ${status}`);
}

function readPath(payload: unknown, pathExpression: string): unknown {
  return pathExpression.split('.').reduce((current: unknown, key) => {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (Array.isArray(current) && /^\d+$/.test(key)) {
      return current[Number(key)];
    }
    if (typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, payload);
}
