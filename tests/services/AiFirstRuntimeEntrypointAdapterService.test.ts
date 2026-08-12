import type { AiFirstPromotionCandidateRegistrySnapshot } from '../../src/contracts/AiFirstPromotionCandidateRegistryContract.js';
import type { AiFirstLimitedCanarySwitchboardSnapshot } from '../../src/contracts/AiFirstLimitedCanarySwitchboardContract.js';
import type { ZavorthResponseDecision } from '../../src/contracts/ZavorthResponseDecisionContract.js';
import { AiFirstLimitedCanarySwitchboardService } from '../../src/services/AiFirstLimitedCanarySwitchboardService.js';
import { AiFirstPromotionCandidateRegistryService } from '../../src/services/AiFirstPromotionCandidateRegistryService.js';
import { AiFirstRuntimeEntrypointAdapterService } from '../../src/services/AiFirstRuntimeEntrypointAdapterService.js';
import {
  AiFirstShadowBatchRecorderService,
  type AiFirstShadowBatchRecorderSampleInput,
} from '../../src/services/AiFirstShadowBatchRecorderService.js';

function createAdapterService(): AiFirstRuntimeEntrypointAdapterService {
  let counter = 0;
  return new AiFirstRuntimeEntrypointAdapterService({
    now: () => new Date('2026-05-06T21:00:00.000Z'),
    idFactory: (prefix) => `${prefix}-${++counter}`,
  });
}

function currentDecision(input: Partial<ZavorthResponseDecision> = {}): ZavorthResponseDecision {
  return {
    schemaVersion: 1,
    mode: 'conversation',
    confidence: 'high',
    reason: 'Respond as normal chat; do not wake the agent runtime.',
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
    legacyDecision: currentDecision(),
    rawAiPlan: {
      intent: { primary: 'conversation', confidence: 0.9 },
      proposedActions: [{ kind: 'answer', summary: 'Responder em conversa.' }],
    },
  };
}

function cleanRegistry(): AiFirstPromotionCandidateRegistrySnapshot {
  let batchCounter = 0;
  const batch = new AiFirstShadowBatchRecorderService({
    now: () => new Date('2026-05-06T21:00:00.000Z'),
    idFactory: (prefix) => `batch-${prefix}-${++batchCounter}`,
  }).recordBatch({
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
  let registryCounter = 0;
  return new AiFirstPromotionCandidateRegistryService({
    now: () => new Date('2026-05-06T21:00:00.000Z'),
    idFactory: (prefix) => `registry-${prefix}-${++registryCounter}`,
  }).buildRegistry({
    registryName: 'clean-registry',
    batchSnapshot: batch,
    criteria: {
      minFamilySamples: 3,
      minFamilyPassRate: 1,
      eligibleRiskLevels: ['safe'],
    },
  });
}

function switchboardWithProbes(): AiFirstLimitedCanarySwitchboardSnapshot {
  let switchCounter = 0;
  return new AiFirstLimitedCanarySwitchboardService({
    now: () => new Date('2026-05-06T21:00:00.000Z'),
    idFactory: (prefix) => `switch-${prefix}-${++switchCounter}`,
  }).buildSwitchboard({
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
        requestId: 'probe-web',
        familyId: 'conversation',
        surface: 'web',
        risk: 'safe',
        approvalGateGuardrailPassed: true,
        registryReceiptPresent: true,
      },
      {
        requestId: 'probe-cli',
        familyId: 'conversation',
        surface: 'cli',
        risk: 'safe',
        approvalGateGuardrailPassed: true,
        registryReceiptPresent: true,
      },
    ],
  });
}

