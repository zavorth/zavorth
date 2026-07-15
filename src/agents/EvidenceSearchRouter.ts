import { type EvidenceSearchDomain, getEvidenceDomainProfile } from './EvidenceDomainProfiles.js';
import { EvidenceIntentPlanner, type EvidenceIntentPlan } from './EvidenceIntentPlanner.js';
import { EvidenceSearchPlanBuilder, type EvidenceSearchPlan } from './EvidenceSearchPlan.js';

export type EvidenceSearchReason = 'current' | 'research' | 'evidence' | 'high_stakes';
export type { EvidenceSearchDomain } from './EvidenceDomainProfiles.js';

export type EvidenceSearchNeed = {
  reason: EvidenceSearchReason;
  domain: EvidenceSearchDomain;
  fresh: boolean;
  intent?: EvidenceIntentPlan;
  searchPlan?: EvidenceSearchPlan;
};

/**
 * Structured input for evidence-search activation.
 * Free text alone never forces external search — LLM/tools own web_search.
 * Callers that already know a domain/reason/force flag may pass them here.
 */
export type EvidenceSearchDetectInput = {
  text?: string | null;
  query?: string | null;
  reason?: EvidenceSearchReason | null;
  domain?: EvidenceSearchDomain | null;
  forceSearch?: boolean | null;
  fresh?: boolean | null;
  /** Structured evidence mode; free text never sets this. */
  userRequestedMode?: EvidenceIntentPlan['mode'] | 'auto' | null;
  risk?: EvidenceIntentPlan['risk'] | null;
};

/**
 * Centralizes the ExternalExecutor-style decision: "does this user turn need external
 * evidence/tools?" Activation is structured-only; free-text regex never decides to
 * force search. Domain profiles remain data used when a structured domain is provided.
 */
export class EvidenceSearchRouter {
  private readonly intentPlanner = new EvidenceIntentPlanner();
  private readonly searchPlanBuilder = new EvidenceSearchPlanBuilder();

  /**
   * Detect whether external evidence search should run.
   * - string / free-text only → null (LLM/tools own web_search)
   * - structured need or { reason|domain|forceSearch } → build EvidenceSearchNeed
   */
  public detect(input?: string | EvidenceSearchNeed | EvidenceSearchDetectInput | null): EvidenceSearchNeed | null {
    if (input == null || typeof input === 'string') {
      // Free text alone must not force external search.
      return null;
    }

    const structured = input as EvidenceSearchDetectInput & Partial<EvidenceSearchNeed>;
    const text = String(structured.text || structured.query || '').trim();
    const hasReason = typeof structured.reason === 'string' && structured.reason.length > 0;
    const hasDomain = typeof structured.domain === 'string' && structured.domain.length > 0;
    const forceSearch = structured.forceSearch === true;

    if (!hasReason && !hasDomain && !forceSearch) {
      return null;
    }

    const domain = (hasDomain ? structured.domain : 'general') as EvidenceSearchDomain;
    const reason = (
      hasReason ? structured.reason : this.isHighStakesDomain(domain) ? 'high_stakes' : 'research'
    ) as EvidenceSearchReason;
    const fresh = typeof structured.fresh === 'boolean' ? structured.fresh : reason === 'current';

    // Already fully built need — return as-is (optionally keep provided intent/plan).
    if (structured.intent && structured.searchPlan && hasReason && hasDomain) {
      return {
        reason,
        domain,
        fresh,
        intent: structured.intent,
        searchPlan: structured.searchPlan,
      };
    }

    return this.withIntent(
      text,
      { reason, domain, fresh },
      {
        userRequestedMode: structured.userRequestedMode,
        risk: structured.risk,
      },
    );
  }

  public buildQuery(message: string, need?: EvidenceSearchNeed | null): string {
    const date = new Date().toISOString().slice(0, 10);
    const normalizedMessage = String(message || '')
      .replace(/\s+/g, ' ')
      .trim();
    // Never auto-detect from free text; only use an explicit need when provided.
    const searchNeed = need || null;

    if (!searchNeed) {
      return normalizedMessage;
    }

    const suffix = getEvidenceDomainProfile(searchNeed.domain).querySuffix;
    const dateSuffix = searchNeed.fresh || searchNeed.reason === 'current' ? ` ${date}` : '';
    return `${normalizedMessage} ${suffix}${dateSuffix}`.trim();
  }

  public buildContextGuidance(need: EvidenceSearchNeed): string {
    return need.searchPlan?.answerPolicy.guidance || getEvidenceDomainProfile(need.domain).guidance;
  }

  public buildAnswerPolicyGuidance(need: EvidenceSearchNeed): string {
    const policy = need.searchPlan?.answerPolicy;
    const intent = need.intent;

    if (!policy || !intent) {
      return [
        'EVIDENCE_ANSWER_POLICY:',
        '- Separate sourced facts from interpretation.',
        '- Mention uncertainty naturally when sources are weak or unavailable.',
      ].join('\n');
    }

    const lines = [
      'EVIDENCE_ANSWER_POLICY:',
      `- Search mode: ${intent.mode}; answer style: ${policy.style}; risk: ${intent.risk}.`,
      '- Separate sourced facts, interpretation, and practical judgment.',
    ];

    if (policy.separateFactsFromReports) {
      lines.push(
        '- If community/forum/social sources are used, label them as reports, discussion signals, or lived experience rather than verified facts.',
      );
    }

    if (policy.requireCaveat) {
      lines.push('- Include a concise caveat when evidence is incomplete, high-stakes, anecdotal, or conflicting.');
    }

    if (policy.style === 'official-first') {
      lines.push('- Lead with verified or primary sources before community signals.');
    } else if (policy.style === 'community-first') {
      lines.push(
        '- Lead with practical community findings, then verify them against docs, repositories, or primary sources when available.',
      );
    } else {
      lines.push(
        '- Balance official facts with community signals and call out disagreements instead of flattening them.',
      );
    }

    return lines.join('\n');
  }

  private isHighStakesDomain(domain: EvidenceSearchDomain): boolean {
    return domain === 'medical' || domain === 'legal' || domain === 'finance';
  }

  private withIntent(
    message: string,
    need: Omit<EvidenceSearchNeed, 'intent' | 'searchPlan'>,
    structured?: Pick<EvidenceSearchDetectInput, 'userRequestedMode' | 'risk'>,
  ): EvidenceSearchNeed {
    const query = String(message || '').trim() || need.domain;
    const intent = this.intentPlanner.plan({
      query,
      domain: need.domain,
      userRequestedMode: structured?.userRequestedMode,
      risk: structured?.risk,
    });

    return {
      ...need,
      intent,
      searchPlan: this.searchPlanBuilder.build({
        query,
        intent,
        domain: need.domain,
        userRequestedMode: structured?.userRequestedMode,
        risk: structured?.risk,
      }),
    };
  }
}
