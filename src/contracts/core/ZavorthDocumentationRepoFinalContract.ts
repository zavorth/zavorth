export const ZAVORTH_DOCUMENTATION_REPO_FINAL_CONTRACT_VERSION =
  '2026-05-14.checkpoint-15-documentation-repo-final' as const;

export type ZavorthDocumentationRepoFinalStatus = 'passed' | 'attention' | 'failed';

export type ZavorthDocumentationRepoFinalCheck = {
  id: string;
  label: string;
  status: ZavorthDocumentationRepoFinalStatus;
  observed: string;
  target: string;
  details: string[];
};

export type ZavorthDocumentationRepoFinalSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_DOCUMENTATION_REPO_FINAL_CONTRACT_VERSION;
  source: 'ZavorthDocumentationRepoFinalService';
  status: ZavorthDocumentationRepoFinalStatus;
  summary: {
    checks: number;
    passed: number;
    attention: number;
    failed: number;
    publicDocsAudited: number;
    publicDocsNeedingFix: number;
    archiveOrDeleteCandidates: number;
    moveInternalCandidates: number;
    rootNoiseFilesPresent: number;
    rawSecretsSerialized: false;
    workspaceMutationPerformed: false;
    externalIoPerformed: false;
  };
  checks: ZavorthDocumentationRepoFinalCheck[];
  guarantees: {
    dashboardIsPrimarySurface: true;
    satelliteAndCliRemainValidSurfaces: true;
    retiredVisualSurfacesAreNotUserFacing: true;
    docsDoNotPublishImplementationDiaries: true;
    publicIdentityIsZavorthNative: true;
    openSourceDistributionIsExplicit: true;
    liveCertificationRemainsWired: true;
    dashboardCanExecute: false;
  };
  commands: {
    inspect: 'npm run zavorth:documentation-repo-final';
    inspectJson: 'npm run zavorth:documentation-repo-final:json';
    check: 'npm run zavorth:documentation-repo-final:check --silent';
    workspace: 'npm run workspace:check';
    next: 'Product closure complete';
  };
};
