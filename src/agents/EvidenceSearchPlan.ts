import {
  buildEvidenceProfileQueries,
  getEvidenceDomainProfile,
  type EvidenceSearchDomain,
} from './EvidenceDomainProfiles.js';
import { EvidenceIntentPlanner, type EvidenceIntentPlan, type EvidenceSourceTrack } from './EvidenceIntentPlanner.js';

export type EvidenceSourceRole = 'primary' | 'supporting' | 'community-signal' | 'context-only' | 'avoid-primary';

export type EvidenceSourceRequirement = {
  track: EvidenceSourceTrack;
  role: EvidenceSourceRole;
  rationale: string;
};

export type EvidenceSearchPlan = {
  intent: EvidenceIntentPlan;
  mustHave: EvidenceSourceRequirement[];
  useful: EvidenceSourceRequirement[];
  avoidAsPrimary: EvidenceSourceRequirement[];
  answerPolicy: {
    style: EvidenceIntentPlan['answerStyle'];
    separateFactsFromReports: boolean;
    requireCaveat: boolean;
    guidance: string;
  };
};

export type EvidenceTrackQuery = {
  query: string;
  track: EvidenceSourceTrack | 'profile';
  role: EvidenceSourceRole | 'baseline';
  rationale: string;
};

export type EvidenceWeighingInput = {
  baseScore: number;
  highSignal: boolean;
  track?: EvidenceTrackQuery['track'] | null;
  role?: EvidenceTrackQuery['role'] | null;
  plan: EvidenceSearchPlan;
};

export type EvidenceWeighingResult = {
  score: number;
  highSignal: boolean;
  reasons: string[];
};

export type EvidenceSearchPlanInput = {
  query: string;
  intent?: EvidenceIntentPlan | null;
  domain?: EvidenceSearchDomain | 'auto' | null;
  userRequestedMode?: EvidenceIntentPlan['mode'] | 'auto' | null;
  risk?: EvidenceIntentPlan['risk'] | null;
};

export class EvidenceSearchPlanBuilder {
  private readonly intentPlanner = new EvidenceIntentPlanner();

  public build(input: EvidenceSearchPlanInput | string): EvidenceSearchPlan {
    const query = typeof input === 'string' ? input : input.query;
    const intent =
      typeof input === 'string'
        ? this.intentPlanner.plan(query)
        : input.intent ||
          this.intentPlanner.plan({
            query,
            domain: input.domain,
            userRequestedMode: input.userRequestedMode,
            risk: input.risk,
          });

    if (intent.mode === 'verified') {
      return this.verifiedPlan(intent);
    }

    if (intent.mode === 'community') {
      return this.communityPlan(intent);
    }

    return this.hybridPlan(intent);
  }

  private verifiedPlan(intent: EvidenceIntentPlan): EvidenceSearchPlan {
    const mustHave = this.verifiedRequirements(intent.domain);
    const useful = this.communityContext(intent.domain);
    const avoidAsPrimary = this.communityAvoidPrimary(intent.domain);

    return {
      intent,
      mustHave,
      useful,
      avoidAsPrimary,
      answerPolicy: {
        style: 'official-first',
        separateFactsFromReports: true,
        requireCaveat: intent.risk === 'high',
        guidance: `${getEvidenceDomainProfile(intent.domain).guidance} Treat community reports as context only unless the user explicitly asks for lived experience.`,
      },
    };
  }

  private communityPlan(intent: EvidenceIntentPlan): EvidenceSearchPlan {
    const highRisk = intent.risk === 'high';
    const mustHave = highRisk ? this.verifiedRequirements(intent.domain) : this.communityRequirements(intent.domain);
    const useful = highRisk
      ? this.communityRequirements(intent.domain)
      : this.verifiedRequirements(intent.domain).slice(0, 2);
    const avoidAsPrimary = highRisk ? this.communityAvoidPrimary(intent.domain) : this.lowQualityAvoidPrimary();

    return {
      intent,
      mustHave,
      useful,
      avoidAsPrimary,
      answerPolicy: {
        style: highRisk ? 'official-first' : 'community-first',
        separateFactsFromReports: true,
        requireCaveat: true,
        guidance: highRisk
          ? 'Lead with verified sources, then clearly label community reports as lived experience or discussion signals.'
          : 'Use community sources to understand practical failures, workarounds and sentiment; distinguish them from confirmed facts.',
      },
    };
  }

  private hybridPlan(intent: EvidenceIntentPlan): EvidenceSearchPlan {
    return {
      intent,
      mustHave: this.verifiedRequirements(intent.domain).slice(0, 2),
      useful: this.communityRequirements(intent.domain),
      avoidAsPrimary: this.lowQualityAvoidPrimary(),
      answerPolicy: {
        style: 'balanced',
        separateFactsFromReports: true,
        requireCaveat: intent.risk !== 'low',
        guidance:
          'Compare official facts with community signals. Surface disagreement instead of collapsing all sources into one certainty level.',
      },
    };
  }

