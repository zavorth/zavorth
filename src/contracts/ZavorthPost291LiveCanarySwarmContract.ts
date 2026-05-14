import type {
  ZavorthPost291CertificationSwarmStatus,
} from './ZavorthPost291CertificationSwarmContract.js';

export const ZAVORTH_POST_291_LIVE_CANARY_SWARM_CONTRACT_VERSION =
  'zavorth-post-291-live-canary-swarm/B' as const;

export type ZavorthPost291LiveCanarySwarmStatus =
  | 'live-canary-swarm-ready'
  | 'attention'
  | 'blocked';

export type ZavorthLiveCanaryKind =
  | 'provider'
  | 'channel'
  | 'tool-execution'
  | 'worker-activation';

export type ZavorthLiveCanaryRisk =
  | 'medium'
  | 'high'
  | 'critical';

export type ZavorthLiveCanaryInput = {
  canaryId: string;
  kind: ZavorthLiveCanaryKind;
  sequenceIndex: number;
  targetRef: string;
  dryRunCommand: string;
  liveCommand: string;
  rollbackCommand: string;
  requiredSecretRefs: string[];
  risk: ZavorthLiveCanaryRisk;
  ownerApprovalId?: string | null;
};

export type ZavorthLiveCanaryPreparationReceipt = {
  canaryId: string;
  kind: ZavorthLiveCanaryKind;
  sequenceIndex: number;
  targetRef: string;
  targetPublicName: 'Zavorth';
  status: 'prepared';
  parallelPreparationSafe: true;
  sequentialActivationRequired: true;
  dryRunPreviewReady: true;
  approvalRequired: true;
  ownerApprovalId: string | null;
  requiredSecretRefs: string[];
  risk: ZavorthLiveCanaryRisk;
  safety: {
    preparationOnly: true;
    noSecretValueSerialized: true;
    noLiveActivation: true;
    noProviderCall: true;
    noChannelSend: true;
    noToolExecution: true;
    noWorkerLaunch: true;
  };
};

export type ZavorthLiveCanaryActivationTicket = {
  canaryId: string;
  kind: ZavorthLiveCanaryKind;
  sequenceIndex: number;
  status: 'approval-required' | 'ready-for-manual-live-activation';
  activationMode: 'manual-approval-required';
  dryRunCommand: string;
  liveCommand: string;
  ownerApprovalId: string | null;
  approvalGranted: boolean;
  liveActivationPerformed: false;
  sequenceBlockedUntilPreviousPasses: boolean;
  rollbackRequiredBeforeNext: true;
  safety: {
    ticketOnly: true;
    noAutomaticActivation: true;
    noApprovalBypass: true;
    noLiveSideEffect: true;
  };
};

export type ZavorthLiveCanaryRollbackReceipt = {
  canaryId: string;
  kind: ZavorthLiveCanaryKind;
  rollbackToken: string;
  rollbackCommand: string;
  status: 'rollback-ready';
  automaticRollback: false;
  liveRollbackPerformed: false;
  safety: {
    rollbackPreparedOnly: true;
    noRollbackExecuted: true;
    operatorConfirmationRequired: true;
  };
};

export type ZavorthLiveCanarySequenceReceipt = {
  sequenceId: 'zavorth.post291.live-canary.sequence';
  status: 'sequence-ready' | 'blocked';
  order: ZavorthLiveCanaryKind[];
  parallelPreparationAllowed: true;
  sequentialActivationRequired: true;
  nextCanaryKind: ZavorthLiveCanaryKind | null;
  safety: {
    providerBeforeChannel: boolean;
    channelBeforeTool: boolean;
    toolBeforeWorker: boolean;
    noAutomaticPromotion: true;
  };
};

export type ZavorthPost291LiveCanaryCommandCenterProjection = {
  title: 'Post-291 Live Canary Swarm';
  status: ZavorthPost291LiveCanarySwarmStatus;
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

export type ZavorthPost291LiveCanarySwarmSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_POST_291_LIVE_CANARY_SWARM_CONTRACT_VERSION;
  status: ZavorthPost291LiveCanarySwarmStatus;
  planId: '302 - Post-291 Zavorth Operationalization Plan';
  phase: 'phase-b-live-canary-swarm';
  previousCertificationSwarmStatus: ZavorthPost291CertificationSwarmStatus;
  preparations: ZavorthLiveCanaryPreparationReceipt[];
  activationTickets: ZavorthLiveCanaryActivationTicket[];
  rollbackReceipts: ZavorthLiveCanaryRollbackReceipt[];
  sequence: ZavorthLiveCanarySequenceReceipt;
  commandCenterProjection: ZavorthPost291LiveCanaryCommandCenterProjection;
  acceptanceMatrix: Array<{
    requirementId: string;
    status: 'passed' | 'failed';
    evidence: string;
  }>;
  summary: {
    canariesPrepared: number;
    providerCanaries: number;
    channelCanaries: number;
    toolCanaries: number;
    workerCanaries: number;
    activationTickets: number;
    dryRunPreviewsReady: number;
    rollbackReceiptsReady: number;
    ownerApprovalsRequired: number;
    liveActivationsPerformed: 0;
    providerCallsPerformed: false;
    channelSendsPerformed: false;
    toolExecutionsPerformed: false;
    workerLaunchesPerformed: false;
    secretsSerialized: false;
    automaticPromotionsPerformed: false;
  };
  safety: {
    liveCanaryControlPlaneOnly: true;
    parallelPreparationAllowed: true;
    sequentialActivationRequired: true;
    noLiveActivationPerformed: true;
    noProviderCallPerformed: true;
    noChannelSendPerformed: true;
    noToolExecutionPerformed: true;
    noWorkerLaunchPerformed: true;
    noSecretValueSerialized: true;
    noAutomaticPromotion: true;
    approvalBypassAllowed: false;
    publicIdentityChanged: false;
  };
  commands: {
    inspect: 'npm run zavorth:post291-live-canary-swarm';
    inspectJson: 'npm run zavorth:post291-live-canary-swarm:json';
    check: 'npm run zavorth:post291-live-canary-swarm:check --silent';
    nextPhase: '302 Phase C - Release Candidate';
  };
};
