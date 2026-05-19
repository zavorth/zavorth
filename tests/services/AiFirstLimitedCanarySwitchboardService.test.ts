import type { AiFirstPromotionCandidateRegistrySnapshot } from '../../src/contracts/AiFirstPromotionCandidateRegistryContract.js';
import type { AiFirstShadowBatchRecorderSnapshot } from '../../src/contracts/AiFirstShadowBatchRecorderContract.js';
import type { ZavorthResponseDecision } from '../../src/contracts/ZavorthResponseDecisionContract.js';
import { AiFirstLimitedCanarySwitchboardService } from '../../src/services/AiFirstLimitedCanarySwitchboardService.js';
import { AiFirstPromotionCandidateRegistryService } from '../../src/services/AiFirstPromotionCandidateRegistryService.js';
import {
  AiFirstShadowBatchRecorderService,
  type AiFirstShadowBatchRecorderSampleInput,
} from '../../src/services/AiFirstShadowBatchRecorderService.js';

function createSwitchboardService(): AiFirstLimitedCanarySwitchboardService {
  let counter = 0;
  return new AiFirstLimitedCanarySwitchboardService({
    now: () => new Date('2026-05-06T20:00:00.000Z'),
    idFactory: (prefix) => `${prefix}-${++counter}`,
  });
}

function createBatchService(): AiFirstShadowBatchRecorderService {
  let counter = 0;
  return new AiFirstShadowBatchRecorderService({
    now: () => new Date('2026-05-06T20:00:00.000Z'),
    idFactory: (prefix) => `batch-${prefix}-${++counter}`,
  });
}

