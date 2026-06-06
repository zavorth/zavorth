import type {
  ZavorthHallucinationFinding,
  ZavorthHallucinationMitigationInput,
  ZavorthHallucinationMitigationReview,
} from '../contracts/ZavorthHallucinationMitigationContract.js';
import { ZAVORTH_HALLUCINATION_MITIGATION_VERSION } from '../contracts/ZavorthHallucinationMitigationContract.js';

type ZavorthHallucinationMitigationRuntime = {
  now?: () => Date;
};

const CURRENT_OR_UNSTABLE_PATTERNS = [
  /\b(hoje|agora|atual|atuais|ultim[ao]s?|recente|recentes|noticia|noticias|news|breaking)\b/i,
  /\b(preco|cotacao|valor de mercado|ranking|agenda|placar|resultado|eleicao|cargo atual)\b/i,
  /\b(vers[aã]o|release|lan[çc]amento|changelog|ceo|presidente|ministro|diretor)\b/i,
  /\b(today|current|latest|recent|news|price|schedule|score|release|version|ranking)\b/i,
];

const HIGH_STAKES_PATTERNS = [
  /\b(medicina|medico|medica|saude|diagnostico|tratamento|remedio|dose|sintoma|doenca)\b/i,
  /\b(juridico|legal|lei|processo|contrato|jurisprudencia|tribunal|direito)\b/i,
  /\b(financas|financeiro|investimento|acoes|cripto|imposto|tributario|seguro)\b/i,
  /\b(seguranca|vulnerabilidade|exploit|credencial|senha|token|privacidade)\b/i,
  /\b(medical|health|legal|financial|investment|security|privacy|vulnerability)\b/i,
];

const SOURCE_REQUEST_PATTERNS = [
  /\b(fonte|fontes|link|links|cite|citar|referencia|referencias|comprove|verifique)\b/i,
  /\b(source|sources|citation|citations|reference|references|verify|verified)\b/i,
];

const EXECUTION_CLAIM_PATTERNS = [
  /\b(executei|rodei|criei|alterei|editei|apaguei|removi|enviei|instalei|configurei|salvei|publiquei|subi)\b/i,
  /\b(verifiquei|validei|testei|corrigi|implementei|apliquei|gerei|capturei)\b/i,
  /\b(i ran|i executed|i created|i changed|i edited|i deleted|i sent|i installed|i configured|i saved)\b/i,
];

