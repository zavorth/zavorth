import type {
  ZavorthNativeEngineAbsorptionStatus,
} from '../ZavorthNativeEngineAbsorptionContract.js';
import type {
  ZavorthExternalRuntimeNaturalFirstRoute,
} from './ZavorthExternalRuntimeBridgeContract.js';

export const ZAVORTH_EXTERNAL_SIDECAR_ADAPTER_CONTRACT_VERSION =
  'zavorth-external-sidecar-adapter/3' as const;

export type ZavorthExternalSidecarAdapterStatus =
  | 'sidecar-adapter-ready'
  | 'attention'
  | 'blocked';

export type ZavorthExternalSidecarProbeMode =
  | 'fixture-readonly'
  | 'live-readonly';

export type ZavorthExternalSidecarProbeStatus =
  | 'probe-ready'
  | 'attention'
  | 'blocked';

export type ZavorthExternalSidecarRisk =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export type ZavorthExternalSidecarSourceRef = {
  sourceRuntimeId: string;
  sourceRuntimeLabel: string;
  diagnosticsOnly: true;
  publicName: 'Zavorth';
};

export type ZavorthExternalSidecarHealthRecord = {
  sourceRuntimeId: string;
  status: 'healthy' | 'degraded' | 'offline' | 'unknown';
  checkedAt: string;
  details: string;
};

export type ZavorthExternalSidecarCapabilityRecord = {
  id: string;
  sourceRuntimeId: string;
  name: string;
  kind: 'skill' | 'tool' | 'channel' | 'worker' | 'memory' | 'runtime';
  risk: ZavorthExternalSidecarRisk;
  availability: 'available' | 'degraded' | 'unavailable';
  zavorthEquivalent: string;
};

export type ZavorthExternalSidecarChannelRecord = {
  id: string;
  sourceRuntimeId: string;
  kind: 'telegram' | 'discord' | 'web' | 'cli' | 'api' | 'other';
  inboundSupported: boolean;
  outboundSupported: boolean;
  credentialBoundary: 'external-port' | 'zavorth-secret-ref' | 'unknown';
};

export type ZavorthExternalSidecarSkillRecord = {
  id: string;
  sourceRuntimeId: string;
  name: string;
  description: string;
  mutationAllowed: false;
  importDecision: 'adapt' | 'absorb' | 'externalize' | 'reject';
};

export type ZavorthExternalSidecarToolRecord = {
  id: string;
  sourceRuntimeId: string;
  name: string;
  risk: ZavorthExternalSidecarRisk;
  exposedDirectly: false;
  requiredGate: 'tool-preview' | 'approval-proposal' | 'blocked';
};

export type ZavorthExternalSidecarSessionRecord = {
  id: string;
  sourceRuntimeId: string;
  channelId: string;
  status: 'active' | 'idle' | 'closed' | 'unknown';
  mappedToZavorthSession: string;
};

export type ZavorthExternalSidecarEventRecord = {
  id: string;
  sourceRuntimeId: string;
  channelId: string;
  sessionId: string;
  direction: 'inbound' | 'outbound';
  eventType: 'message' | 'reaction' | 'tool' | 'approval' | 'health';
  observedAt: string;
  textPreview: string;
};

export type ZavorthExternalSidecarWorkerHealthRecord = {
  id: string;
  sourceRuntimeId: string;
  role: 'reader' | 'writer' | 'reviewer' | 'runner' | 'unknown';
  health: 'ready' | 'busy' | 'degraded' | 'blocked';
  directExecutionAllowed: false;
};

export type ZavorthExternalSidecarReadOnlyProbeSnapshot = {
  mode: ZavorthExternalSidecarProbeMode;
  status: ZavorthExternalSidecarProbeStatus;
  sourceRefs: ZavorthExternalSidecarSourceRef[];
  health: ZavorthExternalSidecarHealthRecord[];
  capabilities: ZavorthExternalSidecarCapabilityRecord[];
  channels: ZavorthExternalSidecarChannelRecord[];
  skills: ZavorthExternalSidecarSkillRecord[];
  tools: ZavorthExternalSidecarToolRecord[];
  sessions: ZavorthExternalSidecarSessionRecord[];
  events: ZavorthExternalSidecarEventRecord[];
  workers: ZavorthExternalSidecarWorkerHealthRecord[];
  summary: {
    sourceRuntimes: number;
    healthRecords: number;
    capabilities: number;
    channels: number;
    skills: number;
    tools: number;
    sessions: number;
    events: number;
    workers: number;
  };
  safety: {
    readOnly: true;
    fixtureAllowed: true;
    liveReadOnlyRequiresExplicitMode: true;
    noSourceRuntimeCodeExecuted: true;
    noSidecarStarted: true;
    noOutboundIo: true;
  };
};

