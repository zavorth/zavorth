import type { ParityCertificationGateStatus } from './ParityCertificationContract.js';
import type { CanaryLaunchRehearsalSnapshot } from './CanaryLaunchRehearsalContract.js';

export const ZAVORTH_CANARY_MONITORING_ROLLBACK_GATE_CONTRACT_VERSION = '2026-05-04.phase-22';

export type CanaryMonitoringRollbackGateStatus =
  | 'monitoring-gate-ready'
  | 'attention'
  | 'blocked';

export type CanaryMonitoringRollbackControlStatus =
  | 'linked'
  | 'monitoring-ready'
  | 'rollback-ready'
  | 'operator-ready'
  | 'locked'
  | 'blocked';

export type CanaryMonitoringRollbackControlMode =
  | 'source-gate'
  | 'monitoring-threshold'
  | 'rollback-control'
  | 'operator-handoff'
  | 'policy-lock';

export type CanaryMonitoringRollbackSurface =
  | 'launch-rehearsal'
  | 'release-execution'
  | 'observation-window'
  | 'telemetry'
  | 'health-budget'
  | 'error-rate'
  | 'latency'
  | 'cohort'
  | 'rollback'
  | 'kill-switch'
  | 'audit'
  | 'incident'
  | 'support'
  | 'promotion'
  | 'publication'
  | 'policy';

export type CanaryMonitoringRollbackControl = {
  id:
    | 'launch-rehearsal-input'
    | 'held-release-execution-gate'
    | 'observation-window-monitor'
    | 'telemetry-dashboard-monitor'
    | 'health-budget-monitor'
    | 'error-rate-threshold-monitor'
    | 'latency-threshold-monitor'
    | 'cohort-exposure-monitor'
    | 'rollback-trigger-control'
    | 'rollback-command-rehearsal'
    | 'kill-switch-control'
    | 'audit-evidence-control'
    | 'incident-commander-handoff'
    | 'support-bridge-handoff'
    | 'promotion-lock'
    | 'publication-lock'
    | 'remote-mutation-lock';
  surface: CanaryMonitoringRollbackSurface;
  mode: CanaryMonitoringRollbackControlMode;
  status: CanaryMonitoringRollbackControlStatus;
  command: string;
  receipt: string;
  evidence: string;
  requiredForGate: true;
  dryRunOnly: boolean;
  liveTrafficObserved: false;
  canaryStarted: false;
  rollbackExecuted: false;
  promotionExecuted: false;
  publishesPackage: false;
  mutatesRemoteState: false;
  secretValuesSerialized: false;
};

export type CanaryMonitoringRollbackGate = {
  id:
    | 'launch-rehearsal-ready'
    | 'held-release-execution-gate-linked'
    | 'monitoring-signals-ready'
    | 'rollback-controls-ready'
    | 'abort-thresholds-explicit'
    | 'operator-handoffs-ready'
    | 'live-traffic-side-effects-blocked'
    | 'publication-and-promotion-held'
    | 'remote-mutation-blocked'
    | 'monitoring-receipts-complete';
  status: ParityCertificationGateStatus;
  title: string;
  observed: number | string | boolean;
  threshold: number | string | boolean;
  receipt: string;
  nextAction: string;
};

export type CanaryMonitoringRollbackReceipt = {
  id: string;
  controlId: CanaryMonitoringRollbackControl['id'];
  status: CanaryMonitoringRollbackControlStatus;
  command: string;
  evidence: string;
  dryRunOnly: boolean;
  liveTrafficObserved: false;
  noCanaryStarted: true;
  noRollbackExecuted: true;
  noPromotionExecuted: true;
  noPackagePublished: true;
  noRemoteMutation: true;
  secretValuesSerialized: false;
};

export type CanaryMonitoringRollbackGateSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_CANARY_MONITORING_ROLLBACK_GATE_CONTRACT_VERSION;
  status: CanaryMonitoringRollbackGateStatus;
  releaseCandidate: {
    id: CanaryLaunchRehearsalSnapshot['releaseCandidate']['id'];
    packageName: CanaryLaunchRehearsalSnapshot['releaseCandidate']['packageName'];
    packageVersion: CanaryLaunchRehearsalSnapshot['releaseCandidate']['packageVersion'];
    channel: 'release-candidate';
    npmDistTag: 'rc';
    monitoringGateOnly: true;
  };
  monitoring: {
    state: 'monitoring-gate-ready' | 'blocked';
    effectiveDecision: 'hold';
    canaryCohortId: CanaryLaunchRehearsalSnapshot['rehearsal']['canaryCohortId'];
    featureFlagKey: CanaryLaunchRehearsalSnapshot['rehearsal']['featureFlagKey'];
    observationWindowHours: CanaryLaunchRehearsalSnapshot['rehearsal']['observationWindowHours'];
    monitoringCadenceMinutes: 15;
    initialCanaryPercent: 5;
    maxCanaryPercentBeforePromotion: 5;
    abortThresholdsDefined: boolean;
    healthSignalMode: 'dry-run';
    rollbackTriggerMode: 'dry-run';
    rollbackCommandRehearsed: boolean;
    liveTrafficObserved: false;
    rollbackRecommended: false;
    promotable: false;
  };
  summary: {
    controls: number;
    requiredControls: number;
    linkedControls: number;
    monitoringReadyControls: number;
    rollbackReadyControls: number;
    operatorReadyControls: number;
    lockedControls: number;
    blockedControls: number;
    gates: number;
    passedGates: number;
    failedGates: number;
    receipts: number;
    launchRehearsalStatus: CanaryLaunchRehearsalSnapshot['status'];
    launchRehearsalReady: boolean;
    heldReleaseExecutionGateLinked: boolean;
    observationWindowDefined: boolean;
    telemetryDashboardReady: boolean;
    healthBudgetReady: boolean;
    errorRateThresholdReady: boolean;
    latencyThresholdReady: boolean;
    cohortExposureBounded: boolean;
    abortThresholdsReady: boolean;
    rollbackTriggersReady: boolean;
    rollbackCommandRehearsed: boolean;
    killSwitchReady: boolean;
    auditEvidenceReady: boolean;
    operatorHandoffsReady: boolean;
    monitoringRollbackGateReady: boolean;
    liveTrafficObserved: false;
    signatureRecorded: false;
    launchAuthorized: false;
    executionApproved: false;
    canaryStarted: false;
    rollbackExecuted: false;
    rolloutStarted: false;
    promotionExecuted: false;
    remoteStateMutated: false;
    npmPublishExecuted: false;
    githubReleaseCreated: false;
    gitTagMoved: false;
    secretValuesSerialized: false;
  };
  launchRehearsal: Pick<
    CanaryLaunchRehearsalSnapshot,
    'contractVersion' | 'status' | 'releaseCandidate' | 'rehearsal' | 'summary' | 'commands'
  >;
  controls: CanaryMonitoringRollbackControl[];
  gates: CanaryMonitoringRollbackGate[];
  receipts: CanaryMonitoringRollbackReceipt[];
  commands: {
    run: string;
    runJson: string;
    check: string;
    requireGateReady: string;
    launchRehearsal: string;
    releaseExecutionHeld: string;
    monitoringDryRun: string;
    rollbackDryRun: string;
    focusedTests: string[];
    typecheck: string;
    nextPhase: 'Canary promotion decision ledger';
  };
  policy: {
    monitoringGateOnly: true;
    consumesCanaryLaunchRehearsal: true;
    noLiveTrafficByDefault: true;
    noSignatureRecordedByDefault: true;
    noLaunchAuthorizedByDefault: true;
    noCanaryStarted: true;
    noRollbackExecuted: true;
    noRolloutStarted: true;
    noPromotionExecuted: true;
    noNpmPublish: true;
    noGithubReleaseCreated: true;
    noGitTagMoved: true;
    noStableTagMoved: true;
    noLatestTagMoved: true;
    noAutomaticExecution: true;
    noAutomaticPromotion: true;
    abortThresholdsRequired: true;
    observationWindowRequired: true;
    healthSignalsRequired: true;
    rollbackGateRequiredBeforePromotion: true;
    incidentCommanderRequired: true;
    supportBridgeRequired: true;
    auditEvidenceRequired: true;
    manualPromotionRequired: true;
    noRemoteMutationByDefault: true;
    noNetworkRequiredByDefault: true;
    secretsSerialized: false;
  };
};
