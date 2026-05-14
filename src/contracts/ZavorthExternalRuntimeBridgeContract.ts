export const ZAVORTH_EXTERNAL_RUNTIME_BRIDGE_CONTRACT_VERSION =
  'natural-first-external-runtime-bridge/10' as const;

export type ZavorthExternalRuntimeSourceRuntimeId =
  | 'hermes'
  | 'openclaw';

export type ZavorthExternalRuntimeBridgeStatus =
  | 'bridge-ready'
  | 'attention'
  | 'blocked';

export type ZavorthExternalRuntimeDecision =
  | 'absorb'
  | 'adapt'
  | 'externalize'
  | 'replace'
  | 'reject';

export type ZavorthExternalRuntimeBridgePhase =
  | 'phase-0-inventory'
  | 'phase-1-contract-layer'
  | 'phase-2-native-engine'
  | 'phase-3-sidecar-adapter'
  | 'phase-4-capability-providers'
  | 'phase-5-channels-messaging'
  | 'phase-6-sessions-memory-continuation'
  | 'phase-7-delegated-workers'
  | 'phase-8-native-replacement';

export type ZavorthExternalRuntimeCapabilityId =
  | 'external-capability-inventory'
  | 'external-runtime-readonly-probe'
  | 'error-classifier'
  | 'tool-call-repair'
  | 'safe-tool-parallelism'
  | 'procedural-memory'
  | 'skill-curator'
  | 'channel-gateway-normalization'
  | 'delegated-workers';

export type ZavorthExternalRuntimeNaturalFirstRoute =
  | 'light-chat'
  | 'llm-reply'
  | 'capability-discovery'
  | 'approval-proposal'
  | 'tool-preview'
  | 'governed-execution'
  | 'memory-recall';

export type ZavorthExternalRuntimeSourceRuntimeDescriptor = {
  id: ZavorthExternalRuntimeSourceRuntimeId;
  label: string;
  role: 'reference-runtime' | 'optional-sidecar' | 'capability-source';
  quarantine: {
    diagnosticsOnly: true;
    publicIdentityAllowed: false;
    sourceNamesAreCanonical: false;
    credentialsStayBehindPorts: true;
  };
  allowedReadSurface: string[];
  blockedByDefault: string[];
};

export type ZavorthExternalRuntimeCandidate = {
  id: ZavorthExternalRuntimeCapabilityId;
  label: string;
  sourceRuntimeIds: ZavorthExternalRuntimeSourceRuntimeId[];
  sourcePattern: string;
  decision: ZavorthExternalRuntimeDecision;
  phase: ZavorthExternalRuntimeBridgePhase;
  priority: number;
  naturalFirstRoute: ZavorthExternalRuntimeNaturalFirstRoute;
  zavorthOwner: {
    contract: string;
    service: string;
    commandCenterProjection: string;
  };
  safety: {
    dryRunFirst: true;
    noSourceRuntimeCodeExecution: true;
    noDirectToolExecution: true;
    noDirectUserReply: true;
    noAutonomousSkillMutation: boolean;
    approvalRequiredForLive: boolean;
    gatewayEntry: 'ZavorthAgentGateway';
    replyExit: 'Zavorth ReplyPipeline';
    memoryOwner: 'Zavorth MemoryWithReceipts';
  };
  acceptanceGates: string[];
  nextPack: string;
};

export type ZavorthExternalRuntimeBridgeSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_EXTERNAL_RUNTIME_BRIDGE_CONTRACT_VERSION;
  status: ZavorthExternalRuntimeBridgeStatus;
  planId: '291 - Plano Zavorth External Runtime Absorption';
  naturalFirstPackStatus: string;
  externalRuntimes: ZavorthExternalRuntimeSourceRuntimeDescriptor[];
  candidates: ZavorthExternalRuntimeCandidate[];
  firstImplementationQueue: ZavorthExternalRuntimeCapabilityId[];
  gatewayPolicy: {
    naturalFirstClosed: boolean;
    freeTextEntrypoint: 'ZavorthAgentGateway';
    allExternalInboundViaGateway: true;
    slashShortcutsPreserved: true;
    approvedSurfaces: Array<'web' | 'cli' | 'telegram' | 'api'>;
    noLlmDirectEntryForExternalRuntime: true;
    noExternalReplyBypass: true;
  };
  publicIdentityPolicy: {
    publicAgentName: 'Zavorth';
    externalRuntimeNamesQuarantinedToDiagnostics: true;
    noSourceRuntimeCanonicalFields: true;
    commandCenterMayShowAdapterDetailsOnly: true;
  };
  summary: {
    candidateCount: number;
    absorbCount: number;
    adaptCount: number;
    externalizeCount: number;
    replaceCount: number;
    rejectCount: number;
    approvalRequiredForLiveCount: number;
    dryRunOnlyCount: number;
    executionPerformed: false;
    sourceRuntimeCodeExecuted: false;
    sidecarsStarted: false;
    toolsLaunched: false;
    filesMutated: false;
    userFacingSourceIdentityLeak: false;
  };
  nextActions: Array<{
    id: string;
    label: string;
    candidateId: ZavorthExternalRuntimeCapabilityId;
    command: string;
    requiresApproval: boolean;
  }>;
  policy: {
    zavorthRemainsOnlyKernel: true;
    externalRuntimeIsAdvisoryUntilNormalized: true;
    approvalEnvelopeRequiredForRiskyContinuation: true;
    importedMemoryRequiresProvenance: true;
    importedSkillMutationRequiresApproval: true;
    readOnlyProbeBeforeLiveSidecar: true;
    commandCenterProjectionRequired: true;
    noImplementationPerformedByBridge: true;
  };
  commands: {
    inspect: 'npm run zavorth:external-runtime-bridge';
    inspectJson: 'npm run zavorth:external-runtime-bridge:json';
    check: 'npm run zavorth:external-runtime-bridge:check --silent';
    nextPhase: '291 Phase 0 - Freeze And Inventory';
  };
};
