import type { ReleaseCertificationGateStatus } from './ReleaseCertificationContract.js';
import type { ReleaseCandidatePackageFreezeSnapshot } from './ReleaseCandidatePackageFreezeContract.js';

export const ZAVORTH_RELEASE_CANDIDATE_DISTRIBUTION_REHEARSAL_CONTRACT_VERSION = '2026-05-04.gate-17';

export type ReleaseCandidateDistributionRehearsalStatus = 'rehearsed' | 'attention' | 'blocked';

export type ReleaseCandidateDistributionRehearsalStepStatus = 'dry-ready' | 'operator-ready' | 'blocked';

export type ReleaseCandidateDistributionRehearsalStepMode =
  | 'local-dry-run'
  | 'operator-rehearsal'
  | 'policy-lock';

export type ReleaseCandidateDistributionSurface =
  | 'package'
  | 'npm'
  | 'github'
  | 'installer'
  | 'rollback'
  | 'docs'
  | 'checksums'
  | 'adoption'
  | 'policy';

export type ReleaseCandidateDistributionRehearsalStep = {
  id:
    | 'rc-freeze-input'
    | 'pack-dry-run-rehearsal'
    | 'tarball-contents-review'
    | 'checksum-manifest-rehearsal'
    | 'npm-rc-publish-dry-run'
    | 'github-release-draft-plan'
    | 'installer-dry-run-rehearsal'
    | 'rollback-dry-run-rehearsal'
    | 'public-docs-release-route'
    | 'distribution-policy-dry-gate'
    | 'adoption-pre-canary-guard'
    | 'no-publish-lock';
  surface: ReleaseCandidateDistributionSurface;
  mode: ReleaseCandidateDistributionRehearsalStepMode;
  status: ReleaseCandidateDistributionRehearsalStepStatus;
  command: string;
  receipt: string;
  evidence: string;
  requiredForRehearsal: true;
  mutatesRemoteState: false;
  publishesPackage: false;
  movesGitTag: false;
  executesInstaller: false;
  secretValuesSerialized: false;
};

export type ReleaseCandidateDistributionRehearsalGate = {
  id:
    | 'rc-freeze-ready'
    | 'required-rehearsal-steps-ready'
    | 'distribution-commands-dry-run-only'
    | 'no-publication-side-effects'
    | 'rollback-and-installer-rehearsed'
    | 'docs-and-policy-linked'
    | 'rehearsal-receipts-complete';
  status: ReleaseCertificationGateStatus;
  title: string;
  observed: number | string | boolean;
  threshold: number | string | boolean;
  receipt: string;
  nextAction: string;
};

export type ReleaseCandidateDistributionRehearsalReceipt = {
  id: string;
  stepId: ReleaseCandidateDistributionRehearsalStep['id'];
  status: ReleaseCandidateDistributionRehearsalStepStatus;
  command: string;
  evidence: string;
  noRemoteMutation: true;
  noPackagePublished: true;
  noGitTagMoved: true;
  noInstallerExecuted: true;
  secretValuesSerialized: false;
};

export type ReleaseCandidateDistributionRehearsalSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_RELEASE_CANDIDATE_DISTRIBUTION_REHEARSAL_CONTRACT_VERSION;
  status: ReleaseCandidateDistributionRehearsalStatus;
  releaseCandidate: {
    id: ReleaseCandidatePackageFreezeSnapshot['package']['releaseCandidateId'];
    packageName: ReleaseCandidatePackageFreezeSnapshot['package']['name'];
    packageVersion: ReleaseCandidatePackageFreezeSnapshot['package']['version'];
    channel: 'release-candidate';
    npmDistTag: 'rc';
    distributionRehearsalOnly: true;
  };
  summary: {
    steps: number;
    requiredSteps: number;
    dryReadySteps: number;
    operatorReadySteps: number;
    blockedSteps: number;
    gates: number;
    passedGates: number;
    failedGates: number;
    receipts: number;
    freezeStatus: ReleaseCandidatePackageFreezeSnapshot['status'];
    packageFrozen: boolean;
    rehearsalReady: boolean;
    npmPublishExecuted: false;
    githubReleaseCreated: false;
    gitTagMoved: false;
    installerExecuted: false;
    remoteStateMutated: false;
    secretValuesSerialized: false;
  };
  packageFreeze: Pick<ReleaseCandidatePackageFreezeSnapshot, 'contractVersion' | 'status' | 'package' | 'summary' | 'commands'>;
  steps: ReleaseCandidateDistributionRehearsalStep[];
  gates: ReleaseCandidateDistributionRehearsalGate[];
  receipts: ReleaseCandidateDistributionRehearsalReceipt[];
  commands: {
    run: string;
    runJson: string;
    check: string;
    requireRehearsed: string;
    freeze: string;
    packDryRun: string;
    npmPublishDryRun: string;
    releasePath: string;
    publicSync: string;
    distributionPolicy: string;
    focusedTests: string[];
    typecheck: string;
    nextAction: 'Pre-canary go/no-go alignment';
  };
  policy: {
    rehearsalOnly: true;
    consumesReleaseCandidateFreeze: true;
    noNpmPublish: true;
    noGithubReleaseCreated: true;
    noGitTagMoved: true;
    noStableTagMoved: true;
    noLatestTagMoved: true;
    noInstallerExecuted: true;
    noRemoteMutationByDefault: true;
    noNetworkRequiredByDefault: true;
    secretsSerialized: false;
  };
};
