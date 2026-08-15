import type {
  IRelevanceScorer,
  RelevanceScore,
  RelevanceScorerInput,
  RelevanceVerdict,
} from '../../contracts/search/SemanticIntentContract.js';
import { RELEVANCE_THRESHOLD_RELEVANT, RELEVANCE_THRESHOLD_TANGENTIAL } from '../../contracts/search/SemanticIntentContract.js';

const ISO_DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/;
const SITE_FILTER_PATTERN = /\bsite:([a-z0-9.-]+)\.[a-z]{2,}\b/i;
const URL_PATH_TOKEN_PATTERN = /\/([a-z][a-z0-9-]+)\b/g;

export class StructuralRelevanceScorer implements IRelevanceScorer {
  public readonly scorerId = 'structural.relevance.v1';
  public readonly supportsOffline = true;

  public score(input: RelevanceScorerInput): Promise<RelevanceScore> {
    const signals = this.collectSignals(input);
    const score = this.computeScore(signals);
    const verdict = this.toVerdict(score);
    const reason = this.buildReason(signals, verdict);
    return Promise.resolve({ score, verdict, reason });
  }

  private collectSignals(input: RelevanceScorerInput): {
    hasDateMatch: boolean;
    hasSiteMatch: boolean;
    hasHostPathOverlap: boolean;
    tokenOverlap: number;
  } {
    const query = input.query.toLowerCase();
    const haystack = `${input.itemTitle}\n${input.itemSnippet}`.toLowerCase();

    const queryDateMatches: string[] = query.match(ISO_DATE_PATTERN) ?? [];
    const haystackDateMatches: string[] = haystack.match(ISO_DATE_PATTERN) ?? [];
    const hasDateMatch = queryDateMatches.length > 0
      && queryDateMatches.some((d: string) => haystackDateMatches.includes(d));

    let hasSiteMatch = false;
    const siteMatch = query.match(SITE_FILTER_PATTERN);
    if (siteMatch && input.itemUrl) {
      try {
        const url = new URL(input.itemUrl);
        hasSiteMatch = url.hostname.endsWith(siteMatch[1].toLowerCase());
      } catch {
        hasSiteMatch = false;
      }
    }

    let hasHostPathOverlap = false;
    if (input.itemUrl) {
      try {
        const url = new URL(input.itemUrl);
        const pathTokens = Array.from(url.pathname.matchAll(URL_PATH_TOKEN_PATTERN))
          .map((m) => m[1].toLowerCase())
          .filter((t) => t.length >= 4);
        const queryTokens = this.tokenize(query);
        hasHostPathOverlap = pathTokens.some((t) => queryTokens.includes(t));
      } catch {
        hasHostPathOverlap = false;
      }
    }

    const queryTokens = new Set(this.tokenize(query));
    const haystackTokens = new Set(this.tokenize(haystack));
    let overlapCount = 0;
    for (const token of queryTokens) {
      if (haystackTokens.has(token)) overlapCount++;
    }
    const tokenOverlap = queryTokens.size === 0 ? 0 : overlapCount / queryTokens.size;

    return { hasDateMatch, hasSiteMatch, hasHostPathOverlap, tokenOverlap };
  }

  private computeScore(signals: {
    hasDateMatch: boolean;
    hasSiteMatch: boolean;
    hasHostPathOverlap: boolean;
    tokenOverlap: number;
  }): number {
    let score = signals.tokenOverlap * 0.5;
    if (signals.hasDateMatch) score += 0.2;
    if (signals.hasSiteMatch) score += 0.4;
    if (signals.hasHostPathOverlap) score += 0.1;
    return Math.max(0, Math.min(1, score));
  }

  private toVerdict(score: number): RelevanceVerdict {
    if (score >= RELEVANCE_THRESHOLD_RELEVANT) return 'relevant';
    if (score >= RELEVANCE_THRESHOLD_TANGENTIAL) return 'tangential';
    return 'off_topic';
  }

  private buildReason(
    signals: {
      hasDateMatch: boolean;
      hasSiteMatch: boolean;
      hasHostPathOverlap: boolean;
      tokenOverlap: number;
    },
    verdict: RelevanceVerdict,
  ): string {
    const parts: string[] = [];
    parts.push(`token_overlap=${signals.tokenOverlap.toFixed(2)}`);
    if (signals.hasDateMatch) parts.push('date_match');
    if (signals.hasSiteMatch) parts.push('site_match');
    if (signals.hasHostPathOverlap) parts.push('host_path_overlap');
    parts.push(`verdict=${verdict}`);
    return parts.join('; ');
  }

  private tokenize(text: string): string[] {
    return Array.from(
      new Set(
        text
          .toLowerCase()
          .split(/[^a-z0-9]+/u)
          .filter((t) => t.length >= 3 && !/^\d+$/u.test(t)),
      ),
    );
  }
}
