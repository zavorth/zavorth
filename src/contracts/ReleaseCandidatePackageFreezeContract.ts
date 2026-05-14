import type { ParityCertificationGateStatus } from './ParityCertificationContract.js';
import type { PublicLaunchSmokeEvidenceLedgerSnapshot } from './PublicLaunchSmokeEvidenceLedgerContract.js';

export const ZAVORTH_RELEASE_CANDIDATE_PACKAGE_FREEZE_CONTRACT_VERSION = '2026-05-04.phase-16';
export const ZAVORTH_RELEASE_CANDIDATE_PACKAGE_NAME = 'zavorth';
export const ZAVORTH_RELEASE_CANDIDATE_PACKAGE_VERSION = '1.1.0';
export const ZAVORTH_RELEASE_CANDIDATE_FREEZE_ID = 'zavorth@1.1.0-rc.1';

export type ReleaseCandidatePackageFreezeStatus = 'frozen' | 'attention' | 'blocked';

export type ReleaseCandidatePackageFreezeArtifactStatus = 'locked' | 'dry-ready' | 'manual-pending' | 'blocked';

export type ReleaseCandidatePackageFreezeArtifactKind =
  | 'manifest'
  | 'source'
  | 'build'
  | 'typecheck'
  | 'pack'
  | 'smoke-ledger'
  | 'release-notes'
  | 'checksum'
  | 'rollback'
  | 'policy';

export type ReleaseCandidatePackageFreezeArtifact = {
  id:
    | 'package-manifest-lock'
    | 'source-tree-lock'
    | 'runtime-build-lock'
    | 'runtime-typecheck-lock'
    | 'npm-pack-dry-run-lock'
    | 'public-launch-smoke-ledger-lock'
    | 'public-launch-certification-lock'
    | 'release-notes-lock'
    | 'checksum-manifest-lock'
    | 'rollback-plan-lock'
    | 'no-publish-policy-lock';
  kind: ReleaseCandidatePackageFreezeArtifactKind;
  status: ReleaseCandidatePackageFreezeArtifactStatus;
  command: string;
  receipt: string;
  evidence: string;
  requiredForFreeze: boolean;
  blocksPublish: boolean;
  secretValuesSerialized: false;
};

export type ReleaseCandidatePackageFreezeGate = {
  id:
    | 'public-launch-ledger-ready'
    | 'required-artifacts-locked'
    | 'package-identity-frozen'
    | 'dry-pack-command-present'
    | 'rollback-plan-present'
    | 'no-publish-side-effects'
    | 'freeze-receipts-complete';
  status: ParityCertificationGateStatus;
  title: string;
  observed: number | string | boolean;
  threshold: number | string | boolean;
  receipt: string;
  nextAction: string;
};

export type ReleaseCandidatePackageFreezeReceipt = {
  id: string;
  artifactId: ReleaseCandidatePackageFreezeArtifact['id'];
  status: ReleaseCandidatePackageFreezeArtifactStatus;
  command: string;
  evidence: string;
  noPublish: true;
  noTagMoved: true;
  noInstallerExecuted: true;
  secretValuesSerialized: false;
};

export type ReleaseCandidatePackageFreezeSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_RELEASE_CANDIDATE_PACKAGE_FREEZE_CONTRACT_VERSION;
  status: ReleaseCandidatePackageFreezeStatus;
  package: {
    name: typeof ZAVORTH_RELEASE_CANDIDATE_PACKAGE_NAME;
    version: typeof ZAVORTH_RELEASE_CANDIDATE_PACKAGE_VERSION;
    releaseCandidateId: typeof ZAVORTH_RELEASE_CANDIDATE_FREEZE_ID;
    channel: 'release-candidate';
    npmDistTag: 'rc';
    stableTagAllowed: false;
    latestTagAllowed: false;
  };
  summary: {
    artifacts: number;
    requiredArtifacts: number;
    lockedArtifacts: number;
    manualPendingArtifacts: number;
    blockedArtifacts: number;
    gates: number;
    passedGates: number;
    failedGates: number;
    receipts: number;
    publicLaunchLedgerStatus: PublicLaunchSmokeEvidenceLedgerSnapshot['status'];
    publicLaunchReady: boolean;
    packageFrozen: boolean;
    publishAllowed: false;
    npmPublishExecuted: false;
    gitTagMoved: false;
    installerExecuted: false;
    secretValuesSerialized: false;
  };
  publicLaunchSmokeLedger: Pick<PublicLaunchSmokeEvidenceLedgerSnapshot, 'contractVersion' | 'status' | 'summary' | 'commands'>;
  artifacts: ReleaseCandidatePackageFreezeArtifact[];
  gates: ReleaseCandidatePackageFreezeGate[];
  receipts: ReleaseCandidatePackageFreezeReceipt[];
  commands: {
    run: string;
    runJson: string;
    check: string;
    requireFrozen: string;
    build: string;
    typecheck: string;
    packDryRun: string;
    smokeLedger: string;
    releasePath: string;
    focusedTests: string[];
    nextPhase: 'Release candidate distribution rehearsal';
  };
  policy: {
    freezeOnly: true;
    consumesPublicLaunchSmokeLedger: true;
    noNpmPublish: true;
    noGitTagMoved: true;
    noStableTagMoved: true;
    noLatestTagMoved: true;
    noInstallerExecuted: true;
    noNetworkRequiredByDefault: true;
    secretsSerialized: false;
  };
};
