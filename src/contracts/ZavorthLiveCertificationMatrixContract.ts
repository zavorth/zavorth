export const ZAVORTH_LIVE_CERTIFICATION_MATRIX_CONTRACT_VERSION =
  '2026-05-14.phase-13-live-certification-matrix' as const;

export type ZavorthLiveCertificationGateStatus = 'passed' | 'attention' | 'blocked';

export type ZavorthLiveCertificationItemStatus =
  | 'live_passed'
  | 'dry_run_passed'
  | 'needs_setup'
  | 'blocked'
  | 'unsupported';

export type ZavorthLiveCertificationItemKind =
  | 'surface'
  | 'provider'
  | 'channel'
  | 'sandbox'
  | 'trust'
  | 'subagent'
  | 'skill'
  | 'scheduler'
  | 'perception'
  | 'abuse';

export type ZavorthLiveCertificationMatrixItem = {
  id: string;
  label: string;
  kind: ZavorthLiveCertificationItemKind;
  status: ZavorthLiveCertificationItemStatus;
  requiredForDailyUse: boolean;
  userVisible: boolean;
  evidence: string[];
  nextAction: string | null;
};

export type ZavorthLiveCertificationAbuseCase = {
  id: string;
  label: string;
  attack: string;
  expectedDisposition: 'blocked' | 'dry_run_passed' | 'needs_setup';
  status: ZavorthLiveCertificationItemStatus;
  evidence: string[];
};

export type ZavorthLiveCertificationMatrixSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_LIVE_CERTIFICATION_MATRIX_CONTRACT_VERSION;
  source: 'ZavorthLiveCertificationMatrixService';
  status: ZavorthLiveCertificationGateStatus;
  matrix: ZavorthLiveCertificationMatrixItem[];
  abuseCases: ZavorthLiveCertificationAbuseCase[];
  summary: {
    items: number;
    livePassed: number;
    dryRunPassed: number;
    needsSetup: number;
    blocked: number;
    unsupported: number;
    abuseCases: number;
    abuseCasesControlled: number;
    dashboardCertified: boolean;
    cliCertified: boolean;
    providerP0Certified: boolean;
    channelMeshCertified: boolean;
    sandboxCertified: boolean;
    approvalsCertified: boolean;
    receiptsCertified: boolean;
    subagentsCertified: boolean;
    skillsCertified: boolean;
    schedulerCertified: boolean;
    perceptionDeviceCertified: boolean;
    rawSecretsSerialized: false;
    workspaceMutationPerformed: false;
    externalIoPerformed: false;
  };
  policy: {
    catalogSupportIsNotLiveProof: true;
    defaultRoutingRequiresLiveProof: true;
    sensitiveActionsRequirePolicyBroker: true;
    scheduledTasksCannotCreateScheduledTasks: true;
    subagentSpawnDepthLimited: true;
    skillsAreInstructionsOnlyByDefault: true;
    dashboardCanExecute: false;
    cliCanExecuteMutations: false;
    rawSecretsSerialized: false;
  };
  commands: {
    inspect: 'npm run zavorth:live-certification-matrix';
    inspectJson: 'npm run zavorth:live-certification-matrix:json';
    check: 'npm run zavorth:live-certification-matrix:check --silent';
    dailyCertify: 'npm run daily:certify --silent';
    nextPhase: 'Phase 14 - Documentation And Repo Final';
  };
};
