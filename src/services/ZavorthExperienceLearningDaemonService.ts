import {
  ZAVORTH_EXPERIENCE_LEARNING_DAEMON_VERSION,
  type ZavorthExperienceLearningCandidate,
  type ZavorthExperienceLearningDaemonSnapshot,
  type ZavorthExperienceLearningTurnInput,
} from '../contracts/native/ZavorthNativeAutonomySpineContract.js';
import { addDays, clampConfidence, redactSensitiveText, stableId } from './ZavorthNativeAutonomyShared.js';

type ExperienceLearningDaemonDeps = {
  now?: () => Date;
  recall?: (query: string) => Array<{ id: string; summary: string; evidenceRefs?: string[] }>;
};

const SENSITIVE_USER_MODEL = /\b(depressed|depression|anxiety|trauma|psychological|psychiatric|fragile|vulnerable|suicid|mental health|deprimido|depressao|depressivo|ansiedade|ansioso|traumatizado|psicologico|psiquiatrico|fragil|vulneravel|suicida|saude mental|salud mental|angst|traumatisiert|psychische gesundheit)\b/i;
const POLICY_CHANGE = /\b(disable|bypass|ignore|skip|always allow|permit always|desativ|desabilit|burlar|ignorar|permitir sempre|sempre permitir|desactivar|deaktivieren)\w*\b.*\b(approval|approvals|policy|sandbox|security|shell|command|aprovacao|aprovacoes|politica|seguranca|comando|permissao|aprobacion|seguridad|genehmigung|sicherheit)\b/i;
const PREFERENCE_SIGNAL = /\b(prefer|always|when i ask|use|format|style|resumo|resuma|sempre|quando eu pedir|prefiro|formato|estilo|bullet|bullets)\b/i;
const PROCEDURE_SIGNAL = /\b(workflow|procedure|playbook|checklist|fluxo|procedimento|roteiro|passo a passo|release notes|repeated)\b/i;

export class ZavorthExperienceLearningDaemonService {
  private readonly now: () => Date;
  private readonly recall: NonNullable<ExperienceLearningDaemonDeps['recall']>;

  public constructor(deps: ExperienceLearningDaemonDeps = {}) {
    this.now = deps.now || (() => new Date());
    this.recall = deps.recall || (() => []);
  }

  public async reviewTurn(input: ZavorthExperienceLearningTurnInput): Promise<ZavorthExperienceLearningDaemonSnapshot> {
    const generatedAt = this.now();
    const redactedUserMessage = redactSensitiveText(input.userMessage);
    const redactedAssistantResponse = redactSensitiveText(input.assistantResponse);
    const redactedObservation = [
      `user: ${redactedUserMessage}`,
      `assistant: ${redactedAssistantResponse}`,
      `receipts: ${input.toolReceipts.map((receipt) => `${receipt.id}:${receipt.kind}:${receipt.status}`).join(', ')}`,
    ].join('\n');
    const preTurnResults = input.recallQuery
      ? this.recall(redactSensitiveText(input.recallQuery)).map((entry) => ({
          id: entry.id,
          summary: redactSensitiveText(entry.summary),
          evidenceRefs: entry.evidenceRefs || [],
        }))
      : [];
    const candidates = input.outcome === 'success'
      ? this.buildCandidates({
          turnId: input.turnId,
          text: redactedObservation,
          toolCallCount: input.toolCallCount,
          generatedAt,
        })
      : [];
    const hasRed = candidates.some((candidate) => candidate.lane === 'red');

    return {
      version: ZAVORTH_EXPERIENCE_LEARNING_DAEMON_VERSION,
      generatedAt: generatedAt.toISOString(),
      status: hasRed ? 'needs-review' : 'ready',
      preTurnRecall: {
        ranBeforeTurn: Boolean(input.recallQuery),
        query: input.recallQuery ? redactSensitiveText(input.recallQuery) : null,
        results: preTurnResults,
      },
      postTurnReview: {
        ranAfterSuccessfulTurn: input.outcome === 'success',
        turnId: input.turnId,
        sourceSurface: input.sourceSurface || 'runtime',
        redactedObservation,
      },
      candidates,
      safety: {
        redactionBeforeClassification: true,
        rawSecretsSerialized: false,
        psychologicalInferencesNeverGreen: true,
        policyChangesNeverGreen: true,
        receiptsRequired: true,
      },
    };
  }

