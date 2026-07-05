import { logger } from '../logger.js';
export type EvidenceSearchDomain =
  | 'ai_news'
  | 'medical'
  | 'legal'
  | 'scientific'
  | 'finance'
  | 'consumer'
  | 'technical'
  | 'public_policy'
  | 'general';

export type EvidenceDomainProfile = {
  domain: EvidenceSearchDomain;
  label: string;
  querySuffix: string;
  guidance: string;
  preferredHosts: string[];
  authorityTerms: string[];
  topicalTerms: string[];
  primarySearches: string[];
  minHighSignalResults: number;
};

type EvidenceScoreInput = {
  title: string;
  url: string;
  description?: string | null;
};

export type EvidenceSourceScore = {
  score: number;
  highSignal: boolean;
  reasons: string[];
};

export const EVIDENCE_DOMAIN_PROFILES: Record<EvidenceSearchDomain, EvidenceDomainProfile> = {
  ai_news: {
    domain: 'ai_news',
    label: 'AI news',
    querySuffix: 'latest AI news official company blog research lab source links',
    guidance: 'Prefer current AI sources, official company/research lab posts, reputable technology outlets and reject off-topic headlines even if they mention AI incidentally.',
    preferredHosts: [
      'openai.com',
      'anthropic.com',
      'deepmind.google',
      'blog.google',
      'ai.meta.com',
      'mistral.ai',
      'nvidia.com',
      'microsoft.com',
      'technologyreview.com',
      'theverge.com',
      'wired.com',
      'reuters.com',
      'apnews.com',
    ],
    authorityTerms: ['openai', 'anthropic', 'deepmind', 'nvidia', 'research', 'model', 'release'],
    topicalTerms: ['ai', 'artificial intelligence', 'llm', 'machine learning', 'generative ai', 'model'],
    primarySearches: [
      '{query} site:openai.com OR site:anthropic.com OR site:deepmind.google',
      '{query} site:reuters.com OR site:apnews.com OR site:technologyreview.com',
    ],
    minHighSignalResults: 1,
  },
  medical: {
    domain: 'medical',
    label: 'medical evidence',
    querySuffix: 'medical research clinical trials guideline PubMed WHO NIH CDC FDA ANVISA official sources links',
    guidance: 'Prefer PubMed, clinical trials, guidelines, WHO/NIH/CDC/FDA/ANVISA and official medical sources; do not provide individual diagnosis.',
    preferredHosts: [
      'pubmed.ncbi.nlm.nih.gov',
      'ncbi.nlm.nih.gov',
      'clinicaltrials.gov',
      'who.int',
      'nih.gov',
      'cdc.gov',
      'fda.gov',
      'anvisa.gov.br',
      'cochranelibrary.com',
      'nejm.org',
      'thelancet.com',
      'bmj.com',
      'jamanetwork.com',
    ],
    authorityTerms: ['pubmed', 'clinical trial', 'guideline', 'systematic review', 'meta-analysis', 'who', 'nih'],
    topicalTerms: ['treatment', 'therapy', 'diagnosis', 'disease', 'patient', 'clinical', 'medicine', 'health'],
    primarySearches: [
      '{query} site:pubmed.ncbi.nlm.nih.gov',
      '{query} site:clinicaltrials.gov OR site:who.int OR site:nih.gov',
    ],
    minHighSignalResults: 1,
  },
  legal: {
    domain: 'legal',
    label: 'legal evidence',
    querySuffix: 'jurisprudencia acordaos decisoes judiciais tribunal case law legislation official sources links',
    guidance: 'Prefer official courts, legislation, case law, judgments and dates; do not present this as personalized legal advice.',
    preferredHosts: [
      'stf.jus.br',
      'stj.jus.br',
      'tst.jus.br',
      'tse.jus.br',
      'trf1.jus.br',
      'trf2.jus.br',
      'trf3.jus.br',
      'trf4.jus.br',
      'trf5.jus.br',
      'planalto.gov.br',
      'gov.br',
      'lexml.gov.br',
      'law.cornell.edu',
      'supreme.justia.com',
      'oyez.org',
    ],
    authorityTerms: ['tribunal', 'acordao', 'jurisprudencia', 'lei', 'legislacao', 'case law', 'court'],
    topicalTerms: ['decision', 'judgment', 'appeal', 'statute', 'law', 'legal', 'precedent', 'case'],
    primarySearches: [
      '{query} site:stf.jus.br OR site:stj.jus.br OR site:tst.jus.br',
      '{query} site:planalto.gov.br OR site:lexml.gov.br OR site:law.cornell.edu',
    ],
    minHighSignalResults: 1,
  },
  scientific: {
    domain: 'scientific',
    label: 'scientific literature',
    querySuffix: 'scientific articles papers DOI PubMed SciELO arXiv journal university publisher links',
    guidance: 'Prefer DOI, PubMed, SciELO, arXiv, journals, universities or publishers; do not invent metadata.',
    preferredHosts: [
      'doi.org',
      'arxiv.org',
      'pubmed.ncbi.nlm.nih.gov',
      'ncbi.nlm.nih.gov',
      'scielo.br',
      'scielo.org',
      'nature.com',
      'science.org',
      'springer.com',
      'sciencedirect.com',
      'wiley.com',
      'tandfonline.com',
      'frontiersin.org',
      'plos.org',
      'acm.org',
      'ieee.org',
    ],
    authorityTerms: ['doi', 'arxiv', 'journal', 'paper', 'preprint', 'systematic review', 'meta-analysis'],
    topicalTerms: ['study', 'research', 'method', 'results', 'evidence', 'dataset', 'literature'],
    primarySearches: [
      '{query} DOI arXiv PubMed SciELO',
      '{query} site:arxiv.org OR site:scielo.br OR site:doi.org',
    ],
    minHighSignalResults: 1,
  },
  finance: {
    domain: 'finance',
    label: 'financial evidence',
    querySuffix: 'current market data regulator exchange company filing official source links',
    guidance: 'Prefer current market, regulator, exchange, company filing or official data; avoid investment advice.',
    preferredHosts: [
      'sec.gov',
      'investor.gov',
      'bcb.gov.br',
      'gov.br',
      'cvm.gov.br',
      'nasdaq.com',
      'nyse.com',
      'b3.com.br',
      'investors.',
      'ir.',
      'reuters.com',
      'apnews.com',
    ],
    authorityTerms: ['filing', '10-k', '10-q', 'earnings', 'regulator', 'market data', 'exchange'],
    topicalTerms: ['price', 'market', 'stock', 'shares', 'revenue', 'guidance', 'rate', 'inflation'],
    primarySearches: [
      '{query} site:sec.gov OR site:bcb.gov.br OR site:cvm.gov.br',
      '{query} company filing investor relations market data',
    ],
    minHighSignalResults: 1,
  },
  consumer: {
    domain: 'consumer',
    label: 'consumer decision sources',
    querySuffix: 'current reviews comparison buying guide official specs price warranty independent sources links',
    guidance: 'Prefer independent reviews, benchmarks, official specifications, consumer protection data and recent price/context; separate preference from sourced facts.',
    preferredHosts: [
      'consumerreports.org',
      'wirecutter.com',
      'rtings.com',
      'notebookcheck.net',
      'tomsguide.com',
      'pcmag.com',
      'cnet.com',
      'techradar.com',
      'inmetro.gov.br',
      'anatel.gov.br',
      'procon.sp.gov.br',
      'reclameaqui.com.br',
    ],
    authorityTerms: [
      'review',
      'comparison',
      'buying guide',
      'benchmark',
      'specifications',
      'price',
      'warranty',
      'consumer',
    ],
    topicalTerms: [
      'best',
      'melhor',
      'reviews',
      'avaliacao',
      'comparativo',
      'custo beneficio',
      'preco',
      'comprar',
    ],
    primarySearches: [
      '{query} independent reviews comparison buying guide official specs',
      '{query} benchmark price warranty consumer protection',
    ],
    minHighSignalResults: 1,
  },
  technical: {
    domain: 'technical',
    label: 'technical sources',
    querySuffix: 'official documentation changelog release notes GitHub issue PR versioned references',
    guidance: 'Prefer official docs, changelogs, release notes, GitHub issues/PRs and versioned references.',
    preferredHosts: [
      'github.com',
      'docs.github.com',
      'developer.mozilla.org',
      'nodejs.org',
      'npmjs.com',
      'python.org',
      'pypi.org',
      'microsoft.com',
      'cloud.google.com',
      'aws.amazon.com',
      'docs.anthropic.com',
      'platform.openai.com',
      'ai.google.dev',
    ],
    authorityTerms: ['docs', 'documentation', 'changelog', 'release notes', 'github', 'issue', 'pull request'],
    topicalTerms: ['api', 'sdk', 'version', 'package', 'library', 'framework', 'model', 'provider'],
    primarySearches: [
      '{query} official docs changelog release notes',
      '{query} site:github.com OR site:docs.github.com',
    ],
    minHighSignalResults: 1,
  },
  public_policy: {
    domain: 'public_policy',
    label: 'public policy',
    querySuffix: 'official sources government data law regulation report links',
    guidance: 'Prefer government, regulator, court, official report or primary public data sources.',
    preferredHosts: [
      'gov.br',
      'planalto.gov.br',
      'camara.leg.br',
      'senado.leg.br',
      'stf.jus.br',
      'who.int',
      'un.org',
      'worldbank.org',
      'oecd.org',
      'europa.eu',
      'whitehouse.gov',
      'congress.gov',
    ],
    authorityTerms: ['official', 'government', 'regulation', 'law', 'report', 'dataset', 'policy'],
    topicalTerms: ['policy', 'regulation', 'public', 'government', 'agency', 'law', 'data'],
    primarySearches: [
      '{query} site:gov.br OR site:planalto.gov.br OR site:camara.leg.br',
      '{query} official government report regulation data',
    ],
    minHighSignalResults: 1,
  },
  general: {
    domain: 'general',
    label: 'general research sources',
    querySuffix: 'reliable sources references official data guide links',
    guidance: 'Prefer diverse reliable sources, official/primary references when available, and explain uncertainty instead of pretending weak results are definitive.',
    preferredHosts: [
      'wikipedia.org',
      'britannica.com',
      'reuters.com',
      'apnews.com',
      'bbc.com',
      'npr.org',
      'theguardian.com',
      'nature.com',
      'science.org',
      'gov.',
      'edu',
      'who.int',
      'un.org',
      'worldbank.org',
      'oecd.org',
    ],
    authorityTerms: ['source', 'reference', 'official', 'report', 'data', 'guide', 'explainer', 'analysis'],
    topicalTerms: ['overview', 'guide', 'comparison', 'evidence', 'dados', 'fontes', 'referencias'],
    primarySearches: [
      '{query} reliable sources official reference',
      '{query} guide overview evidence links',
    ],
    minHighSignalResults: 0,
  },
};

