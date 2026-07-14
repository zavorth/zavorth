import {
  type EvidenceSearchDomain,
  getEvidenceDomainProfile,
  inferEvidenceDomainFromText,
} from './EvidenceDomainProfiles.js';
import {
  EvidenceIntentPlanner,
  type EvidenceIntentPlan,
} from './EvidenceIntentPlanner.js';
import {
  EvidenceSearchPlanBuilder,
  type EvidenceSearchPlan,
} from './EvidenceSearchPlan.js';


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
 * Centralizes the ExternalExecutor-style decision: "does this user turn need external
 * evidence/tools?"  It intentionally models categories instead of one-off
 * keyword patches so every surface can use the same research behavior.
 */
export class EvidenceSearchRouter {
  private readonly intentPlanner = new EvidenceIntentPlanner();
  private readonly searchPlanBuilder = new EvidenceSearchPlanBuilder();

  public detect(message: string): EvidenceSearchNeed | null {
    const normalized = this.normalize(message);
    const questionMarker =
      /\?$/.test(String(message || '').trim())
      || /\b(o\s+que|como|quando|onde|quem|qual|quais|por\s+que|porque|what|how|when|where|who|which|why)\b/.test(normalized);
    const currentMarker =
      /\b(today|now|current|latest|recent|week|weekly|last\s+week|last\s+7\s+days|last\s+24\s+hours?|real[-\s]?time|viral|trending|trend|tiktok|instagram|202[0-9])\b/.test(normalized);
    const explicitSearchIntent =
      /\b(search|browse|look\s+up|find|google|investigate|research)\b/.test(normalized);
    const infoMarker =
      /\b(news|headline|headlines|price|weather|score|results?|trends?|releases?|version|status|evidence|sources?|references?|links?|politics)\b/.test(normalized);
    const volatileMarker =
      /\b(ceo|president|director|minister|governor|mayor|government|congress|senate|company|market|stock|dollar|bitcoin|crypto|election|war|crisis|model|api|package|library|framework)\b/.test(normalized);
    const domain = this.detectDomain(normalized);
    const evidenceMarker = this.hasEvidenceMarker(normalized) || domain !== 'general';
    const decisionMarker = this.hasDecisionMarker(normalized);
    const reportMarker = this.hasReportMarker(normalized);
    const comparisonMarker = this.hasComparisonMarker(normalized);
    const complexResearchMarker = this.hasComplexResearchMarker(normalized);
    const publicRoleQuestion =
      /\b(who\s+is)\b/.test(normalized) && volatileMarker;

    if (this.isAiNewsRequest(normalized)) {
      return this.withIntent(message, { reason: 'current', domain: 'ai_news', fresh: true });
    }
    if (publicRoleQuestion) {
      return this.withIntent(message, { reason: 'current', domain: domain === 'general' ? 'public_policy' : domain, fresh: true });
    }
    if (this.isHighStakesDomain(domain) && (questionMarker || currentMarker || explicitSearchIntent || evidenceMarker)) {
      return this.withIntent(message, {
        reason: currentMarker ? 'current' : 'high_stakes',
        domain,
        fresh: currentMarker,
      });
    }
    if (domain === 'consumer' && (questionMarker || currentMarker || explicitSearchIntent || decisionMarker || comparisonMarker)) {
      return this.withIntent(message, {
        reason: currentMarker ? 'current' : 'research',
        domain,
        fresh: currentMarker || decisionMarker,
      });
    }
    if (domain !== 'general' && (explicitSearchIntent || evidenceMarker || currentMarker)) {
      return this.withIntent(message, {
        reason: currentMarker ? 'current' : evidenceMarker ? 'evidence' : 'research',
        domain,
        fresh: currentMarker,
      });
    }
    if (currentMarker && (infoMarker || explicitSearchIntent || volatileMarker || evidenceMarker)) {
      return this.withIntent(message, { reason: 'current', domain, fresh: true });
    }
    if (explicitSearchIntent && (infoMarker || evidenceMarker || volatileMarker || normalized.length > 20)) {
      return this.withIntent(message, { reason: evidenceMarker ? 'evidence' : 'research', domain, fresh: currentMarker });
    }
    if (reportMarker && normalized.length > 20) {
      return this.withIntent(message, { reason: 'evidence', domain, fresh: currentMarker });
    }
    if ((decisionMarker || comparisonMarker) && normalized.length > 20) {
      return this.withIntent(message, { reason: 'research', domain, fresh: currentMarker || decisionMarker });
    }
    if (complexResearchMarker && normalized.length > 60) {
      return this.withIntent(message, { reason: 'research', domain, fresh: currentMarker });
    }
    if (evidenceMarker && normalized.length > 20) {
      return this.withIntent(message, { reason: 'evidence', domain, fresh: currentMarker });
    }

    return null;
  }

