import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AiFirstPromotionCandidateRegistrySnapshot } from '../../src/contracts/AiFirstPromotionCandidateRegistryContract.js';
import type { AiFirstLimitedCanarySwitchboardSnapshot } from '../../src/contracts/AiFirstLimitedCanarySwitchboardContract.js';
import type { AiFirstRuntimeEntrypointAdapterSnapshot } from '../../src/contracts/AiFirstRuntimeEntrypointAdapterContract.js';
import type { ZavorthResponseDecision } from '../../src/contracts/ZavorthResponseDecisionContract.js';
import { AiFirstLimitedCanarySwitchboardService } from '../../src/services/AiFirstLimitedCanarySwitchboardService.js';
import { AiFirstPromotionCandidateRegistryService } from '../../src/services/AiFirstPromotionCandidateRegistryService.js';
import { AiFirstRuntimeEntrypointAdapterService } from '../../src/services/AiFirstRuntimeEntrypointAdapterService.js';
import { AiFirstRuntimeReceiptLedgerService } from '../../src/services/AiFirstRuntimeReceiptLedgerService.js';
import {
  AiFirstShadowBatchRecorderService,
  type AiFirstShadowBatchRecorderSampleInput,
} from '../../src/services/AiFirstShadowBatchRecorderService.js';

function createLedgerService(): AiFirstRuntimeReceiptLedgerService {
  let counter = 0;
  return new AiFirstRuntimeReceiptLedgerService({
    now: () => new Date('2026-05-06T22:00:00.000Z'),
    idFactory: (prefix) => `${prefix}-${++counter}`,
  });
}

function currentDecision(surface = 'web', input: Partial<ZavorthResponseDecision> = {}): ZavorthResponseDecision {
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
    ...input,
  };
}

function conversationSample(sampleId: string, text: string): AiFirstShadowBatchRecorderSampleInput {
  return {
    sampleId,
    surface: 'web',
    userMessage: text,
    legacyDecision: currentDecision('web'),
    rawAiPlan: {
      intent: { primary: 'conversation', confidence: 0.9 },
      proposedActions: [{ kind: 'answer', summary: 'Respond in conversation.' }],
    },
  };
}

