import {
  inferEvidenceDomainFromText,
  normalizeEvidenceText,
  type EvidenceSearchDomain,
} from './EvidenceDomainProfiles.js';

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
};

export type EvidenceIntentPlannerInput = {
  query: string;
  domain?: EvidenceSearchDomain | 'auto' | null;
  userRequestedMode?: EvidenceSearchMode | 'auto' | null;
};

const HIGH_STAKES_DOMAINS = new Set<EvidenceSearchDomain>([
  'medical',
  'legal',
  'finance',
  'public_policy',
]);

const COMMUNITY_SOURCE_HINTS = /\b(reddit|x\.com|twitter|hacker\s*news|hn|forum|forums?|stack\s*overflow|stackoverflow|github\s+issues?|issues?|discussion|opinion|opinions|people\s+say|community|reports?|experiences?|user\s+reviews?)\b/;
const TROUBLESHOOTING_HINTS = /\b(bug|erro|error|crash|issue|falha|quebra|quebrou|nao\s+funciona|not\s+working|como\s+resolver|resolver|fix|setup|configurar|config|instalar|install|workaround|compatibilidade|regressao|stacktrace|traceback)\b/;
const FORMAL_EVIDENCE_HINTS = /\b(official|docs?|guideline|regulation|law|legislation|jurisprudence|pubmed|anvisa|fda|who|nih|cdc|sec|paper|doi|scientific\s+article|clinical\s+trial)\b/;
const REVIEW_OR_DECISION_HINTS = /\b(review|evaluation|worth\s+it|cost[-\s]?benefit|comparative|compare|vs\.?|versus|benchmark|best|opinions?|experiences?)\b/;
const CURRENT_PUBLIC_DISCUSSION_HINTS = /\b(viral|trending|trend|debate|controversia|repercussao|lancamento|novo\s+modelo|nova\s+versao|recente|latest|today|hoje|agora)\b/;

export class EvidenceIntentPlanner {
  public plan(input: EvidenceIntentPlannerInput | string): EvidenceIntentPlan {
    const query = typeof input === 'string' ? input : input.query;
    const requestedMode = typeof input === 'string' ? null : input.userRequestedMode;
    const domainInput = typeof input === 'string' ? null : input.domain;
    const normalized = normalizeEvidenceText(query);
    const domain =
      domainInput && domainInput !== 'auto'
        ? domainInput
        : inferEvidenceDomainFromText(normalized);
    const risk = this.inferRisk(domain, normalized);
    const signals = this.detectSignals(normalized);

    if (requestedMode && requestedMode !== 'auto') {
      return this.buildPlan({
        mode: requestedMode,
        domain,
        risk,
        confidence: 0.92,
        reason: `user explicitly requested ${requestedMode} evidence routing`,
        signals,
      });
    }

    if (risk === 'high' && !signals.explicitCommunity && !signals.troubleshooting && !signals.reviewOrDecision) {
      return this.buildPlan({
        mode: 'verified',
        domain,
        risk,
        confidence: signals.formalEvidence ? 0.9 : 0.78,
        reason: `${domain} evidence is high-stakes and the user did not ask for lived/community reports`,
        signals,
      });
    }

    if (signals.explicitCommunity || (signals.troubleshooting && domain === 'technical')) {
      return this.buildPlan({
        mode: 'community',
        domain,
        risk,
        confidence: signals.explicitCommunity ? 0.88 : 0.82,
        reason: signals.explicitCommunity
          ? 'user is asking for community discussion, lived experience, or forum signals'
          : 'technical troubleshooting usually benefits from issues, forums, and real failure reports',
        signals,
      });
    }

    if (signals.reviewOrDecision || signals.currentPublicDiscussion || signals.troubleshooting) {
      return this.buildPlan({
        mode: 'hybrid',
        domain,
        risk,
        confidence: signals.reviewOrDecision ? 0.8 : 0.72,
        reason: 'the request mixes facts with practical judgment, recent discussion, or user experience',
        signals,
      });
    }

    if (signals.formalEvidence || risk === 'high') {
      return this.buildPlan({
        mode: 'verified',
        domain,
        risk,
        confidence: 0.76,
        reason: 'the request asks for formal or primary evidence',
        signals,
      });
    }

    return this.buildPlan({
      mode: 'hybrid',
      domain,
      risk,
      confidence: 0.62,
      reason: 'no single source family is clearly dominant, so use balanced evidence routing',
      signals,
    });
  }

  private detectSignals(normalized: string) {
    return {
      explicitCommunity: COMMUNITY_SOURCE_HINTS.test(normalized),
      troubleshooting: TROUBLESHOOTING_HINTS.test(normalized),
      formalEvidence: FORMAL_EVIDENCE_HINTS.test(normalized),
      reviewOrDecision: REVIEW_OR_DECISION_HINTS.test(normalized),
      currentPublicDiscussion: CURRENT_PUBLIC_DISCUSSION_HINTS.test(normalized),
    };
  }

  private inferRisk(domain: EvidenceSearchDomain, normalized: string): EvidenceRiskLevel {
    if (HIGH_STAKES_DOMAINS.has(domain)) {
      return 'high';
    }

    if (/\b(seguranca|security|vulnerabilidade|vulnerability|exploit|malware|phishing|credenciais?|secrets?|privacidade|privacy|investimento|diagnostico|tratamento|processo\s+judicial)\b/.test(normalized)) {
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
    signals: ReturnType<EvidenceIntentPlanner['detectSignals']>;
  }): EvidenceIntentPlan {
    return {
      mode: input.mode,
      domain: input.domain,
      risk: input.risk,
      confidence: input.confidence,
      reason: input.reason,
      sourceDiversity: this.sourceDiversityFor(input.mode, input.domain, input.signals),
      answerStyle: this.answerStyleFor(input.mode, input.risk),
    };
  }

  private sourceDiversityFor(
    mode: EvidenceSearchMode,
    domain: EvidenceSearchDomain,
    signals: ReturnType<EvidenceIntentPlanner['detectSignals']>,
  ): EvidenceSourceTrack[] {
    if (mode === 'community') {
      const tracks: EvidenceSourceTrack[] = ['community', 'issue-tracker'];
      if (domain === 'technical') {
        tracks.push('repository', 'vendor');
      }
      if (signals.reviewOrDecision) {
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
