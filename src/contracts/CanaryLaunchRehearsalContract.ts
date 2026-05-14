import type { ParityCertificationGateStatus } from './ParityCertificationContract.js';
import type { CanaryExecutionApprovalLedgerSnapshot } from './CanaryExecutionApprovalLedgerContract.js';

export const ZAVORTH_CANARY_LAUNCH_REHEARSAL_CONTRACT_VERSION = '2026-05-04.phase-21';

export type CanaryLaunchRehearsalStatus = 'rehearsal-ready' | 'attention' | 'blocked';

export type CanaryLaunchRehearsalStepStatus =
  | 'linked'
  | 'rehearsal-ready'
  | 'operator-ready'
  | 'locked'
  | 'blocked';

export type CanaryLaunchRehearsalStepMode =
  | 'source-gate'
  | 'signature-path-rehearsal'
  | 'launch-command-rehearsal'
  | 'rollback-rehearsal'
  | 'observation-handoff'
  | 'operator-handoff'
  | 'policy-lock';

export type CanaryLaunchRehearsalSurface =
  | 'approval-ledger'
  | 'release-execution'
  | 'signature'
  | 'launch-command'
  | 'smoke'
  | 'feature-flag'
  | 'cohort'
  | 'rollback'
  | 'kill-switch'
  | 'audit'
  | 'observability'
  | 'support'
  | 'publication'
  | 'promotion'
  | 'policy';

export type CanaryLaunchRehearsalStep = {
  id:
    | 'approval-ledger-input'
    | 'held-release-execution-gate'
    | 'signed-ledger-path-rehearsal'
    | 'launch-command-shape-rehearsal'
    | 'prelaunch-smoke-rehearsal'
    | 'feature-flag-activation-rehearsal'
    | 'canary-cohort-routing-rehearsal'
    | 'rollback-checkpoint-rehearsal'
    | 'kill-switch-rehearsal'
    | 'audit-sink-rehearsal'
    | 'observability-handoff-rehearsal'
    | 'support-bridge-handoff-rehearsal'
    | 'canary-launch-lock'
    | 'publication-lock'
    | 'promotion-lock';
  surface: CanaryLaunchRehearsalSurface;
  mode: CanaryLaunchRehearsalStepMode;
  status: CanaryLaunchRehearsalStepStatus;
  command: string;
  receipt: string;
  evidence: string;
  requiredForRehearsal: true;
  dryRunOnly: boolean;
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

export type CanaryLaunchRehearsalGate = {
  id:
    | 'approval-ledger-ready'
    | 'held-release-execution-gate-linked'
    | 'signed-ledger-and-launch-command-rehearsed'
    | 'cohort-flag-smoke-rehearsed'
    | 'rollback-kill-switch-audit-rehearsed'
    | 'observation-support-handoff-ready'
    | 'launch-side-effects-blocked'
    | 'publication-and-promotion-held'
    | 'rehearsal-receipts-complete';
  status: ParityCertificationGateStatus;
  title: string;
  observed: number | string | boolean;
  threshold: number | string | boolean;
  receipt: string;
  nextAction: string;
};

export type CanaryLaunchRehearsalReceipt = {
  id: string;
  stepId: CanaryLaunchRehearsalStep['id'];
  status: CanaryLaunchRehearsalStepStatus;
  command: string;
  evidence: string;
  dryRunOnly: boolean;
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

export type CanaryLaunchRehearsalSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_CANARY_LAUNCH_REHEARSAL_CONTRACT_VERSION;
  status: CanaryLaunchRehearsalStatus;
  releaseCandidate: {
    id: CanaryExecutionApprovalLedgerSnapshot['releaseCandidate']['id'];
    packageName: CanaryExecutionApprovalLedgerSnapshot['releaseCandidate']['packageName'];
    packageVersion: CanaryExecutionApprovalLedgerSnapshot['releaseCandidate']['packageVersion'];
    channel: 'release-candidate';
    npmDistTag: 'rc';
    launchRehearsalOnly: true;
  };
  rehearsal: {
    state: 'rehearsal-ready' | 'blocked';
    effectiveDecision: 'hold';
    signaturePathRehearsed: boolean;
    signedLedgerFixture: 'unsigned-fixture';
    launchCommandRendered: boolean;
    launchAuthorized: false;
    executable: false;
    canaryCohortId: CanaryExecutionApprovalLedgerSnapshot['ledger']['canaryCohortId'];
    featureFlagKey: CanaryExecutionApprovalLedgerSnapshot['ledger']['featureFlagKey'];
    observationWindowHours: CanaryExecutionApprovalLedgerSnapshot['ledger']['observationWindowHours'];
    prelaunchSmokeMode: 'dry-run';
    rollbackCheckpointMode: 'dry-run';
    auditSinkMode: 'dry-run';
  };
  summary: {
    steps: number;
    requiredSteps: number;
    linkedSteps: number;
    rehearsalReadySteps: number;
    operatorReadySteps: number;
    lockedSteps: number;
    blockedSteps: number;
    gates: number;
    passedGates: number;
    failedGates: number;
    receipts: number;
    approvalLedgerStatus: CanaryExecutionApprovalLedgerSnapshot['status'];
    approvalLedgerReady: boolean;
    heldReleaseExecutionGateLinked: boolean;
    signaturePathRehearsed: boolean;
    launchCommandRehearsed: boolean;
    prelaunchSmokeRehearsed: boolean;
    featureFlagRehearsed: boolean;
    cohortRoutingRehearsed: boolean;
    rollbackCheckpointRehearsed: boolean;
    killSwitchRehearsed: boolean;
    auditSinkRehearsed: boolean;
    observabilityHandoffReady: boolean;
    supportBridgeReady: boolean;
    launchRehearsalReady: boolean;
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
  approvalLedger: Pick<
    CanaryExecutionApprovalLedgerSnapshot,
    'contractVersion' | 'status' | 'releaseCandidate' | 'ledger' | 'summary' | 'commands'
  >;
  steps: CanaryLaunchRehearsalStep[];
  gates: CanaryLaunchRehearsalGate[];
  receipts: CanaryLaunchRehearsalReceipt[];
  commands: {
    run: string;
    runJson: string;
    check: string;
    requireRehearsed: string;
    approvalLedger: string;
    releaseExecutionHeld: string;
    launchCommandDryRun: string;
    rollbackDryRun: string;
    focusedTests: string[];
    typecheck: string;
    nextPhase: 'Canary monitoring and rollback gate';
  };
  policy: {
    launchRehearsalOnly: true;
    consumesCanaryExecutionApprovalLedger: true;
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
    signedLedgerRequiredForRealLaunch: true;
    launchRehearsalRequiredBeforeRealCanary: true;
    rollbackCheckpointRequired: true;
    auditSinkRequired: true;
    observabilityHandoffRequired: true;
    supportBridgeRequired: true;
    noRemoteMutationByDefault: true;
    noNetworkRequiredByDefault: true;
    secretsSerialized: false;
  };
};