  private buildCandidates(input: {
    turnId: string;
    text: string;
    toolCallCount: number;
    generatedAt: Date;
  }): ZavorthExperienceLearningCandidate[] {
    const candidates: ZavorthExperienceLearningCandidate[] = [];
    const evidenceRefs = [`turn:${input.turnId}`];

    if (SENSITIVE_USER_MODEL.test(input.text)) {
      candidates.push(this.candidate({
        turnId: input.turnId,
        kind: 'sensitive-user-model',
        lane: 'red',
        risk: 'high',
        status: 'blocked',
        approvalRequired: true,
        evidenceRefs,
        confidence: 0.88,
        expiry: addDays(input.generatedAt, 14),
        summary: 'Sensitive user-model content requires explicit review and is never green lane.',
      }));
    }

    if (POLICY_CHANGE.test(input.text)) {
      candidates.push(this.candidate({
        turnId: input.turnId,
        kind: 'policy-change',
        lane: 'red',
        risk: 'high',
        status: 'blocked',
        approvalRequired: true,
        evidenceRefs,
        confidence: 0.91,
        expiry: addDays(input.generatedAt, 7),
        summary: 'Policy, approval, shell or sandbox changes cannot be learned silently.',
      }));
    }

    if (PREFERENCE_SIGNAL.test(input.text) && !SENSITIVE_USER_MODEL.test(input.text) && !POLICY_CHANGE.test(input.text)) {
      const preferencePhrase = extractPreferencePhrase(input.text);
      candidates.push(this.candidate({
        turnId: input.turnId,
        kind: 'preference',
        lane: 'green',
        risk: 'low',
        status: 'auto-applied',
        approvalRequired: false,
        evidenceRefs,
        confidence: 0.79,
        expiry: addDays(input.generatedAt, 90),
        summary: preferencePhrase || 'Preferencia reversivel de baixo risco (com recibo).',
      }));
    }

    if ((input.toolCallCount >= 5 || PROCEDURE_SIGNAL.test(input.text)) && !POLICY_CHANGE.test(input.text)) {
      candidates.push(this.candidate({
        turnId: input.turnId,
        kind: 'skill-signal',
        lane: 'yellow',
        risk: 'medium',
        status: 'candidate',
        approvalRequired: true,
        evidenceRefs,
        confidence: 0.74,
        expiry: addDays(input.generatedAt, 30),
        summary: 'Repeated or complex workflow should become a reviewable skill draft.',
      }));
    }

    return candidates;
  }

  private candidate(input: Omit<ZavorthExperienceLearningCandidate, 'candidateId' | 'receiptId'> & { turnId: string }): ZavorthExperienceLearningCandidate {
    return {
      candidateId: stableId('learn', [input.turnId, input.kind, input.lane, input.summary]),
      kind: input.kind,
      lane: input.lane,
      risk: input.risk,
      status: input.status,
      approvalRequired: input.approvalRequired,
      evidenceRefs: input.evidenceRefs,
      confidence: clampConfidence(input.confidence),
      expiry: input.expiry,
      receiptId: stableId('receipt', [input.turnId, input.kind, input.summary]),
      summary: input.summary,
    };
  }
}

function extractPreferencePhrase(text: string): string {
  const userLine = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /^user:\s*/i.test(line));
  const raw = userLine ? userLine.replace(/^user:\s*/i, '').trim() : String(text || '').trim();
  const sliced = raw.slice(0, 240).trim();
  if (!sliced) return '';
  return sliced.startsWith('Prefer') || sliced.startsWith('prefer') || /prefiro|sempre|quando eu/i.test(sliced)
    ? sliced
    : `Preferencia do usuario: ${sliced}`;
}