  public buildQuery(message: string, need?: EvidenceSearchNeed | null): string {
    const date = new Date().toISOString().slice(0, 10);
    const normalizedMessage = String(message || '').replace(/\s+/g, ' ').trim();
    const searchNeed = need || this.detect(normalizedMessage);

    if (this.isAiNewsRequest(this.normalize(normalizedMessage))) {
      const recency = /\b(24\s*h|last\s+24\s+hours?)\b/i.test(normalizedMessage)
        ? 'last 24 hours'
        : 'recent';
      return `latest artificial intelligence AI news worldwide ${recency} ${date}`;
    }

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
      lines.push('- If community/forum/social sources are used, label them as reports, discussion signals, or lived experience rather than verified facts.');
    }

    if (policy.requireCaveat) {
      lines.push('- Include a concise caveat when evidence is incomplete, high-stakes, anecdotal, or conflicting.');
    }

    if (policy.style === 'official-first') {
      lines.push('- Lead with verified or primary sources before community signals.');
    } else if (policy.style === 'community-first') {
      lines.push('- Lead with practical community findings, then verify them against docs, repositories, or primary sources when available.');
    } else {
      lines.push('- Balance official facts with community signals and call out disagreements instead of flattening them.');
    }

    return lines.join('\n');
  }

  private detectDomain(normalized: string): EvidenceSearchDomain {
    return inferEvidenceDomainFromText(normalized);
  }

  private hasEvidenceMarker(normalized: string): boolean {
    return /\b(evidencias?|fontes?|referencias?|citacoes?|links?|estudos?|relatorio|levantamento|dataset|dados|casos?|artigos?|papers?|doi|jurisprudencia|acordaos?|decisoes?|precedentes?)\b/.test(normalized);
  }

  private hasDecisionMarker(normalized: string): boolean {
    return /\b(best|worth\s+it|cost[-\s]?benefit|recommend(?:ation)?|options?|alternatives?|ranking|top\s+\d+|reviews?|buy|prices?|which\s+to\s+choose|how\s+to\s+choose)\b/.test(normalized);
  }

  private hasReportMarker(normalized: string): boolean {
    return /\b(relatorio|dossie|panorama|levantamento|pesquisa\s+completa|mapear|mapeie|estado\s+da\s+arte|estado\s+atual|com\s+fontes|com\s+links|bibliografia|referencias?)\b/.test(normalized);
  }

  private hasComparisonMarker(normalized: string): boolean {
    return /\b(compare|comparar|comparativo|comparacao|diferencas?|versus|vs\.?|pros?\s+e\s+contras?|vantagens?|desvantagens?)\b/.test(normalized);
  }

  private hasComplexResearchMarker(normalized: string): boolean {
    return /\b(analyze|analysis|explain|synthesize|synthesis|impacts?|causes?|consequences?|risks?|benefits?|trends?|strategies?|overview|deep\s+dive)\b/.test(normalized);
  }

  private isHighStakesDomain(domain: EvidenceSearchDomain): boolean {
    return domain === 'medical' || domain === 'legal' || domain === 'finance';
  }

  private withIntent(message: string, need: Omit<EvidenceSearchNeed, 'intent' | 'searchPlan'>): EvidenceSearchNeed {
    const intent = this.intentPlanner.plan({
      query: message,
      domain: need.domain,
    });

    return {
      ...need,
      intent,
      searchPlan: this.searchPlanBuilder.build({
        query: message,
        intent,
        domain: need.domain,
      }),
    };
  }

  private isAiNewsRequest(normalized: string): boolean {
    const newsMarker = /\b(news|headlines|latest|recent)\b/.test(normalized);
    const aiMarker =
      /\b(ai|artificial\s+intelligence|machine\s+learning|llm|openai|chatgpt|anthropic|claude|deepmind|gemini|nvidia|mistral|llama)\b/.test(normalized);
    const policyOverride = /\b(regulation|regulator|policy|law|legislation|government|ministry|congress|senate|court)\b/.test(normalized);
    if (policyOverride) {
      return false;
    }
    return newsMarker && aiMarker;
  }

  private normalize(message: string): string {
    return String(message || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