export function getEvidenceDomainProfile(domain: EvidenceSearchDomain | string | null | undefined): EvidenceDomainProfile {
  const normalized = String(domain || '').trim().toLowerCase() as EvidenceSearchDomain;
  return EVIDENCE_DOMAIN_PROFILES[normalized] || EVIDENCE_DOMAIN_PROFILES.general;
}

export function buildEvidenceProfileQueries(query: string, domain: EvidenceSearchDomain): string[] {
  const profile = getEvidenceDomainProfile(domain);
  const base = String(query || '').replace(/\s+/g, ' ').trim();
  const candidates = [base];

  for (const template of profile.primarySearches) {
    candidates.push(template.replace('{query}', base));
  }

  return Array.from(new Set(candidates.filter(Boolean))).slice(0, 3);
}

export function inferEvidenceDomainFromText(text: string): EvidenceSearchDomain {
  const normalized = normalizeEvidenceText(text);
  if (isAiNewsText(normalized)) {
    return 'ai_news';
  }
  if (/\b(medicina|medic[oa]s?|saude|doencas?|tratamentos?|diagnostico|sintomas?|medicamentos?|remedios?|terapias?|vacinas?|clinical\s+trials?|ensaios?\s+clinicos?|guidelines?|pubmed|oncologia|cardiologia|psiquiatria|neurologia|fda|anvisa|who|oms|nih|cdc)\b/.test(normalized)) {
    return 'medical';
  }
  if (/\b(advogad[oa]s?|direito|juridic[oa]|lei|leis|legislacao|jurisprudencia|tribunal|stj|stf|tj[a-z]*|trf|tst|processos?|casos?|sentenca|acordao|decisoes?|precedentes?|case\s+law|court\s+cases?|legal\s+cases?)\b/.test(normalized)) {
    return 'legal';
  }
  if (/\b(artigos?|papers?|paper|doi|pubmed|scielo|arxiv|google\s+scholar|scholar|cientific[oa]s?|academicos?|estudos?|literatura|revisao\s+sistematica|meta[-\s]?analise|journal|periodico)\b/.test(normalized)) {
    return 'scientific';
  }
  if (/\b(financas?|financeir[oa]|mercado|investimentos?|acoes?|bolsa|dolar|euro|juros|selic|bitcoin|cripto|cotacao|precos?|valuation|earning|earnings)\b/.test(normalized)) {
    return 'finance';
  }
  const consumerIntent = /\b(comprar|compra|produto|produtos|custo\s*beneficio|vale\s+a\s+pena|review|reviews?|avaliacoes?|comparativo|comparar|preco|precos?)\b/.test(normalized);
  const consumerProduct = /\b(notebook|celular|smartphone|air\s*fryer|geladeira|tv|monitor|fone|headset|camera|carro|moto|tablet|impressora|roteador|mouse|teclado)\b/.test(normalized);
  if (consumerIntent || (consumerProduct && /\b(melhor(?:es)?|best|comparar|compare|ranking|top|comprar)\b/.test(normalized))) {
    return 'consumer';
  }
  if (/\b(api|sdk|biblioteca|library|framework|pacote|package|versao|version|release|changelog|github|stack\s*overflow|stackoverflow|cors|next\.?js|react|node\.?js|npm|documentacao|docs?|modelo|llm|provider|software|bug|issue|pull\s+request|pr)\b/.test(normalized)) {
    return 'technical';
  }
  if (/\b(governo|ministerio|agencia|regulador|regulacao|politica\s+publica|politica\s+global|politica\s+internacional|geopolitica|diplomacia|eleicoes?|lei|decreto|portaria|consulta\s+publica|tribunal|stf|congresso|senado|camara)\b/.test(normalized)) {
    return 'public_policy';
  }
  return 'general';
}

