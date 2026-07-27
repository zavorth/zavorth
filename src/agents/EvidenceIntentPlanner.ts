import { type EvidenceSearchDomain } from './EvidenceDomainProfiles.js';

export type EvidenceSearchMode = 'verified' | 'community' | 'hybrid';

export type EvidenceSourceTrack =
  | 'official'
  | 'academic'
  | 'news'
  | 'community'
  | 'issue-tracker'
  | 'repository'
  | 'vendor'
  | 'benchmark'
  | 'regulator';

export type EvidenceRiskLevel = 'low' | 'medium' | 'high';

export type EvidenceIntentPlan = {
  mode: EvidenceSearchMode;
  domain: EvidenceSearchDomain;
  risk: EvidenceRiskLevel;
  confidence: number;
  reason: string;
  sourceDiversity: EvidenceSourceTrack[];
  answerStyle: 'official-first' | 'community-first' | 'balanced';
  /** Optional free-text annotations only — never product mode/domain activation. */
  signalHints?: string[];
};

export type EvidenceIntentPlannerInput = {
  query: string;
  domain?: EvidenceSearchDomain | 'auto' | null;
  userRequestedMode?: EvidenceSearchMode | 'auto' | null;
  risk?: EvidenceRiskLevel | null;
};

const HIGH_STAKES_DOMAINS = new Set<EvidenceSearchDomain>(['medical', 'legal', 'finance', 'public_policy']);

/**
 * Evidence product routing is structured-only.
 * Free-text keywords never select domain/mode/risk; callers pass domain /
 * userRequestedMode / risk when known. Free-text-only plans stay neutral.
 */
export class EvidenceIntentPlanner {
  public plan(input: EvidenceIntentPlannerInput | string): EvidenceIntentPlan {
    const isStructured = typeof input !== 'string';
    const query = isStructured ? input.query : input;
    const requestedMode = isStructured ? input.userRequestedMode : null;
    const domainInput = isStructured ? input.domain : null;
    const riskInput = isStructured ? input.risk : null;
    const hasStructuredDomain = Boolean(domainInput && domainInput !== 'auto');
    const hasStructuredMode = Boolean(requestedMode && requestedMode !== 'auto');
    const hasStructuredRisk = Boolean(riskInput);

    // Free-text alone → general. Structured domain (including high-stakes) is caller-owned.
    const domain: EvidenceSearchDomain = hasStructuredDomain ? (domainInput as EvidenceSearchDomain) : 'general';

    // Free-text alone or unspecified mode → hybrid (neutral). Explicit mode wins.
    // High-stakes structured domains default to verified (domain policy, not free-text).
    const mode: EvidenceSearchMode = hasStructuredMode
      ? (requestedMode as EvidenceSearchMode)
      : hasStructuredDomain && HIGH_STAKES_DOMAINS.has(domain) ? 'verified'
        : 'hybrid';

    const risk: EvidenceRiskLevel = hasStructuredRisk ? (riskInput as EvidenceRiskLevel) : this.riskFromDomain(domain);

    // Keyword scoring is metadata-only; never changes product mode/domain/risk.
    const signalHints = this.annotateSignalHints(String(query || ''));

    if (hasStructuredMode) {
      return this.buildPlan({
        mode,
        domain,
        risk,
        confidence: 0.92,
        reason: `user explicitly requested ${mode} evidence routing`,
        signalHints,
      });
    }

    if (hasStructuredDomain) {
      return this.buildPlan({
        mode,
        domain,
        risk,
        confidence: 0.85,
        reason: HIGH_STAKES_DOMAINS.has(domain) ? `structured ${domain} domain uses verified-first evidence routing`
          : `structured ${domain} domain with neutral hybrid evidence routing`,
        signalHints,
      });
    }

    return this.buildPlan({
      mode: 'hybrid',
      domain: 'general',
      risk: 'low',
      confidence: 0.5,
      reason:
        'free-text-only intent stays neutral (general/hybrid); structured domain/mode required for product routing',
      signalHints,
    });
  }

  /**
   * Annotate free-text hints for observability only.
   * Must not drive mode/domain/risk product activation.
   */
  private annotateSignalHints(query: string): string[] {
    void query;
    return [];
  }

  private riskFromDomain(domain: EvidenceSearchDomain): EvidenceRiskLevel {
    if (HIGH_STAKES_DOMAINS.has(domain)) {
      return 'high';
    }
    if (domain === 'scientific' || domain === 'technical' || domain === 'consumer') {
      return 'medium';
    }
    return 'low';
  }

  private buildPlan(input: {
    mode: EvidenceSearchMode;
    domain: EvidenceSearchDomain;
    risk: EvidenceRiskLevel;
    confidence: number;
    reason: string;
    signalHints: string[];
  }): EvidenceIntentPlan {
    return {
      mode: input.mode,
      domain: input.domain,
      risk: input.risk,
      confidence: input.confidence,
      reason: input.reason,
      sourceDiversity: this.sourceDiversityFor(input.mode, input.domain),
      answerStyle: this.answerStyleFor(input.mode, input.risk),
      signalHints: input.signalHints.length > 0 ? input.signalHints : undefined,
    };
  }

  private sourceDiversityFor(mode: EvidenceSearchMode, domain: EvidenceSearchDomain): EvidenceSourceTrack[] {
    if (mode === 'community') {
      const tracks: EvidenceSourceTrack[] = ['community', 'issue-tracker'];
      if (domain === 'technical') {
        tracks.push('repository', 'vendor');
      }
      if (domain === 'consumer') {
        tracks.push('benchmark');
      }
      return Array.from(new Set(tracks));
    }

    if (mode === 'verified') {
      if (domain === 'medical' || domain === 'scientific') {
        return ['academic', 'official'];
      }
      if (domain === 'legal' || domain === 'finance' || domain === 'public_policy') {
        return ['official', 'regulator', 'news'];
      }
      if (domain === 'technical') {
        return ['official', 'vendor', 'repository'];
      }
      return ['official', 'news'];
    }

    const hybridTracks: EvidenceSourceTrack[] = ['official', 'community'];
    if (domain === 'technical') {
      hybridTracks.push('repository', 'issue-tracker');
    } else if (domain === 'consumer') {
      hybridTracks.push('benchmark', 'news');
    } else if (domain === 'scientific') {
      hybridTracks.push('academic');
    } else {
      hybridTracks.push('news');
    }
    return Array.from(new Set(hybridTracks));
  }

  private answerStyleFor(mode: EvidenceSearchMode, risk: EvidenceRiskLevel): EvidenceIntentPlan['answerStyle'] {
    if (mode === 'community' && risk !== 'high') {
      return 'community-first';
    }
    if (mode === 'verified' || risk === 'high') {
      return 'official-first';
    }
    return 'balanced';
  }
}

export function planEvidenceIntent(input: EvidenceIntentPlannerInput | string): EvidenceIntentPlan {
  return new EvidenceIntentPlanner().plan(input);
}
