import type { ParityCertificationGateStatus } from './ParityCertificationContract.js';
import type { CanaryPromotionDecisionLedgerSnapshot } from './CanaryPromotionDecisionLedgerContract.js';

export const ZAVORTH_FINAL_CANARY_RELEASE_CLOSURE_CONTRACT_VERSION = '2026-05-04.checkpoint-24';

export type FinalCanaryReleaseClosureStatus =
  | 'closure-ready'
  | 'attention'
  | 'blocked';

export type FinalCanaryReleaseClosureItemStatus =
  | 'linked'
  | 'closure-ready'
  | 'operator-ready'
  | 'locked'
  | 'blocked';

export type FinalCanaryReleaseClosureItemMode =
  | 'source-gate'
  | 'closure-evidence'
  | 'release-handoff'
  | 'operator-handoff'
  | 'policy-lock';

export type FinalCanaryReleaseClosureSurface =
  | 'promotion-ledger'
  | 'release-execution'
  | 'phase-chain'
  | 'evidence'
  | 'release-handoff'
  | 'audit'
  | 'incident'
  | 'support'
  | 'publication'
  | 'promotion'
  | 'rollback'
  | 'policy';

export type FinalCanaryReleaseClosureItem = {
  id:
    | 'promotion-decision-ledger-input'
    | 'held-release-execution-gate'
    | 'checkpoint-20-approval-ledger-link'
    | 'checkpoint-21-launch-rehearsal-link'
    | 'checkpoint-22-monitoring-rollback-link'
    | 'checkpoint-23-promotion-decision-link'
    | 'side-effect-zeroing-evidence'
    | 'signed-evidence-requirement-record'
    | 'release-handoff-package'
    | 'audit-closure-record'
    | 'manual-release-decision-handoff'
    | 'incident-commander-handoff'
    | 'support-bridge-handoff'
    | 'publication-lock'
    | 'promotion-lock'
    | 'remote-mutation-lock';
  surface: FinalCanaryReleaseClosureSurface;
  mode: FinalCanaryReleaseClosureItemMode;
  status: FinalCanaryReleaseClosureItemStatus;
  command: string;
  receipt: string;
  evidence: string;
  requiredForClosure: true;
  dryRunOnly: boolean;
  manualReleaseDecisionRecorded: false;
  releaseExecuted: false;
  canaryStarted: false;
  canaryExpanded: false;
  rollbackExecuted: false;
  pauseExecuted: false;
  publishesPackage: false;
  createsRelease: false;
  movesTag: false;
  mutatesRemoteState: false;
  secretValuesSerialized: false;
};

export type FinalCanaryReleaseClosureGate = {
  id:
    | 'promotion-decision-ledger-ready'
    | 'held-release-execution-gate-linked'
    | 'phase-chain-complete'
    | 'closure-evidence-complete'
    | 'manual-handoffs-ready'
    | 'live-side-effects-blocked'
    | 'publication-and-promotion-held'
    | 'rollback-and-pause-held'
    | 'remote-mutation-blocked'
    | 'closure-receipts-complete';
  status: ParityCertificationGateStatus;
  title: string;
  observed: number | string | boolean;
  threshold: number | string | boolean;
  receipt: string;
  nextAction: string;
};

export type FinalCanaryReleaseClosureReceipt = {
  id: string;
  itemId: FinalCanaryReleaseClosureItem['id'];
  status: FinalCanaryReleaseClosureItemStatus;
  command: string;
  evidence: string;
  dryRunOnly: boolean;
  manualReleaseDecisionRecorded: false;
  noReleaseExecuted: true;
  noCanaryStarted: true;
  noCanaryExpanded: true;
  noRollbackExecuted: true;
  noPauseExecuted: true;
  noPackagePublished: true;
  noReleaseCreated: true;
  noTagMoved: true;
  noRemoteMutation: true;
  secretValuesSerialized: false;
};

export type FinalCanaryReleaseClosureSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_FINAL_CANARY_RELEASE_CLOSURE_CONTRACT_VERSION;
  status: FinalCanaryReleaseClosureStatus;
  releaseCandidate: {
    id: CanaryPromotionDecisionLedgerSnapshot['releaseCandidate']['id'];
    packageName: CanaryPromotionDecisionLedgerSnapshot['releaseCandidate']['packageName'];
    packageVersion: CanaryPromotionDecisionLedgerSnapshot['releaseCandidate']['packageVersion'];
    channel: 'release-candidate';
    npmDistTag: 'rc';
    finalClosureOnly: true;
  };
  closure: {
    state: 'closure-ready' | 'blocked';
    phaseRange: '20-24';
    effectiveDecision: 'hold';
    finalSequenceDecision: 'closed-dry-run';
    canaryDryRunSequenceComplete: boolean;
    readyForSeparateManualReleaseDecision: boolean;
    manualReleaseDecisionRecorded: false;
    canaryCohortId: CanaryPromotionDecisionLedgerSnapshot['ledger']['canaryCohortId'];
    featureFlagKey: CanaryPromotionDecisionLedgerSnapshot['ledger']['featureFlagKey'];
    observationWindowHours: CanaryPromotionDecisionLedgerSnapshot['ledger']['observationWindowHours'];
    selectedPromotionDecision: CanaryPromotionDecisionLedgerSnapshot['ledger']['selectedDecision'];
    recommendedPromotionDecision: CanaryPromotionDecisionLedgerSnapshot['ledger']['recommendedDecision'];
    noFurtherAutomatedStage: true;
    sequenceClosesAtStage24: true;
  };
  summary: {
    items: number;
    requiredItems: number;
    linkedItems: number;
    closureReadyItems: number;
    operatorReadyItems: number;
    lockedItems: number;
    blockedItems: number;
    gates: number;
    passedGates: number;
    failedGates: number;
    receipts: number;
    promotionDecisionLedgerStatus: CanaryPromotionDecisionLedgerSnapshot['status'];
    promotionDecisionLedgerReady: boolean;
    heldReleaseExecutionGateLinked: boolean;
    previewEngine0Linked: boolean;
    previewEngine1Linked: boolean;
    previewEngine2Linked: boolean;
    previewEngine3Linked: boolean;
    phaseChainComplete: boolean;
    closureEvidenceComplete: boolean;
    manualHandoffsReady: boolean;
    finalCanaryReleaseClosureReady: boolean;
    manualReleaseDecisionRecorded: false;
    releaseExecuted: false;
    canaryStarted: false;
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
  promotionDecisionLedger: Pick<
    CanaryPromotionDecisionLedgerSnapshot,
    'contractVersion' | 'status' | 'releaseCandidate' | 'ledger' | 'summary' | 'commands'
  >;
  items: FinalCanaryReleaseClosureItem[];
  gates: FinalCanaryReleaseClosureGate[];
  receipts: FinalCanaryReleaseClosureReceipt[];
  commands: {
    run: string;
    runJson: string;
    check: string;
    requireClosureReady: string;
    promotionDecisionLedger: string;
    releaseExecutionHeld: string;
    chainValidation: string;
    manualReleaseDecisionHandoff: string;
    focusedTests: string[];
    typecheck: string;
    completion: 'Canary dry-run sequence complete at Preview engine4';
  };
  policy: {
    finalClosureOnly: true;
    consumesCanaryPromotionDecisionLedger: true;
    closesCanaryDryRunSequence: true;
    sequenceClosesAtStage24: true;
    noFurtherAutomatedStage: true;
    noManualReleaseDecisionRecordedByDefault: true;
    noReleaseExecuted: true;
    noCanaryStarted: true;
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
    separateManualReleaseDecisionRequired: true;
    signedMonitoringEvidenceRequiredForFuturePromotion: true;
    auditClosureRequired: true;
    incidentCommanderRequired: true;
    supportBridgeRequired: true;
    noRemoteMutationByDefault: true;
    noNetworkRequiredByDefault: true;
    secretsSerialized: false;
  };
};
