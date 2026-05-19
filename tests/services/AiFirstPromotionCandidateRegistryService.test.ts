import type { AiFirstShadowBatchRecorderSnapshot } from '../../src/contracts/AiFirstShadowBatchRecorderContract.js';
import type { ZavorthResponseDecision } from '../../src/contracts/ZavorthResponseDecisionContract.js';
import { AiFirstPromotionCandidateRegistryService } from '../../src/services/AiFirstPromotionCandidateRegistryService.js';
import {
  AiFirstShadowBatchRecorderService,
  type AiFirstShadowBatchRecorderSampleInput,
} from '../../src/services/AiFirstShadowBatchRecorderService.js';

function createRegistryService(): AiFirstPromotionCandidateRegistryService {
  let counter = 0;
  return new AiFirstPromotionCandidateRegistryService({
    now: () => new Date('2026-05-06T19:00:00.000Z'),
    idFactory: (prefix) => `${prefix}-${++counter}`,
  });
}

function createBatchService(): AiFirstShadowBatchRecorderService {
  let counter = 0;
  return new AiFirstShadowBatchRecorderService({
    now: () => new Date('2026-05-06T19:00:00.000Z'),
    idFactory: (prefix) => `batch-${prefix}-${++counter}`,
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

function conversationSample(sampleId: string, text: string): AiFirstShadowBatchRecorderSampleInput {
  return {
    sampleId,
    surface: 'web',
    userMessage: text,
    legacyDecision: legacyDecision({}),
    rawAiPlan: {
      intent: { primary: 'conversation', confidence: 0.9 },
      proposedActions: [{ kind: 'answer', summary: 'Responder em conversa.' }],
    },
  };
}

function cleanConversationBatch(): AiFirstShadowBatchRecorderSnapshot {
  return createBatchService().recordBatch({
    batchName: 'clean-conversation-batch',
    profile: 'promotion-candidate',
    criteria: {
      minSamples: 3,
      minPassRate: 1,
      maxBlockRate: 0,
      maxHighMismatchRate: 0,
      maxHighShadowDivergenceRate: 0,
    },
    samples: [
      conversationSample('conversation-a', 'Oi, me explique uma ideia.'),
      conversationSample('conversation-b', 'Me ajude a pensar num nome melhor.'),
      conversationSample('conversation-c', 'Resuma minha ideia em uma frase.'),
    ],
  });
}

describe('AiFirstPromotionCandidateRegistryService', () => {
  it('proposes a disabled allowlist for an eligible clean family', () => {
    const service = createRegistryService();
    const snapshot = service.buildRegistry({
      registryName: 'clean-registry',
      batchSnapshot: cleanConversationBatch(),
      criteria: {
        minFamilySamples: 3,
        minFamilyPassRate: 1,
        eligibleRiskLevels: ['safe'],
      },
    });

    expect(snapshot.recommendation.readiness).toBe('ready-for-manual-canary');
    expect(snapshot.recommendation.action).toBe('prepare-limited-promotion-plan');
    expect(snapshot.summary.eligibleFamilies).toBe(1);
    expect(snapshot.summary.proposedAllowlistEntries).toBe(1);
    expect(snapshot.candidates[0]).toEqual(expect.objectContaining({
      familyId: 'conversation',
      status: 'eligible',
    }));
    expect(snapshot.allowlist[0]).toEqual(expect.objectContaining({
      familyId: 'conversation',
      status: 'proposed',
      defaultEnabled: false,
      canExecuteNow: false,
      requiresManualActivation: true,
      requiresStage3Guardrail: true,
      requiresBatchReceipt: true,
    }));
    expect(snapshot.recommendation.activateAutomatically).toBe(false);
    expect(snapshot.recommendation.defaultRuntimeChanged).toBe(false);
  });

  it('withholds all allowlist entries when the batch is not a candidate', () => {
    const batch = createBatchService().recordBatch({
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
          userMessage: 'Configure minha conta.',
          legacyDecision: legacyDecision({}),
          rawAiPlan: {
            intent: { primary: 'configuration', confidence: 0.9 },
            proposedActions: [
              {
                kind: 'configure',
                summary: 'Salvar configuracao depois de preview.',
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
          rawAiPlan: 'saida invalida',
        },
      ],
    });
    const service = createRegistryService();
    const snapshot = service.buildRegistry({
      batchSnapshot: batch,
    });

    expect(snapshot.summary.proposedAllowlistEntries).toBe(0);
    expect(snapshot.allowlist.every((entry) => entry.status === 'withheld')).toBe(true);
    expect(snapshot.recommendation.readiness).toBe('blocked');
    expect(snapshot.recommendation.action).toBe('investigate-blocks');
  });

  it('keeps a candidate family on watch when family sample count is too low', () => {
    const batch = createBatchService().recordBatch({
      batchName: 'small-clean-batch',
      profile: 'promotion-candidate',
      criteria: {
        minSamples: 1,
        minPassRate: 1,
        maxBlockRate: 0,
        maxHighMismatchRate: 0,
        maxHighShadowDivergenceRate: 0,
      },
      samples: [conversationSample('conversation-single', 'Oi.')],
    });
    const service = createRegistryService();
    const snapshot = service.buildRegistry({
      batchSnapshot: batch,
      criteria: {
        minFamilySamples: 2,
        minFamilyPassRate: 1,
      },
    });

    expect(snapshot.candidates[0]).toEqual(expect.objectContaining({
      familyId: 'conversation',
      status: 'watch',
    }));
    expect(snapshot.summary.proposedAllowlistEntries).toBe(0);
    expect(snapshot.recommendation.readiness).toBe('continue-shadow');
    expect(snapshot.recommendation.action).toBe('collect-more-samples');
  });

  it('blocks a family that observes an unsupported risk level', () => {
    const batch: AiFirstShadowBatchRecorderSnapshot = {
      ...cleanConversationBatch(),
      familyAggregates: [
        {
          familyId: 'configuration',
          samples: 2,
          pass: 2,
          hold: 0,
          block: 0,
          passRate: 1,
          highMismatchSamples: 0,
          highShadowDivergenceSamples: 0,
        },
      ],
      samples: [
        {
          sampleId: 'config-a',
          guardrailId: 'guard-a',
          surface: 'web',
          status: 'pass',
          action: 'allow-shadow-sample',
          sampleEligibleForPromotion: true,
          aiIntent: 'configuration',
          aiRisk: 'attention',
          deterministicIntent: 'workspace_mutation',
          deterministicRisk: 'attention',
          shadowHighDivergences: 0,
          shadowMediumDivergences: 0,
          mismatchCount: 0,
          highMismatchCount: 0,
          mediumMismatchCount: 0,
          mismatchKinds: [],
          requestedTools: ['secure-storage.write'],
          canExecuteNow: false,
        },
        {
          sampleId: 'config-b',
          guardrailId: 'guard-b',
          surface: 'web',
          status: 'pass',
          action: 'allow-shadow-sample',
          sampleEligibleForPromotion: true,
          aiIntent: 'configuration',
          aiRisk: 'attention',
          deterministicIntent: 'workspace_mutation',
          deterministicRisk: 'attention',
          shadowHighDivergences: 0,
          shadowMediumDivergences: 0,
          mismatchCount: 0,
          highMismatchCount: 0,
          mediumMismatchCount: 0,
          mismatchKinds: [],
          requestedTools: ['secure-storage.write'],
          canExecuteNow: false,
        },
      ],
    };
    const service = createRegistryService();
    const snapshot = service.buildRegistry({
      batchSnapshot: batch,
      criteria: {
        minFamilySamples: 2,
        minFamilyPassRate: 1,
        eligibleRiskLevels: ['safe'],
      },
    });

    expect(snapshot.candidates[0]).toEqual(expect.objectContaining({
      familyId: 'configuration',
      status: 'blocked',
    }));
    expect(snapshot.allowlist[0]?.status).toBe('withheld');
    expect(snapshot.recommendation.action).toBe('investigate-blocks');
  });

  it('redacts registry names and never enables runtime automatically', () => {
    const service = createRegistryService();
    const snapshot = service.buildRegistry({
      registryName: 'registry token: xoxb-test-token-placeholder-123456',
      batchSnapshot: cleanConversationBatch(),
      criteria: {
        minFamilySamples: 3,
        minFamilyPassRate: 1,
      },
    });

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain('xoxb-test-token-placeholder-123456');
    expect(serialized).toContain('[redacted-secret]');
    expect(snapshot.recommendation.activateAutomatically).toBe(false);
    expect(snapshot.recommendation.canExecuteNow).toBe(false);
    expect(snapshot.recommendation.defaultRuntimeChanged).toBe(false);
    expect(snapshot.allowlist.every((entry) => entry.defaultEnabled === false)).toBe(true);
  });
});