  private verifiedRequirements(domain: EvidenceSearchDomain): EvidenceSourceRequirement[] {
    if (domain === 'medical' || domain === 'scientific') {
      return [
        requirement('academic', 'primary', 'peer-reviewed, indexed, or scholarly evidence is the strongest anchor'),
        requirement('official', 'primary', 'official health/science institutions help verify current guidance'),
      ];
    }

    if (domain === 'legal' || domain === 'public_policy') {
      return [
        requirement('official', 'primary', 'laws, agencies, courts, and primary public records anchor formal claims'),
        requirement('regulator', 'primary', 'regulators and public bodies are authoritative for policy constraints'),
        requirement('news', 'supporting', 'reputable reporting can add timeline and public context'),
      ];
    }

    if (domain === 'finance') {
      return [
        requirement('regulator', 'primary', 'regulatory filings and exchanges anchor financial claims'),
        requirement('official', 'primary', 'company or central bank sources provide primary data'),
        requirement('news', 'supporting', 'reputable reporting can contextualize recent market moves'),
      ];
    }

    if (domain === 'technical') {
      return [
        requirement('vendor', 'primary', 'official docs and release notes anchor versioned behavior'),
        requirement('repository', 'primary', 'source repositories, issues and PRs reveal implementation reality'),
      ];
    }

    if (domain === 'consumer') {
      return [
        requirement('official', 'primary', 'official specs and warranty terms anchor factual claims'),
        requirement('benchmark', 'primary', 'benchmarks and independent tests ground product comparisons'),
      ];
    }

    return [
      requirement('official', 'primary', 'primary sources reduce ambiguity when available'),
      requirement('news', 'supporting', 'reputable reporting adds context and recency'),
    ];
  }

  private communityRequirements(domain: EvidenceSearchDomain): EvidenceSourceRequirement[] {
    if (domain === 'technical') {
      return [
        requirement('issue-tracker', 'primary', 'issues and PRs often contain real failure modes and fixes'),
        requirement('community', 'primary', 'forums can expose workarounds and affected environments'),
        requirement('repository', 'supporting', 'source history helps verify whether the report matches actual code'),
      ];
    }

    if (domain === 'consumer') {
      return [
        requirement('community', 'primary', 'owner reports reveal reliability, support and daily-use friction'),
        requirement('benchmark', 'supporting', 'benchmarks prevent sentiment from overpowering measured performance'),
      ];
    }

    return [
      requirement(
        'community',
        'community-signal',
        'community discussion can reveal sentiment, edge cases and lived experience',
      ),
      requirement('news', 'supporting', 'reporting can confirm whether a community signal is broader than one post'),
    ];
  }

  private communityContext(domain: EvidenceSearchDomain): EvidenceSourceRequirement[] {
    if (domain === 'technical') {
      return [requirement('issue-tracker', 'supporting', 'issue trackers can validate implementation edge cases')];
    }
    if (domain === 'consumer') {
      return [requirement('community', 'supporting', 'user reports can reveal lived experience after official specs')];
    }
    return [
      requirement(
        'community',
        'context-only',
        'community sources may provide anecdotes but should not anchor formal claims',
      ),
    ];
  }

  private communityAvoidPrimary(domain: EvidenceSearchDomain): EvidenceSourceRequirement[] {
    return [
      requirement(
        'community',
        domain === 'technical' ? 'supporting' : 'avoid-primary',
        domain === 'technical'
          ? 'technical community reports still need version and reproduction checks'
          : 'community anecdotes should not be treated as authoritative for high-stakes claims',
      ),
    ];
  }

  private lowQualityAvoidPrimary(): EvidenceSourceRequirement[] {
    return [requirement('community', 'avoid-primary', 'single unverified posts should not override stronger evidence')];
  }
}

function requirement(
  track: EvidenceSourceTrack,
  role: EvidenceSourceRole,
  rationale: string,
): EvidenceSourceRequirement {
  return { track, role, rationale };
}

export function buildEvidenceSearchPlan(input: EvidenceSearchPlanInput | string): EvidenceSearchPlan {
  return new EvidenceSearchPlanBuilder().build(input);
}

