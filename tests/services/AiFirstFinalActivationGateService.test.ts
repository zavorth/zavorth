import type { AiFirstHistoricalReplayGateSnapshot } from '../../src/contracts/AiFirstHistoricalReplayGateContract.js';
import type { AiFirstLimitedCanarySwitchboardSnapshot } from '../../src/contracts/AiFirstLimitedCanarySwitchboardContract.js';
import type { AiFirstRuntimeEntrypointAdapterSnapshot } from '../../src/contracts/AiFirstRuntimeEntrypointAdapterContract.js';
import type { ZavorthResponseDecision } from '../../src/contracts/ZavorthResponseDecisionContract.js';
import { AiFirstFinalActivationGateService } from '../../src/services/AiFirstFinalActivationGateService.js';
import { AiFirstHistoricalReplayGateService } from '../../src/services/AiFirstHistoricalReplayGateService.js';
import { AiFirstLimitedCanarySwitchboardService } from '../../src/services/AiFirstLimitedCanarySwitchboardService.js';
import { AiFirstPromotionCandidateRegistryService } from '../../src/services/AiFirstPromotionCandidateRegistryService.js';
import { AiFirstRuntimeEntrypointAdapterService } from '../../src/services/AiFirstRuntimeEntrypointAdapterService.js';
import { AiFirstRuntimeReceiptLedgerService } from '../../src/services/AiFirstRuntimeReceiptLedgerService.js';
import {
  AiFirstShadowBatchRecorderService,
  type AiFirstShadowBatchRecorderSampleInput,
} from '../../src/services/AiFirstShadowBatchRecorderService.js';

function currentConversationDecision(surface = 'web'): ZavorthResponseDecision {
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
      surface,
      shouldExecute: false,
      semantic: false,
      universalIntent: null,
      trustSlider: null,
    },
  };
}

function conversationSample(sampleId: string, text: string): AiFirstShadowBatchRecorderSampleInput {
  return {
    sampleId,
    surface: 'web',
    userMessage: text,
    legacyDecision: currentConversationDecision('web'),
    rawAiPlan: {
      intent: {
        primary: 'conversation',
        confidence: 0.92,
      },
      proposedActions: [
        {
          kind: 'answer',
          summary: 'Responder em conversa.',
        },
      ],
    },
  };
}

function createCleanInputs(): Parameters<AiFirstFinalActivationGateService['buildGate']>[0] {
  const now = () => new Date('2026-05-06T23:30:00.000Z');
  let counter = 0;
  const idFactory = (prefix: string) => `${prefix}-${++counter}`;
  const batchService = new AiFirstShadowBatchRecorderService({ now, idFactory });
  const registryService = new AiFirstPromotionCandidateRegistryService({ now, idFactory });
  const switchboardService = new AiFirstLimitedCanarySwitchboardService({ now, idFactory });
  const adapterService = new AiFirstRuntimeEntrypointAdapterService({ now, idFactory });
  const ledgerService = new AiFirstRuntimeReceiptLedgerService({ now, idFactory });
  const historicalGateService = new AiFirstHistoricalReplayGateService({ now, idFactory });

  const batchSnapshot = batchService.recordBatch({
    batchName: 'clean-candidate',
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
  const registrySnapshot = registryService.buildRegistry({
    registryName: 'clean-registry',
    batchSnapshot,
    criteria: {
      minFamilySamples: 3,
      minFamilyPassRate: 1,
      eligibleRiskLevels: ['safe'],
    },
  });
  const switchboardSnapshot = switchboardService.buildSwitchboard({
    switchboardName: 'clean-switchboard',
    registrySnapshot,
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
        phase3GuardrailPassed: true,
        registryReceiptPresent: true,
      },
      {
        requestId: 'probe-cli',
        familyId: 'conversation',
        surface: 'cli',
        risk: 'safe',
        phase3GuardrailPassed: true,
        registryReceiptPresent: true,
      },
    ],
  });
  const adapterSnapshots: AiFirstRuntimeEntrypointAdapterSnapshot[] = [
    adapterService.adapt({
      requestId: 'probe-web',
      surface: 'web',
      userMessage: 'Oi.',
      currentDecision: currentConversationDecision('web'),
      switchboardSnapshot,
    }),
    adapterService.adapt({
      requestId: 'probe-cli',
      surface: 'cli',
      userMessage: 'Oi.',
      currentDecision: currentConversationDecision('cli'),
      switchboardSnapshot,
    }),
  ];
  const baselineLedger = ledgerService.buildLedger({
    ledgerName: 'baseline-ledger',
    adapterSnapshots,
  });
  const latestLedger = ledgerService.buildLedger({
    ledgerName: 'latest-ledger',
    adapterSnapshots,
  });
  const historicalGateSnapshot = historicalGateService.buildGate({
    gateName: 'historical-gate',
    ledgers: [baselineLedger, latestLedger],
  });

  return {
    activationName: 'clean-final-gate',
    batchSnapshot,
    registrySnapshot,
    switchboardSnapshot,
    ledgerSnapshot: latestLedger,
    historicalGateSnapshot,
  };
}

function createFinalService(): AiFirstFinalActivationGateService {
  let counter = 0;
  return new AiFirstFinalActivationGateService({
    now: () => new Date('2026-05-06T23:30:00.000Z'),
    idFactory: (prefix) => `${prefix}-${++counter}`,
  });
}

