/**
 * BridgeProtocolSchema — Contrato JSON Schema padronizado para comunicação
 * entre agentes no ecossistema Zavorth.
 *
 * Qualquer software (ZavorthBridge, Codex, ferramentas externas) pode depositar
 * um arquivo JSON no diretório de inbox seguindo este contrato e receber
 * uma resposta estruturada no diretório de respostas.
 *
 * Versão: ZAVORTH_BRIDGE_V2
 */

// ─── Envelope Types ──────────────────────────────────────────────────────────

/** All supported agent identifiers */
export type BridgeAgent = 'ZAVORTH_BRIDGE' | 'CODEX' | 'EXTERNAL_EXECUTOR' | 'GEMINI_CLI' | 'JULES' | 'EXTERNAL';

/** All supported actions that can be requested */
export type BridgeAction =
  | 'PLAN_AND_EXECUTE'
  | 'QUERY'
  | 'STATUS_CHECK'
  | 'CANCEL'
  | 'HEARTBEAT';

/** Priority levels for message processing */
export type BridgePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

/** Status of a bridge response */
export type BridgeResponseStatus =
  | 'ACCEPTED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'FAILED'
  | 'PENDING'
  | 'CANCELLED';

// ─── Request Envelope ────────────────────────────────────────────────────────

/**
 * The universal request envelope that any external software can write
 * as a JSON file into the bridge inbox directory.
 */
export interface BridgeRequestEnvelope {
  /** Protocol version identifier — must be "ZAVORTH_BRIDGE_V2" */
  protocol: 'ZAVORTH_BRIDGE_V2';

  /** Unique message ID (UUIDv4 recommended) */
  messageId: string;

  /** ISO 8601 timestamp of when the message was created */
  timestamp: string;

  /** Identifier of the sending software/agent */
  sender: string;

  /** Target agent to handle the request */
  agent: BridgeAgent;

  /** Requested action */
  action: BridgeAction;

  /** Processing priority */
  priority: BridgePriority;

  /** Correlation ID for linking request/response pairs */
  correlationId: string;

  /** The actual payload — prompt text, query, etc. */
  payload: BridgeRequestPayload;

  /** HMAC-SHA256 signature of canonical fields (hex) */
  signature: string;

  /** Optional: TTL in seconds — message expires after this duration */
  ttlSeconds?: number;

  /** Optional: arbitrary key-value metadata */
  metadata?: Record<string, unknown>;
}

export interface BridgeRequestPayload {
  /** The prompt or instruction text */
  prompt: string;

  /** Target workspace path (or "AUTO" for automatic selection) */
  workspace: string;

  /** Optional task ID from the caller's system */
  externalTaskId?: string;

  /** Optional list of file paths relevant to the request */
  targetFiles?: string[];

  /** Optional context or additional parameters */
  context?: Record<string, unknown>;
}

// ─── Response Envelope ───────────────────────────────────────────────────────

/**
 * The universal response envelope that Zavorth writes back
 * into the bridge response directory.
 */
export interface BridgeResponseEnvelope {
  /** Protocol version — mirrors the request */
  protocol: 'ZAVORTH_BRIDGE_V2';

  /** Unique response message ID */
  messageId: string;

  /** ISO 8601 timestamp of response creation */
  timestamp: string;

  /** Correlation ID that matches the original request */
  correlationId: string;

  /** Original request message ID */
  inReplyTo: string;

  /** Processing status */
  status: BridgeResponseStatus;

  /** The response payload */
  payload: BridgeResponsePayload;

  /** HMAC-SHA256 signature of canonical response fields (hex) */
  signature: string;

  /** Optional: arbitrary key-value metadata */
  metadata?: Record<string, unknown>;
}

export interface BridgeResponsePayload {
  /** Human-readable summary of the result */
  summary: string;

  /** Internal Zavorth task ID assigned to this request */
  taskId: string;

  /** Executor that was used (if any) */
  executorUsed?: string;

  /** Risk level assessed (0-3) */
  riskLevel?: number;

  /** Whether manual approval was required */
  requiredApproval?: boolean;

  /** Standard output capture */
  stdout?: string;

  /** Standard error capture */
  stderr?: string;

  /** Error message if status is FAILED or REJECTED */
  errorMessage?: string;

  /** List of files that were changed */
  filesChanged?: string[];

  /** List of commands that were executed */
  commandsExecuted?: string[];
}

// ─── Heartbeat ───────────────────────────────────────────────────────────────

/**
 * Lightweight heartbeat message for health monitoring.
 * External software can periodically deposit these to check if Zavorth
 * is alive and processing messages.
 */
export interface BridgeHeartbeatResponse {
  protocol: 'ZAVORTH_BRIDGE_V2';
  messageId: string;
  timestamp: string;
  correlationId: string;
  inReplyTo: string;
  status: 'COMPLETED';
  alive: boolean;
  uptimeSeconds: number;
  pendingMessages: number;
  activeAgent: BridgeAgent | null;
}

