import type { ReleaseCertificationGateStatus } from './ReleaseCertificationContract.js';
import type { ReleaseCandidateDistributionRehearsalSnapshot } from './ReleaseCandidateDistributionRehearsalContract.js';

export const ZAVORTH_PRE_CANARY_GO_NO_GO_ALIGNMENT_CONTRACT_VERSION = '2026-05-04.checkpoint-18';

export type PreCanaryGoNoGoAlignmentStatus = 'aligned' | 'attention' | 'blocked';

export type PreCanaryGoNoGoDecisionState =
  | 'ready-for-decision'
  | 'go-recorded'
  | 'no-go-recorded'
  | 'blocked';

export type PreCanaryGoNoGoAlignmentControlStatus =
  | 'aligned'
  | 'operator-ready'
  | 'locked'
  | 'blocked';

export type PreCanaryGoNoGoAlignmentControlMode =
  | 'evidence-gate'
  | 'owner-assignment'
  | 'decision-ledger'
  | 'policy-lock';

export type PreCanaryGoNoGoAlignmentSurface =
  | 'release-candidate'
  | 'release-adoption'
  | 'pre-canary'
  | 'public-adoption'
  | 'rollback'
  | 'approval'
  | 'incident'
  | 'policy';

export type PreCanaryGoNoGoAlignmentControl = {
  id:
    | 'distribution-rehearsal-input'
    | 'release-adoption-readiness-link'
    | 'release-candidate-pre-canary-gate-link'
    | 'public-adoption-pilot-link'
    | 'rollback-command-confirmation'
    | 'approver-role-assignment'
    | 'rollback-owner-assignment'
    | 'incident-owner-assignment'
    | 'decision-ledger-template'
    | 'canary-start-lock'
    | 'auto-promote-lock'
    | 'remote-mutation-lock';
  surface: PreCanaryGoNoGoAlignmentSurface;
  mode: PreCanaryGoNoGoAlignmentControlMode;
  status: PreCanaryGoNoGoAlignmentControlStatus;
  command: string;
  receipt: string;
  evidence: string;
  requiredForAlignment: true;
  requiresHumanDecision: boolean;
  canaryStarted: false;
  rolloutStarted: false;
  deployExecuted: false;
  publishesPackage: false;
  mutatesRemoteState: false;
  secretValuesSerialized: false;
};

export type PreCanaryGoNoGoAlignmentGate = {
  id:
    | 'distribution-rehearsal-ready'
    | 'pre-canary-runtime-gates-linked'
    | 'go-no-go-decision-ledger-ready'
    | 'rollback-incident-ownership-covered'
    | 'canary-side-effects-blocked'
    | 'no-publication-regression'
    | 'alignment-receipts-complete';
  status: ReleaseCertificationGateStatus;
  title: string;
  observed: number | string | boolean;
  threshold: number | string | boolean;
  receipt: string;
  nextAction: string;
};

export type PreCanaryGoNoGoAlignmentReceipt = {
  id: string;
  controlId: PreCanaryGoNoGoAlignmentControl['id'];
  status: PreCanaryGoNoGoAlignmentControlStatus;
  command: string;
  evidence: string;
  noCanaryStarted: true;
  noRolloutStarted: true;
  noDeployExecuted: true;
  noPackagePublished: true;
  noRemoteMutation: true;
  secretValuesSerialized: false;
};

export type PreCanaryGoNoGoAlignmentSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_PRE_CANARY_GO_NO_GO_ALIGNMENT_CONTRACT_VERSION;
  status: PreCanaryGoNoGoAlignmentStatus;
  releaseCandidate: {
    id: ReleaseCandidateDistributionRehearsalSnapshot['releaseCandidate']['id'];
    packageName: ReleaseCandidateDistributionRehearsalSnapshot['releaseCandidate']['packageName'];
    packageVersion: ReleaseCandidateDistributionRehearsalSnapshot['releaseCandidate']['packageVersion'];
    channel: 'release-candidate';
    npmDistTag: 'rc';
    preCanaryAlignmentOnly: true;
  };
  decision: {
    state: PreCanaryGoNoGoDecisionState;
    effectiveDecision: 'hold';
    approvalRecorded: false;
    goDecisionRecorded: false;
    noGoDecisionRecorded: false;
    approvalReceiptId: null;
    approverId: null;
    rollbackOwner: null;
    incidentOwner: null;
    requiredFields: [
      'decision',
      'approverId',
      'approvalReceiptId',
      'rollbackOwner',
      'incidentOwner',
    ];
  };
  summary: {
    controls: number;
    requiredControls: number;
    alignedControls: number;
    operatorReadyControls: number;
    lockedControls: number;
    blockedControls: number;
    gates: number;
    passedGates: number;
    failedGates: number;
    receipts: number;
    distributionRehearsalStatus: ReleaseCandidateDistributionRehearsalSnapshot['status'];
    distributionRehearsed: boolean;
    preCanaryRuntimeGateLinked: boolean;
    releaseAdoptionGateLinked: boolean;
    publicAdoptionGateLinked: boolean;
    rollbackPreviewLinked: boolean;
    alignmentReady: boolean;
    canaryStartAuthorized: false;
    canaryStarted: false;
    rolloutStarted: false;
    deployExecuted: false;
    remoteStateMutated: false;
    npmPublishExecuted: false;
    githubReleaseCreated: false;
    gitTagMoved: false;
    secretValuesSerialized: false;
  };
  distributionRehearsal: Pick<
    ReleaseCandidateDistributionRehearsalSnapshot,
    'contractVersion' | 'status' | 'releaseCandidate' | 'summary' | 'commands'
  >;
  controls: PreCanaryGoNoGoAlignmentControl[];
  gates: PreCanaryGoNoGoAlignmentGate[];
  receipts: PreCanaryGoNoGoAlignmentReceipt[];
  commands: {
    run: string;
    runJson: string;
    check: string;
    requireAligned: string;
    distributionRehearsal: string;
    releaseAdoptionReadiness: string;
    releaseCandidatePreCanary: string;
    publicAdoptionPilot: string;
    rollbackPreview: string;
    focusedTests: string[];
    typecheck: string;
    nextStage: 'Canary plan dry-run and hold';
  };
  policy: {
    alignmentOnly: true;
    consumesDistributionRehearsal: true;
    noCanaryStarted: true;
    noRolloutStarted: true;
    noDeployExecuted: true;
    noNpmPublish: true;
    noGithubReleaseCreated: true;
    noGitTagMoved: true;
    noStableTagMoved: true;
    noLatestTagMoved: true;
    noAutomaticPromotion: true;
    explicitApprovalRequired: true;
    approverRequired: true;
    rollbackOwnerRequired: true;
    incidentOwnerRequired: true;
    noRemoteMutationByDefault: true;
    noNetworkRequiredByDefault: true;
    secretsSerialized: false;
  };
};
