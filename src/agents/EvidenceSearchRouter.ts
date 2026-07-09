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
      /\b(hoje|agora|atual|atuais|recente|recentes|ultimas?|ultimos?|novas?|novos?|descobertas?|24\s*h|24\s*horas|semana|semanal|ultima\s+semana|ultimos\s+7\s+dias|tempo\s+real|viral|trending|trend|tiktok|instagram|202[0-9])\b/.test(normalized)
      || /\b(today|now|current|latest|recent|week|weekly|last\s+week|last\s+7\s+days|last\s+24\s+hours?|real[-\s]?time)\b/.test(normalized)
      || /\b(hoy|ahora|actual|ultimas?|ultimos?|ultimas?\s+24\s+horas)\b/.test(normalized);
    const explicitSearchIntent =
      /\b(pesquise|pesquisar|busque|buscar|procure|procurar|encontre|ache|levante|mapeie|verifique|confira|consulte|search|browse|look\s+up|find|google|investigue|research)\b/.test(normalized);
    const infoMarker =
      /\b(informacoes?|dados|fatos?|noticias?|news|headline|headlines|cotacao|preco|price|clima|weather|placar|score|resultado|results?|tendencias?|trends?|lancamentos?|releases?|versao|version|status|descobertas?|avancos?|atualizacoes?|evidencias?|fontes?|referencias?|links?|politica|politics)\b/.test(normalized);
    const volatileMarker =
      /\b(presidente|ceo|diretor|ministro|governador|prefeito|stf|supremo|governo|congresso|senado|camara|empresa|mercado|bolsa|dolar|bitcoin|cripto|eleicao|guerra|crise|modelo|api|pacote|biblioteca|library|framework)\b/.test(normalized);
    const domain = this.detectDomain(normalized);
    const evidenceMarker = this.hasEvidenceMarker(normalized) || domain !== 'general';
    const decisionMarker = this.hasDecisionMarker(normalized);
    const reportMarker = this.hasReportMarker(normalized);
    const comparisonMarker = this.hasComparisonMarker(normalized);
    const complexResearchMarker = this.hasComplexResearchMarker(normalized);
    const publicRoleQuestion =
      /\b(quem\s+e|quem\s+eh|who\s+is|qual\s+e|qual\s+eh)\b/.test(normalized) && volatileMarker;

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
      const recency = /\b(24\s*h|24\s*horas|last\s+24\s+hours?)\b/i.test(normalizedMessage)
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
    return /\b(melhor(?:es)?|best|vale\s+a\s+pena|custo\s*beneficio|recomend[ae]|recomendacao|opcoes?|alternativas?|ranking|top\s+\d+|reviews?|avaliacoes?|comprar|precos?|qual\s+escolher|como\s+escolher)\b/.test(normalized);
  }

  private hasReportMarker(normalized: string): boolean {
    return /\b(relatorio|dossie|panorama|levantamento|pesquisa\s+completa|mapear|mapeie|estado\s+da\s+arte|estado\s+atual|com\s+fontes|com\s+links|bibliografia|referencias?)\b/.test(normalized);
  }

  private hasComparisonMarker(normalized: string): boolean {
    return /\b(compare|comparar|comparativo|comparacao|diferencas?|versus|vs\.?|pros?\s+e\s+contras?|vantagens?|desvantagens?)\b/.test(normalized);
  }

  private hasComplexResearchMarker(normalized: string): boolean {
    return /\b(analise|analisar|explique|explicar|sintetize|sintese|impactos?|causas?|consequencias?|riscos?|beneficios?|tendencias?|estrategias?|o\s+que\s+dizem|visao\s+geral|deep\s+dive)\b/.test(normalized);
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
    const newsMarker = /\b(noticias?|manchetes|news|headlines|ultimas?|ultimos?|latest|recent)\b/.test(normalized);
    const aiMarker =
      /\b(ia|ai|inteligencia\s+artificial|artificial\s+intelligence|machine\s+learning|aprendizado\s+de\s+maquina|llm|openai|chatgpt|anthropic|claude|deepmind|gemini|nvidia|mistral|llama)\b/.test(normalized);
    return newsMarker && aiMarker;
  }

  private normalize(message: string): string {
    return String(message || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
