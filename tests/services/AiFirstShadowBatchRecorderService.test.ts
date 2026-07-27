import type { ZavorthResponseDecision } from '../../src/contracts/ZavorthResponseDecisionContract.js';
import {
  AiFirstShadowBatchRecorderService,
  type AiFirstShadowBatchRecorderSampleInput,
} from '../../src/services/AiFirstShadowBatchRecorderService.js';

function createService(): AiFirstShadowBatchRecorderService {
  let counter = 0;
  return new AiFirstShadowBatchRecorderService({
    now: () => new Date('2026-05-06T18:00:00.000Z'),
    idFactory: (prefix) => `${prefix}-${++counter}`,
  });
}

function legacyDecision(input: Partial<ZavorthResponseDecision>): ZavorthResponseDecision {
  return {
    schemaVersion: 1,
    mode: 'conversation',
    confidence: 'high',
    reason: 'Current route fixture.',
    sourceReason: 'conversation-only',
    target: { type: 'none', value: null },
    requestedTools: [],
    responsePath: 'fast-chat',
    shouldCreateArtifact: false,
    shouldShowArtifactInChat: false,
    artifactPolicy: {
      shouldCreateArtifact: false,
      shouldShowArtifactInChat: false,
      reason: 'fixture',
    },
    diagnostics: {
      surface: 'web',
      shouldExecute: false,
      semantic: false,
      universalIntent: null,
      trustSlider: null,
    },
    ...input,
  };
}

function conversationSample(sampleId: string, userMessage: string): AiFirstShadowBatchRecorderSampleInput {
  return {
    sampleId,
    surface: 'web',
    userMessage,
    legacyDecision: legacyDecision({}),
    rawAiPlan: {
      intent: { primary: 'conversation', confidence: 0.9 },
      proposedActions: [{ kind: 'answer', summary: 'Respond in conversation.' }],
    },
  };
}

describe('AiFirstShadowBatchRecorderService', () => {
  it('marks a clean matching batch as a limited promotion candidate', () => {
    const service = createService();
    const snapshot = service.recordBatch({
      batchName: 'clean-conversation-batch',
      profile: 'promotion-candidate',
      criteria: {
        minSamples: 2,
        minPassRate: 1,
        maxBlockRate: 0,
        maxHighMismatchRate: 0,
        maxHighShadowDivergenceRate: 0,
      },
      samples: [
        conversationSample('conversation-a', 'Oi, me explique uma ideia.'),
        conversationSample('conversation-b', 'Me ajude a pensar num nome melhor.'),
      ],
    });

    expect(snapshot.score.criteriaPassed).toBe(true);
    expect(snapshot.recommendation.readiness).toBe('candidate');
    expect(snapshot.recommendation.action).toBe('eligible-for-limited-promotion');
    expect(snapshot.statusCounts).toEqual({ pass: 2, hold: 0, block: 0 });
    expect(snapshot.recommendation.defaultRuntimeChanged).toBe(false);
    expect(snapshot.recommendation.canExecuteNow).toBe(false);
  });

  it('aggregates pass, hold and block samples with failed criteria', () => {
    const service = createService();
    const snapshot = service.recordBatch({
      batchName: 'mixed-batch',
      profile: 'custom',
      criteria: {
        minSamples: 3,
        minPassRate: 0.8,
        maxBlockRate: 0,
        maxHighMismatchRate: 0,
        maxHighShadowDivergenceRate: 0,
      },
      samples: [
        conversationSample('pass-sample', 'Oi.'),
        {
          sampleId: 'hold-sample',
          surface: 'web',
          userMessage: 'Configure my account.',
          legacyDecision: legacyDecision({}),
          rawAiPlan: {
            intent: { primary: 'configuration', confidence: 0.9 },
            proposedActions: [
              {
                kind: 'configure',
                summary: 'Salvar configuraction depois de preview.',
                requestedToolIds: ['secure-storage.write'],
              },
            ],
          },
        },
        {
          sampleId: 'block-sample',
          surface: 'web',
          userMessage: 'oi',
          legacyDecision: legacyDecision({}),
          rawAiPlan: 'invalid outputa',
        },
      ],
    });

    expect(snapshot.statusCounts).toEqual({ pass: 1, hold: 1, block: 1 });
    expect(snapshot.score.criteriaPassed).toBe(false);
    expect(snapshot.recommendation.readiness).toBe('not-ready');
    expect(snapshot.recommendation.action).toBe('investigate-blocks');
    expect(snapshot.score.failedCriteria).toEqual(expect.arrayContaining([
      expect.stringContaining('minPassRate'),
      expect.stringContaining('maxBlockRate'),
    ]));
  });

  it('groups family and mismatch aggregates', () => {
    const service = createService();
    const snapshot = service.recordBatch({
      batchName: 'aggregate-batch',
      criteria: { minSamples: 3 },
      samples: [
        conversationSample('conversation-sample', 'Oi.'),
        {
          sampleId: 'configuration-sample',
          surface: 'web',
          userMessage: 'Configure my account.',
          legacyDecision: legacyDecision({}),
          rawAiPlan: {
            intent: { primary: 'configuration', confidence: 0.9 },
            proposedActions: [
              {
                kind: 'configure',
                summary: 'Salvar configuraction depois de preview.',
                requestedToolIds: ['secure-storage.write'],
              },
            ],
          },
        },
        {
          sampleId: 'invalid-sample',
          surface: 'web',
          userMessage: 'oi',
          legacyDecision: legacyDecision({}),
          rawAiPlan: 'invalid outputa',
        },
      ],
    });

    expect(snapshot.familyAggregates.map((entry) => entry.familyId)).toEqual(expect.arrayContaining([
      'conversation',
      'configuration',
    ]));
    expect(snapshot.mismatchAggregates.map((entry) => entry.kind)).toEqual(expect.arrayContaining([
      'shadow-high-divergence',
      'plan-invalid',
    ]));
  });

  it('requires enough samples before candidate readiness', () => {
    const service = createService();
    const snapshot = service.recordBatch({
      batchName: 'too-small',
      criteria: {
        minSamples: 3,
        minPassRate: 1,
      },
      samples: [conversationSample('single', 'Oi.')],
    });

    expect(snapshot.score.criteriaPassed).toBe(false);
    expect(snapshot.recommendation.readiness).toBe('needs-more-samples');
    expect(snapshot.recommendation.action).toBe('collect-more-samples');
    expect(snapshot.score.failedCriteria).toEqual(expect.arrayContaining([
      expect.stringContaining('minSamples'),
    ]));
  });

  it('redacts secrets in the batch snapshot', () => {
    const service = createService();
    const snapshot = service.recordBatch({
      batchName: 'secret-batch token: redacted-slack-token-placeholder',
      criteria: { minSamples: 1 },
      samples: [
        {
          sampleId: 'secret-sample',
          surface: 'web',
          userMessage: 'Configure using token: redacted-slack-token-placeholder.',
          legacyDecision: legacyDecision({}),
          rawAiPlan: {
            intent: { primary: 'configuration' },
            proposedActions: [
              {
                kind: 'configure',
                summary: 'Save token: redacted-slack-token-placeholder.',
                requestedToolIds: ['secure-storage.write'],
                payloadPreview: { token: 'redacted-slack-token-placeholder' },
              },
            ],
          },
        },
      ],
    });

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain('redacted-slack-token-placeholder');
    expect(snapshot.score.secretLeakDetected).toBe(false);
    expect(serialized).toContain('[redacted-secret]');
  });
});
