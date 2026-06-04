import {
  normalizeExternalExecutorReadOnlyEventStreamAdapterFixture,
} from './RuntimeAdapterExternalExecutorReadOnlyEventStreamAdapter.js';
import type {
  UniversalAgentChannel,
} from '../agent/UniversalAgentRuntimeTypes.js';
import type {
  ExternalExecutorReadOnlyEventStreamAdapterNormalization,
} from './RuntimeAdapterExternalExecutorReadOnlyEventStreamAdapter.js';

export const EXTERNAL_EXECUTOR_SESSION_HISTORY_READ_ONLY_BRIDGE_NOW = '2026-04-28T21:00:00.000Z' as const;
export const EXTERNAL_EXECUTOR_SESSION_HISTORY_READ_ONLY_BRIDGE_RUNTIME_ID = 'external-executor-session-history-read-only-bridge' as const;

export type ExternalExecutorSessionHistoryReadOnlyBridgeDecision =
  | 'blocked'
  | 'external-executor-session-history-read-only-bridge-ready';

export type ZavorthExternalSessionViewStatus =
  | 'degraded'
  | 'ready'
  | 'unavailable'
  | 'unknown';

export type ExternalExecutorLikeSessionSource = {
  sourceSessionId: string;
  sourceThreadId: string;
  sourceChannel: UniversalAgentChannel;
  sourceStatus: ZavorthExternalSessionViewStatus;
  sourceTitle?: string;
  participantCount: number;
  participantKinds: Array<'assistant' | 'system' | 'tool' | 'unknown' | 'user'>;
  createdAt?: string | null;
  updatedAt?: string | null;
  messageCount: number;
  metadataSensitivity: 'contains-sensitive-source-id' | 'metadata-only' | 'unknown';
  messages: ExternalExecutorLikeMessageMetadataSource[];
  inaccessibleReason?: string;
};

export type ExternalExecutorLikeMessageMetadataSource = {
  sourceMessageId: string;
  sourceThreadId: string;
  roleFamily: 'assistant' | 'system' | 'tool' | 'unknown' | 'user';
  createdAt?: string | null;
  contentState: 'redacted' | 'unavailable';
  rawContent?: string;
  attachmentCount?: number;
  tokenEstimateBucket?: '0' | '1-512' | '513-2048' | 'unknown';
};

export type ExternalExecutorSessionHistoryReadOnlyBridgeSource = {
  eventStream: ExternalExecutorReadOnlyEventStreamAdapterNormalization;
  sourceSnapshotDoc: 'docs/real-capability-snapshot-read-only.md';
  bridgeDoc: 'docs/external-executor-live-read-only-bridge-boundary.md';
  observabilityDoc: 'docs/external-executor-live-observability-projection.md';
  eventStreamDoc: 'docs/external-executor-read-only-event-stream-adapter.md';
  sqliteDryRunDesignDoc: 'docs/sqlite-session-store-dry-run-design.md';
  migrationStrategyDocs: [
    'docs/runtime-adapter-config-state-migration-strategy.md',
    'docs/runtime-adapter-config-state-read-only-inventory.md',
    'docs/redaction-and-secretref-mapping.md',
    'docs/dry-run-migration-plan.md',
    'docs/rollback-restore-rehearsal.md',
  ];
  sourceDbOpenedForWrite: false;
  sourceDbCopied: false;
  sourceStateMigrated: false;
  writeBackAttempted: false;
  sessionCandidates: ExternalExecutorLikeSessionSource[];
  sensitiveValues?: string[];
};

export type ZavorthExternalMessageMetadataView = {
  nativeContract: 'ZavorthExternalMessageMetadataView/v1';
  id: string;
  stableMessageId: string;
  sessionViewId: string;
  roleFamily: ExternalExecutorLikeMessageMetadataSource['roleFamily'];
  createdAt: string | null;
  contentState: 'redacted' | 'unavailable';
  contentPreview: '[redacted-content]' | '[unavailable]';
  attachmentCount: number;
  tokenEstimateBucket: NonNullable<ExternalExecutorLikeMessageMetadataSource['tokenEstimateBucket']>;
  sensitiveContentRedacted: true;
  rawContentSerialized: false;
  sourceIdsEvidenceOnly: true;
};

export type ZavorthExternalSessionView = {
  nativeContract: 'ZavorthExternalSessionView/v1';
  id: string;
  stableSessionId: string;
  title: string;
  status: ZavorthExternalSessionViewStatus;
  source: {
    runtime: 'ExternalExecutor';
    sourceKind: 'session-history-read-only';
    sourceEvidenceAlias: string;
    sourceIdsEvidenceOnly: true;
  };
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
  threadLinkage: {
    stableThreadId: string;
    sourceThreadAlias: string;
    rawThreadIdSerialized: false;
  };
  messages: ZavorthExternalMessageMetadataView[];
  messageCount: number;
  unavailableReason?: string;
  readOnly: true;
  importAuthority: false;
  migrationAllowed: false;
  writeBackAllowed: false;
  sourceDbOpenedForWrite: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
};