export function scoreEvidenceSource(input: EvidenceScoreInput, domain: EvidenceSearchDomain): EvidenceSourceScore {
  const profile = getEvidenceDomainProfile(domain);
  const host = normalizeHost(input.url);
  const haystack = normalizeEvidenceText(`${input.title} ${input.description || ''} ${input.url}`);
  const reasons: string[] = [];
  let score = 0;

  const preferred = profile.preferredHosts.find((candidate) => hostMatches(host, candidate));
  if (preferred) {
    score += 80;
    reasons.push(`preferred:${preferred}`);
  }

  if (host.endsWith('.gov') || host.includes('.gov.') || host.endsWith('.gov.br') || host.includes('.jus.br')) {
    score += 35;
    reasons.push('official/government');
  } else if (host.endsWith('.edu') || host.includes('.edu.')) {
    score += 25;
    reasons.push('academic');
  } else if (host.endsWith('.org') || host.includes('.org.')) {
    score += 8;
    reasons.push('organization');
  }

  for (const term of profile.authorityTerms) {
    if (haystack.includes(normalizeEvidenceText(term))) {
      score += 10;
      reasons.push(`authority:${term}`);
    }
  }

  let topicalHits = 0;
  for (const term of profile.topicalTerms) {
    if (haystack.includes(normalizeEvidenceText(term))) {
      topicalHits += 1;
    }
  }
  if (topicalHits > 0) {
    score += Math.min(25, topicalHits * 5);
    reasons.push(`topic:${topicalHits}`);
  }

  if (isLowAuthorityHost(host)) {
    score -= 30;
    reasons.push('low-authority-host');
  }

  return {
    score,
    highSignal: score >= 70 || Boolean(preferred),
    reasons: reasons.slice(0, 6),
  };
}

