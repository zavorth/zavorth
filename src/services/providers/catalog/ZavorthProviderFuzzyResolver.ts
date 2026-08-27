import { UNIVERSAL_PROVIDER_CATALOG } from './UniversalProviderCatalog';
import type { RegisteredProvider } from './ProviderCatalogRegistry';

const CURATED_REGISTERED_PROVIDERS: readonly RegisteredProvider[] = UNIVERSAL_PROVIDER_CATALOG.map((entry) => ({
  ...entry,
  custom: false,
}));

export interface ProviderMatchSuggestion {
  id: string;
  label: string;
  score: number;
}

export interface ProviderMatch {
  provider: RegisteredProvider | null;
  requestedModel?: string;
  matchKind: 'exact_id' | 'slash_syntax' | 'fuzzy_alias' | 'not_found';
  matchScore?: number;
  explanation?: string[];
  suggestions?: ProviderMatchSuggestion[];
}

const AUTO_SELECT_SCORE = 0.9;
const CLEAR_SELECT_SCORE = 0.65;
const CLEAR_SELECT_MARGIN = 0.15;
const SUGGEST_MIN_SCORE = 0.5;

export type FuzzyResolutionDecision =
  | { kind: 'auto_select'; candidate: ProviderMatchSuggestion; explanation: string[] }
  | { kind: 'suggest'; suggestions: ProviderMatchSuggestion[] }
  | { kind: 'none' };

/**
 * Two-zone announce-first fuzzy policy:
 * - score >= 0.90: auto-correct, always announced in `explanation`.
 * - score >= 0.65 with a single clear winner (margin >= 0.15 over runner-up): auto-correct, announced.
 * - otherwise: never guess; return up to 3 suggestions so the user can pick.
 */
export function decideFuzzyResolution(
  input: string,
  candidates: readonly ProviderMatchSuggestion[],
): FuzzyResolutionDecision {
  const [top, runnerUp] = candidates;
  if (!top) {
    return { kind: 'none' };
  }
  const uniquelyClear =
    top.score >= CLEAR_SELECT_SCORE && (!runnerUp || top.score - runnerUp.score >= CLEAR_SELECT_MARGIN);
  if (top.score >= AUTO_SELECT_SCORE || uniquelyClear) {
    return {
      kind: 'auto_select',
      candidate: top,
      explanation: [`Auto-corrected "${input}" to "${top.id}" (similarity ${top.score.toFixed(2)}).`],
    };
  }
  return { kind: 'suggest', suggestions: candidates.slice(0, 3) };
}

export class ZavorthProviderFuzzyResolver {
  private readonly source: () => readonly RegisteredProvider[];
  private readonly idToProvider = new Map<string, RegisteredProvider>();
  private readonly fuzzyCandidates = new Map<string, string[]>();

  constructor(source?: () => readonly RegisteredProvider[]) {
    this.source = source || (() => CURATED_REGISTERED_PROVIDERS);
    this.reindex();
  }

  reindex(): void {
    this.idToProvider.clear();
    this.fuzzyCandidates.clear();
    for (const entry of this.source()) {
      this.idToProvider.set(entry.id.toLowerCase(), entry);
      this.addFuzzyCandidate(entry.id, entry.id);
      if (entry.name) {
        this.addFuzzyCandidate(entry.name.toLowerCase(), entry.id);
      }
    }
  }

  resolveProviderInput(input: string): ProviderMatch {
    const trimmed = input.trim().toLowerCase();

    if (!trimmed) {
      return this.notFound();
    }

    const slashMatch = this.resolveSlashSyntax(trimmed);
    if (slashMatch) {
      return slashMatch;
    }

    const exactId = this.resolveId(trimmed);
    if (exactId) {
      return { provider: this.idToProvider.get(exactId)!, matchKind: 'exact_id' };
    }

    const rawDecision = decideFuzzyResolution(trimmed, this.rankFuzzyCandidates(trimmed));
    if (rawDecision.kind === 'auto_select') {
      return this.toFuzzyAliasMatch(rawDecision);
    }

    let strippedDecision: FuzzyResolutionDecision | null = null;
    const stripped = this.stripModelSuffix(trimmed);
    if (stripped !== trimmed) {
      const strippedId = this.resolveId(stripped);
      if (strippedId) {
        return { provider: this.idToProvider.get(strippedId)!, matchKind: 'exact_id' };
      }
      strippedDecision = decideFuzzyResolution(stripped, this.rankFuzzyCandidates(stripped));
      if (strippedDecision.kind === 'auto_select') {
        return this.toFuzzyAliasMatch(strippedDecision);
      }
    }

    if (rawDecision.kind === 'suggest') {
      return this.notFound(rawDecision.suggestions);
    }
    if (strippedDecision?.kind === 'suggest') {
      return this.notFound(strippedDecision.suggestions);
    }
    return this.notFound();
  }

  private toFuzzyAliasMatch(decision: { candidate: ProviderMatchSuggestion; explanation: string[] }): ProviderMatch {
    return {
      provider: this.idToProvider.get(decision.candidate.id)!,
      matchKind: 'fuzzy_alias',
      matchScore: decision.candidate.score,
      explanation: decision.explanation,
    };
  }

  private notFound(suggestions?: ProviderMatchSuggestion[]): ProviderMatch {
    return {
      provider: null,
      matchKind: 'not_found',
      explanation: [
        'Provider not found.',
        ...(suggestions?.length
          ? [`Did you mean: ${suggestions.map((s) => s.id).join(', ')}?`]
          : []),
      ],
      suggestions,
    };
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
    if (this.idToProvider.has(input)) {
      return input;
    }
    return null;
  }

  private rankFuzzyCandidates(input: string): ProviderMatchSuggestion[] {
    if (input.includes('-compatible-') || input.includes('-custom-') || input.includes('-gateway-')) {
      return [];
    }
    const ranked: ProviderMatchSuggestion[] = [];
    for (const [providerId, candidates] of this.fuzzyCandidates) {
      let best = 0;
      for (const candidate of candidates) {
        best = Math.max(best, this.similarity(input, candidate));
      }
      if (best >= SUGGEST_MIN_SCORE) {
        ranked.push({ id: providerId, label: this.idToProvider.get(providerId)?.name ?? providerId, score: best });
      }
    }
    return ranked.sort((a, b) => b.score - a.score);
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
