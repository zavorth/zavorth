import type {
  ZavorthHallucinationFinding,
  ZavorthHallucinationMitigationInput,
  ZavorthHallucinationMitigationReview,
} from '../contracts/native/ZavorthHallucinationMitigationContract.js';
import { ZAVORTH_HALLUCINATION_MITIGATION_VERSION } from '../contracts/native/ZavorthHallucinationMitigationContract.js';

type ZavorthHallucinationMitigationRuntime = {
  now?: () => Date;
};

const EVIDENCE_MARKERS = [
  /https?:\/\//i,
  /\bQUALITY_GATE:/i,
  /\bSource:/i,
  /\bSources:/i,
  /<source\b/i,
  /<untrusted_web_evidence\b/i,
  /web_search/i,
  /deep_search/i,
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
    const responseText = String(input.responseText || '');
    const evidenceTexts = (input.evidenceTexts || []).map((entry) => String(entry || '')).filter(Boolean);
    const toolReceiptCount = Math.max(0, Number(input.toolReceiptCount || 0));
    const highStakes = Boolean(input.highStakes);
    const currentOrUnstable = Boolean(input.currentOrUnstable);
    const sourceRequested = Boolean(input.sourceRequested);
    const evidenceSensitive = Boolean(input.evidenceSensitive || highStakes || currentOrUnstable || sourceRequested);
    const evidenceCount = evidenceTexts.filter((entry) => this.looksLikeEvidence(entry)).length;
    const evidenceAvailable = evidenceCount > 0;
    const responseAlreadyUncertain = Boolean(input.responseAlreadyUncertain);
    const executionClaim = Boolean(input.executionClaim);
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
    const status = executionClaimWithoutReceipt || unsupportedEvidenceSensitive ? 'mitigated'
      : evidenceSensitive && !evidenceAvailable ? 'needs-evidence'
        : 'allow';
    const groundedness = !evidenceSensitive ? 'not-applicable'
      : evidenceAvailable ? 'grounded'
        : responseAlreadyUncertain ? 'partially-grounded'
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
        label: 'Evidence-sensitive request',
        status: input.evidenceSensitive ? 'warning' : 'pass',
        detail: input.evidenceSensitive ? `highStakes=${input.highStakes}; currentOrUnstable=${input.currentOrUnstable}; sourceRequested=${input.sourceRequested}`
          : 'Common response may use stable general knowledge.',
      },
      {
        id: 'grounding-evidence',
        label: 'Attached evidence',
        status: !input.evidenceSensitive || input.evidenceAvailable || input.responseAlreadyUncertain ? 'pass' : 'fail',
        detail: input.evidenceAvailable ? 'The response has detectable evidence/source/tool result.'
          : input.responseAlreadyUncertain ? 'No evidence, but the response already expresses uncertainty.'
            : 'Sensitive response was produced without detectable evidence.',
      },
      {
        id: 'execution-claim-receipt',
        label: 'Receipt for execution claim',
        status: input.executionClaimWithoutReceipt ? 'fail' : 'pass',
        detail: input.executionClaim
          ? input.executionClaimWithoutReceipt ? 'The response claims execution without a tool/run receipt.'
            : 'The response claims execution with a tool/run receipt.'
          : 'No execution claim detected.',
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
      notes.push('Reliability note: I do not have an execution receipt for this run; treat any claim of an applied action below as a proposal or draft, not as something already executed.');
    }
    if (input.unsupportedEvidenceSensitive) {
      const reason = input.highStakes ? 'the topic is sensitive'
        : input.currentOrUnstable ? 'the information may be current or unstable'
          : input.sourceRequested ? 'you asked for sources or verification'
            : 'the answer needs evidence';
      notes.push(`Reliability note: ${reason}, but no source or attached evidence is available in this response. I need to verify before treating it as fact.`);
    }
    if (notes.length === 0) {
      return responseText;
    }
    return `${Array.from(new Set(notes)).join('\n')}\n\n${responseText}`.trim();
  }

  private looksLikeEvidence(text: string): boolean {
    return EVIDENCE_MARKERS.some((pattern) => pattern.test(text));
  }
}

export function buildZavorthHallucinationMitigationInstruction(): string {
  return [
    '**ANTI-HALLUCINATION DISCIPLINE:**',
    '- Separate verified fact, inference, and uncertainty. Do not turn model memory into certainty when information is current, unstable, high-stakes, or requested with sources.',
    '- For news, current roles, prices, versions, laws, health, finance, security, science, and costly recommendations, use available evidence; if there is no evidence, say verification is needed.',
    '- Do not invent quotes, links, dates, numbers, filenames, test results, or receipts.',
    '- Do not say something was executed, created, changed, sent, installed, verified, or tested unless the run has the corresponding receipt/tool event.',
    '- When evidence is weak, conflicting, or marked by QUALITY_GATE/error, answer only the supported part and state the limitation in natural language.',
  ].join('\n');
}
