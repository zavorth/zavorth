import type { ParityCertificationGateStatus } from './ParityCertificationContract.js';
import type { CanaryPlanDryRunHoldSnapshot } from './CanaryPlanDryRunHoldContract.js';

export const ZAVORTH_CANARY_EXECUTION_APPROVAL_LEDGER_CONTRACT_VERSION = '2026-05-04.checkpoint-20';

export type CanaryExecutionApprovalLedgerStatus = 'ledger-ready' | 'attention' | 'blocked';

export type CanaryExecutionApprovalLedgerState =
  | 'ready-for-signature'
  | 'signed'
  | 'blocked';

export type CanaryExecutionApprovalLedgerEntryStatus =
  | 'linked'
  | 'approval-ready'
  | 'operator-ready'
  | 'locked'
  | 'blocked';

export type CanaryExecutionApprovalLedgerEntryMode =
  | 'source-gate'
  | 'approval-ledger'
  | 'operator-assignment'
  | 'checkpoint-ledger'
  | 'audit-ledger'
  | 'policy-lock';

export type CanaryExecutionApprovalLedgerSurface =
  | 'canary-plan'
  | 'release-execution'
  | 'approval'
  | 'operator'
  | 'rollback'
  | 'audit'
  | 'support'
  | 'observability'
  | 'publication'
  | 'promotion'
  | 'policy';

export type CanaryExecutionApprovalLedgerEntry = {
  id:
    | 'canary-plan-dry-run-input'
    | 'release-execution-gate-hold'
    | 'release-approver-slot'
    | 'manual-operator-slot'
    | 'rollback-owner-slot'
    | 'incident-commander-slot'
    | 'approval-receipt-template'
    | 'rollback-checkpoint-template'
    | 'audit-sink-template'
    | 'support-bridge-template'
    | 'observability-dashboard-template'
    | 'execution-launch-hold'
    | 'publication-hold'
    | 'promotion-hold';
  surface: CanaryExecutionApprovalLedgerSurface;
  mode: CanaryExecutionApprovalLedgerEntryMode;
  status: CanaryExecutionApprovalLedgerEntryStatus;
  command: string;
  receipt: string;
  evidence: string;
  requiredForLedger: true;
  requiresHumanSignature: boolean;
  signatureRecorded: false;
  launchAuthorized: false;
  canaryStarted: false;
  rolloutStarted: false;
  deployExecuted: false;
  promotionExecuted: false;
  publishesPackage: false;
  mutatesRemoteState: false;
  secretValuesSerialized: false;
};

export type CanaryExecutionApprovalLedgerGate = {
  id:
    | 'canary-plan-dry-run-ready'
    | 'release-execution-gate-linked'
    | 'required-signature-slots-ready'
    | 'rollback-and-audit-ledgers-ready'
    | 'support-observability-ledgers-ready'
    | 'launch-side-effects-blocked'
    | 'publication-and-promotion-held'
    | 'ledger-receipts-complete';
  status: ParityCertificationGateStatus;
  title: string;
  observed: number | string | boolean;
  threshold: number | string | boolean;
  receipt: string;
  nextAction: string;
};

export type CanaryExecutionApprovalLedgerReceipt = {
  id: string;
  entryId: CanaryExecutionApprovalLedgerEntry['id'];
  status: CanaryExecutionApprovalLedgerEntryStatus;
  command: string;
  evidence: string;
  signatureRecorded: false;
  launchAuthorized: false;
  noCanaryStarted: true;
  noRolloutStarted: true;
  noDeployExecuted: true;
  noPromotionExecuted: true;
  noPackagePublished: true;
  noRemoteMutation: true;
  secretValuesSerialized: false;
};

export type CanaryExecutionApprovalLedgerSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_CANARY_EXECUTION_APPROVAL_LEDGER_CONTRACT_VERSION;
  status: CanaryExecutionApprovalLedgerStatus;
  releaseCandidate: {
    id: CanaryPlanDryRunHoldSnapshot['releaseCandidate']['id'];
    packageName: CanaryPlanDryRunHoldSnapshot['releaseCandidate']['packageName'];
    packageVersion: CanaryPlanDryRunHoldSnapshot['releaseCandidate']['packageVersion'];
    channel: 'release-candidate';
    npmDistTag: 'rc';
    approvalLedgerOnly: true;
  };
  ledger: {
    state: CanaryExecutionApprovalLedgerState;
    effectiveDecision: 'hold';
    readyForSignature: boolean;
    signed: false;
    launchAuthorized: false;
    executionApproved: false;
    approvalReceiptId: null;
    requiredSignatures: [
      'releaseApprover',
      'manualOperator',
      'rollbackOwner',
      'incidentCommander',
      'auditOwner',
    ];
    requiredArtifacts: [
      'approvalReceipt',
      'rollbackCheckpoint',
      'auditSink',
      'supportBridge',
      'observabilityDashboard',
    ];
    ledgerId: 'canary-execution-approval-ledger';
    canaryCohortId: CanaryPlanDryRunHoldSnapshot['plan']['canaryCohortId'];
    featureFlagKey: CanaryPlanDryRunHoldSnapshot['plan']['featureFlagKey'];
    observationWindowHours: CanaryPlanDryRunHoldSnapshot['plan']['observationWindowHours'];
  };
  summary: {
    entries: number;
    requiredEntries: number;
    linkedEntries: number;
    approvalReadyEntries: number;
    operatorReadyEntries: number;
    lockedEntries: number;
    blockedEntries: number;
    gates: number;
    passedGates: number;
    failedGates: number;
    receipts: number;
    canaryPlanStatus: CanaryPlanDryRunHoldSnapshot['status'];
    canaryPlanDryRunReady: boolean;
    releaseExecutionGateLinked: boolean;
    requiredSignatureSlotsReady: boolean;
    rollbackCheckpointReady: boolean;
    auditSinkReady: boolean;
    supportBridgeReady: boolean;
    observabilityDashboardReady: boolean;
    approvalLedgerReady: boolean;
    signatureRecorded: false;
    launchAuthorized: false;
    executionApproved: false;
    canaryStarted: false;
    rolloutStarted: false;
    deployExecuted: false;
    promotionExecuted: false;
    remoteStateMutated: false;
    npmPublishExecuted: false;
    githubReleaseCreated: false;
    gitTagMoved: false;
    secretValuesSerialized: false;
  };
  canaryPlan: Pick<
    CanaryPlanDryRunHoldSnapshot,
    'contractVersion' | 'status' | 'releaseCandidate' | 'plan' | 'summary' | 'commands'
  >;
  entries: CanaryExecutionApprovalLedgerEntry[];
  gates: CanaryExecutionApprovalLedgerGate[];
  receipts: CanaryExecutionApprovalLedgerReceipt[];
  commands: {
    run: string;
    runJson: string;
    check: string;
    requireLedgerReady: string;
    canaryPlanDryRun: string;
    releaseExecutionGate: string;
    approvalLedgerSign: string;
    launchHold: string;
    focusedTests: string[];
    typecheck: string;
    nextStage: 'Canary launch rehearsal';
  };
  policy: {
    approvalLedgerOnly: true;
    consumesCanaryPlanDryRun: true;
    noSignatureRecordedByDefault: true;
    noLaunchAuthorizedByDefault: true;
    noCanaryStarted: true;
    noRolloutStarted: true;
    noDeployExecuted: true;
    noPromotionExecuted: true;
    noNpmPublish: true;
    noGithubReleaseCreated: true;
    noGitTagMoved: true;
    noStableTagMoved: true;
    noLatestTagMoved: true;
    noAutomaticExecution: true;
    noAutomaticPromotion: true;
    explicitSignatureRequired: true;
    rollbackCheckpointRequired: true;
    auditSinkRequired: true;
    supportBridgeRequired: true;
    observabilityDashboardRequired: true;
    noRemoteMutationByDefault: true;
    noNetworkRequiredByDefault: true;
    secretsSerialized: false;
  };
};
