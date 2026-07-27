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
} from '../contracts/SearchQueryContract.js';




import { wrapUntrustedContent } from '../security/UntrustedContent.js';

const MAX_RESULTS = 10;

export class SearchQueryService {
  private readonly adapters: Map<string, ISearchQueryAdapter>;

  constructor(options?: { adapters?: ISearchQueryAdapter[] }) {
    this.adapters = new Map();

    const adapterList = options?.adapters || createDefaultSearchAdapters();

    for (const adapter of adapterList) {
      this.adapters.set(adapter.adapterId, adapter);
    }
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
    const effectiveRequest = { ...request, query: effectiveQuery };

    let adapterOutput: AdapterSearchOutput;
    try {
      adapterOutput = await this.invokeAdapterWithFallback(effectiveRequest, mode);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Search Query] search failed', error);
    return this.buildAdapterErrorResult(err, request, policyDecision, processedAt);
  }

    // 5. Normalize results with evidence scoring.
    const limit = Math.min(request.limit || 5, MAX_RESULTS);
    const scoredItems = this.scoreAndNormalize(adapterOutput, evidenceDomain, profile);

    // 6. Diversifica hosts.
    const diversified = this.diversifyHosts(scoredItems, limit);

    // 7. Extract page content (if deep + extractPages).
    const shouldExtract = request.extractPages !== false && mode === 'deep';
    if (shouldExtract) {
      await this.extractTopPages(diversified, 3);
    }

    // 8. Monta quality gate.
    const qualityGate = this.buildQualityGate(diversified, profile);

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
  ): Promise<AdapterSearchOutput> {
    const requestedProvider = this.requestedProviderId(request);
    if (requestedProvider === 'google' || requestedProvider === 'gemini') {
      const groundingAdapter = this.findAdapterForMode('grounded', 'gemini-grounding')
        || this.findAdapterForMode('grounded');
      if (groundingAdapter) {
        return groundingAdapter.search(request);
      }
    }
    // For 'grounded' mode, try grounding first, fallback to DDG.
    if (mode === 'grounded') {
      const groundingAdapter = this.findAdapterForMode('grounded', requestedProvider);
      if (groundingAdapter) {
        try {
          const result = await groundingAdapter.search(request);
          if (result.groundedSynthesis?.synthesizedText && result.groundedSynthesis.synthesizedText.length > 50) {
            return result;
          }
        } catch (error: unknown) {
          const err = asErrorLike(error);
          logger.warn(`[SearchQueryService] Grounding failed, falling back to DDG: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    // For 'quick' and 'deep', or fallback from 'grounded'.
    const ddgAdapter = (mode === 'grounded' ? null : this.findAdapterForMode(mode, requestedProvider))
      || this.findAdapterForMode('quick', requestedProvider)
      || this.findAdapterForMode('deep', requestedProvider)
      || this.findAdapterForMode('quick')
      || this.findAdapterForMode('deep');
    if (!ddgAdapter) {
      throw new Error('No search adapter available.');
    }

    return ddgAdapter.search(request);
  }

  private findAdapterForMode(mode: SearchQueryMode, providerId: string | null = null): ISearchQueryAdapter | null {
    if (providerId) {
      const direct = this.adapters.get(providerId);
      if (direct?.supportedModes.includes(mode)) {
        return direct;
      }
      for (const adapter of this.adapters.values()) {
        if (adapter.adapterId.toLowerCase() === providerId.toLowerCase() && adapter.supportedModes.includes(mode)) {
          return adapter;
        }
      }
      return null;
    }
    for (const adapter of this.adapters.values()) {
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
    profile: EvidenceDomainProfile,
  ): SearchResultItem[] {
    return output.items.map((item) => {
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

  private diversifyHosts(items: SearchResultItem[], limit: number): SearchResultItem[] {
    const selected: SearchResultItem[] = [];
    const deferred: SearchResultItem[] = [];
    const hostCounts = new Map<string, number>();

    for (const item of items) {
      const count = hostCounts.get(item.host) || 0;
      const maxPerHost = item.highSignal ? 2 : 1;

      if (count < maxPerHost) {
        selected.push(item);
        hostCounts.set(item.host, count + 1);
      } else {
        deferred.push(item);
      }
    }

    return [...selected, ...deferred].slice(0, limit);
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

    try {
      const response = await safeFetch(url, {
        signal: controller.signal,
        headers: {
          'user-agent': 'Zavorth/1.0 (+local assistant; evidence extraction)',
          'accept': 'text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.2',
        },
      }, {
        serviceName: 'SearchQuery evidence extraction',
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
    return { error: err?.name === 'AbortError' ? 'timeout' : (err?.message || String(err)) };
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

  private buildQualityGate(items: SearchResultItem[], profile: EvidenceDomainProfile): SearchQualityGate {
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

    return {
      status,
      highSignalCount,
      highSignalRequired,
      hostDiversity,
      guidance: profile.guidance || '',
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

function createDefaultSearchAdapters(): ISearchQueryAdapter[] {
  const adapters: ISearchQueryAdapter[] = [
    new DuckDuckGoSearchAdapter(),
    new GeminiGroundingSearchAdapter(),
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