describe('AiFirstRuntimeEntrypointAdapterService', () => {
  it('selects AI-first canary only when Runtime gateway authorized it', () => {
    const service = createAdapterService();
    const snapshot = service.adapt({
      adapterName: 'adapter',
      requestId: 'probe-web',
      surface: 'web',
      userMessage: 'Oi.',
      currentDecision: currentDecision(),
      switchboardSnapshot: switchboardWithProbes(),
    });

    expect(snapshot.effective.status).toBe('canary-selected');
    expect(snapshot.effective.selectedPath).toBe('ai-first-canary');
    expect(snapshot.effective.canarySelected).toBe(true);
    expect(snapshot.currentRuntime.retainedAsFallback).toBe(true);
    expect(snapshot.sideBySide.currentRuntimeWouldHandle).toBe(true);
    expect(snapshot.sideBySide.selectedDecisionRecordedBesideCurrent).toBe(true);
    expect(snapshot.effective.canExecuteNow).toBe(false);
    expect(snapshot.effective.defaultRuntimeChanged).toBe(false);
  });

  it('falls back to current runtime when the switchboard decision falls back', () => {
    const service = createAdapterService();
    const snapshot = service.adapt({
      requestId: 'probe-cli',
      surface: 'cli',
      userMessage: 'Oi.',
      currentDecision: currentDecision(),
      switchboardSnapshot: switchboardWithProbes(),
    });

    expect(snapshot.effective.status).toBe('fallback-current-runtime');
    expect(snapshot.effective.selectedPath).toBe('current-runtime');
    expect(snapshot.canary.fallbackReason).toBe('surface-not-enabled');
    expect(snapshot.effective.fallbackAvailable).toBe(true);
  });

  it('uses current-runtime-only when no switchboard decision exists', () => {
    const service = createAdapterService();
    const snapshot = service.adapt({
      requestId: 'missing-switchboard',
      surface: 'web',
      userMessage: 'Oi.',
      currentDecision: currentDecision(),
    });

    expect(snapshot.canary.decision).toBe('unavailable');
    expect(snapshot.canary.fallbackReason).toBe('switchboard-missing');
    expect(snapshot.effective.status).toBe('current-runtime-only');
    expect(snapshot.effective.selectedPath).toBe('current-runtime');
  });

  it('preserves the exact current runtime decision summary beside the canary choice', () => {
    const service = createAdapterService();
    const decision = currentDecision({
      mode: 'operation',
      responsePath: 'agent-runtime',
      requestedTools: ['read_file'],
      diagnostics: {
        surface: 'web',
        shouldExecute: true,
        semantic: true,
        universalIntent: {
          intent: 'inspection',
          risk: 'safe',
          nextSafeAction: 'execute_governed',
          requiresClarification: false,
          requiresPermission: false,
        },
        trustSlider: null,
      },
    });
    const snapshot = service.adapt({
      requestId: 'probe-web',
      surface: 'web',
      userMessage: 'Leia um arquivo.',
      currentDecision: decision,
      switchboardSnapshot: switchboardWithProbes(),
    });

    expect(snapshot.currentRuntime).toEqual(expect.objectContaining({
      mode: 'operation',
      responsePath: 'agent-runtime',
      shouldExecute: true,
      requestedTools: ['read_file'],
      diagnosticRisk: 'safe',
      diagnosticNextSafeAction: 'execute_governed',
      retainedAsFallback: true,
    }));
  });

  it('redacts input text and never authorizes execution', () => {
    const service = createAdapterService();
    const snapshot = service.adapt({
      adapterName: 'adapter token: xoxb-test-token-placeholder-123456',
      requestId: 'probe-web',
      surface: 'web',
      userMessage: 'Use token: xoxb-test-token-placeholder-123456.',
      currentDecision: currentDecision({
        reason: 'Use token: xoxb-test-token-placeholder-123456.',
      }),
      switchboardSnapshot: switchboardWithProbes(),
    });

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain('xoxb-test-token-placeholder-123456');
    expect(serialized).toContain('[redacted-secret]');
    expect(snapshot.effective.adapterOnly).toBe(true);
    expect(snapshot.effective.canExecuteNow).toBe(false);
    expect(snapshot.effective.keepCurrentRuntimeDecision).toBe(true);
  });
});
