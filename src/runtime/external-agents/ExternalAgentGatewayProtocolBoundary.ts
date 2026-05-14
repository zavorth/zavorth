import type {
  NormalizedInboundMessage,
} from '../agent/contracts/index.js';
import type {
  UniversalAgentChannel,
} from '../agent/UniversalAgentRuntimeTypes.js';
import type {
  ExternalAgentEventEnvelope,
  ExternalAgentSessionDescriptor,
} from './contracts.js';

export type ExternalAgentGatewayProtocolFrameKind =
  | 'request'
  | 'event'
  | 'response'
  | 'error'
  | 'unknown';

export type ExternalAgentGatewayProtocolSourceEvidence = {
  sourceRuntimeName?: string;
  sourceRuntimeVersion?: string;
  sourcePaths: string[];
  observedAt: string;
  notes?: string[];
};

export type ExternalAgentGatewayProtocolFrame = {
  fixtureCase?: string;
  frameKind: ExternalAgentGatewayProtocolFrameKind;
  id?: string;
  runtimeId?: string;
  sessionId?: string;
  operation?: string;
  method?: string;
  event?: string;
  status?: 'ok' | 'error';
  sequence?: number;
  idempotencyKey?: string;
  actor?: {
    id?: string;
    role?: 'user' | 'assistant' | 'system' | 'worker';
  };
  payload?: {
    text?: string;
    channel?: string;
    workspace?: string | null;
    requestedTools?: string[];
    errorCode?: string;
    errorMessage?: string;
    data?: Record<string, unknown>;
  };
  sourceEvidence?: ExternalAgentGatewayProtocolSourceEvidence;
};

export type ExternalAgentGatewayProtocolStructuredError = {
  nativeContract: 'ZavorthStructuredGatewayError/v1';
  id: string;
  code: 'external-frame-invalid' | 'external-frame-error';
  message: string;
  reachesExecutor: false;
  sourceFrameStoredAsPublicContract: false;
  evidence: {
    fixtureCase?: string;
    frameKind: ExternalAgentGatewayProtocolFrameKind;
    sourcePaths: string[];
  };
};

export type ExternalAgentGatewayProtocolNormalizationResult =
  | {
      ok: true;
      nativeContract: 'ExternalAgentEventEnvelope' | 'NormalizedInboundMessage';
      envelope: ExternalAgentEventEnvelope;
      message?: NormalizedInboundMessage;
      reachesExecutor: boolean;
      sourceFrameStoredAsPublicContract: false;
      evidence: {
        fixtureCase?: string;
        sourcePaths: string[];
      };
    }
  | {
      ok: false;
      error: ExternalAgentGatewayProtocolStructuredError;
    };

