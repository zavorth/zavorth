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

    if (input.toolCallCount >= 5) {
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
