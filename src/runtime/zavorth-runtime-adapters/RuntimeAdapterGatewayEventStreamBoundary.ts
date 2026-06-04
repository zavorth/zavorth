import type {
  RuntimeAdapterEventEnvelope,
} from './contracts.js';

export type RuntimeAdapterGatewayEventStreamSourceEvidence = {
  sourceRuntimeName?: string;
  sourceRuntimeVersion?: string;
  sourcePaths: string[];
  observedAt: string;
  notes?: string[];
};

export type RuntimeAdapterGatewayEventStreamEventType =
  | 'runtime.update'
  | 'session.message'
  | 'approval.requested'
  | 'artifact.ready'
  | string;

export type RuntimeAdapterGatewayEventStreamEvent = {
  fixtureCase?: string;
  id: string;
  idempotencyKey?: string;
  sequence: number;
  runtimeId?: string;
  sessionId: string;
  type: RuntimeAdapterGatewayEventStreamEventType;
  text?: string;
  severity?: 'info' | 'warning' | 'danger';
  actor?: {
    id?: string;
    role?: 'user' | 'assistant' | 'system' | 'worker';
  };
  payload?: {
    channel?: string;
    workspace?: string | null;
    requestedTools?: string[];
    data?: Record<string, unknown>;
  };
  sourceEvidence?: RuntimeAdapterGatewayEventStreamSourceEvidence;
};

export type RuntimeAdapterGatewayEventStreamOrderRecord = {
  id: string;
  sequence: number;
  idempotencyKey: string;
};

export type RuntimeAdapterGatewayEventStreamNormalization = {
  nativeContract: 'RuntimeAdapterEventEnvelope[]';
  envelopes: RuntimeAdapterEventEnvelope[];
  duplicateEventIds: string[];
  order: RuntimeAdapterGatewayEventStreamOrderRecord[];
  sourceEventBusIntroduced: false;
  evidence: {
    sourceEventCount: number;
    projectedEventCount: number;
    sourcePaths: string[];
  };
};

export type RuntimeAdapterGatewayEventStreamBoundaryOptions = {
  runtimeId: string;
  observedAt: string;
  defaultActorId?: string;
  defaultChannel?: string;
  sourceRuntimeVersion?: string;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}

function eventKindFor(event: RuntimeAdapterGatewayEventStreamEvent): RuntimeAdapterEventEnvelope['kind'] {
  return event.type === 'runtime.update' ? 'health' : 'capability-event';
}

function idempotencyKeyFor(event: RuntimeAdapterGatewayEventStreamEvent): string {
  return normalizeText(event.idempotencyKey, event.id);
}

function sourcePathsFor(events: RuntimeAdapterGatewayEventStreamEvent[]): string[] {
  return uniqueStrings(events.flatMap((event) => event.sourceEvidence?.sourcePaths || []));
}

function buildEnvelope(
  event: RuntimeAdapterGatewayEventStreamEvent,
  options: RuntimeAdapterGatewayEventStreamBoundaryOptions,
): RuntimeAdapterEventEnvelope {
  const sourcePaths = event.sourceEvidence?.sourcePaths || [];
  const idempotencyKey = idempotencyKeyFor(event);

  return {
    id: normalizeText(event.id, 'external-stream-event'),
    runtimeId: normalizeText(event.runtimeId, options.runtimeId),
    sessionId: normalizeText(event.sessionId, 'external-session'),
    kind: eventKindFor(event),
    occurredAt: options.observedAt,
    actor: {
      id: normalizeText(event.actor?.id, options.defaultActorId || 'external-system'),
      role: event.actor?.role || 'system',
    },
    payload: {
      text: normalizeText(event.text),
      channel: event.payload?.channel || options.defaultChannel || 'api',
      workspace: event.payload?.workspace ?? null,
      requestedTools: uniqueStrings(event.payload?.requestedTools || []),
      rawType: normalizeText(event.type, 'external.event'),
      data: {
        ...(event.payload?.data || {}),
        sequence: event.sequence,
        idempotencyKey,
        fixtureCase: event.fixtureCase,
        severity: event.severity || 'info',
        sourcePaths,
      },
    },
    diagnostics: event.sourceEvidence ? {
      sourceRuntimeName: event.sourceEvidence.sourceRuntimeName,
      sourceRuntimeVersion: event.sourceEvidence.sourceRuntimeVersion || options.sourceRuntimeVersion,
      notes: event.sourceEvidence.notes,
    } : undefined,
  };
}

export function normalizeRuntimeAdapterGatewayEventStream(
  events: RuntimeAdapterGatewayEventStreamEvent[],
  options: RuntimeAdapterGatewayEventStreamBoundaryOptions,
): RuntimeAdapterGatewayEventStreamNormalization {
  const seen = new Set<string>();
  const duplicateEventIds: string[] = [];
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
  const envelopes: RuntimeAdapterEventEnvelope[] = [];

  ordered.forEach((event) => {
    const key = idempotencyKeyFor(event);
    if (seen.has(key)) {
      duplicateEventIds.push(normalizeText(event.id, 'external-stream-event'));
      return;
    }

    seen.add(key);
    envelopes.push(buildEnvelope(event, options));
  });

  return {
    nativeContract: 'RuntimeAdapterEventEnvelope[]',
    envelopes,
    duplicateEventIds,
    order: envelopes.map((envelope) => ({
      id: envelope.id,
      sequence: Number(envelope.payload.data?.sequence || 0),
      idempotencyKey: String(envelope.payload.data?.idempotencyKey || envelope.id),
    })),
    sourceEventBusIntroduced: false,
    evidence: {
      sourceEventCount: events.length,
      projectedEventCount: envelopes.length,
      sourcePaths: sourcePathsFor(events),
    },
  };
}
