import type { ParityCertificationGateStatus } from './ParityCertificationContract.js';
import type { PreCanaryGoNoGoAlignmentSnapshot } from './PreCanaryGoNoGoAlignmentContract.js';

export const ZAVORTH_CANARY_PLAN_DRY_RUN_HOLD_CONTRACT_VERSION = '2026-05-04.phase-19';

export type CanaryPlanDryRunHoldStatus = 'dry-run-ready' | 'attention' | 'blocked';

export type CanaryPlanDryRunHoldControlStatus =
  | 'aligned'
  | 'dry-run-ready'
  | 'operator-ready'
  | 'locked'
  | 'blocked';

export type CanaryPlanDryRunHoldControlMode =
  | 'source-gate'
  | 'canary-design'
  | 'rollback-design'
  | 'observation-design'
  | 'operator-handoff'
  | 'policy-lock';

export type CanaryPlanDryRunHoldSurface =
  | 'pre-canary-alignment'
  | 'rollout-plan'
  | 'cohort'
  | 'feature-flag'
  | 'observation'
  | 'health-budget'
  | 'rollback'
  | 'support'
  | 'audit'
  | 'promotion'
  | 'publication'
  | 'policy';

export type CanaryPlanDryRunHoldControl = {
  id:
    | 'pre-canary-alignment-input'
    | 'rollout-plan-dry-run-gate'
    | 'canary-cohort-plan'
    | 'feature-flag-default-off-plan'
    | 'observation-window-plan'
    | 'health-budget-plan'
    | 'rollback-trigger-plan'
    | 'rollback-owner-call-tree'
    | 'support-incident-bridge-plan'
    | 'audit-receipt-plan'
    | 'canary-launch-hold'
    | 'promotion-hold'
    | 'global-rollout-hold'
    | 'publication-hold';
  surface: CanaryPlanDryRunHoldSurface;
  mode: CanaryPlanDryRunHoldControlMode;
  status: CanaryPlanDryRunHoldControlStatus;
  command: string;
  receipt: string;
  evidence: string;
  requiredForDryRun: true;
  dryRunOnly: boolean;
  canaryStarted: false;
  rolloutStarted: false;
  deployExecuted: false;
  promotionExecuted: false;
  publishesPackage: false;
  mutatesRemoteState: false;
  secretValuesSerialized: false;
};

export type CanaryPlanDryRunHoldGate = {
  id:
    | 'pre-canary-alignment-ready'
    | 'rollout-plan-dry-run-linked'
    | 'cohort-flag-observation-defined'
    | 'rollback-and-health-triggers-defined'
    | 'owner-support-audit-covered'
    | 'canary-launch-side-effects-blocked'
    | 'promotion-and-publication-held'
    | 'dry-run-receipts-complete';
  status: ParityCertificationGateStatus;
  title: string;
  observed: number | string | boolean;
  threshold: number | string | boolean;
  receipt: string;
  nextAction: string;
};

export type CanaryPlanDryRunHoldReceipt = {
  id: string;
  controlId: CanaryPlanDryRunHoldControl['id'];
  status: CanaryPlanDryRunHoldControlStatus;
  command: string;
  evidence: string;
  dryRunOnly: boolean;
  noCanaryStarted: true;
  noRolloutStarted: true;
  noDeployExecuted: true;
  noPromotionExecuted: true;
  noPackagePublished: true;
  noRemoteMutation: true;
  secretValuesSerialized: false;
};

export type CanaryPlanDryRunHoldSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_CANARY_PLAN_DRY_RUN_HOLD_CONTRACT_VERSION;
  status: CanaryPlanDryRunHoldStatus;
  releaseCandidate: {
    id: PreCanaryGoNoGoAlignmentSnapshot['releaseCandidate']['id'];
    packageName: PreCanaryGoNoGoAlignmentSnapshot['releaseCandidate']['packageName'];
    packageVersion: PreCanaryGoNoGoAlignmentSnapshot['releaseCandidate']['packageVersion'];
    channel: 'release-candidate';
    npmDistTag: 'rc';
    canaryPlanDryRunOnly: true;
  };
  plan: {
    state: 'dry-run-ready' | 'blocked';
    effectiveDecision: 'hold';
    executable: false;
    launchAuthorized: false;
    canaryCohortId: 'dry-run-canary-cohort';
    cohortPercent: 5;
    maxCohortPercent: 10;
    featureFlagKey: 'zavorth.rc.1.1.canary';
    featureFlagDefault: 'off';
    observationWindowHours: 48;
    minimumObservationWindowHours: 24;
    rollbackTrigger: {
      errorRatePercent: 1;
      p95LatencyMs: 2500;
      crashFreePercent: 99.5;
      supportSeverity: 'high';
      killSwitchRequired: true;
    };
    promotion: {
      automaticPromotion: false;
      manualPromotionRequired: true;
      nextCohortPercent: null;
      promotionWindowOpen: false;
    };
  };
  summary: {
    controls: number;
    requiredControls: number;
    alignedControls: number;
    dryRunReadyControls: number;
    operatorReadyControls: number;
    lockedControls: number;
    blockedControls: number;
    gates: number;
    passedGates: number;
    failedGates: number;
    receipts: number;
    preCanaryAlignmentStatus: PreCanaryGoNoGoAlignmentSnapshot['status'];
    preCanaryAlignmentReady: boolean;
    rolloutPlanDryRunLinked: boolean;
    cohortDefined: boolean;
    flagDefaultOffDefined: boolean;
    observationWindowDefined: boolean;
    rollbackTriggerDefined: boolean;
    canaryPlanDryRunReady: boolean;
    canaryStartAuthorized: false;
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
  preCanaryAlignment: Pick<
    PreCanaryGoNoGoAlignmentSnapshot,
    'contractVersion' | 'status' | 'releaseCandidate' | 'decision' | 'summary' | 'commands'
  >;
  controls: CanaryPlanDryRunHoldControl[];
  gates: CanaryPlanDryRunHoldGate[];
  receipts: CanaryPlanDryRunHoldReceipt[];
  commands: {
    run: string;
    runJson: string;
    check: string;
    requireDryRunReady: string;
    preCanaryAlignment: string;
    capabilityAutopilotRolloutPlan: string;
    releaseExecutionHold: string;
    canaryPromotionHold: string;
    focusedTests: string[];
    typecheck: string;
    nextPhase: 'Canary execution approval ledger';
  };
  policy: {
    canaryPlanOnly: true;
    dryRunOnly: true;
    consumesPreCanaryGoNoGoAlignment: true;
    noCanaryStarted: true;
    noRolloutStarted: true;
    noDeployExecuted: true;
    noPromotionExecuted: true;
    noNpmPublish: true;
    noGithubReleaseCreated: true;
    noGitTagMoved: true;
    noStableTagMoved: true;
    noLatestTagMoved: true;
    noAutomaticPromotion: true;
    noSkipCanary: true;
    explicitLaunchApprovalRequired: true;
    rollbackTriggerRequired: true;
    observationWindowRequired: true;
    noRemoteMutationByDefault: true;
    noNetworkRequiredByDefault: true;
    secretsSerialized: false;
  };
};
