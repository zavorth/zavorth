import {
  AI_FIRST_RUNTIME_RECEIPT_LEDGER_CONTRACT_VERSION,
  type AiFirstRuntimeReceiptLedgerEntry,
  type AiFirstRuntimeReceiptLedgerSnapshot,
} from '../../src/contracts/AiFirstRuntimeReceiptLedgerContract.js';
import type {
  AiFirstRuntimeEntrypointFallbackReason,
  AiFirstRuntimeEntrypointSelectedPath,
  AiFirstRuntimeEntrypointStatus,
} from '../../src/contracts/AiFirstRuntimeEntrypointAdapterContract.js';
import { AiFirstHistoricalReplayGateService } from '../../src/services/AiFirstHistoricalReplayGateService.js';

type EntrySpec = {
  requestId: string;
  selectedPath: AiFirstRuntimeEntrypointSelectedPath;
  fallbackReason?: AiFirstRuntimeEntrypointFallbackReason | null;
};

function createGateService(): AiFirstHistoricalReplayGateService {
  let counter = 0;
  return new AiFirstHistoricalReplayGateService({
    now: () => new Date('2026-05-06T23:00:00.000Z'),
    idFactory: (prefix) => `${prefix}-${++counter}`,
  });
}

function entry(spec: EntrySpec, index: number): AiFirstRuntimeReceiptLedgerEntry {
  const canarySelected = spec.selectedPath === 'ai-first-canary';
  const status: AiFirstRuntimeEntrypointStatus = canarySelected
    ? 'canary-selected'
    : 'fallback-current-runtime';
  const fallbackReason = canarySelected ? null : spec.fallbackReason || 'surface-not-enabled';
  return {
    entryId: `entry-${index + 1}`,
    adapterId: `adapter-${index + 1}`,
    requestId: spec.requestId,
    surface: index % 2 === 0 ? 'web' : 'cli',
    generatedAt: '2026-05-06T23:00:00.000Z',
    selectedPath: spec.selectedPath,
    status,
    canarySelected,
    currentRuntime: {
      mode: 'conversation',
      responsePath: 'fast-chat',
      shouldExecute: false,
      requestedTools: [],
      retainedAsFallback: true,
    },
    canary: {
      switchboardId: 'switchboard-test',
      decision: canarySelected ? 'select-ai-first-canary' : 'fallback-current-runtime',
      matchedRouteKey: 'ai-first:conversation',
      fallbackReason,
    },
    replay: {
      replayKey: spec.requestId,
      comparisonKey: `${spec.requestId}:${spec.selectedPath}:${fallbackReason || 'none'}`,
      selectedDecisionRecordedBesideCurrent: true,
    },
    invariants: {
      fallbackAvailable: true,
      defaultRuntimeChanged: false,
      keepCurrentRuntimeDecision: true,
      adapterOnly: true,
      canExecuteNow: false,
    },
  };
}

function ledger(
  ledgerId: string,
  specs: EntrySpec[],
  options: {
    ledgerName?: string;
    sourceViolations?: string[];
    secretLeakDetected?: boolean;
  } = {},
): AiFirstRuntimeReceiptLedgerSnapshot {
  const entries = specs.map((spec, index) => entry(spec, index));
  const fallbackReasons = buildFallbackReasons(entries);
  const totalEntries = entries.length;
  const canarySelected = entries.filter((item) => item.selectedPath === 'ai-first-canary').length;
  const currentRuntimeSelected = entries.filter((item) => item.selectedPath === 'current-runtime').length;
  return {
    contractVersion: AI_FIRST_RUNTIME_RECEIPT_LEDGER_CONTRACT_VERSION,
    source: 'ai-first-runtime-receipt-ledger',
    generatedAt: '2026-05-06T23:00:00.000Z',
    ledgerId,
    input: {
      ledgerName: options.ledgerName || ledgerId,
      adapterSnapshotCount: entries.length,
    },
    entries,
    replayIndex: entries.map((item) => ({
      requestId: item.requestId,
      entryIds: [item.entryId],
      selectedPaths: [item.selectedPath],
      lastSelectedPath: item.selectedPath,
    })),
    comparisonIndex: entries.map((item) => ({
      comparisonKey: item.replay.comparisonKey,
      entries: 1,
      canarySelections: item.selectedPath === 'ai-first-canary' ? 1 : 0,
      fallbackSelections: item.selectedPath === 'current-runtime' ? 1 : 0,
    })),
    summary: {
      totalEntries,
      canarySelected,
      currentRuntimeSelected,
      fallbackCurrentRuntime: currentRuntimeSelected,
      currentRuntimeOnly: 0,
      secretLeakDetected: options.secretLeakDetected === true,
    },
    fallbackReasons,
    invariants: {
      allFallbackAvailable: true,
      allDefaultRuntimePreserved: true,
      allCurrentRuntimeRetained: true,
      allAdapterOnly: true,
      allCanExecuteNowFalse: (options.sourceViolations || []).length === 0,
      sourceViolations: options.sourceViolations || [],
    },
    persistence: {
      mode: 'memory-only',
      attempted: false,
      succeeded: true,
      targetPath: null,
      append: false,
      entriesWritten: 0,
      error: null,
    },
    recommendation: {
      readiness: (options.sourceViolations || []).length > 0 ? 'review-source-violations' : 'ledger-clean',
      action: (options.sourceViolations || []).length > 0 ? 'review-ledger' : 'ready-for-replay',
      reason: 'fixture',
      defaultRuntimeChanged: false,
      keepCurrentRuntimeDecision: true,
      canExecuteNow: false,
    },
    receipts: [],
    gates: [],
  };
}