describe('AiFirstFinalActivationGateService', () => {
  it('returns ready for owner-controlled default when every phase is clean', () => {
    const service = createFinalService();
    const snapshot = service.buildGate(createCleanInputs());

    expect(snapshot.recommendation.readiness).toBe('ready-for-owner-controlled-default');
    expect(snapshot.recommendation.action).toBe('prepare-owner-controlled-default');
    expect(snapshot.findings).toEqual([]);
    expect(snapshot.aggregate.sampleCount).toBe(3);
    expect(snapshot.aggregate.canaryEnabledRoutes).toBe(1);
    expect(snapshot.aggregate.canarySelections).toBe(1);
    expect(snapshot.aggregate.latestCanaryRate).toBe(0.5);
    expect(snapshot.aggregate.ownerApprovalRequired).toBe(true);
    expect(snapshot.aggregate.automaticActivationAllowed).toBe(false);
    expect(snapshot.recommendation.defaultRuntimeChanged).toBe(false);
    expect(snapshot.recommendation.canExecuteNow).toBe(false);
    expect(snapshot.recommendation.promoteDefaultRuntime).toBe(false);
  });

  it('holds when the manual canary switchboard is not ready', () => {
    const service = createFinalService();
    const input = createCleanInputs();
    const switchboardSnapshot: AiFirstLimitedCanarySwitchboardSnapshot = {
      ...input.switchboardSnapshot,
      recommendation: {
        ...input.switchboardSnapshot.recommendation,
        readiness: 'manual-activation-needed',
        action: 'request-manual-activation',
      },
      summary: {
        ...input.switchboardSnapshot.summary,
        canaryEnabledRoutes: 0,
        aiFirstCanarySelections: 0,
      },
    };
    const snapshot = service.buildGate({
      ...input,
      switchboardSnapshot,
    });

    expect(snapshot.recommendation.readiness).toBe('hold');
    expect(snapshot.recommendation.action).toBe('continue-canary');
    expect(snapshot.findings.map((finding) => finding.kind)).toEqual(expect.arrayContaining([
      'switchboard-not-ready',
      'manual-canary-missing',
      'canary-selection-missing',
    ]));
  });

  it('blocks activation when the historical gate is no-go', () => {
    const service = createFinalService();
    const input = createCleanInputs();
    const historicalGateSnapshot: AiFirstHistoricalReplayGateSnapshot = {
      ...input.historicalGateSnapshot,
      findings: [
        {
          id: 'finding-regression',
          kind: 'canary-rate-regression',
          severity: 'high',
          detail: 'fixture regression',
        },
      ],
      recommendation: {
        ...input.historicalGateSnapshot.recommendation,
        status: 'no-go',
        action: 'investigate-regressions',
        reason: 'fixture no-go',
      },
    };
    const snapshot = service.buildGate({
      ...input,
      historicalGateSnapshot,
    });

    expect(snapshot.recommendation.readiness).toBe('blocked');
    expect(snapshot.recommendation.action).toBe('investigate-blockers');
    expect(snapshot.findings.map((finding) => finding.kind)).toContain('historical-gate-blocked');
  });

  it('rejects activation when a runtime invariant is violated', () => {
    const service = createFinalService();
    const input = createCleanInputs();
    const batchSnapshot = {
      ...input.batchSnapshot,
      recommendation: {
        ...input.batchSnapshot.recommendation,
        defaultRuntimeChanged: true,
      },
    } as typeof input.batchSnapshot;
    const snapshot = service.buildGate({
      ...input,
      batchSnapshot,
    });

    expect(snapshot.recommendation.readiness).toBe('blocked');
    expect(snapshot.recommendation.action).toBe('reject-activation');
    expect(snapshot.findings.map((finding) => finding.kind)).toContain('runtime-invariant-violation');
    expect(snapshot.gates.find((gate) => gate.id === 'phase-10-runtime-invariants-preserved')?.status).toBe('blocked');
  });

  it('holds for historical hold without pretending activation is ready', () => {
    const service = createFinalService();
    const input = createCleanInputs();
    const historicalGateSnapshot: AiFirstHistoricalReplayGateSnapshot = {
      ...input.historicalGateSnapshot,
      findings: [
        {
          id: 'finding-history',
          kind: 'insufficient-history',
          severity: 'medium',
          detail: 'fixture hold',
        },
      ],
      recommendation: {
        ...input.historicalGateSnapshot.recommendation,
        status: 'hold',
        action: 'collect-more-history',
        reason: 'fixture hold',
      },
    };
    const snapshot = service.buildGate({
      ...input,
      historicalGateSnapshot,
    });

    expect(snapshot.recommendation.readiness).toBe('hold');
    expect(snapshot.recommendation.action).toBe('collect-more-history');
    expect(snapshot.findings.map((finding) => finding.kind)).toContain('historical-gate-hold');
  });

  it('redacts secret-like activation metadata', () => {
    const service = createFinalService();
    const snapshot = service.buildGate({
      ...createCleanInputs(),
      activationName: 'phase10 sk-finalactivation123456',
    });
    const serialized = JSON.stringify(snapshot);

    expect(serialized).not.toContain('sk-finalactivation123456');
    expect(serialized).toContain('[redacted-secret]');
  });
});
