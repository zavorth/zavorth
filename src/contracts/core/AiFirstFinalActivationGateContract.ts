export const AI_FIRST_FINAL_ACTIVATION_GATE_CONTRACT_VERSION = '2026-05-06.checkpoint-10' as const;

export type AiFirstFinalActivationReadiness =
  | 'ready-for-owner-controlled-default'
  | 'hold'
  | 'blocked';

export type AiFirstFinalActivationAction =
  | 'prepare-owner-controlled-default'
  | 'continue-canary'
  | 'collect-more-history'
  | 'investigate-blockers'
  | 'reject-activation';

export type AiFirstFinalActivationFindingSeverity =
  | 'info'
  | 'low'
  | 'medium'
  | 'high';

export type AiFirstFinalActivationFindingKind =
  | 'batch-not-candidate'
  | 'batch-criteria-failed'
  | 'registry-not-ready'
  | 'allowlist-missing'
  | 'switchboard-not-ready'
  | 'manual-canary-missing'
  | 'canary-selection-missing'
  | 'ledger-not-clean'
  | 'ledger-source-violation'
  | 'ledger-secret-leak'
  | 'historical-gate-hold'
  | 'historical-gate-blocked'
  | 'runtime-invariant-violation';

export type AiFirstFinalActivationFinding = {
  id: string;
  kind: AiFirstFinalActivationFindingKind;
  severity: AiFirstFinalActivationFindingSeverity;
  detail: string;
};

export type AiFirstFinalActivationPhaseSummary = {
  gate: 'ai-first-activation-checkpoint-4' | 'checkpoint-5' | 'checkpoint-6' | 'checkpoint-8' | 'checkpoint-9';
  sourceId: string;
  readiness: string;
  action: string;
  status: 'passed' | 'warning' | 'blocked';
  receiptCount: number;
  gateCount: number;
  detail: string;
};

export type AiFirstFinalActivationGateSnapshot = {
  contractVersion: typeof AI_FIRST_FINAL_ACTIVATION_GATE_CONTRACT_VERSION;
  source: 'ai-first-final-activation-gate';
  generatedAt: string;
  activationGateId: string;
  input: {
    activationName: string;
    batchId: string;
    registryId: string;
    switchboardId: string;
    ledgerId: string;
    historicalGateId: string;
  };
  phaseSummaries: AiFirstFinalActivationPhaseSummary[];
  aggregate: {
    sampleCount: number;
    batchPassRate: number;
    batchBlockRate: number;
    eligibleFamilies: number;
    proposedAllowlistEntries: number;
    canaryEnabledRoutes: number;
    canarySelections: number;
    fallbackSelections: number;
    ledgerEntries: number;
    latestCanaryRate: number;
    latestFallbackRate: number;
    historicalFindingCount: number;
    finalFindingCount: number;
    allReceiptsPresent: boolean;
    allRuntimeInvariantsPreserved: boolean;
    ownerApprovalRequired: true;
    automaticActivationAllowed: false;
  };
  findings: AiFirstFinalActivationFinding[];
  recommendation: {
    readiness: AiFirstFinalActivationReadiness;
    action: AiFirstFinalActivationAction;
    reason: string;
    defaultRuntimeChanged: false;
    keepCurrentRuntimeDecision: true;
    canExecuteNow: false;
    activateAutomatically: false;
    ownerApprovalRequired: true;
    promoteDefaultRuntime: false;
  };
  receipts: Array<{
    id: string;
    kind:
      | 'gate-summary'
      | 'activation-decision'
      | 'owner-approval'
      | 'fallback'
      | 'no-runtime-change';
    detail: string;
  }>;
  gates: Array<{
    id: string;
    status: 'passed' | 'warning' | 'blocked';
    detail: string;
  }>;
};