function createRegistryService(): AiFirstPromotionCandidateRegistryService {
  let counter = 0;
  return new AiFirstPromotionCandidateRegistryService({
    now: () => new Date('2026-05-06T20:00:00.000Z'),
    idFactory: (prefix) => `registry-${prefix}-${++counter}`,
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

function cleanRegistry(): AiFirstPromotionCandidateRegistrySnapshot {
  const batch = createBatchService().recordBatch({
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
  return createRegistryService().buildRegistry({
    registryName: 'clean-registry',
    batchSnapshot: batch,
    criteria: {
      minFamilySamples: 3,
      minFamilyPassRate: 1,
      eligibleRiskLevels: ['safe'],
    },
  });
}

function blockedRegistry(): AiFirstPromotionCandidateRegistrySnapshot {
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
  return createRegistryService().buildRegistry({
    batchSnapshot: batch,
  });
}

describe('AiFirstLimitedCanarySwitchboardService', () => {
  it('enables a proposed route only with manual canary activation', () => {
    const service = createSwitchboardService();
    const snapshot = service.buildSwitchboard({
      switchboardName: 'clean-switchboard',
      registrySnapshot: cleanRegistry(),
      manualActivations: [
        {
          activationId: 'conversation-web',
          routeKey: 'ai-first:conversation',
          surfaces: ['web'],
          enabled: true,
          approvedBy: 'owner',
          reason: 'Manual canary activation.',
        },
      ],
      routeProbes: [
        {
          requestId: 'probe-web',
          familyId: 'conversation',
          surface: 'web',
          risk: 'safe',
          approvalGateGuardrailPassed: true,
          registryReceiptPresent: true,
        },
      ],
    });

    expect(snapshot.routes[0]).toEqual(expect.objectContaining({
      routeKey: 'ai-first:conversation',
      status: 'canary-enabled',
      enabledSurfaces: ['web'],
      defaultEnabled: false,
      canExecuteNow: false,
    }));
    expect(snapshot.decisions[0]).toEqual(expect.objectContaining({
      decision: 'select-ai-first-canary',
      fallbackReason: null,
      fallbackAvailable: true,
      defaultRuntimeChanged: false,
      canExecuteNow: false,
    }));
    expect(snapshot.recommendation.readiness).toBe('canary-ready');
    expect(snapshot.recommendation.activateAutomatically).toBe(false);
  });

  it('falls back when manual activation is missing', () => {
    const service = createSwitchboardService();
    const snapshot = service.buildSwitchboard({
      registrySnapshot: cleanRegistry(),
      routeProbes: [
        {
          requestId: 'probe-web',
          familyId: 'conversation',
          surface: 'web',
          risk: 'safe',
          approvalGateGuardrailPassed: true,
          registryReceiptPresent: true,
        },
      ],
    });

    expect(snapshot.routes[0]?.status).toBe('manual-activation-required');
    expect(snapshot.decisions[0]).toEqual(expect.objectContaining({
      decision: 'fallback-current-runtime',
      fallbackReason: 'manual-activation-missing',
    }));
    expect(snapshot.recommendation.action).toBe('request-manual-activation');
  });

  it('falls back when surface, risk, guardrail or receipt do not match', () => {
    const service = createSwitchboardService();
    const snapshot = service.buildSwitchboard({
      registrySnapshot: cleanRegistry(),
      manualActivations: [
        {
          activationId: 'conversation-web',
          routeKey: 'ai-first:conversation',
          surfaces: ['web'],
          enabled: true,
          approvedBy: 'owner',
        },
      ],
      routeProbes: [
        {
          requestId: 'surface-miss',
          familyId: 'conversation',
          surface: 'cli',
          risk: 'safe',
          approvalGateGuardrailPassed: true,
          registryReceiptPresent: true,
        },
        {
          requestId: 'risk-miss',
          familyId: 'conversation',
          surface: 'web',
          risk: 'attention',
          approvalGateGuardrailPassed: true,
          registryReceiptPresent: true,
        },
        {
          requestId: 'guardrail-miss',
          familyId: 'conversation',
          surface: 'web',
          risk: 'safe',
          approvalGateGuardrailPassed: false,
          registryReceiptPresent: true,
        },
        {
          requestId: 'receipt-miss',
          familyId: 'conversation',
          surface: 'web',
          risk: 'safe',
          approvalGateGuardrailPassed: true,
          registryReceiptPresent: false,
        },
      ],
    });

    expect(snapshot.decisions.map((decision) => decision.fallbackReason)).toEqual([
      'surface-not-enabled',
      'risk-not-allowed',
      'approval-gate-guardrail-missing',
      'registry-receipt-missing',
    ]);
    expect(snapshot.summary.fallbackSelections).toBe(4);
  });

  it('does not enable withheld registry allowlist entries', () => {
    const service = createSwitchboardService();
    const snapshot = service.buildSwitchboard({
      registrySnapshot: blockedRegistry(),
      manualActivations: [
        {
          routeKey: 'ai-first:conversation',
          surfaces: ['web'],
          enabled: true,
          approvedBy: 'owner',
        },
      ],
      routeProbes: [
        {
          requestId: 'probe-web',
          familyId: 'conversation',
          surface: 'web',
          risk: 'safe',
          approvalGateGuardrailPassed: true,
          registryReceiptPresent: true,
        },
      ],
    });

    expect(snapshot.routes.every((route) => route.status !== 'canary-enabled')).toBe(true);
    expect(snapshot.decisions[0]).toEqual(expect.objectContaining({
      decision: 'fallback-current-runtime',
    }));
    expect(snapshot.recommendation.readiness).toBe('no-eligible-routes');
    expect(snapshot.recommendation.defaultRuntimeChanged).toBe(false);
  });

  it('redacts activation metadata and never activates automatically', () => {
    const service = createSwitchboardService();
    const snapshot = service.buildSwitchboard({
      switchboardName: 'switchboard token: xoxb-test-token-placeholder-123456',
      registrySnapshot: cleanRegistry(),
      manualActivations: [
        {
          activationId: 'secret-activation',
          routeKey: 'ai-first:conversation',
          surfaces: ['web'],
          enabled: true,
          approvedBy: 'owner',
          reason: 'Use token: xoxb-test-token-placeholder-123456.',
        },
      ],
    });

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain('xoxb-test-token-placeholder-123456');
    expect(serialized).toContain('[redacted-secret]');
    expect(snapshot.recommendation.activateAutomatically).toBe(false);
    expect(snapshot.recommendation.defaultRuntimeChanged).toBe(false);
    expect(snapshot.routes.every((route) => route.defaultEnabled === false && route.canExecuteNow === false)).toBe(true);
  });
});
