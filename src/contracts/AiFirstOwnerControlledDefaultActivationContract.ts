import type { AiFirstFinalActivationGateSnapshot } from './AiFirstFinalActivationGateContract.js';

export const AI_FIRST_OWNER_CONTROLLED_DEFAULT_ACTIVATION_CONTRACT_VERSION = '2026-05-06.owner-controlled-default-activation' as const;

export type AiFirstOwnerControlledDefaultOperation =
  | 'plan'
  | 'activate'
  | 'status'
  | 'rollback';

export type AiFirstOwnerControlledDefaultRouter = 'ai-first' | 'current-runtime';

export type AiFirstOwnerControlledDefaultStateStatus =
  | 'active'
  | 'inactive'
  | 'rolled-back';

export type AiFirstOwnerControlledDefaultResultStatus =
  | 'ready'
  | 'active'
  | 'inactive'
  | 'rolled-back'
  | 'blocked'
  | 'missing';

export type AiFirstOwnerControlledDefaultFindingSeverity =
  | 'info'
  | 'medium'
  | 'high';

export type AiFirstOwnerControlledDefaultFindingKind =
  | 'snapshot-missing'
  | 'snapshot-source-invalid'
  | 'snapshot-not-ready'
  | 'snapshot-findings-present'
  | 'runtime-invariant-violation'
  | 'owner-approval-missing'
  | 'activation-confirmation-missing'
  | 'rollback-confirmation-missing'
  | 'state-missing'
  | 'state-not-active'
  | 'already-active'
  | 'secret-like-input';

export type AiFirstOwnerControlledDefaultFinding = {
  id: string;
  kind: AiFirstOwnerControlledDefaultFindingKind;
  severity: AiFirstOwnerControlledDefaultFindingSeverity;
  detail: string;
};

export type AiFirstOwnerControlledDefaultState = {
  version: 1;
  contractVersion: typeof AI_FIRST_OWNER_CONTROLLED_DEFAULT_ACTIVATION_CONTRACT_VERSION;
  source: 'ai-first-owner-controlled-default-state';
  updatedAt: string;
  status: AiFirstOwnerControlledDefaultStateStatus;
  defaultRouter: AiFirstOwnerControlledDefaultRouter;
  fallbackRouter: 'current-runtime';
  activationGateId: string | null;
  activationSnapshotHash: string | null;
  ownerApprovalId: string | null;
  activatedAt: string | null;
  rolledBackAt: string | null;
  rollbackOfReceiptId: string | null;
  lastReceiptId: string | null;
  runtime: {
    defaultRuntimeChanged: boolean;
    currentRuntimeFallbackRequired: true;
    canExecuteNow: false;
    activateAutomatically: false;
  };
  sourceSnapshot: {
    readiness: AiFirstFinalActivationGateSnapshot['recommendation']['readiness'] | null;
    action: AiFirstFinalActivationGateSnapshot['recommendation']['action'] | null;
    sampleCount: number;
    canaryEnabledRoutes: number;
    canarySelections: number;
    latestCanaryRate: number;
    latestFallbackRate: number;
  };
};

export type AiFirstOwnerControlledDefaultReceipt = {
  version: 1;
  contractVersion: typeof AI_FIRST_OWNER_CONTROLLED_DEFAULT_ACTIVATION_CONTRACT_VERSION;
  id: string;
  createdAt: string;
  operation: AiFirstOwnerControlledDefaultOperation;
  applied: boolean;
  dryRun: boolean;
  status: AiFirstOwnerControlledDefaultResultStatus;
  activationGateId: string | null;
  activationSnapshotHash: string | null;
  ownerApprovalId: string | null;
  previousDefaultRouter: AiFirstOwnerControlledDefaultRouter | null;
  nextDefaultRouter: AiFirstOwnerControlledDefaultRouter;
  statePath: string;
  ledgerPath: string;
  findings: AiFirstOwnerControlledDefaultFinding[];
  message: string;
  invariants: {
    defaultRuntimeChangedOnlyWhenApplied: boolean;
    currentRuntimeFallbackRequired: true;
    canExecuteNow: false;
    activateAutomatically: false;
    noSecretValuesSerialized: true;
  };
};

export type AiFirstOwnerControlledDefaultLedgerSnapshot = {
  version: 1;
  generatedAt: string;
  ledgerPath: string;
  exists: boolean;
  total: number;
  returned: number;
  invalidLines: number;
  receipts: AiFirstOwnerControlledDefaultReceipt[];
  errors: Array<{
    line: number;
    reason: string;
  }>;
};

export type AiFirstOwnerControlledDefaultResult = {
  version: 1;
  contractVersion: typeof AI_FIRST_OWNER_CONTROLLED_DEFAULT_ACTIVATION_CONTRACT_VERSION;
  generatedAt: string;
  operation: AiFirstOwnerControlledDefaultOperation;
  status: AiFirstOwnerControlledDefaultResultStatus;
  applied: boolean;
  dryRun: boolean;
  action:
    | 'write-owner-controlled-default'
    | 'preview-owner-controlled-default'
    | 'read-current-state'
    | 'write-rollback'
    | 'preview-rollback'
    | 'fix-blockers';
  message: string;
  state: AiFirstOwnerControlledDefaultState | null;
  receipt: AiFirstOwnerControlledDefaultReceipt | null;
  ledger: AiFirstOwnerControlledDefaultLedgerSnapshot | null;
  findings: AiFirstOwnerControlledDefaultFinding[];
  paths: {
    statePath: string;
    ledgerPath: string;
  };
  commands: {
    plan: string;
    activate: string;
    status: string;
    rollback: string;
  };
};
