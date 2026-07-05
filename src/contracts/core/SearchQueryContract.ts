/**
 * Zavorth-native contract for unified web search.
 *
 * The contract centralizes quick, deep, and grounded search behind one
 * provider-neutral request/result model. Policy is evaluated before network
 * execution, provider evidence is kept separate from source authority, and
 * results are normalized before reaching agents or surfaces.
 *
 * @module contracts/SearchQueryContract
 * @since 2026-05-03
 * @author Zavorth Core Team
 */

export const SEARCH_QUERY_CAPABILITY_ID = 'search.query' as const;

export type SearchQueryMode = 'quick' | 'deep' | 'grounded';

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

export interface SearchQueryRequest {
  query: string;
  mode?: SearchQueryMode;
  limit?: number;
  evidenceDomain?: SearchEvidenceDomain | 'auto';
  extractPages?: boolean;
  sessionId?: string | null;
  correlationId?: string | null;
  providerHints?: Record<string, unknown> | null;
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  host: string;
  evidenceScore: number;
  highSignal: boolean;
  scoreReasons: string[];
  extractedContent?: SearchExtractedContent | null;
  providerEvidence: SearchProviderEvidence;
}

export interface SearchExtractedContent {
  title?: string | null;
  excerpt?: string | null;
  publishedAt?: string | null;
  error?: string | null;
}

export interface SearchProviderEvidence {
  providerId: string;
  effectiveQuery: string;
  originalRank: number;
  metadata?: Record<string, unknown> | null;
}

export interface SearchGroundedSynthesis {
  synthesizedText: string;
  citations: SearchCitation[];
  modelId: string;
}

export interface SearchCitation {
  title: string;
  url: string;
}

export interface SearchQueryPolicyDecision {
  allowed: boolean;
  reason: string;
  policySource: 'network-scope' | 'rate-limit' | 'content-safety' | 'capability-gate';
  queryModified: boolean;
  sanitizedQuery?: string | null;
}

export interface SearchQueryResult {
  ok: boolean;
  mode: SearchQueryMode;
  evidenceDomain: SearchEvidenceDomain;
  items: SearchResultItem[];
  groundedSynthesis?: SearchGroundedSynthesis | null;
  policyDecision: SearchQueryPolicyDecision;
  error?: SearchQueryError | null;
  qualityGate: SearchQualityGate;
  summary: string;
  processedAt: string;
}

export interface SearchQualityGate {
  status: 'evidence_sources_ranked' | 'weak_domain_sources' | 'insufficient_results' | 'search_unavailable';
  highSignalCount: number;
  highSignalRequired: number;
  hostDiversity: number;
  guidance: string;
}

export interface SearchQueryError {
  code:
    | 'POLICY_BLOCKED'
    | 'PROVIDER_UNAVAILABLE'
    | 'PROVIDER_ERROR'
    | 'INVALID_REQUEST'
    | 'ALL_PROVIDERS_FAILED'
    | 'UNKNOWN_ERROR';
  message: string;
  providerDetail?: string | null;
}

export interface ISearchQueryAdapter {
  readonly adapterId: string;
  readonly supportedModes: SearchQueryMode[];
  search(request: SearchQueryRequest): Promise<AdapterSearchOutput>;
}

export interface AdapterSearchOutput {
  items: AdapterSearchItem[];
  groundedSynthesis?: SearchGroundedSynthesis | null;
  providerId: string;
}

export interface AdapterSearchItem {
  title: string;
  url: string;
  description: string;
  originalRank: number;
  sourceQuery: string;
  metadata?: Record<string, unknown> | null;
}