export type ZavorthExternalSidecarInboundEventInput = {
  sourceRuntimeId: string;
  sourceEventId: string;
  channelId: string;
  sessionId: string;
  text: string;
  authorRef?: string;
  attachments?: Array<{ id: string; kind: string; safeRef: string }>;
};

export type ZavorthExternalSidecarInboundGatewayReceipt = {
  status: 'routed-to-gateway' | 'blocked';
  sourceEventId: string;
  gatewayEntrypoint: 'ZavorthAgentGateway';
  replyExit: 'ReplyPipeline';
  naturalFirstRoute: ZavorthExternalRuntimeNaturalFirstRoute;
  gatewayPacket: {
    adapterSource: 'external-sidecar-adapter';
    messageText: string;
    sourceRuntimeId: string;
    channelId: string;
    sessionId: string;
    authorRef: string;
    attachments: Array<{ id: string; kind: string; safeRef: string }>;
  };
  safety: {
    directReplyBlocked: true;
    replyPipelineRequired: true;
    sourceRuntimeCodeExecuted: false;
    toolExecutionPerformed: false;
  };
};

export type ZavorthExternalSidecarOutboundActionKind =
  | 'message-send'
  | 'tool-preview'
  | 'worker-launch'
  | 'approval-decision';

export type ZavorthExternalSidecarOutboundDryRunInput = {
  actionId: string;
  kind: ZavorthExternalSidecarOutboundActionKind;
  targetRef: string;
  textPreview: string;
  risk: ZavorthExternalSidecarRisk;
  approvalGranted?: boolean;
};

export type ZavorthExternalSidecarOutboundDryRunReceipt = {
  actionId: string;
  kind: ZavorthExternalSidecarOutboundActionKind;
  replyExit: 'ReplyPipeline';
  policyDecision: 'dry-run-allowed' | 'blocked';
  approvalRequired: boolean;
  approvalGranted: boolean;
  risk: ZavorthExternalSidecarRisk;
  reason: string;
  nextSafeAction: string;
  safety: {
    dryRunOnly: true;
    liveIoPerformed: false;
    replyPipelineRequired: true;
    noToolExecution: true;
    noWorkerLaunch: true;
    noApprovalBypass: true;
  };
};

export type ZavorthExternalSidecarZavorthControlProjection = {
  title: 'External Sidecar Adapter';
  status: ZavorthExternalSidecarAdapterStatus;
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

export type ZavorthExternalSidecarAdapterSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_EXTERNAL_SIDECAR_ADAPTER_CONTRACT_VERSION;
  status: ZavorthExternalSidecarAdapterStatus;
  planId: 'Zavorth External Runtime Integration';
  phase: 'sidecar-adapter';
  previousNativeEngineStatus: ZavorthNativeEngineAbsorptionStatus;
  readOnlyProbe: ZavorthExternalSidecarReadOnlyProbeSnapshot;
  inboundGatewayReceipt: ZavorthExternalSidecarInboundGatewayReceipt;
  outboundDryRunReceipt: ZavorthExternalSidecarOutboundDryRunReceipt;
  riskyOutboundDryRunReceipt: ZavorthExternalSidecarOutboundDryRunReceipt;
  zavorthControlProjection: ZavorthExternalSidecarZavorthControlProjection;
  acceptanceMatrix: Array<{
    requirementId: string;
    status: 'passed' | 'failed';
    evidence: string;
  }>;
  summary: {
    sourceChannelsListed: number;
    sourceSkillsListed: number;
    sourceToolsListed: number;
    sourceSessionsListed: number;
    workerHealthRecordsListed: number;
    inboundEventsRoutedToGateway: number;
    outboundDryRunsEvaluated: number;
    riskyOutboundActionsBlocked: number;
    sidecarsStarted: false;
    liveIoPerformed: false;
  };
  safety: {
    readOnlyProbeOnly: true;
    sourceRuntimeCodeExecuted: false;
    sidecarsStarted: false;
    outboundIoPerformed: false;
    toolExecutionPerformed: false;
    workerLaunchPerformed: false;
    approvalBypassAllowed: false;
    publicIdentityChanged: false;
  };
  commands: {
    inspect: 'npm run zavorth:external-sidecar-adapter';
    inspectJson: 'npm run zavorth:external-sidecar-adapter:json';
    check: 'npm run zavorth:external-sidecar-adapter:check --silent';
    nextStage: '291 Connector registry - Capability Providers';
  };
};
