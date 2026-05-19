import {
  normalizeExternalExecutorLiveObservabilityProjectionFixture,
} from './ExternalAgentExternalExecutorLiveObservabilityProjection.js';
import type {
  ExternalAgentEventEnvelope,
} from './contracts.js';
import type {
  ExternalExecutorLiveObservabilityProjectionNormalization,
  ExternalExecutorLiveObservabilityProjectionStatus,
} from './ExternalAgentExternalExecutorLiveObservabilityProjection.js';

export const EXTERNAL_EXECUTOR_READ_ONLY_EVENT_STREAM_ADAPTER_NOW = '2026-04-28T20:40:00.000Z' as const;
export const EXTERNAL_EXECUTOR_READ_ONLY_EVENT_STREAM_ADAPTER_RUNTIME_ID = 'external-executor-read-only-event-stream-adapter' as const;

export type ExternalExecutorReadOnlyEventStreamDecision =
  | 'blocked'
  | 'external-executor-read-only-event-stream-adapter-ready';

export type ExternalExecutorReadOnlySourceEventKind =
  | 'backpressure'
  | 'capability'
  | 'channel'
  | 'degraded'
  | 'disconnect'
  | 'gateway-lifecycle'
  | 'health'
  | 'message-metadata'
  | 'plugin'
  | 'provider'
  | 'retry'
  | 'session-metadata'
  | 'status'
  | 'timeout'
  | 'unknown';

export type ExternalExecutorReadOnlySourceEvent = {
  id: string;
  kind: ExternalExecutorReadOnlySourceEventKind;
  sequence: number;
  occurredAt: string;
  status: ExternalExecutorLiveObservabilityProjectionStatus;
  summary: string;
  sourceSurfaceId?: string;
  payload?: Record<string, unknown>;
};

export type ExternalExecutorReadOnlyEventStreamAdapterSource = {
  observabilityProjection: ExternalExecutorLiveObservabilityProjectionNormalization;
  observabilityDoc: 'docs/external-executor-live-observability-projection.md';
  bridgeDoc: 'docs/external-executor-live-read-only-bridge-boundary.md';
  sourceSnapshotDoc: 'docs/real-capability-snapshot-read-only.md';
  candidateRealStreamEndpoint?: string | null;
  liveStreamConnected: false;
  mutableStreamOpened: false;
  sourceEvents: ExternalExecutorReadOnlySourceEvent[];
  sensitiveValues?: string[];
};

export type ExternalExecutorReadOnlyEventStreamState = {
  nativeContract: 'ZavorthExternalExecutorReadOnlyEventStreamState/v1';
  liveStreamConnected: false;
  mutableStreamOpened: false;
  candidateRealStreamEndpoint: string | null;
  disconnectModeled: true;
  timeoutModeled: true;
  retryModeled: true;
  backpressureModeled: true;
  unknownEventModeled: true;
  lastKnownStatus: 'degraded';
};

export type ExternalExecutorReadOnlyCommandCenterEventProjection = {
  nativeContract: 'ZavorthExternalExecutorReadOnlyCommandCenterEventProjection/v1';
  id: string;
  eventId: string;
  kind: ExternalExecutorReadOnlySourceEventKind;
  status: ExternalExecutorLiveObservabilityProjectionStatus;
  severity: 'danger' | 'info' | 'warning';
  title: string;
  readOnly: true;
  commandCenterConsumable: true;
  executionAuthority: false;
  actionDispatchAllowed: false;
  messageSendAllowed: false;
  providerExecutionAllowed: false;
  commandExecutionAllowed: false;
};

export type ExternalExecutorReadOnlyEventStreamExecutionGate = {
  executionAuthority: false;
  actionDispatchAllowed: false;
  messageSendAllowed: false;
  providerExecutionAllowed: false;
  commandExecutionAllowed: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  rawSecretSerialized: false;
  liveStreamConnected: false;
  mutableStreamOpened: false;
  liveExternalExecutorStartedByAdapter: false;
  stateMigrated: false;
};

export type ExternalExecutorReadOnlyEventStreamRedaction = {
  sensitivePayloadRedacted: true;
  rawSecretSerialized: false;
  rawSecretLikeKeysRedacted: true;
  serializedOutputContainsSensitiveFixture: false;
};

