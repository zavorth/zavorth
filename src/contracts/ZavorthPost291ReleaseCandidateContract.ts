import type {
  ZavorthPost291LiveCanarySwarmStatus,
} from './ZavorthPost291LiveCanarySwarmContract.js';

export const ZAVORTH_POST_291_RELEASE_CANDIDATE_CONTRACT_VERSION =
  'zavorth-post-291-release-candidate/C' as const;

export type ZavorthPost291ReleaseCandidateStatus =
  | 'release-candidate-ready'
  | 'attention'
  | 'blocked';

export type ZavorthReleaseCandidateReadinessKind =
  | 'final-docs'
  | 'setup-presets'
  | 'command-center-polish'
  | 'release-checklist'
  | 'smoke-tests'
  | 'packaging';

export type ZavorthReleaseCandidateReadinessInput = {
  itemId: string;
  kind: ZavorthReleaseCandidateReadinessKind;
  title: string;
  command: string;
  artifactRef: string;
  passed: boolean;
  notes: string[];
};

export type ZavorthReleaseCandidateReadinessReceipt = {
  itemId: string;
  kind: ZavorthReleaseCandidateReadinessKind;
  title: string;
  status: 'passed' | 'blocked';
  command: string;
  artifactRef: string;
  notes: string[];
  safety: {
    receiptOnly: true;
    noPublish: true;
    noTag: true;
    noDeploy: true;
    noExternalUpload: true;
  };
};

export type ZavorthReleaseChecklistReceipt = {
  checklistId: 'zavorth.post291.release-candidate.checklist';
  status: 'passed' | 'blocked';
  requiredItems: ZavorthReleaseCandidateReadinessKind[];
  passedItems: number;
  blockedItems: number;
  publicIdentity: 'Zavorth';
  safety: {
    releaseChecklistOnly: true;
    noAutomaticPublish: true;
    noApprovalBypass: true;
    noPublicIdentityChange: true;
  };
};

export type ZavorthReleasePackagingReceipt = {
  packageId: 'zavorth.post291.release-candidate.package';
  status: 'package-preview-ready' | 'blocked';
  versionLabel: string;
  packageCommand: 'npm run build --silent';
  publishCommand: 'npm publish --dry-run';
  publishPerformed: false;
  tagCreated: false;
  deployPerformed: false;
  safety: {
    packagePreviewOnly: true;
    publishRequiresOwnerApproval: true;
    noRegistryPush: true;
    noGitTagCreated: true;
    noDeploy: true;
  };
};

export type ZavorthReleaseCandidateCommandCenterProjection = {
  title: 'Post-291 Release Candidate';
  status: ZavorthPost291ReleaseCandidateStatus;
  tone: 'ready' | 'attention' | 'blocked';
  cards: Array<{
    id: string;
    label: string;
    value: string;
    detail: string;
  }>;
  policyPills: string[];
  nextSafeAction: string;
};

export type ZavorthPost291ReleaseCandidateSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_POST_291_RELEASE_CANDIDATE_CONTRACT_VERSION;
  status: ZavorthPost291ReleaseCandidateStatus;
  planId: '302 - Post-291 Zavorth Operationalization Plan';
  phase: 'phase-c-release-candidate';
  previousLiveCanarySwarmStatus: ZavorthPost291LiveCanarySwarmStatus;
  readinessReceipts: ZavorthReleaseCandidateReadinessReceipt[];
  checklistReceipt: ZavorthReleaseChecklistReceipt;
  packagingReceipt: ZavorthReleasePackagingReceipt;
  commandCenterProjection: ZavorthReleaseCandidateCommandCenterProjection;
  acceptanceMatrix: Array<{
    requirementId: string;
    status: 'passed' | 'failed';
    evidence: string;
  }>;
  summary: {
    readinessItems: number;
    passedReadinessItems: number;
    blockedReadinessItems: number;
    finalDocsReady: number;
    setupPresetsReady: number;
    commandCenterPolishReady: number;
    releaseChecklistReady: number;
    smokeTestsReady: number;
    packagingReady: number;
    publishPerformed: false;
    tagCreated: false;
    deployPerformed: false;
    externalUploadsPerformed: false;
  };
  safety: {
    releaseCandidateOnly: true;
    publishRequiresOwnerApproval: true;
    noPublishPerformed: true;
    noGitTagCreated: true;
    noDeployPerformed: true;
    noExternalUploadPerformed: true;
    noApprovalBypass: true;
    publicIdentityChanged: false;
  };
  commands: {
    inspect: 'npm run zavorth:post291-release-candidate';
    inspectJson: 'npm run zavorth:post291-release-candidate:json';
    check: 'npm run zavorth:post291-release-candidate:check --silent';
    planStatus: '302 plan complete';
  };
};
