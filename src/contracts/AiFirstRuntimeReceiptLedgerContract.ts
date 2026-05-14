import type {
  AiFirstRuntimeEntrypointFallbackReason,
  AiFirstRuntimeEntrypointSelectedPath,
  AiFirstRuntimeEntrypointStatus,
} from './AiFirstRuntimeEntrypointAdapterContract.js';
import type {
  ZavorthResponseDecisionMode,
  ZavorthResponseDecisionPath,
} from './ZavorthResponseDecisionContract.js';

export const AI_FIRST_RUNTIME_RECEIPT_LEDGER_CONTRACT_VERSION = '2026-05-06.phase-8' as const;

export type AiFirstRuntimeReceiptLedgerPersistenceMode = 'memory-only' | 'jsonl-file';

export type AiFirstRuntimeReceiptLedgerReadiness =
  | 'ledger-clean'
  | 'review-source-violations';

export type AiFirstRuntimeReceiptLedgerAction =
  | 'ready-for-replay'
  | 'review-ledger';

export type AiFirstRuntimeReceiptLedgerEntry = {
  entryId: string;
  adapterId: string;
  requestId: string;
  surface: string;
  generatedAt: string;
  selectedPath: AiFirstRuntimeEntrypointSelectedPath;
  status: AiFirstRuntimeEntrypointStatus;
  canarySelected: boolean;
  currentRuntime: {
    mode: ZavorthResponseDecisionMode;
    responsePath: ZavorthResponseDecisionPath;
    shouldExecute: boolean;
    requestedTools: string[];
    retainedAsFallback: true;
  };
  canary: {
    switchboardId: string | null;
    decision: string;
    matchedRouteKey: string | null;
    fallbackReason: AiFirstRuntimeEntrypointFallbackReason | null;
  };
  replay: {
    replayKey: string;
    comparisonKey: string;
    selectedDecisionRecordedBesideCurrent: true;
  };
  invariants: {
    fallbackAvailable: true;
    defaultRuntimeChanged: false;
    keepCurrentRuntimeDecision: true;
    adapterOnly: true;
    canExecuteNow: false;
  };
};

export type AiFirstRuntimeReceiptReplayIndexEntry = {
  requestId: string;
  entryIds: string[];
  selectedPaths: AiFirstRuntimeEntrypointSelectedPath[];
  lastSelectedPath: AiFirstRuntimeEntrypointSelectedPath;
};

export type AiFirstRuntimeReceiptComparisonIndexEntry = {
  comparisonKey: string;
  entries: number;
  canarySelections: number;
  fallbackSelections: number;
};

export type AiFirstRuntimeReceiptLedgerPersistence = {
  mode: AiFirstRuntimeReceiptLedgerPersistenceMode;
  attempted: boolean;
  succeeded: boolean;
  targetPath: string | null;
  append: boolean;
  entriesWritten: number;
  error: string | null;
};

export type AiFirstRuntimeReceiptLedgerSnapshot = {
  contractVersion: typeof AI_FIRST_RUNTIME_RECEIPT_LEDGER_CONTRACT_VERSION;
  source: 'ai-first-runtime-receipt-ledger';
  generatedAt: string;
  ledgerId: string;
  input: {
    ledgerName: string;
    adapterSnapshotCount: number;
  };
  entries: AiFirstRuntimeReceiptLedgerEntry[];
  replayIndex: AiFirstRuntimeReceiptReplayIndexEntry[];
  comparisonIndex: AiFirstRuntimeReceiptComparisonIndexEntry[];
  summary: {
    totalEntries: number;
    canarySelected: number;
    currentRuntimeSelected: number;
    fallbackCurrentRuntime: number;
    currentRuntimeOnly: number;
    secretLeakDetected: boolean;
  };
  fallbackReasons: Array<{
    reason: AiFirstRuntimeEntrypointFallbackReason;
    count: number;
  }>;
  invariants: {
    allFallbackAvailable: boolean;
    allDefaultRuntimePreserved: boolean;
    allCurrentRuntimeRetained: boolean;
    allAdapterOnly: boolean;
    allCanExecuteNowFalse: boolean;
    sourceViolations: string[];
  };
  persistence: AiFirstRuntimeReceiptLedgerPersistence;
  recommendation: {
    readiness: AiFirstRuntimeReceiptLedgerReadiness;
    action: AiFirstRuntimeReceiptLedgerAction;
    reason: string;
    defaultRuntimeChanged: false;
    keepCurrentRuntimeDecision: true;
    canExecuteNow: false;
  };
  receipts: Array<{
    id: string;
    kind: 'ledger' | 'entry' | 'replay-index' | 'persistence' | 'no-runtime-change';
    detail: string;
  }>;
  gates: Array<{
    id: string;
    status: 'passed';
    detail: string;
  }>;
};