export type ExternalExecutorReadOnlyEventStreamAdapterNormalization = {
  nativeContract: 'ZavorthExternalExecutorReadOnlyEventStreamAdapter/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ExternalExecutorReadOnlyEventStreamDecision;
  observabilityDoc: ExternalExecutorReadOnlyEventStreamAdapterSource['observabilityDoc'];
  bridgeDoc: ExternalExecutorReadOnlyEventStreamAdapterSource['bridgeDoc'];
  sourceSnapshotDoc: ExternalExecutorReadOnlyEventStreamAdapterSource['sourceSnapshotDoc'];
  readOnly: true;
  sourceEventCount: number;
  projectedEventCount: number;
  envelopes: ExternalAgentEventEnvelope[];
  commandCenterEvents: ExternalExecutorReadOnlyCommandCenterEventProjection[];
  streamState: ExternalExecutorReadOnlyEventStreamState;
  redaction: ExternalExecutorReadOnlyEventStreamRedaction;
  executionGate: ExternalExecutorReadOnlyEventStreamExecutionGate;
  nextGateRecommended: 'future-read-only-stream-endpoint-discovery-or-event-diff';
};

export type ExternalExecutorReadOnlyEventStreamAdapterOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: ExternalExecutorReadOnlyEventStreamAdapterSource;
};

const SECRET_KEY_PATTERN = /(authorization|api[-_]?key|credential|password|secret|token)/i;

function sanitizeText(value: unknown, sensitiveValues: string[] = []): string {
  let text = String(value ?? '');
  sensitiveValues.filter(Boolean).forEach((secret) => {
    text = text.split(secret).join('[redacted-secret]');
  });
  text = text.replace(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=([^\s"'`|]+)/g, 'EXTERNAL_EXECUTOR_GATEWAY_TOKEN=[redacted-secret]');
  text = text.replace(/(bearer\s+)[A-Za-z0-9._-]{8,}/gi, '$1[redacted-secret]');
  return text;
}

function redactPayload(value: unknown, sensitiveValues: string[] = []): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactPayload(entry, sensitiveValues));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      SECRET_KEY_PATTERN.test(key) ? '[redacted-secret]' : redactPayload(entry, sensitiveValues),
    ]));
  }
  if (typeof value === 'string') {
    return sanitizeText(value, sensitiveValues);
  }
  return value;
}

function eventEnvelopeKind(kind: ExternalExecutorReadOnlySourceEventKind): ExternalAgentEventEnvelope['kind'] {
  if (kind === 'message-metadata') {
    return 'message';
  }
  if (kind === 'health' || kind === 'status') {
    return 'health';
  }
  if (
    kind === 'backpressure' ||
    kind === 'degraded' ||
    kind === 'disconnect' ||
    kind === 'retry' ||
    kind === 'timeout' ||
    kind === 'unknown'
  ) {
    return 'diagnostic';
  }
  return 'capability-event';
}

function severityFor(status: ExternalExecutorLiveObservabilityProjectionStatus, kind: ExternalExecutorReadOnlySourceEventKind): 'danger' | 'info' | 'warning' {
  if (status === 'blocked' || kind === 'disconnect' || kind === 'timeout') {
    return 'danger';
  }
  if (status === 'degraded' || status === 'unavailable' || kind === 'backpressure' || kind === 'retry' || kind === 'unknown') {
    return 'warning';
  }
  return 'info';
}

function normalizeSourceEvent(
  event: ExternalExecutorReadOnlySourceEvent,
  options: ExternalExecutorReadOnlyEventStreamAdapterOptions,
): ExternalAgentEventEnvelope {
  const redactedPayload = redactPayload(event.payload || {}, options.source.sensitiveValues);
  const severity = severityFor(event.status, event.kind);

  return {
    id: `${options.idPrefix}:event-${event.sequence}-${event.id}`,
    runtimeId: options.runtimeId,
    sessionId: 'external-executor-read-only-event-stream',
    kind: eventEnvelopeKind(event.kind),
    occurredAt: event.occurredAt,
    actor: {
      id: 'zavorth-external-executor-read-only-event-stream-adapter',
      role: 'system',
    },
    payload: {
      rawType: event.kind,
      text: sanitizeText(event.summary, options.source.sensitiveValues),
      channel: 'api',
      data: {
        ...(redactedPayload as Record<string, unknown>),
        sourceStatus: event.status,
        sourceSurfaceId: event.sourceSurfaceId,
        sourceIdsEvidenceOnly: true,
        readOnly: true,
        severity,
        sequence: event.sequence,
        executionAuthority: false,
        actionDispatchAllowed: false,
        messageSendAllowed: false,
        providerExecutionAllowed: false,
        commandExecutionAllowed: false,
      },
    },
    diagnostics: {
      sourceRuntimeName: 'ExternalExecutor',
      sourceRuntimeVersion: 'read-only-snapshot-161',
      notes: [
        'external-executor-read-only-event-stream-adapter',
        'fixture-derived-from-161-169-170',
        'no-live-stream-connected',
      ],
    },
  };
}

