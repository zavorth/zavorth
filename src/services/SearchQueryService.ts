/**
 * SearchQueryService — Serviço Zavorth-nativo de orquestração de busca web unificada.
 *
 * Este serviço é o coração da capability `search.query`. Ele unifica as superfícies
 * de busca que antes estavam dispersas entre WebSearchTool e DeepSearchService,
 * centralizando sob um pipeline canônico:
 *
 * 1. Validar e sanitizar a consulta.
 * 2. Avaliar política de rede/conteúdo.
 * 3. Resolver o modo e domínio de evidência efetivos.
 * 4. Selecionar e invocar o adapter correto.
 * 5. Normalizar resultados com scoring de evidência.
 * 6. Aplicar diversificação de hosts.
 * 7. Extrair conteúdo de páginas (se solicitado).
 * 8. Montar quality gate e resultado final.
 *
 * O serviço NUNCA:
 * - Retorna dados do provedor como autoridade.
 * - Aceita endpoint como fonte canônica.
 * - Contorna a política de rede.
 *
 * Referências arquiteturais:
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
import {
  DuckDuckGoSearchAdapter,
  SearchAdapterError,
} from '../adapters/search/DuckDuckGoSearchAdapter.js';
import {
  GeminiGroundingSearchAdapter,
  GroundingAdapterError,
} from '../adapters/search/GeminiGroundingSearchAdapter.js';
import { safeFetch } from '../security/SafeFetchService.js';
import { wrapUntrustedContent } from '../security/UntrustedContent.js';

// ---------------------------------------------------------------------------
// Constantes de política
// ---------------------------------------------------------------------------

const MAX_RESULTS = 10;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SearchQueryService {
  private readonly adapters: Map<string, ISearchQueryAdapter>;

  constructor(options?: { adapters?: ISearchQueryAdapter[] }) {
    this.adapters = new Map();

    const adapterList = options?.adapters || [
      new DuckDuckGoSearchAdapter(),
      new GeminiGroundingSearchAdapter(),
    ];

    for (const adapter of adapterList) {
      this.adapters.set(adapter.adapterId, adapter);
    }
  }

  // -------------------------------------------------------------------------
  // API Pública
  // -------------------------------------------------------------------------

  /**
   * Executa busca web de ponta a ponta.
   *
   * Fluxo: request -> validate -> policy -> adapter -> normalize -> quality gate -> result
   */
  public async search(request: SearchQueryRequest): Promise<SearchQueryResult> {
    const processedAt = new Date().toISOString();

    // 1. Validação.
    const validationError = this.validateRequest(request);
    if (validationError) {
      return this.buildErrorResult(validationError, request, processedAt);
    }

    // 2. Política.
    const policyDecision = this.evaluatePolicy(request);
    if (!policyDecision.allowed) {
      return this.buildPolicyBlockedResult(policyDecision, request, processedAt);
    }

    // 3. Resolve modo e domínio efetivos.
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
    } catch (err) {
      return this.buildAdapterErrorResult(err, request, policyDecision, processedAt);
    }

    // 5. Normaliza resultados com scoring de evidência.
    const limit = Math.min(request.limit || 5, MAX_RESULTS);
    const scoredItems = this.scoreAndNormalize(adapterOutput, evidenceDomain, profile);

    // 6. Diversifica hosts.
    const diversified = this.diversifyHosts(scoredItems, limit);

    // 7. Extrai conteúdo de páginas (se deep + extractPages).
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
      summary: `${diversified.length} resultado(s) encontrado(s) para "${effectiveQuery}" (modo: ${mode}, domínio: ${evidenceDomain}).`,
      processedAt,
    };
  }

  // -------------------------------------------------------------------------
  // Validação
  // -------------------------------------------------------------------------

  private validateRequest(request: SearchQueryRequest): SearchQueryError | null {
    if (!request.query || typeof request.query !== 'string' || request.query.trim().length === 0) {
      return {
        code: 'INVALID_REQUEST',
        message: 'O campo "query" é obrigatório e deve ser uma string não-vazia.',
      };
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Política
  // -------------------------------------------------------------------------

  private evaluatePolicy(request: SearchQueryRequest): SearchQueryPolicyDecision {
    // Sanitiza a consulta (corrige erros comuns de transcrição de nomes).
    const sanitized = this.sanitizeQuery(request.query);
    const modified = sanitized !== request.query;

    return {
      allowed: true,
      reason: 'Busca permitida pela política de rede.',
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

  // -------------------------------------------------------------------------
  // Resolução de domínio de evidência
  // -------------------------------------------------------------------------

  private resolveEvidenceDomain(request: SearchQueryRequest): SearchEvidenceDomain {
    if (request.evidenceDomain && request.evidenceDomain !== 'auto') {
      return request.evidenceDomain;
    }
    return inferEvidenceDomainFromText(request.query) as SearchEvidenceDomain;
  }

  // -------------------------------------------------------------------------
  // Invocação de adapter com fallback
  // -------------------------------------------------------------------------

  private async invokeAdapterWithFallback(
    request: SearchQueryRequest,
    mode: SearchQueryMode,
  ): Promise<AdapterSearchOutput> {
    const requestedProvider = this.requestedProviderId(request);
    // Para modo 'grounded', tenta grounding primeiro, fallback para DDG.
    if (mode === 'grounded') {
      const groundingAdapter = this.findAdapterForMode('grounded', requestedProvider);
      if (groundingAdapter) {
        try {
          const result = await groundingAdapter.search(request);
          if (result.groundedSynthesis?.synthesizedText && result.groundedSynthesis.synthesizedText.length > 50) {
            return result;
          }
        } catch (err) {
          logger.warn(`[SearchQueryService] Grounding failed, falling back to DDG: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    // Para 'quick' e 'deep', ou fallback de 'grounded'.
    const ddgAdapter = (mode === 'grounded' ? null : this.findAdapterForMode(mode, requestedProvider))
      || this.findAdapterForMode('quick', requestedProvider)
      || this.findAdapterForMode('deep', requestedProvider)
      || this.findAdapterForMode('quick')
      || this.findAdapterForMode('deep');
    if (!ddgAdapter) {
      throw new Error('Nenhum adapter de busca disponível.');
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
    const value = hints.providerId || hints.searchProvider || hints.preferredProvider;
    const normalized = String(value || '').trim();
    return normalized || null;
  }

  // -------------------------------------------------------------------------
  // Scoring e normalização
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Diversificação de hosts
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Extração de conteúdo de páginas
  // -------------------------------------------------------------------------

  private async extractTopPages(items: SearchResultItem[], maxExtract: number): Promise<void> {
    const targets = items.slice(0, maxExtract);

    await Promise.all(targets.map(async (item) => {
      try {
        item.extractedContent = await this.extractPageExcerpt(item.url);
      } catch {
        item.extractedContent = { error: 'extraction_failed' };
      }
    }));
  }

  private async extractPageExcerpt(url: string): Promise<SearchResultItem['extractedContent']> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6_000);
    if (typeof (timeout as any).unref === 'function') {
      (timeout as any).unref();
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
    } catch (err: any) {
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

  // -------------------------------------------------------------------------
  // Quality Gate
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Builders de resultado
  // -------------------------------------------------------------------------

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
        reason: 'Política não avaliada.',
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
      summary: 'Busca indisponível.',
      processedAt,
    };
  }
}
