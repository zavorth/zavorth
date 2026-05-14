import type { ParityCertificationGateStatus } from './ParityCertificationContract.js';
import type { CanaryMonitoringRollbackGateSnapshot } from './CanaryMonitoringRollbackGateContract.js';

export const ZAVORTH_CANARY_PROMOTION_DECISION_LEDGER_CONTRACT_VERSION = '2026-05-04.phase-23';

export type CanaryPromotionDecisionLedgerStatus =
  | 'decision-ledger-ready'
  | 'attention'
  | 'blocked';

export type CanaryPromotionDecisionEntryStatus =
  | 'linked'
  | 'decision-ready'
  | 'operator-ready'
  | 'locked'
  | 'blocked';

export type CanaryPromotionDecisionEntryMode =
  | 'source-gate'
  | 'decision-path'
  | 'evidence-slot'
  | 'operator-handoff'
  | 'policy-lock';

export type CanaryPromotionDecisionSurface =
  | 'monitoring-gate'
  | 'release-execution'
  | 'evidence'
  | 'approval'
  | 'promotion'
  | 'pause'
  | 'rollback'
  | 'cohort'
  | 'audit'
  | 'incident'
  | 'support'
  | 'publication'
  | 'policy';

export type CanaryPromotionDecisionEntry = {
  id:
    | 'monitoring-rollback-gate-input'
    | 'held-release-execution-gate'
    | 'signed-monitoring-evidence-slot'
    | 'promotion-approver-slot'
    | 'manual-operator-slot'
    | 'expand-decision-path'
    | 'pause-decision-path'
    | 'rollback-decision-path'
    | 'cohort-expansion-command-shape'
    | 'rollback-command-shape'
    | 'audit-decision-ledger'
    | 'incident-commander-handoff'
    | 'support-bridge-handoff'
    | 'promotion-execution-lock'
    | 'publication-lock'
    | 'remote-mutation-lock';
  surface: CanaryPromotionDecisionSurface;
  mode: CanaryPromotionDecisionEntryMode;
  status: CanaryPromotionDecisionEntryStatus;
  command: string;
  receipt: string;
  evidence: string;
  requiredForDecisionLedger: true;
  dryRunOnly: boolean;
  signedEvidenceRecorded: false;
  promotionAuthorized: false;
  canaryExpanded: false;
  rollbackExecuted: false;
  pauseExecuted: false;
  publishesPackage: false;
  mutatesRemoteState: false;
  secretValuesSerialized: false;
};

export type CanaryPromotionDecisionGate = {
  id:
    | 'monitoring-rollback-gate-ready'
    | 'held-release-execution-gate-linked'
    | 'decision-options-explicit'
    | 'approval-and-evidence-slots-ready'
    | 'operator-handoffs-ready'
    | 'promotion-side-effects-blocked'
    | 'rollback-and-pause-side-effects-blocked'
    | 'publication-held'
    | 'remote-mutation-blocked'
    | 'decision-receipts-complete';
  status: ParityCertificationGateStatus;
  title: string;
  observed: number | string | boolean;
  threshold: number | string | boolean;
  receipt: string;
  nextAction: string;
};

export type CanaryPromotionDecisionReceipt = {
  id: string;
  entryId: CanaryPromotionDecisionEntry['id'];
  status: CanaryPromotionDecisionEntryStatus;
  command: string;
  evidence: string;
  dryRunOnly: boolean;
  signedEvidenceRecorded: false;
  noPromotionAuthorized: true;
  noCanaryExpanded: true;
  noRollbackExecuted: true;
  noPauseExecuted: true;
  noPackagePublished: true;
  noRemoteMutation: true;
  secretValuesSerialized: false;
};

export type CanaryPromotionDecisionLedgerSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_CANARY_PROMOTION_DECISION_LEDGER_CONTRACT_VERSION;
  status: CanaryPromotionDecisionLedgerStatus;
  releaseCandidate: {
    id: CanaryMonitoringRollbackGateSnapshot['releaseCandidate']['id'];
    packageName: CanaryMonitoringRollbackGateSnapshot['releaseCandidate']['packageName'];
    packageVersion: CanaryMonitoringRollbackGateSnapshot['releaseCandidate']['packageVersion'];
    channel: 'release-candidate';
    npmDistTag: 'rc';
    promotionDecisionLedgerOnly: true;
  };
  ledger: {
    state: 'ready-for-signed-evidence' | 'blocked';
    effectiveDecision: 'hold';
    selectedDecision: 'hold';
    availableDecisions: Array<'expand' | 'pause' | 'rollback'>;
    recommendedDecision: 'await-live-evidence';
    canaryCohortId: CanaryMonitoringRollbackGateSnapshot['monitoring']['canaryCohortId'];
    featureFlagKey: CanaryMonitoringRollbackGateSnapshot['monitoring']['featureFlagKey'];
    observationWindowHours: CanaryMonitoringRollbackGateSnapshot['monitoring']['observationWindowHours'];
    currentCanaryPercent: 5;
    nextCohortPercent: 10;
    signedMonitoringEvidenceRequired: true;
    signedMonitoringEvidenceRecorded: false;
    promotionAuthorized: false;
    rollbackRecommended: false;
    pauseRecommended: false;
    promotable: false;
  };
  summary: {
    entries: number;
    requiredEntries: number;
    linkedEntries: number;
    decisionReadyEntries: number;
    operatorReadyEntries: number;
    lockedEntries: number;
    blockedEntries: number;
    gates: number;
    passedGates: number;
    failedGates: number;
    receipts: number;
    monitoringRollbackGateStatus: CanaryMonitoringRollbackGateSnapshot['status'];
    monitoringRollbackGateReady: boolean;
    heldReleaseExecutionGateLinked: boolean;
    decisionOptionsExplicit: boolean;
    signedMonitoringEvidenceSlotReady: boolean;
    promotionApproverReady: boolean;
    manualOperatorReady: boolean;
    auditDecisionLedgerReady: boolean;
    operatorHandoffsReady: boolean;
    promotionDecisionLedgerReady: boolean;
    signedEvidenceRecorded: false;
    promotionAuthorized: false;
    canaryExpanded: false;
    rollbackExecuted: false;
    pauseExecuted: false;
    rolloutStarted: false;
    remoteStateMutated: false;
    npmPublishExecuted: false;
    githubReleaseCreated: false;
    gitTagMoved: false;
    secretValuesSerialized: false;
  };
  monitoringRollbackGate: Pick<
    CanaryMonitoringRollbackGateSnapshot,
    'contractVersion' | 'status' | 'releaseCandidate' | 'monitoring' | 'summary' | 'commands'
  >;
  entries: CanaryPromotionDecisionEntry[];
  gates: CanaryPromotionDecisionGate[];
  receipts: CanaryPromotionDecisionReceipt[];
  commands: {
    run: string;
    runJson: string;
    check: string;
    requireLedgerReady: string;
    monitoringRollbackGate: string;
    releaseExecutionHeld: string;
    promotionDecisionDryRun: string;
    rollbackDecisionDryRun: string;
    focusedTests: string[];
    typecheck: string;
    nextPhase: 'Final canary release closure';
  };
  policy: {
    promotionDecisionLedgerOnly: true;
    consumesCanaryMonitoringRollbackGate: true;
    noSignedEvidenceRecordedByDefault: true;
    noPromotionAuthorizedByDefault: true;
    noCanaryExpanded: true;
    noRollbackExecuted: true;
    noPauseExecuted: true;
    noRolloutStarted: true;
    noNpmPublish: true;
    noGithubReleaseCreated: true;
    noGitTagMoved: true;
    noStableTagMoved: true;
    noLatestTagMoved: true;
    noAutomaticExecution: true;
    noAutomaticPromotion: true;
    signedMonitoringEvidenceRequired: true;
    manualPromotionApprovalRequired: true;
    rollbackDecisionRequiredBeforeRollback: true;
    pauseDecisionRequiredBeforePause: true;
    finalClosureRequiredBeforeRelease: true;
    auditDecisionLedgerRequired: true;
    incidentCommanderRequired: true;
    supportBridgeRequired: true;
    noRemoteMutationByDefault: true;
    noNetworkRequiredByDefault: true;
    secretsSerialized: false;
  };
};