export function buildEvidenceTrackQueries(input: EvidenceSearchPlanInput | string, limit = 3): EvidenceTrackQuery[] {
  const builder = new EvidenceSearchPlanBuilder();
  const plan = builder.build(input);
  const query = typeof input === 'string' ? input : input.query;
  const baseProfileQueries = buildEvidenceProfileQueries(query, plan.intent.domain);
  const candidates: EvidenceTrackQuery[] = [];

  if (baseProfileQueries[0]) {
    candidates.push({
      query: baseProfileQueries[0],
      track: 'profile',
      role: 'baseline',
      rationale: 'baseline domain profile query',
    });
  }

  for (const requirement of [...plan.mustHave, ...plan.useful]) {
    const trackQuery = queryForTrack(query, requirement.track, plan.intent.domain);
    if (!trackQuery) {
      continue;
    }
    candidates.push({
      query: trackQuery,
      track: requirement.track,
      role: requirement.role,
      rationale: requirement.rationale,
    });
  }

  for (const profileQuery of baseProfileQueries.slice(1)) {
    candidates.push({
      query: profileQuery,
      track: 'profile',
      role: 'baseline',
      rationale: 'baseline domain profile query',
    });
  }

  const seen = new Set<string>();
  return candidates
    .filter((candidate) => {
      const key = candidate.query.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, Math.max(1, limit));
}

export function weighEvidenceSource(input: EvidenceWeighingInput): EvidenceWeighingResult {
  const track = input.track || 'profile';
  const role = input.role || 'baseline';
  const reasons: string[] = [];
  let score = input.baseScore;
  let highSignal = input.highSignal;

  const requirement = [...input.plan.mustHave, ...input.plan.useful, ...input.plan.avoidAsPrimary].find(
    (entry) => entry.track === track,
  );

  if (role === 'primary') {
    score += 22;
    reasons.push('plan-role:primary');
  } else if (role === 'supporting') {
    score += 10;
    reasons.push('plan-role:supporting');
  } else if (role === 'community-signal') {
    score += 4;
    reasons.push('plan-role:community-signal');
  } else if (role === 'context-only') {
    score -= 8;
    highSignal = false;
    reasons.push('plan-role:context-only');
  } else if (role === 'avoid-primary') {
    score -= 25;
    highSignal = false;
    reasons.push('plan-role:avoid-primary');
  }

  if (requirement && input.plan.mustHave.some((entry) => entry.track === track)) {
    score += 16;
    reasons.push(`plan-must-have:${track}`);
  } else if (requirement && input.plan.useful.some((entry) => entry.track === track)) {
    score += 6;
    reasons.push(`plan-useful:${track}`);
  }

  if (track === 'community') {
    if (input.plan.intent.mode === 'community' && input.plan.intent.risk !== 'high') {
      score += 50;
      reasons.push('intent-community-fit');
    } else if (input.plan.intent.risk === 'high') {
      score -= 18;
      highSignal = false;
      reasons.push('high-risk-community-limited');
    } else if (input.plan.intent.mode === 'hybrid') {
      score += 8;
      reasons.push('hybrid-community-signal');
    }
  }

  if ((track === 'issue-tracker' || track === 'repository') && input.plan.intent.domain === 'technical') {
    score += input.plan.intent.mode === 'community' ? 20 : 10;
    reasons.push('technical-implementation-fit');
  }

  if ((track === 'academic' || track === 'official' || track === 'regulator') && input.plan.intent.risk === 'high') {
    score += 18;
    reasons.push('high-risk-anchor');
  }

  if (role === 'primary' && score >= 55) {
    highSignal = true;
  }

  return {
    score,
    highSignal,
    reasons,
  };
}

function queryForTrack(query: string, track: EvidenceSourceTrack, domain: EvidenceSearchDomain): string {
  switch (track) {
    case 'official':
      if (domain === 'medical') {
        return `${query} WHO NIH CDC FDA ANVISA official guideline`;
      }
      if (domain === 'technical') {
        return `${query} official documentation changelog release notes`;
      }
      return `${query} official source site:gov OR site:edu OR site:org`;
    case 'academic':
      if (domain === 'medical') {
        return `${query} site:pubmed.ncbi.nlm.nih.gov PubMed clinical trial guideline`;
      }
      return `${query} DOI arXiv PubMed SciELO journal university scholar`;
    case 'news':
      return `${query} Reuters AP BBC reputable news report`;
    case 'community':
      return `${query} reddit forum hacker news discussion user reports`;
    case 'issue-tracker':
      return `${query} site:github.com/issues OR site:github.com discussions bug workaround`;
    case 'repository':
      return `${query} site:github.com changelog pull request source repository`;
    case 'vendor':
      return `${query} official documentation changelog release notes`;
    case 'benchmark':
      return domain === 'consumer'
        ? `${query} independent review benchmark comparison hands-on testing`
        : `${query} benchmark comparison independent test`;
    case 'regulator':
      return `${query} regulator official filing government agency`;
    default:
      return query;
  }
}