function buildCommandCenterEvent(
  idPrefix: string,
  envelope: ExternalAgentEventEnvelope,
  sourceEvent: ExternalExecutorReadOnlySourceEvent,
): ExternalExecutorReadOnlyCommandCenterEventProjection {
  return {
    nativeContract: 'ZavorthExternalExecutorReadOnlyCommandCenterEventProjection/v1',
    id: `${idPrefix}:command-center-event-${sourceEvent.sequence}`,
    eventId: envelope.id,
    kind: sourceEvent.kind,
    status: sourceEvent.status,
    severity: severityFor(sourceEvent.status, sourceEvent.kind),
    title: sanitizeText(sourceEvent.summary),
    readOnly: true,
    commandCenterConsumable: true,
    executionAuthority: false,
    actionDispatchAllowed: false,
    messageSendAllowed: false,
    providerExecutionAllowed: false,
    commandExecutionAllowed: false,
  };
}

function buildStreamState(source: ExternalExecutorReadOnlyEventStreamAdapterSource): ExternalExecutorReadOnlyEventStreamState {
  return {
    nativeContract: 'ZavorthExternalExecutorReadOnlyEventStreamState/v1',
    liveStreamConnected: false,
    mutableStreamOpened: false,
    candidateRealStreamEndpoint: source.candidateRealStreamEndpoint || null,
    disconnectModeled: true,
    timeoutModeled: true,
    retryModeled: true,
    backpressureModeled: true,
    unknownEventModeled: true,
    lastKnownStatus: 'degraded',
  };
}

function createSourceEvent(
  sequence: number,
  kind: ExternalExecutorReadOnlySourceEventKind,
  status: ExternalExecutorLiveObservabilityProjectionStatus,
  summary: string,
  payload: Record<string, unknown> = {},
  sourceSurfaceId?: string,
): ExternalExecutorReadOnlySourceEvent {
  return {
    id: kind,
    kind,
    sequence,
    occurredAt: EXTERNAL_EXECUTOR_READ_ONLY_EVENT_STREAM_ADAPTER_NOW,
    status,
    summary,
    sourceSurfaceId,
    payload,
  };
}

export function createExternalExecutorReadOnlyEventStreamAdapterFixtureSource(): ExternalExecutorReadOnlyEventStreamAdapterSource {
  const observabilityProjection = normalizeExternalExecutorLiveObservabilityProjectionFixture();
  const surfaceByKind = new Map(observabilityProjection.commandCenterProjection.rows.map((row) => [row.surfaceKind, row]));
  const sensitiveFixture = 'synthetic-external-executor-event-secret-that-must-not-appear';

  return {
    observabilityProjection,
    observabilityDoc: 'docs/external-executor-live-observability-projection.md',
    bridgeDoc: 'docs/external-executor-live-read-only-bridge-boundary.md',
    sourceSnapshotDoc: 'docs/real-capability-snapshot-read-only.md',
    candidateRealStreamEndpoint: null,
    liveStreamConnected: false,
    mutableStreamOpened: false,
    sensitiveValues: [sensitiveFixture],
    sourceEvents: [
      createSourceEvent(1, 'health', 'ready', 'ExternalExecutor authenticated health observed read-only.', {
        healthProbeAuthenticated: true,
        cleanupConfirmed: true,
      }, surfaceByKind.get('runtime')?.id),
      createSourceEvent(2, 'status', 'ready', 'ExternalExecutor status rpc.ok=true observed read-only.', {
        statusRpcOk: true,
        postListenerCount: 0,
        postProcessCount: 0,
      }, surfaceByKind.get('runtime')?.id),
      createSourceEvent(3, 'capability', 'ready', 'ExternalExecutor capability inventory event projected read-only.', {
        capabilitySurfaceCount: observabilityProjection.runtimeObservability.capabilitySurfaceCount,
      }, surfaceByKind.get('runtime')?.id),
      createSourceEvent(4, 'channel', 'degraded', 'ExternalExecutor channel surface degraded and preserved.', {
        outbound: false,
      }, surfaceByKind.get('channel')?.id),
      createSourceEvent(5, 'plugin', 'ready', 'ExternalExecutor plugin inventory visible without execution authority.', {
        pluginInventoryOnly: true,
      }, surfaceByKind.get('plugin')?.id),
      createSourceEvent(6, 'provider', 'degraded', 'ExternalExecutor provider metadata degraded; provider SDK execution false.', {
        providerExecutionAllowed: false,
        apiKey: sensitiveFixture,
      }, surfaceByKind.get('provider')?.id),
      createSourceEvent(7, 'message-metadata', 'unavailable', 'ExternalExecutor message metadata unavailable; body not imported.', {
        messageBodyImported: false,
        token: sensitiveFixture,
      }, surfaceByKind.get('message')?.id),
      createSourceEvent(8, 'session-metadata', 'unavailable', 'ExternalExecutor session metadata unavailable; session import false.', {
        sessionImportAllowed: false,
      }, surfaceByKind.get('session')?.id),
      createSourceEvent(9, 'gateway-lifecycle', 'ready', 'ExternalExecutor gateway lifecycle cleanup preserved.', {
        listenerCount: 0,
        processCount: 0,
      }, surfaceByKind.get('gateway-method')?.id),
      createSourceEvent(10, 'unknown', 'degraded', 'Unknown ExternalExecutor event preserved as degraded metadata.', {
        rawType: 'external-executor.future.event',
        authorization: `Bearer ${sensitiveFixture}`,
      }),
      createSourceEvent(11, 'degraded', 'degraded', 'Degraded ExternalExecutor event represented without crashing Zavorth.', {
        reason: 'source-reported-degraded',
      }),
      createSourceEvent(12, 'disconnect', 'degraded', 'Read-only stream disconnect modeled without reconnect side effects.'),
      createSourceEvent(13, 'timeout', 'degraded', 'Read-only stream timeout modeled without mutable retry side effects.'),
      createSourceEvent(14, 'retry', 'degraded', 'Read-only retry intent recorded as metadata only.', {
        retryAfterMs: 1000,
      }),
      createSourceEvent(15, 'backpressure', 'degraded', 'Backpressure modeled as Command Center warning metadata.', {
        queueDepth: 128,
      }),
    ],
  };
}