export function normalizeEvidenceText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch (error) {
    logger.warn('[Evidence Domain Profiles] string operation failed', error);
    return String(url || '').toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
  }
}

function hostMatches(host: string, candidate: string): boolean {
  const normalizedCandidate = String(candidate || '').toLowerCase().replace(/^www\./, '');
  if (!normalizedCandidate) {
    return false;
  }
  if (normalizedCandidate.endsWith('.')) {
    return host.includes(normalizedCandidate);
  }
  return host === normalizedCandidate || host.endsWith(`.${normalizedCandidate}`) || host.includes(normalizedCandidate);
}

function isLowAuthorityHost(host: string): boolean {
  return /\b(pinterest|tiktok|instagram|facebook|x\.com|twitter|quora|medium|reddit)\b/.test(host);
}

function isAiNewsText(normalized: string): boolean {
  const newsMarker = /\b(noticias?|manchetes|news|headlines|ultimas?|ultimos?|latest|recent)\b/.test(normalized);
  const aiMarker =
    /\b(ia|ai|inteligencia\s+artificial|artificial\s+intelligence|machine\s+learning|aprendizado\s+de\s+maquina|llm|openai|chatgpt|anthropic|claude|deepmind|gemini|nvidia|mistral|llama)\b/.test(normalized);
  return newsMarker && aiMarker;
}