export type ExternalAgentGatewayProtocolBoundaryOptions = {
  runtimeId: string;
  observedAt: string;
  session?: ExternalAgentSessionDescriptor | null;
  defaultUserId?: string;
  sourceRuntimeVersion?: string;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeId(value: unknown, fallback: string): string {
  const normalized = normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}

function normalizeChannel(value: unknown): UniversalAgentChannel {
  const channel = normalizeText(value).toLowerCase();
  if (channel === 'web' || channel === 'cli' || channel === 'telegram' || channel === 'api') {
    return channel;
  }
  return channel ? 'api' : 'unknown';
}

function sourcePathsFor(frame: ExternalAgentGatewayProtocolFrame): string[] {
  return frame.sourceEvidence?.sourcePaths || [];
}

function frameOperation(frame: ExternalAgentGatewayProtocolFrame): string {
  return normalizeText(frame.operation || frame.method || frame.event || frame.frameKind, frame.frameKind);
}

function structuredGatewayFrameError(
  frame: ExternalAgentGatewayProtocolFrame,
  code: ExternalAgentGatewayProtocolStructuredError['code'],
  message: string,
): ExternalAgentGatewayProtocolNormalizationResult {
  return {
    ok: false,
    error: {
      nativeContract: 'ZavorthStructuredGatewayError/v1',
      id: `zavorth-gateway-error:${normalizeId(frame.id, 'frame')}`,
      code,
      message,
      reachesExecutor: false,
      sourceFrameStoredAsPublicContract: false,
      evidence: {
        fixtureCase: frame.fixtureCase,
        frameKind: frame.frameKind,
        sourcePaths: sourcePathsFor(frame),
      },
    },
  };
}

function buildEnvelope(
  frame: ExternalAgentGatewayProtocolFrame,
  options: ExternalAgentGatewayProtocolBoundaryOptions,
  diagnosticOnly: boolean,
): ExternalAgentEventEnvelope {
  const session = options.session || null;
  const operation = frameOperation(frame);
  const actorId = normalizeText(frame.actor?.id, diagnosticOnly ? 'external-system' : options.defaultUserId || session?.userId || 'external-user');

  return {
    id: normalizeText(frame.id, 'external-frame'),
    runtimeId: normalizeText(frame.runtimeId, options.runtimeId),
    sessionId: normalizeText(frame.sessionId, session?.id || 'external-session'),
    kind: diagnosticOnly ? 'diagnostic' : 'message',
    occurredAt: options.observedAt,
    actor: {
      id: actorId,
      role: frame.actor?.role || (diagnosticOnly ? 'system' : 'user'),
    },
    payload: {
      text: normalizeText(
        frame.payload?.text,
        diagnosticOnly ? 'External response frame observed as diagnostics.' : '',
      ),
      channel: frame.payload?.channel || session?.channel || 'api',
      workspace: frame.payload?.workspace ?? session?.workspace ?? null,
      requestedTools: uniqueStrings(frame.payload?.requestedTools || []),
      rawType: operation,
      data: {
        ...(frame.payload?.data || {}),
        frameKind: frame.frameKind,
        operation,
        fixtureCase: frame.fixtureCase,
        sequence: frame.sequence,
        idempotencyKey: frame.idempotencyKey,
        sourcePaths: sourcePathsFor(frame),
      },
    },
    diagnostics: frame.sourceEvidence ? {
      sourceRuntimeName: frame.sourceEvidence.sourceRuntimeName,
      sourceRuntimeVersion: frame.sourceEvidence.sourceRuntimeVersion || options.sourceRuntimeVersion,
      notes: frame.sourceEvidence.notes,
    } : undefined,
  };
}

function normalizeEnvelopeToInboundMessage(
  envelope: ExternalAgentEventEnvelope,
  options: ExternalAgentGatewayProtocolBoundaryOptions,
): NormalizedInboundMessage {
  const session = options.session || null;
  const channel = normalizeChannel(envelope.payload.channel || session?.channel || 'api');
  const requestedTools = uniqueStrings(envelope.payload.requestedTools || []);
  const sourcePaths = Array.isArray(envelope.payload.data?.sourcePaths)
    ? envelope.payload.data.sourcePaths.map(String)
    : [];

  return {
    requestId: `external-event:${normalizeId(envelope.id, 'event')}`,
    traceId: `${options.runtimeId}:${normalizeId(envelope.sessionId, 'session')}:${normalizeId(envelope.id, 'event')}`,
    userId: normalizeText(envelope.actor.id, session?.userId || options.defaultUserId || 'external-user'),
    sessionId: `external:${normalizeId(envelope.sessionId, 'session')}`,
    channel,
    text: normalizeText(envelope.payload.text, '[external frame without text]'),
    workspace: envelope.payload.workspace ?? session?.workspace ?? null,
    requestedTools,
    metadata: {
      source: 'external-agent-gateway-protocol-boundary',
      normalizedInboundMessage: true,
      externalGatewayProtocolBoundary: {
        runtimeId: options.runtimeId,
        eventId: envelope.id,
        eventKind: envelope.kind,
        occurredAt: envelope.occurredAt,
        rawType: envelope.payload.rawType || null,
        sourcePaths,
        boundary: {
          gatewayEntry: 'ZavorthAgentGateway.handle',
          replyEntry: 'ReplyPipeline',
          policyEntry: 'ToolExposurePolicy',
        },
        diagnostics: envelope.diagnostics || null,
      },
    },
  };
}

export function normalizeExternalAgentGatewayProtocolFrame(
  frame: ExternalAgentGatewayProtocolFrame,
  options: ExternalAgentGatewayProtocolBoundaryOptions,
): ExternalAgentGatewayProtocolNormalizationResult {
  if (frame.frameKind === 'error' || frame.status === 'error') {
    return structuredGatewayFrameError(
      frame,
      'external-frame-error',
      normalizeText(frame.payload?.errorMessage, 'External gateway frame reported an error.'),
    );
  }

  if (
    frame.frameKind === 'unknown'
    || !normalizeText(frame.id)
    || !normalizeText(frame.sessionId)
    || !frame.payload
  ) {
    return structuredGatewayFrameError(
      frame,
      'external-frame-invalid',
      'External gateway frame is missing required identity or payload fields.',
    );
  }

  const diagnosticOnly = frame.frameKind === 'response';
  const envelope = buildEnvelope(frame, options, diagnosticOnly);

  return {
    ok: true,
    nativeContract: diagnosticOnly ? 'ExternalAgentEventEnvelope' : 'NormalizedInboundMessage',
    envelope,
    ...(diagnosticOnly ? {} : { message: normalizeEnvelopeToInboundMessage(envelope, options) }),
    reachesExecutor: !diagnosticOnly,
    sourceFrameStoredAsPublicContract: false,
    evidence: {
      fixtureCase: frame.fixtureCase,
      sourcePaths: sourcePathsFor(frame),
    },
  };
}
