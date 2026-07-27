import type {
  ZavorthLiveCanaryApplyGateRollbackDrillInput,
  ZavorthLiveCanaryApplyGateRollbackDrillSnapshot,
} from './ZavorthLiveCanaryApplyGateRollbackDrillContract.js';
import type { ZavorthProviderLiveCanarySnapshot } from '../ZavorthProviderLiveCanaryContract.js';

export const ZAVORTH_LIVE_CANARY_CONTROLLED_EXECUTOR_CONTRACT_VERSION =
  '2026-05-11.live-canary-controlled-executor-gate-10' as const;

export type ZavorthLiveCanaryExecutorId =
  | 'local_ack'
  | 'provider_live_canary';

export type ZavorthLiveCanaryControlledExecutorStatus =
  | 'executed'
  | 'ready-for-execution'
  | 'needs-apply-gate'
  | 'approval-required'
  | 'rollback-drill-required'
  | 'unsupported-adapter'
  | 'execution-failed'
  | 'blocked';

export type ZavorthLiveCanaryControlledExecutorMode =
  | 'controlled-live-execution'
  | 'operator-ready'
  | 'apply-gate'
  | 'approval-gate'
  | 'rollback-drill-gate'
  | 'unsupported'
  | 'hold';

export type ZavorthLiveCanaryExecutionRequest = {
  execute?: boolean | null;
  executorId?: ZavorthLiveCanaryExecutorId | null;
  operatorConfirmed?: boolean | null;
  idempotencyKey?: string | null;
  providerName?: string | null;
  modelName?: string | null;
  timeoutMs?: number | null;
};

export type ZavorthLiveCanaryControlledExecutorInput = {
  applyGate?: ZavorthLiveCanaryApplyGateRollbackDrillInput | null;
  execution?: ZavorthLiveCanaryExecutionRequest | null;
};

export type ZavorthLiveCanaryControlledExecutorCheck = {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  kind:
    | 'apply-gate-open'
    | 'authorization-fresh'
    | 'executor-selected'
    | 'adapter-supported'
    | 'idempotency-key'
    | 'explicit-execute'
    | 'operator-confirmation'
    | 'no-secret-output'
    | 'rollback-boundary';
  summary: string;
  recommendation: string | null;
};

export type ZavorthLiveCanaryControlledExecutionResult = {
  executorId: ZavorthLiveCanaryExecutorId;
  status: 'not-run' | 'performed' | 'failed';
  startedAt: string | null;
  completedAt: string | null;
  idempotencyKey: string | null;
  executionReceiptId: string | null;
  rollbackReceiptId: string | null;
  externalIoPerformed: boolean;
  workspaceMutationPerformed: boolean;
  upstreamRuntimeCodeExecuted: boolean;
  outputPreview: string | null;
  error: string | null;
  providerCanary: ZavorthProviderLiveCanarySnapshot | null;
};

export type ZavorthLiveCanaryControlledExecutorReceipt = {
  id: string;
  kind:
    | 'gate-10-live-canary-controlled-executor'
    | 'apply-gate-consumed'
    | 'execution-receipt'
    | 'rollback-receipt'
    | 'unsupported-adapter'
    | 'no-secret-output-boundary'
    | 'visual-change-boundary';
  status: 'recorded' | 'skipped' | 'blocked' | 'failed';
  summary: string;
};

export type ZavorthLiveCanaryControlledExecutorSafety = {
  executesOnlyWithStage9Authorization: true;
  explicitOperatorExecuteRequired: true;
  noImplicitExecutionFromChecks: true;
  idempotencyKeyRequiredForExecution: true;
  rollbackReceiptRequiredAfterExecution: true;
  noZavorthControlVisualMutation: true;
  rawSecretsSerialized: false;
};

export type ZavorthLiveCanaryControlledExecutorSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_LIVE_CANARY_CONTROLLED_EXECUTOR_CONTRACT_VERSION;
  source: 'ZavorthLiveCanaryControlledExecutorService';
  gate: 'live-canary-controlled-executor';
  status: ZavorthLiveCanaryControlledExecutorStatus;
  mode: ZavorthLiveCanaryControlledExecutorMode;
  applyGate: ZavorthLiveCanaryApplyGateRollbackDrillSnapshot;
  executionRequest: {
    execute: boolean;
    executorId: ZavorthLiveCanaryExecutorId;
    operatorConfirmed: boolean;
    idempotencyKey: string | null;
    timeoutMs: number;
    providerName: string | null;
    modelName: string | null;
  };
  checks: ZavorthLiveCanaryControlledExecutorCheck[];
  executionResult: ZavorthLiveCanaryControlledExecutionResult;
  receipts: ZavorthLiveCanaryControlledExecutorReceipt[];
  safety: ZavorthLiveCanaryControlledExecutorSafety;
  summary: {
    checks: number;
    passedChecks: number;
    warningChecks: number;
    failedChecks: number;
    applyGateOpen: boolean;
    adapterSupported: boolean;
    executionRequested: boolean;
    executionPerformed: boolean;
    externalIoPerformed: boolean;
    workspaceMutationPerformed: boolean;
    rollbackReceiptPresent: boolean;
  };
  commands: {
    report: 'npx tsx scripts/zavorth-live-canary-executor.ts';
    json: 'npx tsx scripts/zavorth-live-canary-executor.ts --json';
    local: 'npx tsx scripts/zavorth-live-canary-executor.ts --execute-local';
    provider: 'npx tsx scripts/zavorth-live-canary-executor.ts --execute-provider';
    check: 'node scripts/zavorth-live-canary-executor-check.mjs';
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
