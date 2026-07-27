import type {
  ZavorthSessionMemoryContinuationStatus,
} from '../ZavorthSessionMemoryContinuationContract.js';

export const ZAVORTH_DELEGATED_WORKER_BRIDGE_CONTRACT_VERSION =
  'zavorth-delegated-worker-bridge/7' as const;

export type ZavorthDelegatedWorkerBridgeStatus =
  | 'delegated-worker-bridge-ready'
  | 'attention'
  | 'blocked';

export type ZavorthWorkerRole =
  | 'reader'
  | 'writer'
  | 'reviewer'
  | 'runner';

export type ZavorthWorkerHealth =
  | 'ready'
  | 'busy'
  | 'degraded'
  | 'blocked';

export type ZavorthDelegatedTaskRisk =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export type ZavorthWorkerDescriptorInput = {
  sourceRuntimeId: string;
  sourceWorkerId: string;
  role: ZavorthWorkerRole;
  health: ZavorthWorkerHealth;
  capabilities: string[];
  maxRuntimeMs: number;
  canMutateFiles: boolean;
  requiresApprovalToLaunch: boolean;
};

export type ZavorthWorkerDescriptor = {
  workerId: string;
  sourceRuntimeId: string;
  sourceWorkerId: string;
  sourceRuntimeDiagnosticsOnly: true;
  publicName: 'Zavorth';
  role: ZavorthWorkerRole;
  health: ZavorthWorkerHealth;
  capabilities: string[];
  maxRuntimeMs: number;
  canMutateFiles: boolean;
  dispatchMode: 'zavorth-gateway-delegated-only';
  directSourceLaunchAllowed: false;
  approvalRequiredForLiveLaunch: boolean;
  safety: {
    sourceWorkerNotCanonical: true;
    noDirectLaunch: true;
    noSourceRuntimeCodeExecuted: true;
  };
};

export type ZavorthDelegatedTaskEnvelopeInput = {
  taskId: string;
  workerId: string;
  requestedBySessionId: string;
  objective: string;
  resourceRefs: string[];
  risk: ZavorthDelegatedTaskRisk;
  timeoutMs: number;
  cancellationToken: string;
  approvalGranted?: boolean;
};

export type ZavorthDelegatedTaskEnvelope = {
  delegatedTaskId: string;
  workerId: string;
  requestedBySessionId: string;
  objective: string;
  resourceRefs: string[];
  risk: ZavorthDelegatedTaskRisk;
  timeoutMs: number;
  cancellationToken: string;
  status: 'dry-run-ready' | 'blocked';
  dispatchMode: 'zavorth-gateway-delegated-only';
  gatewayEntrypoint: 'ZavorthAgentGateway';
  approvalRequired: boolean;
  approvalGranted: boolean;
  directSourceWorkerLaunchAllowed: false;
  liveDispatchPerformed: false;
  safety: {
    boundedTaskEnvelope: true;
    noWorkerLaunch: true;
    noToolExecution: true;
    noApprovalBypass: true;
  };
};

export type ZavorthWorkerTimeoutCancellationReceipt = {
  delegatedTaskId: string;
  timeoutMs: number;
  cancellationToken: string;
  timeoutPolicy: 'cancel-task-and-return-status';
  cancellationAvailable: true;
  timerStarted: false;
  safety: {
    dryRunOnly: true;
    noBackgroundTimerStarted: true;
    cancellationTokenRequired: true;
  };
};

export type ZavorthSourceWorkerLaunchGateReceipt = {
  workerId: string;
  status: 'blocked' | 'approval-required';
  approvalRequired: true;
  approvalGranted: boolean;
  sourceWorkerLaunchBlocked: true;
  reason: string;
  safety: {
    noSourceWorkerLaunch: true;
    laterGateRequired: true;
    noApprovalBypass: true;
  };
};