const UNCERTAINTY_PATTERNS = [
  /\b(n[aã]o sei|nao tenho certeza|preciso verificar|sem fonte|sem fontes|posso estar desatualizado)\b/i,
  /\b(not sure|i do not know|i don't know|need to verify|without sources|unverified)\b/i,
];

const EVIDENCE_MARKERS = [
  /https?:\/\//i,
  /\bQUALITY_GATE:/i,
  /\bFonte:/i,
  /\bFontes:/i,
  /\bSource:/i,
  /\bSources:/i,
  /<source\b/i,
  /<untrusted_web_evidence\b/i,
  /web_search/i,
  /\bDOI\b/i,
  /\bPubMed\b/i,
  /\barXiv\b/i,
];

export class ZavorthHallucinationMitigationService {
  private readonly now: () => Date;

  public constructor(runtime: ZavorthHallucinationMitigationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildInstruction(): string {
    return buildZavorthHallucinationMitigationInstruction();
  }

  public reviewResponse(input: ZavorthHallucinationMitigationInput): ZavorthHallucinationMitigationReview {
    const requestText = String(input.requestText || '');
    const responseText = String(input.responseText || '');
    const evidenceTexts = (input.evidenceTexts || []).map((entry) => String(entry || '')).filter(Boolean);
    const toolReceiptCount = Math.max(0, Number(input.toolReceiptCount || 0));
    const selfStatusRequest = this.isSelfStatusRequest(requestText);
    const highStakes = this.matchesAny(`${requestText}\n${responseText}`, HIGH_STAKES_PATTERNS)
      && !selfStatusRequest;
    const currentOrUnstable = this.matchesAny(requestText, CURRENT_OR_UNSTABLE_PATTERNS)
      && !selfStatusRequest;
    const sourceRequested = this.matchesAny(requestText, SOURCE_REQUEST_PATTERNS);
    const evidenceSensitive = highStakes || currentOrUnstable || sourceRequested;
    const evidenceCount = evidenceTexts.filter((entry) => this.looksLikeEvidence(entry)).length;
    const evidenceAvailable = evidenceCount > 0;
    const responseAlreadyUncertain = this.matchesAny(responseText, UNCERTAINTY_PATTERNS);
    const executionClaim = this.matchesAny(responseText, EXECUTION_CLAIM_PATTERNS);
    const executionClaimWithoutReceipt = executionClaim && toolReceiptCount === 0;
    const unsupportedEvidenceSensitive = evidenceSensitive && !evidenceAvailable && !responseAlreadyUncertain;
    const findings = this.buildFindings({
      evidenceSensitive,
      highStakes,
      currentOrUnstable,
      sourceRequested,
      evidenceAvailable,
      executionClaim,
      executionClaimWithoutReceipt,
      responseAlreadyUncertain,
    });
    const outputText = this.applyMitigation(responseText, {
      unsupportedEvidenceSensitive,
      executionClaimWithoutReceipt,
      highStakes,
      currentOrUnstable,
      sourceRequested,
    });
    const status = executionClaimWithoutReceipt || unsupportedEvidenceSensitive
      ? 'mitigated'
      : evidenceSensitive && !evidenceAvailable
        ? 'needs-evidence'
        : 'allow';
    const groundedness = !evidenceSensitive
      ? 'not-applicable'
      : evidenceAvailable
        ? 'grounded'
        : responseAlreadyUncertain
          ? 'partially-grounded'
          : 'unsupported';

    return {
      contractVersion: ZAVORTH_HALLUCINATION_MITIGATION_VERSION,
      status,
      groundedness,
      outputText,
      evidenceSensitive,
      highStakes,
      currentOrUnstable,
      sourceRequested,
      executionClaimWithoutReceipt,
      findings,
      receipt: {
        channel: input.channel ? String(input.channel) : null,
        evidenceCount,
        toolReceiptCount,
        mitigatedAt: this.now().toISOString(),
      },
    };
  }

  private buildFindings(input: {
    evidenceSensitive: boolean;
    highStakes: boolean;
    currentOrUnstable: boolean;
    sourceRequested: boolean;
    evidenceAvailable: boolean;
    executionClaim: boolean;
    executionClaimWithoutReceipt: boolean;
    responseAlreadyUncertain: boolean;
  }): ZavorthHallucinationFinding[] {
    return [
      {
        id: 'evidence-sensitive-detection',
        label: 'Pedido sensivel a evidencia',
        status: input.evidenceSensitive ? 'warning' : 'pass',
        detail: input.evidenceSensitive
          ? `highStakes=${input.highStakes}; currentOrUnstable=${input.currentOrUnstable}; sourceRequested=${input.sourceRequested}`
          : 'Resposta comum pode usar conhecimento geral estavel.',
      },
      {
        id: 'grounding-evidence',
        label: 'Evidencia anexada',
        status: !input.evidenceSensitive || input.evidenceAvailable || input.responseAlreadyUncertain ? 'pass' : 'fail',
        detail: input.evidenceAvailable
          ? 'A resposta tem evidencia/fonte/tool result detectavel.'
          : input.responseAlreadyUncertain
            ? 'Sem evidencia, mas a resposta ja expressa incerteza.'
            : 'Resposta sensivel saiu sem evidencia detectavel.',
      },
      {
        id: 'execution-claim-receipt',
        label: 'Recibo para alegacao de execucao',
        status: input.executionClaimWithoutReceipt ? 'fail' : 'pass',
        detail: input.executionClaim
          ? input.executionClaimWithoutReceipt
            ? 'A resposta afirma execucao sem tool/run receipt.'
            : 'A resposta afirma execucao com recibo de ferramenta/run.'
          : 'Nenhuma alegacao de execucao detectada.',
      },
    ];
  }

  private applyMitigation(
    responseText: string,
    input: {
      unsupportedEvidenceSensitive: boolean;
      executionClaimWithoutReceipt: boolean;
      highStakes: boolean;
      currentOrUnstable: boolean;
      sourceRequested: boolean;
    },
  ): string {
    const notes: string[] = [];
    if (input.executionClaimWithoutReceipt) {
      notes.push('Reliability note: nao tenho recibo de execucao deste run; I do not have an execution receipt for this run; treat any claim of an applied action below as a proposal or draft, not as something already executed.');
    }
    if (input.unsupportedEvidenceSensitive) {
      const reason = input.highStakes
        ? 'the topic is sensitive'
        : input.currentOrUnstable
          ? 'the information may be current or unstable'
          : input.sourceRequested
            ? 'you asked for sources or verification'
            : 'the answer needs evidence';
      notes.push(`Reliability note: ${reason}, but no source or attached evidence is available in this response. I need to verify before treating it as fact.`);
    }
    if (notes.length === 0) {
      return responseText;
    }
    return `${Array.from(new Set(notes)).join('\n')}\n\n${responseText}`.trim();
  }

  private looksLikeEvidence(text: string): boolean {
    return this.matchesAny(text, EVIDENCE_MARKERS);
  }

  private isSelfStatusRequest(text: string): boolean {
    const normalized = String(text || '').toLowerCase();
    return /\b(current state|your state|status|ready|health|what are you|who are you)\b/.test(normalized)
      && /\b(zavorth|you|your)\b/.test(normalized);
  }

  private matchesAny(text: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(text));
  }
}

export function buildZavorthHallucinationMitigationInstruction(): string {
  return [
    '**DISCIPLINA ANTI-ALUCINACAO:**',
    '- Separe fato verificado, inferencia e incerteza. Nao transforme memoria do modelo em certeza quando a informacao for atual, instavel, high-stakes ou pedida com fontes.',
    '- Para noticias, cargos atuais, precos, versoes, leis, saude, financas, seguranca, ciencia e recomendacoes caras, use evidencia disponivel; se nao houver evidencia, diga que precisa verificar.',
    '- Nao invente citacoes, links, datas, numeros, nomes de arquivos, resultados de testes ou recibos.',
    '- Nao diga que executou, criou, alterou, enviou, instalou, verificou ou testou algo se o run nao tiver recibo/tool event correspondente.',
    '- Quando a evidencia for fraca, conflitante ou vier com QUALITY_GATE/erro, responda somente a parte sustentada e declare a limitacao em linguagem natural.',
  ].join('\n');
}
