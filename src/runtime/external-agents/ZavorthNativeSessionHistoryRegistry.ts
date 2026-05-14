import {
  createZavorthNativeCapabilityRegistryFixture,
  normalizeZavorthNativeCapabilityRegistryReplacementFixture,
} from './ZavorthNativeCapabilityRegistry.js';
import {
  createZavorthNativeDashboardViewModelRegistryFixture,
  normalizeZavorthNativeDashboardViewModelRegistryFixture,
} from './ZavorthNativeDashboardViewModelRegistry.js';
import {
  createZavorthNativeIntegrationRegistryFixture,
  normalizeZavorthNativeIntegrationRegistryFixture,
} from './ZavorthNativeIntegrationRegistry.js';
import {
  normalizeExternalAgentCommandCenterLiveAssimilationFixture,
} from './ExternalAgentCommandCenterLiveAssimilation.js';
import {
  normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture,
} from './ExternalAgentExternalExecutorSessionHistoryReadOnlyBridge.js';
import type {
  ZavorthNativeCapabilityRegistry,
  ZavorthNativeCapabilityRegistryReplacementNormalization,
} from './ZavorthNativeCapabilityRegistry.js';
import type {
  ZavorthNativeDashboardViewModelRegistry,
  ZavorthNativeDashboardViewModelRegistryNormalization,
} from './ZavorthNativeDashboardViewModelRegistry.js';
import type {
  ZavorthNativeIntegrationRegistry,
  ZavorthNativeIntegrationRegistryNormalization,
} from './ZavorthNativeIntegrationRegistry.js';
import type {
  ExternalAgentCommandCenterLiveAssimilationNormalization,
  ExternalAgentCommandCenterOperationalStatus,
} from './ExternalAgentCommandCenterLiveAssimilation.js';
import type {
  ZavorthExternalMessageMetadataView,
  ZavorthExternalSessionView,
  ZavorthExternalSessionViewStatus,
  ExternalExecutorSessionHistoryReadOnlyBridgeNormalization,
} from './ExternalAgentExternalExecutorSessionHistoryReadOnlyBridge.js';
import type {
  UniversalAgentChannel,
} from '../agent/UniversalAgentRuntimeTypes.js';

export const ZAVORTH_NATIVE_SESSION_HISTORY_REGISTRY_NOW = '2026-04-29T02:00:00.000Z' as const;
export const ZAVORTH_NATIVE_SESSION_HISTORY_REGISTRY_RUNTIME_ID = 'zavorth-native-session-history-registry' as const;

export type ZavorthNativeSessionHistoryRegistryDecision =
  | 'blocked'
  | 'native-session-history-registry-ready';

export type ZavorthNativeSessionHistoryProvenanceKind =
  | 'command-center-assimilation'
  | 'dashboard-view-model-registry'
  | 'integration-registry'
  | 'native-capability-registry'
  | 'session-history-read-only-bridge'
  | 'sqlite-session-dry-run-design';

export type ZavorthNativeSessionHistoryProvenance = {
  nativeContract: 'ZavorthNativeSessionHistoryProvenance/v1';
  sourceKind: ZavorthNativeSessionHistoryProvenanceKind;
  sourceEvidenceIds: string[];
  sourceRuntimeNameInternal: 'ExternalExecutor';
  sourceRuntimePublicIdentity: false;
  sourceStructuresPublic: false;
  sourceIdsEvidenceOnly: true;
  redacted: true;
};

