import type {
  ISemanticIntentClassifier,
  SemanticIntent,
  SemanticIntentClassifierInput,
  SemanticTopic,
  SemanticFreshness,
  SemanticScope,
  SemanticSourceAuthority,
} from '../../contracts/search/SemanticIntentContract.js';

const ISO_DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/;
const RELATIVE_DURATION_PATTERN = /\blast\s+\d+\s+(second|minute|hour|day|week|month|year)s?\b/i;
const SITE_FILTER_PATTERN = /\bsite:[a-z0-9.-]+\.[a-z]{2,}\b/i;
const OR_OPERATOR_PATTERN = /\b(?:[a-z0-9.-]+\.[a-z]{2,}|\b[a-z][a-z0-9_]{2,}\b)(?:\s+OR\s+(?:[a-z0-9.-]+\.[a-z]{2,}|\b[a-z][a-z0-9_]{2,}\b))+.*\bsite:/i;

export class StructuralIntentClassifier implements ISemanticIntentClassifier {
  public readonly classifierId = 'structural.intent.v1';
  public readonly supportsOffline = true;

  public classify(input: SemanticIntentClassifierInput): Promise<SemanticIntent> {
    const query = String(input.query ?? '');
    const explicitDomain = this.resolveTopicFromDomain(input.explicitDomain);
    const freshness = this.detectFreshness(query);
    const scope = this.detectScope(query);
    const sourceAuthority = this.detectSourceAuthority(query);
    const language = this.detectLanguageHint(input.providerHints);
    const confidence = explicitDomain !== 'general' || freshness !== 'unknown' || scope !== 'unknown'
      ? 0.6
      : 0.3;

    return Promise.resolve({
      topic: explicitDomain,
      freshness,
      scope,
      sourceAuthority,
      language,
      confidence,
    });
  }

  private resolveTopicFromDomain(domain?: string | null): SemanticTopic {
    if (!domain) return 'general';
    switch (domain) {
      case 'medical':
      case 'legal':
      case 'scientific':
      case 'finance':
      case 'consumer':
      case 'technical':
        return domain;
      case 'public_policy':
        return 'public_policy';
      case 'ai_news':
        return 'ai_news';
      default:
        return 'general';
    }
  }

  private detectFreshness(query: string): SemanticFreshness {
    if (ISO_DATE_PATTERN.test(query) || OR_OPERATOR_PATTERN.test(query)) {
      return 'historical';
    }
    if (RELATIVE_DURATION_PATTERN.test(query)) {
      return 'recent';
    }
    return 'unknown';
  }

  private detectScope(query: string): SemanticScope {
    if (SITE_FILTER_PATTERN.test(query)) return 'unknown';
    return 'unknown';
  }

  private detectSourceAuthority(query: string): SemanticSourceAuthority {
    return 'any';
  }

  private detectLanguageHint(hints?: Record<string, unknown> | null): string {
    if (!hints) return 'auto';
    const lang = hints.language;
    if (typeof lang === 'string' && lang.length > 0) return lang;
    return 'auto';
  }
}
