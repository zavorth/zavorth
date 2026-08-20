/**
 * SatelliteContract - Zavorth-native contract for the Zavorth Satellite PWA.
 *
 * This contract defines the canonical communication interface between the
 * Satellite PWA, a lightweight browser client, and the main Zavorth runtime.
 *
 * Satellite is a `browser-companion` node in the Node Mesh. It connects to the
 * runtime through WebSocket and exchanges messages with a standardized
 * envelope protocol.
 *
 * Principles:
 * - WebSocket communication with typed envelopes.
 * - Node Mesh pairing-token authentication.
 * - Satellite never runs domain logic; it only sends and receives envelopes.
 * - All processing happens in the main runtime.
 *
 * Canonical capability: `satellite.connect`
 *
 * Architectural references:
 * - docs/product-direction.md (Channel mesh)
 * - src/contracts/NodeMeshContract.ts (transport base)
 *
 * @module contracts/SatelliteContract
 * @since 2026-05-03
 * @author Zavorth Core Team
 */

// Capability ID

export const SATELLITE_CONNECT_CAPABILITY_ID = 'satellite.connect' as const;
export const SATELLITE_PWA_ROUTE_BASE = '/satellite' as const;
export const SATELLITE_WS_PATH = '/api/web/satellite/ws' as const;

// Message envelope

/**
 * Message type for the Satellite protocol.
 */
export type SatelliteMessageType =
  | 'chat.send'
  | 'chat.response'
  | 'chat.stream_chunk'
  | 'chat.stream_end'
  | 'status.request'
  | 'status.response'
  | 'capability.invoke'
  | 'capability.result'
  | 'action.request'
  | 'approval.request'
  | 'heartbeat.ping'
  | 'heartbeat.pong'
  | 'auth.challenge'
  | 'auth.response'
  | 'auth.ok'
  | 'auth.error'
  | 'error';

/**
 * Canonical message envelope between Satellite and the runtime.
 * All WebSocket communication uses this shape.
 */
export interface SatelliteEnvelope<T = unknown> {
  /** Message type. */
  type: SatelliteMessageType;

  /** Unique message ID for request/response correlation. */
  messageId: string;

  /** Original message ID for responses. */
  replyTo?: string | null;

  /** Message payload; shape depends on the message type. */
  payload: T;

  /** Message creation timestamp in ISO format. */
  timestamp: string;

  /** Satellite session ID. */
  sessionId?: string | null;
}

// Payloads

/** chat.send payload (Satellite -> Runtime). */
export interface SatelliteChatSendPayload {
  /** User text message. */
  text: string;

  /** Optional attachments. */
  attachments?: SatelliteAttachment[] | null;
}

/** chat.response payload (Runtime -> Satellite). */
export interface SatelliteChatResponsePayload {
  /** Agent text response. */
  text: string;

  /** Whether the response is streaming and more chunks will follow. */
  streaming: boolean;

  /** Artifacts generated during the response. */
  artifacts?: SatelliteArtifactRef[] | null;
}

/** chat.stream_chunk payload (Runtime -> Satellite). */
export interface SatelliteStreamChunkPayload {
  /** Incremental text chunk. */
  delta: string;

  /** Chunk index in the stream sequence. */
  index: number;
}

/** chat.stream_end payload (Runtime -> Satellite). */
export interface SatelliteStreamEndPayload {
  /** Final full text for reconciliation. */
  fullText: string;

  /** Generated artifacts. */
  artifacts?: SatelliteArtifactRef[] | null;
}

/** status.response payload (Runtime -> Satellite). */
export interface SatelliteStatusPayload {
  /** Whether the runtime is operational. */
  online: boolean;

  /** Active agent name. */
  agentName: string;

  /** Available capabilities. */
  capabilities: string[];

  /** Host information. */
  host: {
    hostname: string;
    platform: string;
    uptime: number;
  };
}

/** capability.invoke payload (Satellite -> Runtime). */
export interface SatelliteCapabilityInvokePayload {
  /** Capability ID to invoke. */
  capabilityId: string;

  /** Invocation arguments. */
  args: Record<string, unknown>;
}

/** capability.result payload (Runtime -> Satellite). */
export interface SatelliteCapabilityResultPayload {
  /** Whether the invocation succeeded. */
  ok: boolean;

  /** Card ID when the result came from an interactive decision. */
  actionId?: string | null;

  /** User decision from an interactive card. */
  decision?: 'approve' | 'reject' | string | null;

  /** Invocation result. */
  result: unknown;

  /** Error, when present. */
  error?: string | null;
}

/** action.request / approval.request payload (Runtime -> Satellite). */
export interface SatelliteActionRequestPayload {
  /** Stable decision ID for correlation with capability.result. */
  actionId: string;

  /** Short title displayed in the card. */
  title: string;

  /** Contextual decision description. */
  description: string;