function cleanRegistry(): AiFirstPromotionCandidateRegistrySnapshot {
  let batchCounter = 0;
  const batch = new AiFirstShadowBatchRecorderService({
    now: () => new Date('2026-05-06T22:00:00.000Z'),
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
      conversationSample('conversation-c', 'Summarize my idea in one sentence.'),
    ],
  });
  let registryCounter = 0;
  return new AiFirstPromotionCandidateRegistryService({
    now: () => new Date('2026-05-06T22:00:00.000Z'),
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
    now: () => new Date('2026-05-06T22:00:00.000Z'),
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

function adapterSnapshots(): AiFirstRuntimeEntrypointAdapterSnapshot[] {
  let adapterCounter = 0;
  const service = new AiFirstRuntimeEntrypointAdapterService({
    now: () => new Date('2026-05-06T22:00:00.000Z'),
    idFactory: (prefix) => `adapter-${prefix}-${++adapterCounter}`,
  });
  const switchboard = switchboardWithProbes();
  return [
    service.adapt({
      requestId: 'probe-web',
      surface: 'web',
      userMessage: 'Oi.',
      currentDecision: currentDecision('web'),
      switchboardSnapshot: switchboard,
    }),
    service.adapt({
      requestId: 'probe-cli',
      surface: 'cli',
      userMessage: 'Oi.',
      currentDecision: currentDecision('cli'),
      switchboardSnapshot: switchboard,
    }),
  ];
}

describe('AiFirstRuntimeReceiptLedgerService', () => {
  it('builds a replayable ledger from Surface controls adapter snapshots', () => {
    const service = createLedgerService();
    const snapshot = service.buildLedger({
      ledgerName: 'checkpoint-8-ledger',
      adapterSnapshots: adapterSnapshots(),
    });

    expect(snapshot.summary.totalEntries).toBe(2);
    expect(snapshot.summary.canarySelected).toBe(1);
    expect(snapshot.summary.currentRuntimeSelected).toBe(1);
    expect(snapshot.summary.fallbackCurrentRuntime).toBe(1);
    expect(snapshot.replayIndex.map((entry) => entry.requestId)).toEqual(['probe-cli', 'probe-web']);
    expect(snapshot.fallbackReasons).toEqual([
      expect.objectContaining({ reason: 'surface-not-enabled', count: 1 }),
    ]);
    expect(snapshot.recommendation.readiness).toBe('ledger-clean');
    expect(snapshot.recommendation.canExecuteNow).toBe(false);
    expect(snapshot.recommendation.defaultRuntimeChanged).toBe(false);
  });

  it('groups repeated request ids in the replay index', () => {
    const service = createLedgerService();
    const [first] = adapterSnapshots();
    const second = {
      ...first!,
      adapterId: 'adapter-repeat',
      effective: {
        ...first!.effective,
        selectedPath: 'current-runtime' as const,
        status: 'fallback-current-runtime' as const,
        canarySelected: false,
      },
      canary: {
        ...first!.canary,
        decision: 'fallback-current-runtime' as const,
        fallbackReason: 'canary-not-selected' as const,
      },
    };
    const snapshot = service.buildLedger({
      adapterSnapshots: [first!, second],
    });

    expect(snapshot.replayIndex).toHaveLength(1);
    expect(snapshot.replayIndex[0]).toEqual(expect.objectContaining({
      requestId: 'probe-web',
      entryIds: expect.any(Array),
      selectedPaths: ['ai-first-canary', 'current-runtime'],
      lastSelectedPath: 'current-runtime',
    }));
    expect(snapshot.replayIndex[0]!.entryIds).toHaveLength(2);
  });

  it('persists JSONL receipts when a controlled file path is supplied', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-controls-'));
    const filePath = path.join(tempDir, 'ledger.jsonl');
    try {
      const service = createLedgerService();
      const snapshot = service.buildLedger({
        adapterSnapshots: adapterSnapshots(),
        persistence: {
          enabled: true,
          filePath,
        },
      });

      expect(snapshot.persistence).toEqual(expect.objectContaining({
        mode: 'jsonl-file',
        attempted: true,
        succeeded: true,
        targetPath: path.resolve(filePath),
        entriesWritten: 2,
      }));
      const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]!)).toEqual(expect.objectContaining({
        requestId: expect.any(String),
        invariants: expect.objectContaining({ canExecuteNow: false }),
      }));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('reports persistence errors for non-jsonl targets without throwing', () => {
    const service = createLedgerService();
    const snapshot = service.buildLedger({
      adapterSnapshots: adapterSnapshots(),
      persistence: {
        enabled: true,
        filePath: path.join(os.tmpdir(), 'ledger.txt'),
      },
    });

    expect(snapshot.persistence).toEqual(expect.objectContaining({
      mode: 'jsonl-file',
      attempted: true,
      succeeded: false,
      entriesWritten: 0,
    }));
    expect(snapshot.persistence.error).toContain('.jsonl');
  });

  it('detects source invariant violations from tampered adapter snapshots', () => {
    const service = createLedgerService();
    const [first] = adapterSnapshots();
    const tampered = {
      ...first!,
      effective: {
        ...first!.effective,
        canExecuteNow: true as false,
      },
    };
    const snapshot = service.buildLedger({
      adapterSnapshots: [tampered],
    });

    expect(snapshot.invariants.allCanExecuteNowFalse).toBe(false);
    expect(snapshot.invariants.sourceViolations).toEqual(expect.arrayContaining([
      'probe-web:canExecuteNow',
    ]));
    expect(snapshot.recommendation.readiness).toBe('review-source-violations');
    expect(snapshot.recommendation.action).toBe('review-ledger');
  });

  it('redacts ledger metadata and keeps JSONL emission secret-safe', () => {
    const service = createLedgerService();
    const snapshot = service.buildLedger({
      ledgerName: 'ledger token: redacted-slack-token-placeholder',
      adapterSnapshots: adapterSnapshots(),
    });
    const serialized = JSON.stringify(snapshot);
    const jsonl = service.toJsonl(snapshot);

    expect(serialized).not.toContain('redacted-slack-token-placeholder');
    expect(serialized).toContain('[redacted-secret]');
    expect(jsonl).not.toContain('redacted-slack-token-placeholder');
    expect(snapshot.summary.secretLeakDetected).toBe(false);
  });
});