export type ZavorthNativeSessionMetadataRecord = {
  nativeContract: 'ZavorthNativeSessionMetadataRecord/v1';
  id: string;
  stableSessionId: string;
  publicSessionAlias: string;
  title: string;
  status: ZavorthExternalSessionViewStatus;
  channel: UniversalAgentChannel;
  participantMetadata: {
    participantCount: number;
    participantKinds: Array<'assistant' | 'system' | 'tool' | 'unknown' | 'user'>;
    rawParticipantIdsSerialized: false;
  };
  timestamps: {
    createdAt: string | null;
    updatedAt: string | null;
    timestampPrecision: 'source-metadata';
  };
  messageCount: number;
  threadRecordIds: string[];
  messageMetadataRecordIds: string[];
  capabilityRegistryEntryIds: string[];
  dashboardViewModelIds: string[];
  channelIntegrationIds: string[];
  transportIntegrationIds: string[];
  provenance: ZavorthNativeSessionHistoryProvenance;
  readOnly: true;
  runtimeExternalExecutorRequiredForSessionLookup: false;
  runtimeExternalExecutorRequiredForHistoryRender: false;
  sourceRuntimeAuthority: false;
  sessionImportAllowed: false;
  migrationAllowed: false;
  writeBackAllowed: false;
  sourceDbOpenedForWrite: false;
  sourceDbCopied: false;
  messageContentRawStored: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  sourceModuleCopied: false;
  adapterRemovalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeThreadMetadataRecord = {
  nativeContract: 'ZavorthNativeThreadMetadataRecord/v1';
  id: string;
  stableThreadId: string;
  publicThreadAlias: string;
  sessionRecordId: string;
  status: ZavorthExternalSessionViewStatus;
  channel: UniversalAgentChannel;
  messageMetadataRecordIds: string[];
  rawThreadIdSerialized: false;
  provenance: ZavorthNativeSessionHistoryProvenance;
  readOnly: true;
  migrationAllowed: false;
  writeBackAllowed: false;
  sourceDbOpenedForWrite: false;
  sourceDbCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeMessageMetadataRecord = {
  nativeContract: 'ZavorthNativeMessageMetadataRecord/v1';
  id: string;
  stableMessageId: string;
  publicMessageAlias: string;
  sessionRecordId: string;
  threadRecordId: string;
  roleFamily: ZavorthExternalMessageMetadataView['roleFamily'];
  createdAt: string | null;
  contentState: ZavorthExternalMessageMetadataView['contentState'];
  contentPreview: '[redacted-content]' | '[unavailable]';
  attachmentCount: number;
  tokenEstimateBucket: ZavorthExternalMessageMetadataView['tokenEstimateBucket'];
  sensitiveContentRedacted: true;
  rawContentSerialized: false;
  messageContentRawStored: false;
  sourceIdsEvidenceOnly: true;
  provenance: ZavorthNativeSessionHistoryProvenance;
  readOnly: true;
  migrationAllowed: false;
  writeBackAllowed: false;
  sourceDbOpenedForWrite: false;
  sourceDbCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeSessionHistoryLookupResult<TRecord> = {
  nativeContract: 'ZavorthNativeSessionHistoryLookupResult/v1';
  lookupId: string;
  found: boolean;
  record?: TRecord;
  runtimeExternalExecutorRequiredForSessionLookup: false;
  runtimeExternalExecutorRequiredForHistoryRender: false;
  sourceRuntimeAuthority: false;
};

export type ZavorthNativeSessionHistoryDashboardProjection = {
  nativeContract: 'ZavorthNativeSessionHistoryDashboardProjection/v1';
  id: string;
  sessionRecordId: string;
  title: string;
  status: ExternalAgentCommandCenterOperationalStatus;
  channel: UniversalAgentChannel;
  messageCount: number;
  threadCount: number;
  redactedMessageCount: number;
  dashboardViewModelIds: string[];
  commandCenterConsumable: true;
  sourceIdentityPublic: false;
  messageContentRawStored: false;
  executionAuthority: false;
};

export type ZavorthNativeSessionHistoryRegistrySnapshot = {
  nativeContract: 'ZavorthNativeSessionHistoryRegistry/v1';
  id: string;
  generatedAt: string;
  sessions: ZavorthNativeSessionMetadataRecord[];
  threads: ZavorthNativeThreadMetadataRecord[];
  messages: ZavorthNativeMessageMetadataRecord[];
  indexes: {
    sessionsByStatus: Record<ZavorthExternalSessionViewStatus, number>;
    messagesByContentState: Record<ZavorthExternalMessageMetadataView['contentState'], number>;
    degradedOrUnavailableSessionIds: string[];
    channelIntegrationLinkedSessionIds: string[];
    transportIntegrationLinkedSessionIds: string[];
  };
  sourceArtifactsConsumed: {
    sqliteSessionStoreDryRunDesign: 'docs/167-wave-1-sqlite-session-store-dry-run-design.md';
    sessionHistoryReadOnlyBridge: 'docs/172-wave-1-external-executor-session-history-read-only-bridge.md';
    commandCenterAssimilation: 'docs/173-wave-1-command-center-live-assimilation.md';
    nativeCapabilityRegistry: 'docs/185-wave-3-first-native-capability-registry-replacement-slice.md';
    dashboardViewModelRegistry: 'docs/186-wave-3-dashboard-view-model-registry-native-slice.md';
    integrationRegistry: 'docs/187-wave-3-provider-channel-transport-native-registry.md';
    migrationStrategy: 'docs/162-wave-0-external-agent-config-state-migration-strategy.md';
    readOnlyInventory: 'docs/163-wave-1-external-agent-config-state-read-only-inventory.md';
    redactionSecretRefMapping: 'docs/164-wave-1-redaction-and-secretref-mapping.md';
    dryRunMigrationPlan: 'docs/165-wave-1-dry-run-migration-plan.md';
    rollbackRestoreRehearsal: 'docs/166-wave-1-rollback-restore-rehearsal.md';
  };
  runtimeExternalExecutorRequiredForSessionLookup: false;
  runtimeExternalExecutorRequiredForHistoryRender: false;
  sourceRuntimeAuthority: false;
  sessionImportAllowed: false;
  migrationAllowed: false;
  writeBackAllowed: false;
  sourceDbOpenedForWrite: false;
  sourceDbCopied: false;
  messageContentRawStored: false;
  nativeReplacementAuthorizedForSessionMetadata: true;
  adapterRemovalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeSessionHistoryRegistryFilter = {
  status?: ZavorthExternalSessionViewStatus;
  channel?: UniversalAgentChannel;
  degradedOrUnavailable?: boolean;
  hasMessages?: boolean;
};

export type ZavorthNativeSessionHistoryThreadFilter = {
  sessionRecordId?: string;
  status?: ZavorthExternalSessionViewStatus;
};

export type ZavorthNativeSessionHistoryMessageFilter = {
  sessionRecordId?: string;
  threadRecordId?: string;
  contentState?: ZavorthExternalMessageMetadataView['contentState'];
};

export type ZavorthNativeSessionHistoryRegistryExecutionGate = {
  runtimeExternalExecutorRequiredForSessionLookup: false;
  runtimeExternalExecutorRequiredForHistoryRender: false;
  sourceRuntimeAuthority: false;
  sessionImportAllowed: false;
  migrationAllowed: false;
  writeBackAllowed: false;
  sourceDbOpenedForWrite: false;
  sourceDbCopied: false;
  messageContentRawStored: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorizedForSessionMetadata: true;
  adapterRemovalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeSessionHistoryRegistryIntegration = {
  nativeContract: 'ZavorthNativeSessionHistoryRegistryIntegration/v1';
  dashboardProjectionReady: true;
  integrationRegistryCrossReferenceReady: true;
  migrationDryRunOnly: true;
  sqliteRealDbNotOpened: true;
  messageContentRedactedOrUnavailable: true;
  liveExternalExecutorOptionalForRefreshOnly: true;
  runtimeExternalExecutorRequiredForSessionLookup: false;
  runtimeExternalExecutorRequiredForHistoryRender: false;
  publicSourceIdentityExposed: false;
};

export type ZavorthNativeSessionHistoryRegistrySource = {
  sessionHistoryBridge: ExternalExecutorSessionHistoryReadOnlyBridgeNormalization;
  commandCenterAssimilation: ExternalAgentCommandCenterLiveAssimilationNormalization;
  nativeCapabilityRegistry: ZavorthNativeCapabilityRegistryReplacementNormalization;
  capabilityRegistry: ZavorthNativeCapabilityRegistry;
  dashboardViewModelRegistry: ZavorthNativeDashboardViewModelRegistryNormalization;
  dashboardRegistry: ZavorthNativeDashboardViewModelRegistry;
  nativeIntegrationRegistry: ZavorthNativeIntegrationRegistryNormalization;
  integrationRegistry: ZavorthNativeIntegrationRegistry;
  sqliteSessionStoreDryRunDesignDoc: 'docs/167-wave-1-sqlite-session-store-dry-run-design.md';
  migrationStrategyDocs: [
    'docs/162-wave-0-external-agent-config-state-migration-strategy.md',
    'docs/163-wave-1-external-agent-config-state-read-only-inventory.md',
    'docs/164-wave-1-redaction-and-secretref-mapping.md',
    'docs/165-wave-1-dry-run-migration-plan.md',
    'docs/166-wave-1-rollback-restore-rehearsal.md',
  ];
  gatewayLiveCalledDuringLookup: false;
  sourceDbOpenedForWrite: false;
  sourceDbCopied: false;
  sourceStateMigrated: false;
  writeBackAttempted: false;
  rawMessageContentRead: false;
};

export type ZavorthNativeSessionHistoryRegistryNormalization = {
  nativeContract: 'ZavorthNativeSessionHistoryRegistrySlice/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthNativeSessionHistoryRegistryDecision;
  status: 'blocked' | 'native-session-history-registry-ready';
  sourceReadiness: {
    sessionHistoryReadOnlyBridge: ExternalExecutorSessionHistoryReadOnlyBridgeNormalization['decision'];
    commandCenterAssimilation: ExternalAgentCommandCenterLiveAssimilationNormalization['decision'];
    nativeCapabilityRegistry: ZavorthNativeCapabilityRegistryReplacementNormalization['decision'];
    dashboardViewModelRegistry: ZavorthNativeDashboardViewModelRegistryNormalization['decision'];
    nativeIntegrationRegistry: ZavorthNativeIntegrationRegistryNormalization['decision'];
    sqliteDryRunDesign: 'sqlite-session-dry-run-design-no-real-db';
  };
  registry: ZavorthNativeSessionHistoryRegistrySnapshot;
  dashboardProjection: ZavorthNativeSessionHistoryDashboardProjection[];
  integration: ZavorthNativeSessionHistoryRegistryIntegration;
  dependencyReductionProof: {
    lookupWorksWithoutLiveExternalExecutor: true;
    listWorksWithoutLiveExternalExecutor: true;
    filterWorksWithoutLiveExternalExecutor: true;
    historyRenderWorksWithoutLiveExternalExecutor: true;
    dashboardConsumesNativeSessionRegistry: true;
    integrationRegistryCrossReferenceWorks: true;
  };
  executionGate: ZavorthNativeSessionHistoryRegistryExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    messageContentRawStored: false;
    rawSourceIdsSerialized: false;
    sourceIdentityPublic: false;
    sourceStructuresPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-session-history-native-refresh-or-migration-dry-run-gate';
};

export type ZavorthNativeSessionHistoryRegistryOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: ZavorthNativeSessionHistoryRegistrySource;
};

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

function publicAlias(prefix: string, stableId: string): string {
  return `${prefix}:${stableHash(stableId)}`;
}

function publicTitle(view: ZavorthExternalSessionView): string {
  if (view.status === 'unavailable') {
    return 'Unavailable session metadata';
  }
  if (view.status === 'degraded') {
    return 'Degraded session metadata';
  }
  if (view.status === 'unknown') {
    return 'Unknown session metadata';
  }
  return 'Session metadata view';
}

function provenance(
  sourceKind: ZavorthNativeSessionHistoryProvenanceKind,
  sourceEvidenceIds: string[],
): ZavorthNativeSessionHistoryProvenance {
  return {
    nativeContract: 'ZavorthNativeSessionHistoryProvenance/v1',
    sourceKind,
    sourceEvidenceIds,
    sourceRuntimeNameInternal: 'ExternalExecutor',
    sourceRuntimePublicIdentity: false,
    sourceStructuresPublic: false,
    sourceIdsEvidenceOnly: true,
    redacted: true,
  };
}

function commandCenterStatus(status: ZavorthExternalSessionViewStatus): ExternalAgentCommandCenterOperationalStatus {
  if (status === 'ready') {
    return 'ready';
  }
  if (status === 'unavailable') {
    return 'unavailable';
  }
  if (status === 'unknown') {
    return 'unknown';
  }
  return 'degraded';
}

function emptySessionStatusIndex(): Record<ZavorthExternalSessionViewStatus, number> {
  return {
    degraded: 0,
    ready: 0,
    unavailable: 0,
    unknown: 0,
  };
}

function emptyMessageContentStateIndex(): Record<ZavorthExternalMessageMetadataView['contentState'], number> {
  return {
    redacted: 0,
    unavailable: 0,
  };
}

function sessionCapabilityEntryIds(source: ZavorthNativeSessionHistoryRegistrySource): string[] {
  return source.capabilityRegistry.list({ kind: 'session-history' }).map((entry) => entry.id);
}

function sessionDashboardViewModelIds(source: ZavorthNativeSessionHistoryRegistrySource, status: ZavorthExternalSessionViewStatus): string[] {
  return source.dashboardRegistry
    .list({ viewType: 'session' })
    .filter((view) => view.status === commandCenterStatus(status))
    .map((view) => view.id);
}

function messageDashboardViewModelIds(source: ZavorthNativeSessionHistoryRegistrySource): string[] {
  return source.dashboardRegistry.list({ viewType: 'message-metadata' }).map((view) => view.id);
}

function channelIntegrationIds(source: ZavorthNativeSessionHistoryRegistrySource): string[] {
  return source.integrationRegistry.list({ integrationKind: 'channel' }).map((record) => record.id);
}

function transportIntegrationIds(source: ZavorthNativeSessionHistoryRegistrySource): string[] {
  const readOnlyTransports = source.integrationRegistry
    .list({ integrationKind: 'message-transport', classification: 'read-only' })
    .map((record) => record.id);

  return readOnlyTransports.length > 0
    ? readOnlyTransports
    : source.integrationRegistry.list({ integrationKind: 'message-transport' }).map((record) => record.id);
}

function threadRecord(
  idPrefix: string,
  sessionRecordId: string,
  view: ZavorthExternalSessionView,
  messageRecordIds: string[],
): ZavorthNativeThreadMetadataRecord {
  return {
    nativeContract: 'ZavorthNativeThreadMetadataRecord/v1',
    id: `${idPrefix}:thread-${stableHash(view.threadLinkage.stableThreadId)}`,
    stableThreadId: view.threadLinkage.stableThreadId,
    publicThreadAlias: publicAlias('thread', view.threadLinkage.stableThreadId),
    sessionRecordId,
    status: view.status,
    channel: view.channel,
    messageMetadataRecordIds: messageRecordIds,
    rawThreadIdSerialized: false,
    provenance: provenance('session-history-read-only-bridge', [
      view.id,
      'docs/172-wave-1-external-executor-session-history-read-only-bridge.md',
      'docs/167-wave-1-sqlite-session-store-dry-run-design.md',
    ]),
    readOnly: true,
    migrationAllowed: false,
    writeBackAllowed: false,
    sourceDbOpenedForWrite: false,
    sourceDbCopied: false,
    rawSecretSerialized: false,
  };
}

function messageRecord(
  idPrefix: string,
  sessionRecordId: string,
  threadRecordId: string,
  message: ZavorthExternalMessageMetadataView,
): ZavorthNativeMessageMetadataRecord {
  return {
    nativeContract: 'ZavorthNativeMessageMetadataRecord/v1',
    id: `${idPrefix}:message-${stableHash(message.stableMessageId)}`,
    stableMessageId: message.stableMessageId,
    publicMessageAlias: publicAlias('message', message.stableMessageId),
    sessionRecordId,
    threadRecordId,
    roleFamily: message.roleFamily,
    createdAt: message.createdAt,
    contentState: message.contentState,
    contentPreview: message.contentPreview,
    attachmentCount: message.attachmentCount,
    tokenEstimateBucket: message.tokenEstimateBucket,
    sensitiveContentRedacted: true,
    rawContentSerialized: false,
    messageContentRawStored: false,
    sourceIdsEvidenceOnly: true,
    provenance: provenance('session-history-read-only-bridge', [
      message.id,
      sessionRecordId,
      'docs/172-wave-1-external-executor-session-history-read-only-bridge.md',
    ]),
    readOnly: true,
    migrationAllowed: false,
    writeBackAllowed: false,
    sourceDbOpenedForWrite: false,
    sourceDbCopied: false,
    rawSecretSerialized: false,
  };
}

function sessionRecord(
  idPrefix: string,
  source: ZavorthNativeSessionHistoryRegistrySource,
  view: ZavorthExternalSessionView,
  threadRecordIds: string[],
  messageRecordIds: string[],
): ZavorthNativeSessionMetadataRecord {
  return {
    nativeContract: 'ZavorthNativeSessionMetadataRecord/v1',
    id: `${idPrefix}:session-${stableHash(view.stableSessionId)}`,
    stableSessionId: view.stableSessionId,
    publicSessionAlias: publicAlias('session', view.stableSessionId),
    title: publicTitle(view),
    status: view.status,
    channel: view.channel,
    participantMetadata: view.participantMetadata,
    timestamps: view.timestamps,
    messageCount: view.messageCount,
    threadRecordIds,
    messageMetadataRecordIds: messageRecordIds,
    capabilityRegistryEntryIds: sessionCapabilityEntryIds(source),
    dashboardViewModelIds: [
      ...sessionDashboardViewModelIds(source, view.status),
      ...messageDashboardViewModelIds(source),
    ],
    channelIntegrationIds: channelIntegrationIds(source),
    transportIntegrationIds: transportIntegrationIds(source),
    provenance: provenance('session-history-read-only-bridge', [
      view.id,
      view.source.sourceEvidenceAlias,
      'docs/172-wave-1-external-executor-session-history-read-only-bridge.md',
      'docs/167-wave-1-sqlite-session-store-dry-run-design.md',
    ]),
    readOnly: true,
    runtimeExternalExecutorRequiredForSessionLookup: false,
    runtimeExternalExecutorRequiredForHistoryRender: false,
    sourceRuntimeAuthority: false,
    sessionImportAllowed: false,
    migrationAllowed: false,
    writeBackAllowed: false,
    sourceDbOpenedForWrite: false,
    sourceDbCopied: false,
    messageContentRawStored: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    sourceModuleCopied: false,
    adapterRemovalAllowed: false,
    rawSecretSerialized: false,
  };
}

type BuiltRecords = {
  sessions: ZavorthNativeSessionMetadataRecord[];
  threads: ZavorthNativeThreadMetadataRecord[];
  messages: ZavorthNativeMessageMetadataRecord[];
};

function buildRecords(
  idPrefix: string,
  source: ZavorthNativeSessionHistoryRegistrySource,
): BuiltRecords {
  return source.sessionHistoryBridge.sessionViews.reduce<BuiltRecords>((records, view) => {
    const sessionRecordId = `${idPrefix}:session-${stableHash(view.stableSessionId)}`;
    const temporaryThreadId = `${idPrefix}:thread-${stableHash(view.threadLinkage.stableThreadId)}`;
    const messages = view.messages.map((message) => (
      messageRecord(idPrefix, sessionRecordId, temporaryThreadId, message)
    ));
    const thread = threadRecord(idPrefix, sessionRecordId, view, messages.map((message) => message.id));
    const session = sessionRecord(
      idPrefix,
      source,
      view,
      [thread.id],
      messages.map((message) => message.id),
    );

    records.sessions.push(session);
    records.threads.push(thread);
    records.messages.push(...messages);
    return records;
  }, {
    sessions: [],
    threads: [],
    messages: [],
  });
}

function sessionsByStatus(
  sessions: ZavorthNativeSessionMetadataRecord[],
): Record<ZavorthExternalSessionViewStatus, number> {
  const index = emptySessionStatusIndex();
  sessions.forEach((session) => {
    index[session.status] += 1;
  });
  return index;
}

function messagesByContentState(
  messages: ZavorthNativeMessageMetadataRecord[],
): Record<ZavorthExternalMessageMetadataView['contentState'], number> {
  const index = emptyMessageContentStateIndex();
  messages.forEach((message) => {
    index[message.contentState] += 1;
  });
  return index;
}

function buildSnapshot(
  options: ZavorthNativeSessionHistoryRegistryOptions,
): ZavorthNativeSessionHistoryRegistrySnapshot {
  const records = buildRecords(options.idPrefix, options.source);

  return {
    nativeContract: 'ZavorthNativeSessionHistoryRegistry/v1',
    id: `${options.idPrefix}:registry`,
    generatedAt: options.generatedAt,
    sessions: records.sessions,
    threads: records.threads,
    messages: records.messages,
    indexes: {
      sessionsByStatus: sessionsByStatus(records.sessions),
      messagesByContentState: messagesByContentState(records.messages),
      degradedOrUnavailableSessionIds: records.sessions
        .filter((session) => session.status === 'degraded' || session.status === 'unavailable' || session.status === 'unknown')
        .map((session) => session.id),
      channelIntegrationLinkedSessionIds: records.sessions
        .filter((session) => session.channelIntegrationIds.length > 0)
        .map((session) => session.id),
      transportIntegrationLinkedSessionIds: records.sessions
        .filter((session) => session.transportIntegrationIds.length > 0)
        .map((session) => session.id),
    },
    sourceArtifactsConsumed: {
      sqliteSessionStoreDryRunDesign: 'docs/167-wave-1-sqlite-session-store-dry-run-design.md',
      sessionHistoryReadOnlyBridge: 'docs/172-wave-1-external-executor-session-history-read-only-bridge.md',
      commandCenterAssimilation: 'docs/173-wave-1-command-center-live-assimilation.md',
      nativeCapabilityRegistry: 'docs/185-wave-3-first-native-capability-registry-replacement-slice.md',
      dashboardViewModelRegistry: 'docs/186-wave-3-dashboard-view-model-registry-native-slice.md',
      integrationRegistry: 'docs/187-wave-3-provider-channel-transport-native-registry.md',
      migrationStrategy: 'docs/162-wave-0-external-agent-config-state-migration-strategy.md',
      readOnlyInventory: 'docs/163-wave-1-external-agent-config-state-read-only-inventory.md',
      redactionSecretRefMapping: 'docs/164-wave-1-redaction-and-secretref-mapping.md',
      dryRunMigrationPlan: 'docs/165-wave-1-dry-run-migration-plan.md',
      rollbackRestoreRehearsal: 'docs/166-wave-1-rollback-restore-rehearsal.md',
    },
    runtimeExternalExecutorRequiredForSessionLookup: false,
    runtimeExternalExecutorRequiredForHistoryRender: false,
    sourceRuntimeAuthority: false,
    sessionImportAllowed: false,
    migrationAllowed: false,
    writeBackAllowed: false,
    sourceDbOpenedForWrite: false,
    sourceDbCopied: false,
    messageContentRawStored: false,
    nativeReplacementAuthorizedForSessionMetadata: true,
    adapterRemovalAllowed: false,
    rawSecretSerialized: false,
  };
}

function dashboardProjection(
  registry: ZavorthNativeSessionHistoryRegistrySnapshot,
): ZavorthNativeSessionHistoryDashboardProjection[] {
  return registry.sessions.map((session) => {
    const redactedMessageCount = session.messageMetadataRecordIds
      .map((messageId) => registry.messages.find((message) => message.id === messageId))
      .filter((message) => message?.contentState === 'redacted')
      .length;

    return {
      nativeContract: 'ZavorthNativeSessionHistoryDashboardProjection/v1',
      id: `${session.id}:dashboard-projection`,
      sessionRecordId: session.id,
      title: session.title,
      status: commandCenterStatus(session.status),
      channel: session.channel,
      messageCount: session.messageCount,
      threadCount: session.threadRecordIds.length,
      redactedMessageCount,
      dashboardViewModelIds: session.dashboardViewModelIds,
      commandCenterConsumable: true,
      sourceIdentityPublic: false,
      messageContentRawStored: false,
      executionAuthority: false,
    };
  });
}

function sourceReady(source: ZavorthNativeSessionHistoryRegistrySource): boolean {
  return (
    source.sessionHistoryBridge.decision === 'external-executor-session-history-read-only-bridge-ready' &&
    source.commandCenterAssimilation.decision === 'command-center-live-assimilation-ready' &&
    source.nativeCapabilityRegistry.decision === 'native-capability-registry-replacement-ready' &&
    source.dashboardViewModelRegistry.decision === 'native-dashboard-view-model-registry-ready' &&
    source.nativeIntegrationRegistry.decision === 'native-integration-registry-ready' &&
    !source.gatewayLiveCalledDuringLookup &&
    !source.sourceDbOpenedForWrite &&
    !source.sourceDbCopied &&
    !source.sourceStateMigrated &&
    !source.writeBackAttempted &&
    !source.rawMessageContentRead
  );
}

function executionGate(): ZavorthNativeSessionHistoryRegistryExecutionGate {
  return {
    runtimeExternalExecutorRequiredForSessionLookup: false,
    runtimeExternalExecutorRequiredForHistoryRender: false,
    sourceRuntimeAuthority: false,
    sessionImportAllowed: false,
    migrationAllowed: false,
    writeBackAllowed: false,
    sourceDbOpenedForWrite: false,
    sourceDbCopied: false,
    messageContentRawStored: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorizedForSessionMetadata: true,
    adapterRemovalAllowed: false,
    rawSecretSerialized: false,
  };
}

function matchesSessionFilter(
  session: ZavorthNativeSessionMetadataRecord,
  filter: ZavorthNativeSessionHistoryRegistryFilter,
): boolean {
  if (filter.status && session.status !== filter.status) {
    return false;
  }
  if (filter.channel && session.channel !== filter.channel) {
    return false;
  }
  if (filter.degradedOrUnavailable && session.status !== 'degraded' && session.status !== 'unavailable' && session.status !== 'unknown') {
    return false;
  }
  if (filter.hasMessages !== undefined && (session.messageMetadataRecordIds.length > 0) !== filter.hasMessages) {
    return false;
  }
  return true;
}

function matchesThreadFilter(
  thread: ZavorthNativeThreadMetadataRecord,
  filter: ZavorthNativeSessionHistoryThreadFilter,
): boolean {
  if (filter.sessionRecordId && thread.sessionRecordId !== filter.sessionRecordId) {
    return false;
  }
  if (filter.status && thread.status !== filter.status) {
    return false;
  }
  return true;
}

function matchesMessageFilter(
  message: ZavorthNativeMessageMetadataRecord,
  filter: ZavorthNativeSessionHistoryMessageFilter,
): boolean {
  if (filter.sessionRecordId && message.sessionRecordId !== filter.sessionRecordId) {
    return false;
  }
  if (filter.threadRecordId && message.threadRecordId !== filter.threadRecordId) {
    return false;
  }
  if (filter.contentState && message.contentState !== filter.contentState) {
    return false;
  }
  return true;
}

export class ZavorthNativeSessionHistoryRegistry {
  private readonly sessionsById: Map<string, ZavorthNativeSessionMetadataRecord>;
  private readonly sessionsByPublicAlias: Map<string, ZavorthNativeSessionMetadataRecord>;
  private readonly sessionsByStableId: Map<string, ZavorthNativeSessionMetadataRecord>;
  private readonly threadsById: Map<string, ZavorthNativeThreadMetadataRecord>;
  private readonly threadsByPublicAlias: Map<string, ZavorthNativeThreadMetadataRecord>;
  private readonly threadsByStableId: Map<string, ZavorthNativeThreadMetadataRecord>;
  private readonly messagesById: Map<string, ZavorthNativeMessageMetadataRecord>;
  private readonly messagesByPublicAlias: Map<string, ZavorthNativeMessageMetadataRecord>;
  private readonly messagesByStableId: Map<string, ZavorthNativeMessageMetadataRecord>;

  public constructor(public readonly snapshot: ZavorthNativeSessionHistoryRegistrySnapshot) {
    this.sessionsById = new Map(snapshot.sessions.map((session) => [session.id, session]));
    this.sessionsByPublicAlias = new Map(snapshot.sessions.map((session) => [session.publicSessionAlias, session]));
    this.sessionsByStableId = new Map(snapshot.sessions.map((session) => [session.stableSessionId, session]));
    this.threadsById = new Map(snapshot.threads.map((thread) => [thread.id, thread]));
    this.threadsByPublicAlias = new Map(snapshot.threads.map((thread) => [thread.publicThreadAlias, thread]));
    this.threadsByStableId = new Map(snapshot.threads.map((thread) => [thread.stableThreadId, thread]));
    this.messagesById = new Map(snapshot.messages.map((message) => [message.id, message]));
    this.messagesByPublicAlias = new Map(snapshot.messages.map((message) => [message.publicMessageAlias, message]));
    this.messagesByStableId = new Map(snapshot.messages.map((message) => [message.stableMessageId, message]));
  }

  public listSessions(filter: ZavorthNativeSessionHistoryRegistryFilter = {}): ZavorthNativeSessionMetadataRecord[] {
    return this.snapshot.sessions.filter((session) => matchesSessionFilter(session, filter));
  }

  public listThreads(filter: ZavorthNativeSessionHistoryThreadFilter = {}): ZavorthNativeThreadMetadataRecord[] {
    return this.snapshot.threads.filter((thread) => matchesThreadFilter(thread, filter));
  }

  public listMessages(filter: ZavorthNativeSessionHistoryMessageFilter = {}): ZavorthNativeMessageMetadataRecord[] {
    return this.snapshot.messages.filter((message) => matchesMessageFilter(message, filter));
  }

  public lookupSession(id: string): ZavorthNativeSessionHistoryLookupResult<ZavorthNativeSessionMetadataRecord> {
    const record = this.sessionsById.get(id);

    return {
      nativeContract: 'ZavorthNativeSessionHistoryLookupResult/v1',
      lookupId: id,
      found: Boolean(record),
      ...(record ? { record } : {}),
      runtimeExternalExecutorRequiredForSessionLookup: false,
      runtimeExternalExecutorRequiredForHistoryRender: false,
      sourceRuntimeAuthority: false,
    };
  }

  public lookupSessionByStableId(stableSessionId: string): ZavorthNativeSessionHistoryLookupResult<ZavorthNativeSessionMetadataRecord> {
    const record = this.sessionsByStableId.get(stableSessionId);

    return {
      nativeContract: 'ZavorthNativeSessionHistoryLookupResult/v1',
      lookupId: stableSessionId,
      found: Boolean(record),
      ...(record ? { record } : {}),
      runtimeExternalExecutorRequiredForSessionLookup: false,
      runtimeExternalExecutorRequiredForHistoryRender: false,
      sourceRuntimeAuthority: false,
    };
  }

  public lookupSessionByPublicAlias(publicSessionAlias: string): ZavorthNativeSessionHistoryLookupResult<ZavorthNativeSessionMetadataRecord> {
    const record = this.sessionsByPublicAlias.get(publicSessionAlias);

    return {
      nativeContract: 'ZavorthNativeSessionHistoryLookupResult/v1',
      lookupId: publicSessionAlias,
      found: Boolean(record),
      ...(record ? { record } : {}),
      runtimeExternalExecutorRequiredForSessionLookup: false,
      runtimeExternalExecutorRequiredForHistoryRender: false,
      sourceRuntimeAuthority: false,
    };
  }

  public lookupThread(id: string): ZavorthNativeSessionHistoryLookupResult<ZavorthNativeThreadMetadataRecord> {
    const record = this.threadsById.get(id);

    return {
      nativeContract: 'ZavorthNativeSessionHistoryLookupResult/v1',
      lookupId: id,
      found: Boolean(record),
      ...(record ? { record } : {}),
      runtimeExternalExecutorRequiredForSessionLookup: false,
      runtimeExternalExecutorRequiredForHistoryRender: false,
      sourceRuntimeAuthority: false,
    };
  }

  public lookupThreadByStableId(stableThreadId: string): ZavorthNativeSessionHistoryLookupResult<ZavorthNativeThreadMetadataRecord> {
    const record = this.threadsByStableId.get(stableThreadId);

    return {
      nativeContract: 'ZavorthNativeSessionHistoryLookupResult/v1',
      lookupId: stableThreadId,
      found: Boolean(record),
      ...(record ? { record } : {}),
      runtimeExternalExecutorRequiredForSessionLookup: false,
      runtimeExternalExecutorRequiredForHistoryRender: false,
      sourceRuntimeAuthority: false,
    };
  }

  public lookupThreadByPublicAlias(publicThreadAlias: string): ZavorthNativeSessionHistoryLookupResult<ZavorthNativeThreadMetadataRecord> {
    const record = this.threadsByPublicAlias.get(publicThreadAlias);

    return {
      nativeContract: 'ZavorthNativeSessionHistoryLookupResult/v1',
      lookupId: publicThreadAlias,
      found: Boolean(record),
      ...(record ? { record } : {}),
      runtimeExternalExecutorRequiredForSessionLookup: false,
      runtimeExternalExecutorRequiredForHistoryRender: false,
      sourceRuntimeAuthority: false,
    };
  }

  public lookupMessage(id: string): ZavorthNativeSessionHistoryLookupResult<ZavorthNativeMessageMetadataRecord> {
    const record = this.messagesById.get(id);

    return {
      nativeContract: 'ZavorthNativeSessionHistoryLookupResult/v1',
      lookupId: id,
      found: Boolean(record),
      ...(record ? { record } : {}),
      runtimeExternalExecutorRequiredForSessionLookup: false,
      runtimeExternalExecutorRequiredForHistoryRender: false,
      sourceRuntimeAuthority: false,
    };
  }

  public lookupMessageByStableId(stableMessageId: string): ZavorthNativeSessionHistoryLookupResult<ZavorthNativeMessageMetadataRecord> {
    const record = this.messagesByStableId.get(stableMessageId);

    return {
      nativeContract: 'ZavorthNativeSessionHistoryLookupResult/v1',
      lookupId: stableMessageId,
      found: Boolean(record),
      ...(record ? { record } : {}),
      runtimeExternalExecutorRequiredForSessionLookup: false,
      runtimeExternalExecutorRequiredForHistoryRender: false,
      sourceRuntimeAuthority: false,
    };
  }

  public lookupMessageByPublicAlias(publicMessageAlias: string): ZavorthNativeSessionHistoryLookupResult<ZavorthNativeMessageMetadataRecord> {
    const record = this.messagesByPublicAlias.get(publicMessageAlias);

    return {
      nativeContract: 'ZavorthNativeSessionHistoryLookupResult/v1',
      lookupId: publicMessageAlias,
      found: Boolean(record),
      ...(record ? { record } : {}),
      runtimeExternalExecutorRequiredForSessionLookup: false,
      runtimeExternalExecutorRequiredForHistoryRender: false,
      sourceRuntimeAuthority: false,
    };
  }

  public renderDashboardProjection(): ZavorthNativeSessionHistoryDashboardProjection[] {
    return dashboardProjection(this.snapshot);
  }
}

export function createZavorthNativeSessionHistoryRegistryFixtureSource(): ZavorthNativeSessionHistoryRegistrySource {
  return {
    sessionHistoryBridge: normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture(),
    commandCenterAssimilation: normalizeExternalAgentCommandCenterLiveAssimilationFixture(),
    nativeCapabilityRegistry: normalizeZavorthNativeCapabilityRegistryReplacementFixture(),
    capabilityRegistry: createZavorthNativeCapabilityRegistryFixture(),
    dashboardViewModelRegistry: normalizeZavorthNativeDashboardViewModelRegistryFixture(),
    dashboardRegistry: createZavorthNativeDashboardViewModelRegistryFixture(),
    nativeIntegrationRegistry: normalizeZavorthNativeIntegrationRegistryFixture(),
    integrationRegistry: createZavorthNativeIntegrationRegistryFixture(),
    sqliteSessionStoreDryRunDesignDoc: 'docs/167-wave-1-sqlite-session-store-dry-run-design.md',
    migrationStrategyDocs: [
      'docs/162-wave-0-external-agent-config-state-migration-strategy.md',
      'docs/163-wave-1-external-agent-config-state-read-only-inventory.md',
      'docs/164-wave-1-redaction-and-secretref-mapping.md',
      'docs/165-wave-1-dry-run-migration-plan.md',
      'docs/166-wave-1-rollback-restore-rehearsal.md',
    ],
    gatewayLiveCalledDuringLookup: false,
    sourceDbOpenedForWrite: false,
    sourceDbCopied: false,
    sourceStateMigrated: false,
    writeBackAttempted: false,
    rawMessageContentRead: false,
  };
}

export function normalizeZavorthNativeSessionHistoryRegistry<TRuntimeId extends string>(
  options: ZavorthNativeSessionHistoryRegistryOptions<TRuntimeId>,
): ZavorthNativeSessionHistoryRegistryNormalization {
  const registry = buildSnapshot(options);
  const projection = dashboardProjection(registry);
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    registry.sessions.length > 0 &&
    registry.threads.length > 0 &&
    registry.messages.length > 0 &&
    registry.indexes.degradedOrUnavailableSessionIds.length > 0 &&
    registry.indexes.messagesByContentState.redacted > 0 &&
    registry.indexes.messagesByContentState.unavailable > 0 &&
    registry.indexes.channelIntegrationLinkedSessionIds.length === registry.sessions.length &&
    registry.indexes.transportIntegrationLinkedSessionIds.length === registry.sessions.length;

  return {
    nativeContract: 'ZavorthNativeSessionHistoryRegistrySlice/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'native-session-history-registry-ready' : 'blocked',
    status: ready ? 'native-session-history-registry-ready' : 'blocked',
    sourceReadiness: {
      sessionHistoryReadOnlyBridge: options.source.sessionHistoryBridge.decision,
      commandCenterAssimilation: options.source.commandCenterAssimilation.decision,
      nativeCapabilityRegistry: options.source.nativeCapabilityRegistry.decision,
      dashboardViewModelRegistry: options.source.dashboardViewModelRegistry.decision,
      nativeIntegrationRegistry: options.source.nativeIntegrationRegistry.decision,
      sqliteDryRunDesign: 'sqlite-session-dry-run-design-no-real-db',
    },
    registry,
    dashboardProjection: projection,
    integration: {
      nativeContract: 'ZavorthNativeSessionHistoryRegistryIntegration/v1',
      dashboardProjectionReady: true,
      integrationRegistryCrossReferenceReady: true,
      migrationDryRunOnly: true,
      sqliteRealDbNotOpened: true,
      messageContentRedactedOrUnavailable: true,
      liveExternalExecutorOptionalForRefreshOnly: true,
      runtimeExternalExecutorRequiredForSessionLookup: false,
      runtimeExternalExecutorRequiredForHistoryRender: false,
      publicSourceIdentityExposed: false,
    },
    dependencyReductionProof: {
      lookupWorksWithoutLiveExternalExecutor: true,
      listWorksWithoutLiveExternalExecutor: true,
      filterWorksWithoutLiveExternalExecutor: true,
      historyRenderWorksWithoutLiveExternalExecutor: true,
      dashboardConsumesNativeSessionRegistry: true,
      integrationRegistryCrossReferenceWorks: true,
    },
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      messageContentRawStored: false,
      rawSourceIdsSerialized: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-session-history-native-refresh-or-migration-dry-run-gate',
  };
}

export function normalizeZavorthNativeSessionHistoryRegistryFixture(): ZavorthNativeSessionHistoryRegistryNormalization {
  return normalizeZavorthNativeSessionHistoryRegistry({
    generatedAt: ZAVORTH_NATIVE_SESSION_HISTORY_REGISTRY_NOW,
    runtimeId: ZAVORTH_NATIVE_SESSION_HISTORY_REGISTRY_RUNTIME_ID,
    idPrefix: 'zavorth-native-session-history-registry',
    source: createZavorthNativeSessionHistoryRegistryFixtureSource(),
  });
}

export function createZavorthNativeSessionHistoryRegistryFixture(): ZavorthNativeSessionHistoryRegistry {
  return new ZavorthNativeSessionHistoryRegistry(
    normalizeZavorthNativeSessionHistoryRegistryFixture().registry,
  );
}
