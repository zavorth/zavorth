/**
 * Zavorth-native contract for semantic query intent and content relevance.
 *
 * Intent classification and relevance scoring are LLM-centered by design.
 * Keyword/regex heuristics are explicitly forbidden: they are brittle,
 * language-dependent, and break the moment a user phrases a query differently
 * than the pattern author anticipated. The `structural` fallback in this
 * contract uses ONLY non-semantic signals (ISO date formats, domain parameter,
 * `site:` filters) and never inspects the natural-language body of the query.
 *
 * @module contracts/search/SemanticIntentContract
 * @since 2026-08-14
 * @author Zavorth Core Team
 */

export const SEMANTIC_INTENT_CONTRACT_VERSION = 'zavorth-semantic-intent/v1' as const;

export type SemanticTopic =
  | 'general'
  | 'news'
  | 'consumer'
  | 'medical'
  | 'legal'
  | 'scientific'
  | 'technical'
  | 'finance'
  | 'sports'
  | 'entertainment'
  | 'public_policy'
  | 'ai_news';

export type SemanticFreshness = 'realtime' | 'recent' | 'historical' | 'unknown';

export type SemanticScope = 'global' | 'regional' | 'local' | 'unknown';

export type SemanticSourceAuthority =
  | 'any'
  | 'official_preferred'
  | 'official_required';

export interface SemanticIntent {
  readonly topic: SemanticTopic;
  readonly freshness: SemanticFreshness;
  readonly scope: SemanticScope;
  readonly sourceAuthority: SemanticSourceAuthority;
  readonly language: string;
  readonly confidence: number;
}

export interface SemanticIntentClassifierInput {
  readonly query: string;
  readonly explicitDomain?: string | null;
  readonly mode?: string | null;
  readonly providerHints?: Record<string, unknown> | null;
}

export interface ISemanticIntentClassifier {
  readonly classifierId: string;
  readonly supportsOffline: boolean;
  classify(input: SemanticIntentClassifierInput): Promise<SemanticIntent>;
}

export type RelevanceVerdict = 'relevant' | 'tangential' | 'off_topic';

export interface RelevanceScore {
  readonly score: number;
  readonly verdict: RelevanceVerdict;
  readonly reason: string;
}

export interface RelevanceScorerInput {
  readonly itemTitle: string;
  readonly itemSnippet: string;
  readonly itemUrl?: string | null;
  readonly query: string;
  readonly intent: SemanticIntent;
}

export interface IRelevanceScorer {
  readonly scorerId: string;
  readonly supportsOffline: boolean;
  score(input: RelevanceScorerInput): Promise<RelevanceScore>;
}

export const RELEVANCE_THRESHOLD_RELEVANT = 0.65;
export const RELEVANCE_THRESHOLD_TANGENTIAL = 0.35;
