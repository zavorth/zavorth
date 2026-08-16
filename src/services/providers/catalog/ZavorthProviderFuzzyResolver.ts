import { UNIVERSAL_PROVIDER_CATALOG, ProviderCatalogEntry } from './UniversalProviderCatalog';

export interface ProviderMatch {
  provider: ProviderCatalogEntry;
  requestedModel?: string;
  matchKind: 'exact_id' | 'slash_syntax' | 'fuzzy_alias' | 'fallback_default';
  matchScore?: number;
  explanation?: string[];
}

const MIN_FUZZY_SCORE = 0.6;

export class ZavorthProviderFuzzyResolver {
  private readonly catalog = UNIVERSAL_PROVIDER_CATALOG;
  private readonly idToProvider = new Map<string, ProviderCatalogEntry>();
  private readonly aliases = new Map<string, string>();
  private readonly fuzzyCandidates = new Map<string, string[]>();

  constructor() {
    this.indexCatalog();
    this.registerAliases();
    this.registerFuzzyHints();
  }

  resolveProviderInput(input: string): ProviderMatch {
    const trimmed = input.trim().toLowerCase();

    if (!trimmed) {
      return this.fallbackDefault();
    }

    const slashMatch = this.resolveSlashSyntax(trimmed);
    if (slashMatch) {
      return slashMatch;
    }

    const exactId = this.resolveId(trimmed);
    if (exactId) {
      return { provider: this.idToProvider.get(exactId)!, matchKind: 'exact_id' };
    }

    const fuzzy = this.fuzzyMatch(trimmed);
    if (fuzzy) {
      return {
        provider: this.idToProvider.get(fuzzy.id)!,
        matchKind: 'fuzzy_alias',
        matchScore: fuzzy.score,
      };
    }

    const stripped = this.stripModelSuffix(trimmed);
    if (stripped !== trimmed) {
      const strippedId = this.resolveId(stripped);
      if (strippedId) {
        return { provider: this.idToProvider.get(strippedId)!, matchKind: 'exact_id' };
      }
      const strippedFuzzy = this.fuzzyMatch(stripped);
      if (strippedFuzzy) {
        return {
          provider: this.idToProvider.get(strippedFuzzy.id)!,
          matchKind: 'fuzzy_alias',
          matchScore: strippedFuzzy.score,
        };
      }
    }

    return this.fallbackDefault();
  }

  private fallbackDefault(): ProviderMatch {
    const gemini = this.idToProvider.get('gemini');
    if (!gemini) {
      throw new Error('Gemini provider not available for fallback');
    }
    return {
      provider: gemini,
      matchKind: 'fallback_default',
      explanation: ['Gemini legacy fallback for unknown provider'],
    };
  }

  private indexCatalog(): void {
    for (const entry of this.catalog) {
      this.idToProvider.set(entry.id, entry);
      this.addFuzzyCandidate(entry.id, entry.id);
      if (entry.name) {
        this.addFuzzyCandidate(entry.name.toLowerCase(), entry.id);
      }
    }
  }

  private registerAliases(): void {
    this.aliases.set('gpt', 'openai');
    this.aliases.set('gpt4', 'openai');
    this.aliases.set('gpt-4', 'openai');
    this.aliases.set('gpt-3.5', 'openai');
    this.aliases.set('claude', 'anthropic');
    this.aliases.set('bard', 'gemini');
    this.aliases.set('sonnet', 'anthropic');
    this.aliases.set('opus', 'anthropic');
    this.aliases.set('haiku', 'anthropic');
    this.aliases.set('kimi-k3', 'kimi');
    this.aliases.set('kimi-k', 'kimi');
  }

  private registerFuzzyHints(): void {
    this.addFuzzyCandidate('claude', 'anthropic');
    this.addFuzzyCandidate('claudia', 'anthropic');
  }

  private addFuzzyCandidate(candidate: string, providerId: string): void {
    const existing = this.fuzzyCandidates.get(providerId);
    if (existing) {
      if (!existing.includes(candidate)) {
        existing.push(candidate);
      }
    } else {
      this.fuzzyCandidates.set(providerId, [candidate]);
    }
  }

  private resolveSlashSyntax(input: string): ProviderMatch | null {
    if (!input.includes('/')) {
      return null;
    }
    const separator = input.indexOf('/');
    const providerPart = input.slice(0, separator);
    const modelPart = input.slice(separator + 1);
    const providerId = this.resolveId(providerPart);
    if (providerId) {
      return {
        provider: this.idToProvider.get(providerId)!,
        requestedModel: modelPart,
        matchKind: 'slash_syntax',
      };
    }
    return null;
  }

  private resolveId(input: string): string | null {
    if (this.aliases.has(input)) {
      return this.aliases.get(input)!;
    }
    if (this.idToProvider.has(input)) {
      return input;
    }
    return null;
  }

  private fuzzyMatch(input: string): { id: string; score: number } | null {
    if (input.includes('-compatible-') || input.includes('-custom-') || input.includes('-gateway-')) {
      return null;
    }
    let best: { id: string; score: number } | null = null;
    for (const [providerId, candidates] of this.fuzzyCandidates) {
      for (const candidate of candidates) {
        const score = this.similarity(input, candidate);
        if (score >= MIN_FUZZY_SCORE && (!best || score > best.score)) {
          best = { id: providerId, score };
        }
      }
    }
    return best;
  }

  private stripModelSuffix(input: string): string {
    if (input.includes('-compatible-') || input.includes('-custom-') || input.includes('-gateway-')) {
      return input;
    }
    const separator = input.indexOf('-');
    return separator === -1 ? input : input.slice(0, separator);
  }

  private similarity(a: string, b: string): number {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) {
      return 1;
    }
    return 1 - this.levenshteinDistance(a, b) / maxLen;
  }

  private levenshteinDistance(a: string, b: string): number {
    const previous = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let current = previous[0] + 1;
      for (let j = 1; j <= b.length; j++) {
        const next = Math.min(
          previous[j] + 1,
          current + 1,
          previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
        previous[j - 1] = current;
        current = next;
      }
      previous[b.length] = current;
    }
    return previous[b.length];
  }
}
