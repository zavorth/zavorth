import type {
  ZavorthChannelMessagingBridgeStatus,
} from './ZavorthChannelMessagingBridgeContract.js';

export const ZAVORTH_SESSION_MEMORY_CONTINUATION_CONTRACT_VERSION =
  'zavorth-session-memory-continuation/6' as const;

export type ZavorthSessionMemoryContinuationStatus =
  | 'session-memory-continuation-ready'
  | 'attention'
  | 'blocked';

export type ZavorthTranscriptRole =
  | 'user'
  | 'assistant'
  | 'tool'
  | 'system';

export type ZavorthTranscriptVisibility =
  | 'public'
  | 'private'
  | 'restricted'
  | 'secret';

export type ZavorthSessionHistoryItemInput = {
  sourceEventId: string;
  role: ZavorthTranscriptRole;
  text: string;
  visibility: ZavorthTranscriptVisibility;
  occurredAt: string;
  provenanceRef: string;
};

export type ZavorthSessionHistoryBridgeInput = {
  sourceRuntimeId: string;
  sourceSessionId: string;
  channelId: string;
  zavorthSessionId: string;
  transcript: ZavorthSessionHistoryItemInput[];
};

export type ZavorthSessionHistoryBridgeReceipt = {
  status: 'bridged' | 'blocked';
  sourceRuntimeId: string;
  sourceSessionId: string;
  zavorthSessionId: string;
  channelId: string;
  receivedItems: number;
  canonicalOwner: 'Zavorth';
  safety: {
    sourceSessionNotCanonical: true;
    noSourceRuntimeCodeExecuted: true;
    noMemoryWritePerformed: true;
  };
};

export type ZavorthFilteredTranscriptItem = {
  itemId: string;
  sourceEventId: string;
  role: ZavorthTranscriptRole;
  text: string;
  visibility: 'public';
  originalVisibility: ZavorthTranscriptVisibility;
  occurredAt: string;
  provenanceRef: string;
  redactionApplied: boolean;
};

export type ZavorthDroppedTranscriptItem = {
  sourceEventId: string;
  originalVisibility: Exclude<ZavorthTranscriptVisibility, 'public'>;
  reason: 'private-filtered' | 'restricted-filtered' | 'secret-filtered';
};

export type ZavorthPrivacyFilteringReceipt = {
  status: 'filtered' | 'blocked';
  sourceSessionId: string;
  acceptedItems: ZavorthFilteredTranscriptItem[];
  droppedItems: ZavorthDroppedTranscriptItem[];
  redactionsApplied: number;
  safety: {
    privateFilteredBeforeContext: true;
    restrictedFilteredBeforeMemory: true;
    secretValuesRedacted: true;
    noPrivateContextLeak: true;
    noRawTranscriptMemoryWrite: true;
  };
};

export type ZavorthMemorySignalKind =
  | 'procedural'
  | 'decision'
  | 'context'
  | 'handoff';

export type ZavorthImportedMemorySignal = {
  signalId: string;
  sessionId: string;
  kind: ZavorthMemorySignalKind;
  text: string;
  confidence: number;
  retentionHint: 'short' | 'medium' | 'long';
  advisoryOnly: true;
  writePerformed: false;
  provenance: {
    sourceRuntimeId: string;
    sourceSessionId: string;
    sourceEventIds: string[];
    provenanceRefs: string[];
    importedAt: string;
  };
};

export type ZavorthMemorySignalMappingReceipt = {
  status: 'signals-ready' | 'blocked';
  sessionId: string;
  signals: ZavorthImportedMemorySignal[];
  safety: {
    provenanceRequired: true;
    importedMemoryAdvisoryOnly: true;
    noMemoryWritePerformed: true;
    correctOrForgetRequired: true;
  };
};

export type ZavorthReplayHandoffSnapshot = {
  status: 'handoff-ready' | 'blocked';
  replayId: string;
  sessionId: string;
  contextItems: Array<{
    itemId: string;
    role: ZavorthTranscriptRole;
    text: string;
    sourceEventId: string;
  }>;
  memorySignalRefs: string[];
  redactedBeforeContext: true;
  rawTranscriptIncluded: false;
  safety: {
    privateDataExcluded: true;
    restrictedDataExcluded: true;
    secretValuesRedacted: true;
    noMemoryWritePerformed: true;
  };
};

export type ZavorthContinuationRequest = {
  status: 'ready' | 'blocked';
  continuationId: string;
  sessionId: string;
  replayId: string;
  gatewayEntrypoint: 'ZavorthAgentGateway';
  naturalFirstRoute: 'memory-recall' | 'governed-execution';
  requestText: string;
  sourceRuntimeDiagnosticsOnly: true;
  safety: {
    continuationThroughGateway: true;
    noDirectSourceContinuation: true;
    noToolExecution: true;
    noProviderCall: true;
  };
};

export type ZavorthSessionMemoryCommandCenterProjection = {
  title: 'Session Memory Continuation';
  status: ZavorthSessionMemoryContinuationStatus;
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

export type ZavorthSessionMemoryContinuationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SESSION_MEMORY_CONTINUATION_CONTRACT_VERSION;
  status: ZavorthSessionMemoryContinuationStatus;
  planId: '291 - Plano Zavorth External Runtime Absorption';
  phase: 'phase-6-sessions-memory-continuation';
  previousChannelMessagingStatus: ZavorthChannelMessagingBridgeStatus;
  historyBridgeReceipt: ZavorthSessionHistoryBridgeReceipt;
  privacyFilteringReceipt: ZavorthPrivacyFilteringReceipt;
  memorySignalMappingReceipt: ZavorthMemorySignalMappingReceipt;
  replayHandoffSnapshot: ZavorthReplayHandoffSnapshot;
  continuationRequest: ZavorthContinuationRequest;
  commandCenterProjection: ZavorthSessionMemoryCommandCenterProjection;
  acceptanceMatrix: Array<{
    requirementId: string;
    status: 'passed' | 'failed';
    evidence: string;
  }>;
  summary: {
    transcriptItemsReceived: number;
    publicContextItems: number;
    privateRestrictedSecretItemsFiltered: number;
    redactionsApplied: number;
    memorySignals: number;
    provenanceBackedSignals: number;
    replayHandoffSnapshots: number;
    continuationGatewayRequests: number;
    memoryWritesPerformed: false;
    hiddenMemoryAuthorityCreated: false;
    sourceRuntimeCodeExecuted: false;
  };
  safety: {
    sessionBridgeOnly: true;
    noSourceRuntimeCodeExecuted: true;
    noPrivateContextLeak: true;
    noRawTranscriptMemoryWrite: true;
    noMemoryWritePerformed: true;
    importedMemoryAdvisoryOnly: true;
    continuationThroughGateway: true;
    publicIdentityChanged: false;
  };
  commands: {
    inspect: 'npm run zavorth:session-memory-continuation';
    inspectJson: 'npm run zavorth:session-memory-continuation:json';
    check: 'npm run zavorth:session-memory-continuation:check --silent';
    nextPhase: '291 Phase 7 - Delegated Workers';
  };
};