export type ExternalExecutorSessionHistoryDashboardView = {
  nativeContract: 'ZavorthExternalSessionDashboardView/v1';
  id: string;
  sessionViewId: string;
  label: string;
  status: ZavorthExternalSessionViewStatus;
  channel: UniversalAgentChannel;
  messageCount: number;
  readOnly: true;
  dashboardConsumable: true;
  importAuthority: false;
  migrationAllowed: false;
  writeBackAllowed: false;
};

export type ExternalExecutorSessionHistoryReadOnlyFailure = {
  id: string;
  status: Exclude<ZavorthExternalSessionViewStatus, 'ready'>;
  reason: string;
  rawExceptionSerialized: false;
  zavorthRuntimeFailed: false;
};

export type ExternalExecutorSessionHistoryReadOnlyExecutionGate = {
  importAuthority: false;
  migrationAllowed: false;
  writeBackAllowed: false;
  sourceDbOpenedForWrite: false;
  sourceDbCopied: false;
  sourceStateMigrated: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  actionDispatchAllowed: false;
  messageSendAllowed: false;
  providerExecutionAllowed: false;
  commandExecutionAllowed: false;
  rawSecretSerialized: false;
};

export type ExternalExecutorSessionHistoryReadOnlyBridgeNormalization = {
  nativeContract: 'ZavorthExternalExecutorSessionHistoryReadOnlyBridge/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ExternalExecutorSessionHistoryReadOnlyBridgeDecision;
  sourceSnapshotDoc: ExternalExecutorSessionHistoryReadOnlyBridgeSource['sourceSnapshotDoc'];
  eventStreamDoc: ExternalExecutorSessionHistoryReadOnlyBridgeSource['eventStreamDoc'];
  sqliteDryRunDesignDoc: ExternalExecutorSessionHistoryReadOnlyBridgeSource['sqliteDryRunDesignDoc'];
  readOnly: true;
  sessionViews: ZavorthExternalSessionView[];
  dashboardViews: ExternalExecutorSessionHistoryDashboardView[];
  failures: ExternalExecutorSessionHistoryReadOnlyFailure[];
  executionGate: ExternalExecutorSessionHistoryReadOnlyExecutionGate;
  redaction: {
    sensitiveContentRedacted: true;
    rawContentSerialized: false;
    rawSourceIdsSerialized: false;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-read-only-session-schema-fingerprint-or-dashboard-session-panel';
};

export type ExternalExecutorSessionHistoryReadOnlyBridgeOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: ExternalExecutorSessionHistoryReadOnlyBridgeSource;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

function stableAlias(prefix: string, value: string): string {
  return `${prefix}:${stableHash(value)}`;
}

function redactContent(raw: string | undefined, sensitiveValues: string[] = []): '[redacted-content]' | '[unavailable]' {
  if (!raw) {
    return '[unavailable]';
  }
  sensitiveValues.forEach((secret) => {
    if (secret && raw.includes(secret)) {
      return '[redacted-content]';
    }
  });
  return '[redacted-content]';
}

function buildMessageView(
  idPrefix: string,
  index: number,
  sessionViewId: string,
  message: ExternalExecutorLikeMessageMetadataSource,
  sensitiveValues: string[],
): ZavorthExternalMessageMetadataView {
  const stableMessageId = stableAlias('zavorth_message_view', `${message.sourceThreadId}:${message.sourceMessageId}`);
  const contentPreview = message.contentState === 'unavailable'
    ? '[unavailable]'
    : redactContent(message.rawContent, sensitiveValues);

  return {
    nativeContract: 'ZavorthExternalMessageMetadataView/v1',
    id: `${idPrefix}:message-${index + 1}-${stableHash(stableMessageId)}`,
    stableMessageId,
    sessionViewId,
    roleFamily: message.roleFamily,
    createdAt: message.createdAt || null,
    contentState: message.contentState,
    contentPreview,
    attachmentCount: Math.max(0, message.attachmentCount || 0),
    tokenEstimateBucket: message.tokenEstimateBucket || 'unknown',
    sensitiveContentRedacted: true,
    rawContentSerialized: false,
    sourceIdsEvidenceOnly: true,
  };
}

function buildSessionView(
  idPrefix: string,
  index: number,
  session: ExternalExecutorLikeSessionSource,
  sensitiveValues: string[],
): ZavorthExternalSessionView {
  const stableSessionId = stableAlias('zavorth_session_view', session.sourceSessionId);
  const stableThreadId = stableAlias('zavorth_thread_view', session.sourceThreadId);
  const viewId = `${idPrefix}:session-${index + 1}-${stableHash(stableSessionId)}`;
  const messages = session.messages.map((message, messageIndex) => (
    buildMessageView(`${viewId}`, messageIndex, viewId, message, sensitiveValues)
  ));

  return {
    nativeContract: 'ZavorthExternalSessionView/v1',
    id: viewId,
    stableSessionId,
    title: normalizeText(session.sourceTitle, 'ExternalExecutor session metadata'),
    status: session.sourceStatus,
    source: {
      runtime: 'ExternalExecutor',
      sourceKind: 'session-history-read-only',
      sourceEvidenceAlias: stableAlias('external-executor-session-evidence', `${session.sourceSessionId}:${session.sourceThreadId}`),
      sourceIdsEvidenceOnly: true,
    },
    channel: session.sourceChannel,
    participantMetadata: {
      participantCount: Math.max(0, session.participantCount),
      participantKinds: Array.from(new Set(session.participantKinds)),
      rawParticipantIdsSerialized: false,
    },
    timestamps: {
      createdAt: session.createdAt || null,
      updatedAt: session.updatedAt || null,
      timestampPrecision: 'source-metadata',
    },
    threadLinkage: {
      stableThreadId,
      sourceThreadAlias: stableAlias('external-executor-thread-evidence', session.sourceThreadId),
      rawThreadIdSerialized: false,
    },
    messages,
    messageCount: session.messageCount,
    unavailableReason: session.sourceStatus === 'ready' ? undefined : session.inaccessibleReason || session.sourceStatus,
    readOnly: true,
    importAuthority: false,
    migrationAllowed: false,
    writeBackAllowed: false,
    sourceDbOpenedForWrite: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorized: false,
  };
}

function buildDashboardView(view: ZavorthExternalSessionView): ExternalExecutorSessionHistoryDashboardView {
  return {
    nativeContract: 'ZavorthExternalSessionDashboardView/v1',
    id: `${view.id}:dashboard`,
    sessionViewId: view.id,
    label: view.title,
    status: view.status,
    channel: view.channel,
    messageCount: view.messageCount,
    readOnly: true,
    dashboardConsumable: true,
    importAuthority: false,
    migrationAllowed: false,
    writeBackAllowed: false,
  };
}

function buildFailures(views: ZavorthExternalSessionView[]): ExternalExecutorSessionHistoryReadOnlyFailure[] {
  return views
    .filter((view) => view.status !== 'ready')
    .map((view) => ({
      id: `${view.id}:failure`,
      status: view.status === 'ready' ? 'unknown' : view.status,
      reason: view.unavailableReason || `${view.status}-session-history`,
      rawExceptionSerialized: false,
      zavorthRuntimeFailed: false,
    }));
}

export function createExternalExecutorSessionHistoryReadOnlyBridgeFixtureSource(): ExternalExecutorSessionHistoryReadOnlyBridgeSource {
  const sensitiveFixture = 'synthetic-external-executor-session-secret-that-must-not-appear';

  return {
    eventStream: normalizeExternalExecutorReadOnlyEventStreamAdapterFixture(),
    sourceSnapshotDoc: 'docs/real-capability-snapshot-read-only.md',
    bridgeDoc: 'docs/external-executor-live-read-only-bridge-boundary.md',
    observabilityDoc: 'docs/external-executor-live-observability-projection.md',
    eventStreamDoc: 'docs/external-executor-read-only-event-stream-adapter.md',
    sqliteDryRunDesignDoc: 'docs/sqlite-session-store-dry-run-design.md',
    migrationStrategyDocs: [
      'docs/runtime-adapter-config-state-migration-strategy.md',
      'docs/runtime-adapter-config-state-read-only-inventory.md',
      'docs/redaction-and-secretref-mapping.md',
      'docs/dry-run-migration-plan.md',
      'docs/rollback-restore-rehearsal.md',
    ],
    sourceDbOpenedForWrite: false,
    sourceDbCopied: false,
    sourceStateMigrated: false,
    writeBackAttempted: false,
    sensitiveValues: [sensitiveFixture],
    sessionCandidates: [
      {
        sourceSessionId: 'external-executor-live-session-private-123',
        sourceThreadId: 'external-executor-thread-alpha-private-456',
        sourceChannel: 'api',
        sourceStatus: 'ready',
        sourceTitle: 'ExternalExecutor session metadata view',
        participantCount: 2,
        participantKinds: ['user', 'assistant'],
        createdAt: '2026-04-28T19:50:00.000Z',
        updatedAt: '2026-04-28T19:59:00.000Z',
        messageCount: 2,
        metadataSensitivity: 'contains-sensitive-source-id',
        messages: [
          {
            sourceMessageId: 'external-executor-message-private-1',
            sourceThreadId: 'external-executor-thread-alpha-private-456',
            roleFamily: 'user',
            createdAt: '2026-04-28T19:50:30.000Z',
            contentState: 'redacted',
            rawContent: `operator text with ${sensitiveFixture}`,
            attachmentCount: 1,
            tokenEstimateBucket: '1-512',
          },
          {
            sourceMessageId: 'external-executor-message-private-2',
            sourceThreadId: 'external-executor-thread-alpha-private-456',
            roleFamily: 'assistant',
            createdAt: '2026-04-28T19:51:00.000Z',
            contentState: 'redacted',
            rawContent: 'assistant response omitted',
            attachmentCount: 0,
            tokenEstimateBucket: '1-512',
          },
        ],
      },
      {
        sourceSessionId: 'external-executor-history-unavailable-999',
        sourceThreadId: 'external-executor-thread-unavailable-999',
        sourceChannel: 'api',
        sourceStatus: 'unavailable',
        sourceTitle: 'Unavailable ExternalExecutor history metadata',
        participantCount: 0,
        participantKinds: ['unknown'],
        createdAt: null,
        updatedAt: null,
        messageCount: 0,
        metadataSensitivity: 'unknown',
        inaccessibleReason: 'history-not-read-by-161-169-170-171',
        messages: [
          {
            sourceMessageId: 'external-executor-message-unavailable',
            sourceThreadId: 'external-executor-thread-unavailable-999',
            roleFamily: 'unknown',
            createdAt: null,
            contentState: 'unavailable',
            tokenEstimateBucket: 'unknown',
          },
        ],
      },
      {
        sourceSessionId: 'external-executor-history-degraded-555',
        sourceThreadId: 'external-executor-thread-degraded-555',
        sourceChannel: 'api',
        sourceStatus: 'degraded',
        sourceTitle: 'Degraded ExternalExecutor history metadata',
        participantCount: 1,
        participantKinds: ['system'],
        createdAt: '2026-04-28T19:45:00.000Z',
        updatedAt: null,
        messageCount: 0,
        metadataSensitivity: 'metadata-only',
        inaccessibleReason: 'metadata-only-history-surface',
        messages: [],
      },
    ],
  };
}

export function normalizeExternalExecutorSessionHistoryReadOnlyBridge<TRuntimeId extends string>(
  options: ExternalExecutorSessionHistoryReadOnlyBridgeOptions<TRuntimeId>,
): ExternalExecutorSessionHistoryReadOnlyBridgeNormalization {
  const bridgeReady =
    options.source.eventStream.decision === 'external-executor-read-only-event-stream-adapter-ready' &&
    options.source.eventStream.executionGate.executionAuthority === false &&
    !options.source.sourceDbOpenedForWrite &&
    !options.source.sourceDbCopied &&
    !options.source.sourceStateMigrated &&
    !options.source.writeBackAttempted;
  const views = options.source.sessionCandidates.map((session, index) => (
    buildSessionView(options.idPrefix, index, session, options.source.sensitiveValues || [])
  ));

  return {
    nativeContract: 'ZavorthExternalExecutorSessionHistoryReadOnlyBridge/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: bridgeReady ? 'external-executor-session-history-read-only-bridge-ready' : 'blocked',
    sourceSnapshotDoc: options.source.sourceSnapshotDoc,
    eventStreamDoc: options.source.eventStreamDoc,
    sqliteDryRunDesignDoc: options.source.sqliteDryRunDesignDoc,
    readOnly: true,
    sessionViews: views,
    dashboardViews: views.map(buildDashboardView),
    failures: buildFailures(views),
    executionGate: {
      importAuthority: false,
      migrationAllowed: false,
      writeBackAllowed: false,
      sourceDbOpenedForWrite: false,
      sourceDbCopied: false,
      sourceStateMigrated: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorized: false,
      actionDispatchAllowed: false,
      messageSendAllowed: false,
      providerExecutionAllowed: false,
      commandExecutionAllowed: false,
      rawSecretSerialized: false,
    },
    redaction: {
      sensitiveContentRedacted: true,
      rawContentSerialized: false,
      rawSourceIdsSerialized: false,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-read-only-session-schema-fingerprint-or-dashboard-session-panel',
  };
}

export function normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture(): ExternalExecutorSessionHistoryReadOnlyBridgeNormalization {
  return normalizeExternalExecutorSessionHistoryReadOnlyBridge({
    source: createExternalExecutorSessionHistoryReadOnlyBridgeFixtureSource(),
    generatedAt: EXTERNAL_EXECUTOR_SESSION_HISTORY_READ_ONLY_BRIDGE_NOW,
    runtimeId: EXTERNAL_EXECUTOR_SESSION_HISTORY_READ_ONLY_BRIDGE_RUNTIME_ID,
    idPrefix: 'external-executor-session-history-read-only',
  });
}
