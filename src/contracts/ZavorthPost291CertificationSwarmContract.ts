import type {
  ZavorthNativeReplacementDecommissionStatus,
} from './ZavorthNativeReplacementDecommissionContract.js';

export const ZAVORTH_POST_291_CERTIFICATION_SWARM_CONTRACT_VERSION =
  'zavorth-post-291-certification-swarm/A' as const;

export type ZavorthPost291CertificationSwarmStatus =
  | 'certification-swarm-ready'
  | 'attention'
  | 'blocked';

export type ZavorthCertificationLaneKind =
  | 'security-hardening'
  | 'approval-policy-certification'
  | 'regression-gates'
  | 'observability-audit'
  | 'rollback-baseline';

export type ZavorthCertificationGateStatus =
  | 'passed'
  | 'failed';

export type ZavorthCertificationGateInput = {
  gateId: string;
  command: string;
  evidence: string;
  passed: boolean;
};

export type ZavorthCertificationLaneInput = {
  laneId: string;
  kind: ZavorthCertificationLaneKind;
  subagentRole: string;
  objective: string;
  gates: ZavorthCertificationGateInput[];
  findings: string[];
};

export type ZavorthCertificationGateReceipt = {
  gateId: string;
  command: string;
  status: ZavorthCertificationGateStatus;
  evidence: string;
  safety: {
    certificationReceiptOnly: true;
    noLiveActivation: true;
    noProviderCall: true;
    noToolExecution: true;
  };
};

export type ZavorthCertificationLaneReceipt = {
  laneId: string;
  kind: ZavorthCertificationLaneKind;
  subagentRole: string;
  objective: string;
  status: 'passed' | 'blocked';
  parallelSafe: true;
  writeScope: 'certification-receipts-only';
  gates: ZavorthCertificationGateReceipt[];
  findings: string[];
  blockers: string[];
  safety: {
    noLiveActivation: true;
    noProviderCall: true;
    noChannelSend: true;
    noToolExecution: true;
    noWorkerLaunch: true;
    noFileMutation: true;
    approvalBypassAllowed: false;
  };
};

export type ZavorthCertificationSwarmAggregationReceipt = {
  aggregationId: 'zavorth.post291.certification-swarm.aggregate';
  status: 'passed' | 'blocked';
  laneCount: number;
  passedLanes: number;
  blockedLanes: number;
  gateCount: number;
  passedGates: number;
  blockedGates: number;
  parallelizationMode: 'subagent-lanes-ready';
  nextPhase: '302 Phase B - Live Canary Swarm';
  safety: {
    aggregateOnly: true;
    noLiveActivation: true;
    noAutomaticCanaryPromotion: true;
    noApprovalBypass: true;
  };
};

export type ZavorthPost291CommandCenterProjection = {
  title: 'Post-291 Certification Swarm';
  status: ZavorthPost291CertificationSwarmStatus;
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

export type ZavorthPost291CertificationSwarmSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_POST_291_CERTIFICATION_SWARM_CONTRACT_VERSION;
  status: ZavorthPost291CertificationSwarmStatus;
  planId: '302 - Post-291 Zavorth Operationalization Plan';
  phase: 'phase-a-certification-swarm';
  previousNativeReplacementStatus: ZavorthNativeReplacementDecommissionStatus;
  lanes: ZavorthCertificationLaneReceipt[];
  aggregation: ZavorthCertificationSwarmAggregationReceipt;
  commandCenterProjection: ZavorthPost291CommandCenterProjection;
  acceptanceMatrix: Array<{
    requirementId: string;
    status: 'passed' | 'failed';
    evidence: string;
  }>;
  summary: {
    certificationLanes: number;
    passedLanes: number;
    blockedLanes: number;
    gates: number;
    passedGates: number;
    securityHardeningLanes: number;
    approvalPolicyLanes: number;
    regressionGateLanes: number;
    observabilityAuditLanes: number;
    rollbackBaselineLanes: number;
    liveActivationsStarted: 0;
    providerCallsPerformed: false;
    channelSendsPerformed: false;
    toolExecutionsPerformed: false;
    workerLaunchesPerformed: false;
    fileMutationsPerformed: false;
  };
  safety: {
    certificationOnly: true;
    canaryActivationDeferred: true;
    noLiveActivation: true;
    noProviderCallPerformed: true;
    noChannelSendPerformed: true;
    noToolExecutionPerformed: true;
    noWorkerLaunchPerformed: true;
    noFileMutationPerformed: true;
    approvalBypassAllowed: false;
    publicIdentityChanged: false;
  };
  commands: {
    inspect: 'npm run zavorth:post291-certification-swarm';
    inspectJson: 'npm run zavorth:post291-certification-swarm:json';
    check: 'npm run zavorth:post291-certification-swarm:check --silent';
    nextPhase: '302 Phase B - Live Canary Swarm';
  };
};