export type ZavorthWorkerLifecycleDryRunReceipt = {
  delegatedTaskId: string;
  workerId: string;
  status: 'dry-run-ready' | 'blocked';
  lifecycle: Array<{
    state: 'queued' | 'leased' | 'running' | 'cancelled' | 'completed' | 'blocked';
    dryRunOnly: true;
    detail: string;
  }>;
  sourceWorkerLaunchBlocked: boolean;
  liveWorkerStarted: false;
  safety: {
    lifecyclePreviewOnly: true;
    noWorkerLaunch: true;
    noSourceRuntimeCodeExecuted: true;
  };
};

export type ZavorthExecutorResultInput = {
  delegatedTaskId: string;
  workerId: string;
  status: 'success' | 'failed' | 'cancelled' | 'timed-out';
  exitCode: number | null;
  stdoutPreview: string;
  stderrPreview: string;
  artifactRefs: string[];
};

export type ZavorthExecutorResultMappingReceipt = {
  delegatedTaskId: string;
  workerId: string;
  status: 'mapped';
  artifactEvents: Array<{
    artifactId: string;
    sourceRef: string;
    artifactType: 'worker-output';
  }>;
  event: {
    eventId: string;
    eventType: 'delegated-worker-result';
    status: ZavorthExecutorResultInput['status'];
  };
  runStatus: {
    statusId: string;
    state: 'completed' | 'failed' | 'cancelled' | 'timed-out';
    exitCode: number | null;
    stdoutPreview: string;
    stderrPreview: string;
  };
  safety: {
    resultMappingOnly: true;
    noArtifactWritePerformed: true;
    noMemoryWritePerformed: true;
  };
};

export type ZavorthDelegatedWorkerZavorthControlProjection = {
  title: 'Delegated Worker Bridge';
  status: ZavorthDelegatedWorkerBridgeStatus;
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

export type ZavorthDelegatedWorkerBridgeSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_DELEGATED_WORKER_BRIDGE_CONTRACT_VERSION;
  status: ZavorthDelegatedWorkerBridgeStatus;
  planId: 'Zavorth External Runtime Integration';
  gate: 'delegated-workers';
  previousSessionMemoryStatus: ZavorthSessionMemoryContinuationStatus;
  workerDescriptors: ZavorthWorkerDescriptor[];
  delegatedTaskEnvelope: ZavorthDelegatedTaskEnvelope;
  timeoutCancellationReceipt: ZavorthWorkerTimeoutCancellationReceipt;
  sourceWorkerLaunchGateReceipt: ZavorthSourceWorkerLaunchGateReceipt;
  lifecycleDryRunReceipt: ZavorthWorkerLifecycleDryRunReceipt;
  executorResultMappingReceipt: ZavorthExecutorResultMappingReceipt;
  zavorthControlProjection: ZavorthDelegatedWorkerZavorthControlProjection;
  acceptanceMatrix: Array<{
    requirementId: string;
    status: 'passed' | 'failed';
    evidence: string;
  }>;
  summary: {
    workerDescriptors: number;
    delegatedTaskEnvelopes: number;
    dryRunLifecycleReceipts: number;
    timeoutPolicies: number;
    cancellationPolicies: number;
    sourceWorkerLaunchesBlocked: number;
    executorResultsMapped: number;
    artifactEventsReturned: number;
    liveWorkersStarted: 0;
    sourceRuntimeCodeExecuted: false;
    toolExecutionPerformed: false;
  };
  safety: {
    workerBridgeOnly: true;
    dispatchMode: 'zavorth-gateway-delegated-only';
    noSourceRuntimeCodeExecuted: true;
    noWorkerLaunchPerformed: true;
    noToolExecutionPerformed: true;
    noArtifactWritePerformed: true;
    noMemoryWritePerformed: true;
    approvalBypassAllowed: false;
    publicIdentityChanged: false;
  };
  commands: {
    inspect: 'npm run zavorth:delegated-worker-bridge';
    inspectJson: 'npm run zavorth:delegated-worker-bridge:json';
    check: 'npm run zavorth:delegated-worker-bridge:check --silent';
    nextAction: 'ZavorthControl controls - Native Replacement And Decommission';
  };
};