  /** Visual badge, such as CODE_CHANGE or SECURITY. */
  badge?: string | null;

  /** Summarized risk or severity. */
  risk?: string | null;

  /** Diff, preview, or metadata for the Details button. */
  details?: unknown;
}

/** heartbeat.ping payload (Satellite -> Runtime). */
export interface SatelliteHeartbeatPingPayload {
  /** Optional Node Mesh ID when Satellite also acts as a paired node. */
  nodeId?: string | null;

  /** Secret issued by the Node Mesh pairing claim. */
  sharedSecret?: string | null;

  /** Client-completed invocation results, when present. */
  completedInvocations?: unknown[] | null;

  /** Local capabilities reported by the client. */
  capabilities?: string[] | null;
}

/** heartbeat.pong payload (Runtime -> Satellite). */
export interface SatelliteHeartbeatPongPayload {
  ok: boolean;
  serverTime: string;
  nodeMesh?: unknown;
}

/** auth.challenge payload (Runtime -> Satellite). */
export interface SatelliteAuthChallengePayload {
  /** Expected authentication type. */
  authType: 'pairing-token' | 'zavorthControl-token';

  /** Nonce for replay-attack prevention. */
  nonce: string;
}

/** auth.response payload (Satellite -> Runtime). */
export interface SatelliteAuthResponsePayload {
  /** Authentication token. */
  token: string;

  /** Nonce received in the challenge. */
  nonce: string;
}

/** error payload (Runtime -> Satellite). */
export interface SatelliteErrorPayload {
  /** Error code. */
  code: string;

  /** Human-readable message. */
  message: string;
}

// Artifact and attachment references

/** Artifact reference for Satellite. */
export interface SatelliteArtifactRef {
  /** Zavorth artifact ID. */
  artifactId: string;

  /** MIME type. */
  contentType: string;

  /** Display name. */
  displayName: string;

  /** Relative download URL through the API. */
  downloadPath: string;

  /** Size in bytes. */
  sizeBytes?: number | null;
}

/** Attachment sent by Satellite. */
export interface SatelliteAttachment {
  /** File name. */
  fileName: string;

  /** MIME type. */
  contentType: string;

  /** Base64-encoded data. */
  dataBase64: string;

  /** Size in bytes. */
  sizeBytes: number;
}

// Satellite connection state

/** Connection state between Satellite and the runtime. */
export type SatelliteConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'reconnecting'
  | 'error';

/** Satellite connection configuration. */
export interface SatelliteConnectionConfig {
  /** Runtime WebSocket URL. */
  wsUrl: string;

  /** Authentication token. */
  authToken: string;

  /** Heartbeat interval in ms. Default: 30000. */
  heartbeatInterval?: number;

  /** Reconnection timeout in ms. Default: 5000. */
  reconnectTimeout?: number;

  /** Maximum reconnection attempts. Default: 10. */
  maxReconnectAttempts?: number;
}

export type SatelliteEnvelopeValidation =
  | { ok: true; envelope: SatelliteEnvelope }
  | { ok: false; code: string; message: string };

export function validateSatelliteEnvelope(value: unknown): SatelliteEnvelopeValidation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      code: 'INVALID_ENVELOPE',
      message: 'Envelope must be a JSON object.',
    };
  }

  const candidate = value as Partial<SatelliteEnvelope>;
  if (!isSatelliteMessageType(candidate.type)) {
    return {
      ok: false,
      code: 'INVALID_MESSAGE_TYPE',
      message: 'Envelope contains an invalid type.',
    };
  }

  if (!String(candidate.messageId || '').trim()) {
    return {
      ok: false,
      code: 'INVALID_MESSAGE_ID',
      message: 'Envelope must contain messageId.',
    };
  }

  if (!String(candidate.timestamp || '').trim()) {
    return {
      ok: false,
      code: 'INVALID_TIMESTAMP',
      message: 'Envelope must contain timestamp.',
    };
  }

  return {
    ok: true,
    envelope: {
      type: candidate.type,
      messageId: String(candidate.messageId),
      replyTo: candidate.replyTo ?? null,
      payload: candidate.payload ?? {},
      timestamp: String(candidate.timestamp),
      sessionId: candidate.sessionId ?? null,
    },
  };
}

function isSatelliteMessageType(value: unknown): value is SatelliteMessageType {
  return (
    value === 'chat.send'
    || value === 'chat.response'
    || value === 'chat.stream_chunk'
    || value === 'chat.stream_end'
    || value === 'status.request'
    || value === 'status.response'
    || value === 'capability.invoke'
    || value === 'capability.result'
    || value === 'action.request'
    || value === 'approval.request'
    || value === 'heartbeat.ping'
    || value === 'heartbeat.pong'
    || value === 'auth.challenge'
    || value === 'auth.response'
    || value === 'auth.ok'
    || value === 'auth.error'
    || value === 'error'
  );
}
