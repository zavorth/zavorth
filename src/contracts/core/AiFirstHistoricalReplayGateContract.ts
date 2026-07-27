import type {
  AiFirstRuntimeEntrypointFallbackReason,
  AiFirstRuntimeEntrypointSelectedPath,
} from './AiFirstRuntimeEntrypointAdapterContract.js';

export const AI_FIRST_HISTORICAL_REPLAY_GATE_CONTRACT_VERSION = '2026-05-06.gate-9' as const;

export type AiFirstHistoricalReplayGateStatus = 'go' | 'hold' | 'no-go';

export type AiFirstHistoricalReplayGateAction =
  | 'prepare-broader-canary'
  | 'collect-more-history'
  | 'investigate-regressions'
  | 'reject-promotion';

export type AiFirstHistoricalReplayFindingSeverity =
  | 'info'
  | 'low'
  | 'medium'
  | 'high';

export type AiFirstHistoricalReplayFindingKind =
  | 'insufficient-history'
  | 'insufficient-entries'
  | 'empty-ledger'
  | 'low-canary-rate'
  | 'high-fallback-rate'
  | 'canary-rate-regression'
  | 'fallback-rate-regression'
  | 'new-fallback-reason'
  | 'replay-selection-changed'
  | 'source-invariant-violation'
  | 'secret-leak';

export type AiFirstHistoricalReplayCriteria = {
  minLedgers: number;
  minTotalEntries: number;
  minLatestCanaryRate: number;
  maxLatestFallbackRate: number;
  maxCanaryRateDrop: number;
  maxFallbackRateIncrease: number;
  requireNoInvariantViolations: boolean;
  requireNoSecretLeaks: boolean;
  requireNoNewFallbackReasons: boolean;
  requireStableReplaySelections: boolean;
};

export type AiFirstHistoricalReplayLedgerPoint = {
  index: number;
  ledgerId: string;
  ledgerName: string;
  generatedAt: string;
  totalEntries: number;
  canarySelected: number;
  currentRuntimeSelected: number;
  fallbackSelections: number;
  canaryRate: number;
  fallbackRate: number;
  fallbackReasons: Array<{
    reason: AiFirstRuntimeEntrypointFallbackReason;
    count: number;
  }>;
  sourceViolationCount: number;
  secretLeakDetected: boolean;
  readiness: string;
};

export type AiFirstHistoricalReplayFallbackTrend = {
  reason: AiFirstRuntimeEntrypointFallbackReason;
  firstCount: number;
  latestCount: number;
  delta: number;
  isNewInLatest: boolean;
};

export type AiFirstHistoricalReplaySelectionChange = {
  requestId: string;
  ledgerIds: string[];
  selectedPaths: AiFirstRuntimeEntrypointSelectedPath[];
  firstSelectedPath: AiFirstRuntimeEntrypointSelectedPath;
  latestSelectedPath: AiFirstRuntimeEntrypointSelectedPath;
  becameFallbackInLatest: boolean;
};

export type AiFirstHistoricalReplayFinding = {
  id: string;
  kind: AiFirstHistoricalReplayFindingKind;
  severity: AiFirstHistoricalReplayFindingSeverity;
  detail: string;
};

export type AiFirstHistoricalReplayGateSnapshot = {
  contractVersion: typeof AI_FIRST_HISTORICAL_REPLAY_GATE_CONTRACT_VERSION;
  source: 'ai-first-historical-replay-gate';
  generatedAt: string;
  gateId: string;
  input: {
    gateName: string;
    ledgerCount: number;
    totalEntries: number;
  };
  criteria: AiFirstHistoricalReplayCriteria;
  history: AiFirstHistoricalReplayLedgerPoint[];
  fallbackTrends: AiFirstHistoricalReplayFallbackTrend[];
  replaySelectionChanges: AiFirstHistoricalReplaySelectionChange[];
  aggregate: {
    totalLedgers: number;
    totalEntries: number;
    baselineLedgerId: string | null;
    latestLedgerId: string | null;
    baselineCanaryRate: number;
    latestCanaryRate: number;
    canaryRateDrop: number;
    baselineFallbackRate: number;
    latestFallbackRate: number;
    fallbackRateIncrease: number;
    newFallbackReasonCount: number;
    replaySelectionChangeCount: number;
    emptyLedgerCount: number;
    sourceViolationCount: number;
    secretLeakDetected: boolean;
  };
  findings: AiFirstHistoricalReplayFinding[];
  recommendation: {
    status: AiFirstHistoricalReplayGateStatus;
    action: AiFirstHistoricalReplayGateAction;
    reason: string;
    defaultRuntimeChanged: false;
    keepCurrentRuntimeDecision: true;
    canExecuteNow: false;
    promoteDefaultRuntime: false;
  };
  receipts: Array<{
    id: string;
    kind: 'history' | 'fallback-trend' | 'replay-change' | 'gate' | 'no-runtime-change';
    detail: string;
  }>;
  gates: Array<{
    id: string;
    status: 'passed' | 'warning' | 'blocked';
    detail: string;
  }>;
};
