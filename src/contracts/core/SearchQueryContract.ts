/**
 * SearchQueryContract — Contrato Zavorth-nativo para busca web unificada.
 *
 * Este contrato define a interface canônica para toda operação de busca web
 * dentro do runtime do Zavorth. Ele unifica as superfícies que antes estavam
 * dispersas entre WebSearchTool (DuckDuckGo direto) e DeepSearchService
 * (Gemini Grounding + fallback), centralizando sob um modelo único:
 *
 * - Request padronizado com modo (quick / deep / grounded).
 * - Resultados sempre normalizados como SearchResultItem com citações.
 * - Decisão de política de rede avaliada antes da execução.
 * - Evidência do provedor separada da autoridade do domínio.
 *
 * Capability canônica: `search.query`
 *
 * Referências arquiteturais:
 * - docs/native-absorption-execution-plan.md
 * - docs/product-direction.md (padrão de referência)
 *
 * @module contracts/SearchQueryContract
 * @since 2026-05-03
 * @author Zavorth Core Team
 */

// ---------------------------------------------------------------------------
// Capability ID
// ---------------------------------------------------------------------------

/** Identificador canônico da capability de busca web. */
export const SEARCH_QUERY_CAPABILITY_ID = 'search.query' as const;

// ---------------------------------------------------------------------------
// Tipos de modo de busca
// ---------------------------------------------------------------------------

/**
 * Modos de busca suportados pelo contrato.
 *
 * - `quick`:    Busca rápida via motor de busca externo (DuckDuckGo/Bing).
 *               Retorna resultados crus sem síntese LLM.
 * - `deep`:     Busca com ranking por perfil de evidência, extração de páginas
 *               e diversificação de hosts.
 * - `grounded`: Busca via Gemini Grounding (Google Search integrado ao modelo).
 *               Retorna resposta sintetizada com citações.
 */
export type SearchQueryMode = 'quick' | 'deep' | 'grounded';

/**
 * Perfil de domínio de evidência para scoring de fontes.
 * Determina quais fontes são consideradas autoritativas.
 */
export type SearchEvidenceDomain =
  | 'general'
  | 'medical'
  | 'legal'
  | 'scientific'
  | 'finance'
  | 'consumer'
  | 'technical'
  | 'public_policy'
  | 'ai_news';

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

/**
 * Requisição canônica de busca web.
 * Shape agnóstico ao motor de busca — detalhes de API ficam no adapter.
 */
export interface SearchQueryRequest {
  /** Consulta de busca textual. */
  query: string;

  /** Modo de busca solicitado. Default: 'deep'. */
  mode?: SearchQueryMode;

  /** Máximo de resultados a retornar. Default: 5, máx: 10. */
  limit?: number;

  /**
   * Perfil de domínio de evidência para scoring de fontes.
   * Se 'auto', infere do texto da consulta.
   * Default: 'auto'.
   */
  evidenceDomain?: SearchEvidenceDomain | 'auto';

  /**
   * Se true, tenta extrair trechos curtos das melhores páginas.
   * Aumenta a qualidade mas consome mais tempo e rede.
   * Default: true quando mode='deep'.
   */
  extractPages?: boolean;

  /** Contexto de sessão para rastreabilidade. */
  sessionId?: string | null;

  /** ID de correlação para tracing distribuído. */
  correlationId?: string | null;

  /**
   * Metadados extras que o caller pode passar.
   * O service não interpreta; adapters/policies podem usar.
   */
  providerHints?: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Result Items
// ---------------------------------------------------------------------------

/**
 * Um resultado de busca individual normalizado.
 * Shape canônico independente do motor de busca.
 */
export interface SearchResultItem {
  /** Título da página/recurso. */
  title: string;

  /** URL canônica do resultado. */
  url: string;

  /** Descrição/trecho do resultado (snippet do motor de busca). */
  snippet: string;

  /** Host normalizado (ex: 'reuters.com'). */
  host: string;

  /**
   * Score de evidência calculado pelo Zavorth.
   * Baseado no perfil de domínio, autoridade da fonte, termos-chave.
   * Range: 0-100.
   */
  evidenceScore: number;

  /** Se a fonte é considerada de alta qualidade para o domínio. */
  highSignal: boolean;

  /** Razões do score atribuído. */
  scoreReasons: string[];

  /**
   * Conteúdo extraído da página, se disponível.
   * Preenchido quando extractPages=true e a extração foi bem-sucedida.
   */
  extractedContent?: SearchExtractedContent | null;

  /** Evidência do provedor de busca (apenas auditoria). */
  providerEvidence: SearchProviderEvidence;
}

/**
 * Conteúdo extraído de uma página web.
 */
export interface SearchExtractedContent {
  /** Título extraído do HTML da página. */
  title?: string | null;

  /** Trecho de texto legível extraído da página. */
  excerpt?: string | null;

  /** Data de publicação extraída, se detectada. */
  publishedAt?: string | null;

  /** Erro de extração, se houve falha. */
  error?: string | null;
}

/**
 * Evidência do provedor de busca.
 * Estes dados servem apenas para auditoria e debugging.
 */
export interface SearchProviderEvidence {
  /** ID do provedor/adapter que forneceu o resultado. */
  providerId: string;