// ─── JSON Schema Definitions (static) ────────────────────────────────────────

/**
 * Machine-readable JSON Schema definitions for the request and response
 * envelopes. Can be exported and consumed by any language or validation tool.
 */
export const BRIDGE_REQUEST_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://zavorth.local/schemas/bridge-request-v2.json',
  title: 'Zavorth Bridge Request Envelope V2',
  description:
    'Envelope JSON que qualquer software pode depositar no inbox do Zavorth Agent Bridge para solicitar uma ação.',
  type: 'object' as const,
  required: [
    'protocol',
    'messageId',
    'timestamp',
    'sender',
    'agent',
    'action',
    'priority',
    'correlationId',
    'payload',
    'signature',
  ],
  properties: {
    protocol: {
      type: 'string' as const,
      const: 'ZAVORTH_BRIDGE_V2',
      description: 'Identificador fixo do protocolo.',
    },
    messageId: {
      type: 'string' as const,
      format: 'uuid',
      description: 'UUID v4 unico da mensagem.',
    },
    timestamp: {
      type: 'string' as const,
      format: 'date-time',
      description: 'ISO 8601 timestamp.',
    },
    sender: {
      type: 'string' as const,
      minLength: 1,
      description: 'Identificador do software remetente.',
    },
    agent: {
      type: 'string' as const,
      enum: ['ZAVORTH_BRIDGE', 'CODEX', 'EXTERNAL_EXECUTOR', 'GEMINI_CLI', 'JULES', 'EXTERNAL'],
      description: 'Agente alvo.',
    },
    action: {
      type: 'string' as const,
      enum: ['PLAN_AND_EXECUTE', 'QUERY', 'STATUS_CHECK', 'CANCEL', 'HEARTBEAT'],
      description: 'Acao solicitada.',
    },
    priority: {
      type: 'string' as const,
      enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'],
      default: 'NORMAL',
      description: 'Prioridade de processamento.',
    },
    correlationId: {
      type: 'string' as const,
      description: 'ID de correlacao para vincular request/response.',
    },
    payload: {
      type: 'object' as const,
      required: ['prompt', 'workspace'],
      properties: {
        prompt: { type: 'string' as const, minLength: 1 },
        workspace: { type: 'string' as const, default: 'AUTO' },
        externalTaskId: { type: 'string' as const },
        targetFiles: { type: 'array' as const, items: { type: 'string' as const } },
        context: { type: 'object' as const, additionalProperties: true },
      },
    },
    signature: {
      type: 'string' as const,
      description: 'HMAC-SHA256 hex da string canonica.',
    },
    ttlSeconds: {
      type: 'integer' as const,
      minimum: 1,
      description: 'Tempo de vida da mensagem em segundos.',
    },
    metadata: {
      type: 'object' as const,
      additionalProperties: true,
    },
  },
  additionalProperties: false,
} as const;

export const BRIDGE_RESPONSE_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://zavorth.local/schemas/bridge-response-v2.json',
  title: 'Zavorth Bridge Response Envelope V2',
  description:
    'Envelope JSON que o Zavorth deposita no diretório de respostas apos processar uma solicitação.',
  type: 'object' as const,
  required: [
    'protocol',
    'messageId',
    'timestamp',
    'correlationId',
    'inReplyTo',
    'status',
    'payload',
    'signature',
  ],
  properties: {
    protocol: {
      type: 'string' as const,
      const: 'ZAVORTH_BRIDGE_V2',
    },
    messageId: { type: 'string' as const, format: 'uuid' },
    timestamp: { type: 'string' as const, format: 'date-time' },
    correlationId: { type: 'string' as const },
    inReplyTo: { type: 'string' as const },
    status: {
      type: 'string' as const,
      enum: ['ACCEPTED', 'REJECTED', 'COMPLETED', 'FAILED', 'PENDING', 'CANCELLED'],
    },
    payload: {
      type: 'object' as const,
      required: ['summary', 'taskId'],
      properties: {
        summary: { type: 'string' as const },
        taskId: { type: 'string' as const },
        executorUsed: { type: 'string' as const },
        riskLevel: { type: 'integer' as const, minimum: 0, maximum: 3 },
        requiredApproval: { type: 'boolean' as const },
        stdout: { type: 'string' as const },
        stderr: { type: 'string' as const },
        errorMessage: { type: 'string' as const },
        filesChanged: { type: 'array' as const, items: { type: 'string' as const } },
        commandsExecuted: { type: 'array' as const, items: { type: 'string' as const } },
      },
    },
    signature: { type: 'string' as const },
    metadata: { type: 'object' as const, additionalProperties: true },
  },
  additionalProperties: false,
} as const;