export function normalizeExternalExecutorReadOnlyEventStreamAdapter<TRuntimeId extends string>(
  options: ExternalExecutorReadOnlyEventStreamAdapterOptions<TRuntimeId>,
): ExternalExecutorReadOnlyEventStreamAdapterNormalization {
  const adapterReady =
    options.source.observabilityProjection.decision === 'external-executor-live-observability-projection-ready' &&
    !options.source.liveStreamConnected &&
    !options.source.mutableStreamOpened &&
    options.source.observabilityProjection.executionGate.executionAuthority === false &&
    options.source.observabilityProjection.executionGate.actionDispatchAllowed === false &&
    options.source.observabilityProjection.executionGate.providerExecutionAllowed === false &&
    options.source.observabilityProjection.executionGate.commandExecutionAllowed === false &&
    options.source.observabilityProjection.executionGate.rawSecretSerialized === false;
  const envelopes = options.source.sourceEvents
    .slice()
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => normalizeSourceEvent(event, options));
  const orderedEvents = options.source.sourceEvents
    .slice()
    .sort((left, right) => left.sequence - right.sequence);

  return {
    nativeContract: 'ZavorthExternalExecutorReadOnlyEventStreamAdapter/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: adapterReady ? 'external-executor-read-only-event-stream-adapter-ready' : 'blocked',
    observabilityDoc: options.source.observabilityDoc,
    bridgeDoc: options.source.bridgeDoc,
    sourceSnapshotDoc: options.source.sourceSnapshotDoc,
    readOnly: true,
    sourceEventCount: options.source.sourceEvents.length,
    projectedEventCount: envelopes.length,
    envelopes,
    commandCenterEvents: envelopes.map((envelope, index) => (
      buildCommandCenterEvent(options.idPrefix, envelope, orderedEvents[index])
    )),
    streamState: buildStreamState(options.source),
    redaction: {
      sensitivePayloadRedacted: true,
      rawSecretSerialized: false,
      rawSecretLikeKeysRedacted: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    executionGate: {
      executionAuthority: false,
      actionDispatchAllowed: false,
      messageSendAllowed: false,
      providerExecutionAllowed: false,
      commandExecutionAllowed: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorized: false,
      rawSecretSerialized: false,
      liveStreamConnected: false,
      mutableStreamOpened: false,
      liveExternalExecutorStartedByAdapter: false,
      stateMigrated: false,
    },
    nextGateRecommended: 'future-read-only-stream-endpoint-discovery-or-event-diff',
  };
}

export function normalizeExternalExecutorReadOnlyEventStreamAdapterFixture(): ExternalExecutorReadOnlyEventStreamAdapterNormalization {
  return normalizeExternalExecutorReadOnlyEventStreamAdapter({
    source: createExternalExecutorReadOnlyEventStreamAdapterFixtureSource(),
    generatedAt: EXTERNAL_EXECUTOR_READ_ONLY_EVENT_STREAM_ADAPTER_NOW,
    runtimeId: EXTERNAL_EXECUTOR_READ_ONLY_EVENT_STREAM_ADAPTER_RUNTIME_ID,
    idPrefix: 'external-executor-read-only-event-stream',
  });
}