  /** Consulta efetiva enviada ao provedor (pode diferir da original). */
  effectiveQuery: string;

  /** Posição original no ranking do provedor. */
  originalRank: number;

  /** Metadados extras do provedor. */
  metadata?: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Grounded Search Result
// ---------------------------------------------------------------------------

/**
 * Resultado de busca grounded (sintetizado pelo LLM com citações).
 * Usado quando mode='grounded'.
 */
export interface SearchGroundedSynthesis {
  /** Texto sintetizado pelo modelo com citações inline. */
  synthesizedText: string;

  /** Citações extraídas do grounding metadata. */
  citations: SearchCitation[];

  /** Modelo que gerou a síntese. */
  modelId: string;
}

/**
 * Uma citação individual de uma busca grounded.
 */
export interface SearchCitation {
  /** Título do recurso citado. */
  title: string;

  /** URL do recurso citado. */
  url: string;
}

// ---------------------------------------------------------------------------
// Policy Decision
// ---------------------------------------------------------------------------

/**
 * Decisão de política sobre a requisição de busca.
 */
export interface SearchQueryPolicyDecision {
  /** Se a busca foi permitida. */
  allowed: boolean;

  /** Razão da decisão. */
  reason: string;

  /** Fonte da política. */
  policySource: 'network-scope' | 'rate-limit' | 'content-safety' | 'capability-gate';

  /** Se a consulta foi modificada/sanitizada. */
  queryModified: boolean;

  /** Consulta sanitizada, se houve modificação. */
  sanitizedQuery?: string | null;
}

// ---------------------------------------------------------------------------
// Service Result
// ---------------------------------------------------------------------------

/**
 * Resultado completo da operação de busca.
 * Retornado pelo SearchQueryService.
 */
export interface SearchQueryResult {
  /** Se a operação foi bem-sucedida. */
  ok: boolean;

  /** Modo efetivo usado na busca. */
  mode: SearchQueryMode;

  /** Domínio de evidência efetivo usado. */
  evidenceDomain: SearchEvidenceDomain;

  /** Resultados individuais normalizados. */
  items: SearchResultItem[];

  /**
   * Síntese grounded, se mode='grounded' e disponível.
   * Pode ser null se o grounding falhou e houve fallback para 'deep'.
   */
  groundedSynthesis?: SearchGroundedSynthesis | null;

  /** Decisão de política aplicada. */
  policyDecision: SearchQueryPolicyDecision;

  /** Erro estruturado, se a operação falhou. */
  error?: SearchQueryError | null;

  /**
   * Quality gate: indica a confiança nos resultados.
   * O agente deve usar este campo para decidir como apresentar os dados.
   */
  qualityGate: SearchQualityGate;

  /** Resumo legível do resultado. */
  summary: string;

  /** Timestamp ISO do processamento. */
  processedAt: string;
}

/**
 * Quality gate de busca — informa ao agente a confiança nos resultados.
 */
export interface SearchQualityGate {
  /** Status geral do quality gate. */
  status: 'evidence_sources_ranked' | 'weak_domain_sources' | 'insufficient_results' | 'search_unavailable';

  /** Quantidade de fontes de alta qualidade encontradas. */
  highSignalCount: number;

  /** Mínimo necessário para o domínio. */
  highSignalRequired: number;

  /** Diversidade de hosts nos resultados. */
  hostDiversity: number;

  /** Guidance textual para o agente. */
  guidance: string;
}

/**
 * Erro estruturado de busca.
 */
export interface SearchQueryError {
  /** Código de erro canônico. */
  code:
    | 'POLICY_BLOCKED'
    | 'PROVIDER_UNAVAILABLE'
    | 'PROVIDER_ERROR'
    | 'INVALID_REQUEST'
    | 'ALL_PROVIDERS_FAILED'
    | 'UNKNOWN_ERROR';

  /** Mensagem legível. */
  message: string;

  /** Detalhes do provedor (debugging). */
  providerDetail?: string | null;
}

// ---------------------------------------------------------------------------
// Adapter Interface
// ---------------------------------------------------------------------------

/**
 * Interface que cada adapter de busca web deve implementar.
 */
export interface ISearchQueryAdapter {
  /** Identificador do adapter. */
  readonly adapterId: string;

  /** Modos suportados. */
  readonly supportedModes: SearchQueryMode[];

  /**
   * Executa a busca.
   * @returns Array de resultados crus para normalização pelo service.
   */
  search(request: SearchQueryRequest): Promise<AdapterSearchOutput>;
}

/**
 * Resultado cru retornado por um adapter de busca.
 */
export interface AdapterSearchOutput {
  /** Resultados individuais crus. */
  items: AdapterSearchItem[];

  /** Síntese grounded, se aplicável (mode='grounded'). */
  groundedSynthesis?: SearchGroundedSynthesis | null;

  /** ID do provedor efetivo. */
  providerId: string;
}

/**
 * Um resultado individual cru do adapter.
 */
export interface AdapterSearchItem {
  /** Título do resultado. */
  title: string;

  /** URL do resultado. */
  url: string;

  /** Descrição/snippet. */
  description: string;

  /** Posição original no ranking do provedor. */
  originalRank: number;

  /** Consulta efetiva usada. */
  sourceQuery: string;

  /** Metadados extras. */
  metadata?: Record<string, unknown> | null;
}