function buildFallbackReasons(
  entries: AiFirstRuntimeReceiptLedgerEntry[],
): AiFirstRuntimeReceiptLedgerSnapshot['fallbackReasons'] {
  const counts = new Map<AiFirstRuntimeEntrypointFallbackReason, number>();
  for (const item of entries) {
    if (!item.canary.fallbackReason) {
      continue;
    }
    counts.set(item.canary.fallbackReason, (counts.get(item.canary.fallbackReason) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([reason, count]) => ({ reason, count }));
}

describe('AiFirstHistoricalReplayGateService', () => {
  it('returns go for stable clean historical ledgers', () => {
    const service = createGateService();
    const snapshot = service.buildGate({
      gateName: 'stable-history',
      ledgers: [
        ledger('baseline', [
          { requestId: 'request-web', selectedPath: 'ai-first-canary' },
          { requestId: 'request-cli', selectedPath: 'current-runtime', fallbackReason: 'surface-not-enabled' },
        ]),
        ledger('latest', [
          { requestId: 'request-web', selectedPath: 'ai-first-canary' },
          { requestId: 'request-cli', selectedPath: 'current-runtime', fallbackReason: 'surface-not-enabled' },
        ]),
      ],
    });

    expect(snapshot.recommendation.status).toBe('go');
    expect(snapshot.recommendation.action).toBe('prepare-broader-canary');
    expect(snapshot.findings).toEqual([]);
    expect(snapshot.aggregate.latestCanaryRate).toBe(0.5);
    expect(snapshot.aggregate.latestFallbackRate).toBe(0.5);
    expect(snapshot.recommendation.defaultRuntimeChanged).toBe(false);
    expect(snapshot.recommendation.canExecuteNow).toBe(false);
    expect(snapshot.recommendation.promoteDefaultRuntime).toBe(false);
  });

  it('holds when there is not enough history yet', () => {
    const service = createGateService();
    const snapshot = service.buildGate({
      ledgers: [
        ledger('single', [
          { requestId: 'request-web', selectedPath: 'ai-first-canary' },
          { requestId: 'request-cli', selectedPath: 'current-runtime', fallbackReason: 'surface-not-enabled' },
        ]),
      ],
    });

    expect(snapshot.recommendation.status).toBe('hold');
    expect(snapshot.recommendation.action).toBe('collect-more-history');
    expect(snapshot.findings.map((finding) => finding.kind)).toEqual(expect.arrayContaining([
      'insufficient-history',
      'insufficient-entries',
    ]));
  });

  it('blocks promotion when canary and fallback rates regress', () => {
    const service = createGateService();
    const snapshot = service.buildGate({
      ledgers: [
        ledger('baseline', [
          { requestId: 'request-a', selectedPath: 'ai-first-canary' },
          { requestId: 'request-b', selectedPath: 'ai-first-canary' },
          { requestId: 'request-c', selectedPath: 'ai-first-canary' },
          { requestId: 'request-d', selectedPath: 'ai-first-canary' },
        ]),
        ledger('latest', [
          { requestId: 'request-a', selectedPath: 'current-runtime', fallbackReason: 'canary-not-selected' },
          { requestId: 'request-b', selectedPath: 'current-runtime', fallbackReason: 'canary-not-selected' },
          { requestId: 'request-c', selectedPath: 'current-runtime', fallbackReason: 'canary-not-selected' },
          { requestId: 'request-d', selectedPath: 'current-runtime', fallbackReason: 'canary-not-selected' },
        ]),
      ],
    });

    expect(snapshot.recommendation.status).toBe('no-go');
    expect(snapshot.recommendation.action).toBe('investigate-regressions');
    expect(snapshot.aggregate.canaryRateDrop).toBe(1);
    expect(snapshot.aggregate.fallbackRateIncrease).toBe(1);
    expect(snapshot.findings.map((finding) => finding.kind)).toEqual(expect.arrayContaining([
      'canary-rate-regression',
      'fallback-rate-regression',
    ]));
  });

  it('rejects promotion on source invariant violations or secret-like historical input', () => {
    const service = createGateService();
    const snapshot = service.buildGate({
      gateName: 'secret sk-phase9secret123456',
      ledgers: [
        ledger('baseline', [
          { requestId: 'request-web', selectedPath: 'ai-first-canary' },
          { requestId: 'request-cli', selectedPath: 'current-runtime', fallbackReason: 'surface-not-enabled' },
        ]),
        ledger('latest', [
          { requestId: 'request-web', selectedPath: 'ai-first-canary' },
          { requestId: 'request-cli', selectedPath: 'current-runtime', fallbackReason: 'surface-not-enabled' },
        ], {
          ledgerName: 'latest sk-phase9secret123456',
          sourceViolations: ['request-web:canExecuteNow'],
        }),
      ],
    });

    expect(snapshot.recommendation.status).toBe('no-go');
    expect(snapshot.recommendation.action).toBe('reject-promotion');
    expect(snapshot.findings.map((finding) => finding.kind)).toEqual(expect.arrayContaining([
      'source-invariant-violation',
      'secret-leak',
    ]));
    expect(JSON.stringify(snapshot)).not.toContain('sk-phase9secret123456');
    expect(JSON.stringify(snapshot)).toContain('[redacted-secret]');
  });

  it('holds when the latest ledger introduces a new fallback reason', () => {
    const service = createGateService();
    const snapshot = service.buildGate({
      ledgers: [
        ledger('baseline', [
          { requestId: 'request-web', selectedPath: 'ai-first-canary' },
          { requestId: 'request-cli', selectedPath: 'current-runtime', fallbackReason: 'surface-not-enabled' },
        ]),
        ledger('latest', [
          { requestId: 'request-web', selectedPath: 'ai-first-canary' },
          { requestId: 'request-cli', selectedPath: 'current-runtime', fallbackReason: 'risk-not-allowed' },
        ]),
      ],
    });

    expect(snapshot.recommendation.status).toBe('hold');
    expect(snapshot.recommendation.action).toBe('investigate-regressions');
    expect(snapshot.aggregate.newFallbackReasonCount).toBe(1);
    expect(snapshot.findings.map((finding) => finding.kind)).toContain('new-fallback-reason');
  });

  it('can require stable replay selections without changing runtime behavior', () => {
    const service = createGateService();
    const snapshot = service.buildGate({
      ledgers: [
        ledger('baseline', [
          { requestId: 'request-a', selectedPath: 'ai-first-canary' },
          { requestId: 'request-b', selectedPath: 'current-runtime', fallbackReason: 'surface-not-enabled' },
        ]),
        ledger('latest', [
          { requestId: 'request-a', selectedPath: 'current-runtime', fallbackReason: 'surface-not-enabled' },
          { requestId: 'request-b', selectedPath: 'ai-first-canary' },
        ]),
      ],
      criteria: {
        requireStableReplaySelections: true,
      },
    });

    expect(snapshot.recommendation.status).toBe('hold');
    expect(snapshot.findings.map((finding) => finding.kind)).toContain('replay-selection-changed');
    expect(snapshot.replaySelectionChanges).toHaveLength(2);
    expect(snapshot.recommendation.defaultRuntimeChanged).toBe(false);
    expect(snapshot.recommendation.canExecuteNow).toBe(false);
  });
});
