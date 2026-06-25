/**
 * SatelliteContract — Contrato Zavorth-nativo para o Zavorth Satellite PWA.
 *
 * Este contrato define a interface canônica para a comunicação entre
 * o Satellite PWA (cliente leve no browser) e o runtime principal do Zavorth.
 *
 * O Satellite é um nó do tipo 'browser-companion' no Node Mesh,
 * que se conecta via WebSocket ao runtime e troca mensagens
 * usando um protocolo de envelope padronizado.
 *
 * Princípios:
 * - Comunicação via WebSocket com envelope tipado.
 * - Autenticação via token de pairing do Node Mesh.
 * - O Satellite nunca executa lógica de domínio — apenas envia/recebe envelopes.
 * - Todo processamento ocorre no runtime principal.
 *
 * Capability canônica: `satellite.connect`
 *
 * Referências arquiteturais:
 * - docs/product-direction.md (Channel mesh)
 * - src/contracts/NodeMeshContract.ts (transport base)
 *
 * @module contracts/SatelliteContract
 * @since 2026-05-03
 * @author Zavorth Core Team
 */

// ---------------------------------------------------------------------------
// Capability ID
// ---------------------------------------------------------------------------

export const SATELLITE_CONNECT_CAPABILITY_ID = 'satellite.connect' as const;
export const SATELLITE_PWA_ROUTE_BASE = '/satellite' as const;
export const SATELLITE_WS_PATH = '/api/web/satellite/ws' as const;

// ---------------------------------------------------------------------------
// Envelope de mensagem
// ---------------------------------------------------------------------------

/**
 * Tipo de mensagem do protocolo Satellite.
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
 * Envelope canônico de mensagem entre Satellite e Runtime.
 * Toda comunicação via WebSocket usa este formato.
 */
export interface SatelliteEnvelope<T = unknown> {
  /** Tipo da mensagem. */
  type: SatelliteMessageType;

  /** ID único da mensagem para correlação request/response. */
  messageId: string;

  /** ID da mensagem original (para respostas). */
  replyTo?: string | null;

  /** Payload da mensagem (shape depende do type). */
  payload: T;

  /** Timestamp ISO da criação da mensagem. */
  timestamp: string;

  /** ID da sessão do Satellite. */
  sessionId?: string | null;
}

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------

/** Payload de chat.send (Satellite → Runtime). */
export interface SatelliteChatSendPayload {
  /** Mensagem textual do usuário. */
  text: string;

  /** Anexos, se existirem. */
  attachments?: SatelliteAttachment[] | null;
}

/** Payload de chat.response (Runtime → Satellite). */
export interface SatelliteChatResponsePayload {
  /** Resposta textual do agente. */
  text: string;

  /** Se a resposta é streaming (mais chunks virão). */
  streaming: boolean;

  /** Artefatos gerados durante a resposta. */
  artifacts?: SatelliteArtifactRef[] | null;
}

/** Payload de chat.stream_chunk (Runtime → Satellite). */
export interface SatelliteStreamChunkPayload {
  /** Trecho de texto incremental. */
  delta: string;

  /** Índice do chunk na sequência. */
  index: number;
}

/** Payload de chat.stream_end (Runtime → Satellite). */
export interface SatelliteStreamEndPayload {
  /** Texto completo final (para reconciliação). */
  fullText: string;

  /** Artefatos gerados. */
  artifacts?: SatelliteArtifactRef[] | null;
}

/** Payload de status.response (Runtime → Satellite). */
export interface SatelliteStatusPayload {
  /** Se o runtime está operacional. */
  online: boolean;

  /** Nome do agente ativo. */
  agentName: string;

  /** Capabilities disponíveis. */
  capabilities: string[];

  /** Informações do host. */
  host: {
    hostname: string;
    platform: string;
    uptime: number;
  };
}

/** Payload de capability.invoke (Satellite → Runtime). */
export interface SatelliteCapabilityInvokePayload {
  /** ID da capability a invocar. */
  capabilityId: string;

  /** Argumentos da invocação. */
  args: Record<string, unknown>;
}

/** Payload de capability.result (Runtime → Satellite). */
export interface SatelliteCapabilityResultPayload {
  /** Se a invocação foi bem-sucedida. */
  ok: boolean;

  /** ID do card quando o resultado veio de uma decisao interativa. */
  actionId?: string | null;

  /** Decisao tomada pelo usuario em um card interativo. */
  decision?: 'approve' | 'reject' | string | null;

  /** Resultado da invocação. */
  result: unknown;

  /** Erro, se houve. */
  error?: string | null;
}

/** Payload de action.request / approval.request (Runtime -> Satellite). */
export interface SatelliteActionRequestPayload {
  /** ID estavel da decisao para correlacionar com capability.result. */
  actionId: string;

  /** Titulo curto exibido no card. */
  title: string;

  /** Descricao contextual da decisao. */
  description: string;

  /** Badge visual, como CODE_CHANGE ou SECURITY. */
  badge?: string | null;

  /** Risco ou severidade resumida. */
  risk?: string | null;

  /** Diff, preview ou metadados para o botao Details. */
  details?: unknown;
}

/** Payload de heartbeat.ping (Satellite -> Runtime). */
export interface SatelliteHeartbeatPingPayload {
  /** Node Mesh id opcional quando o Satellite tambem atua como node pareado. */
  nodeId?: string | null;

  /** Segredo emitido pelo claim de pairing do Node Mesh. */
  sharedSecret?: string | null;

  /** Resultados de invocacoes concluidas pelo cliente, quando houver. */
  completedInvocations?: unknown[] | null;

  /** Capabilities locais reportadas pelo cliente. */
  capabilities?: string[] | null;
}

/** Payload de heartbeat.pong (Runtime -> Satellite). */
export interface SatelliteHeartbeatPongPayload {
  ok: boolean;
  serverTime: string;
  nodeMesh?: unknown;
}

/** Payload de auth.challenge (Runtime → Satellite). */
export interface SatelliteAuthChallengePayload {
  /** Tipo de autenticação esperado. */
  authType: 'pairing-token' | 'dashboard-token';

  /** Nonce para evitar replay attacks. */
  nonce: string;
}

/** Payload de auth.response (Satellite → Runtime). */
export interface SatelliteAuthResponsePayload {
  /** Token de autenticação. */
  token: string;

  /** Nonce recebido no challenge. */
  nonce: string;
}

/** Payload de error (Runtime → Satellite). */
export interface SatelliteErrorPayload {
  /** Código de erro. */
  code: string;

  /** Mensagem legível. */
  message: string;
}

// ---------------------------------------------------------------------------
// Referências de artefatos e anexos
// ---------------------------------------------------------------------------

/** Referência a um artefato para o Satellite. */
export interface SatelliteArtifactRef {
  /** ID do artefato no Zavorth. */
  artifactId: string;

  /** Tipo MIME. */
  contentType: string;

  /** Nome de exibição. */
  displayName: string;

  /** URL relativa para download via API. */
  downloadPath: string;

  /** Tamanho em bytes. */
  sizeBytes?: number | null;
}

/** Anexo enviado pelo Satellite. */
export interface SatelliteAttachment {
  /** Nome do arquivo. */
  fileName: string;

  /** Tipo MIME. */
  contentType: string;

  /** Dados em base64. */
  dataBase64: string;

  /** Tamanho em bytes. */
  sizeBytes: number;
}

// ---------------------------------------------------------------------------
// Estado da conexão do Satellite
// ---------------------------------------------------------------------------

/** Estado da conexão entre Satellite e Runtime. */
export type SatelliteConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'reconnecting'
  | 'error';

/** Configuração de conexão do Satellite. */
export interface SatelliteConnectionConfig {
  /** URL do WebSocket do runtime. */
  wsUrl: string;

  /** Token de autenticação. */
  authToken: string;

  /** Intervalo de heartbeat em ms. Default: 30000. */
  heartbeatInterval?: number;

  /** Timeout de reconexão em ms. Default: 5000. */
  reconnectTimeout?: number;

  /** Máximo de tentativas de reconexão. Default: 10. */
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
      message: 'Envelope deve ser um objeto JSON.',
    };
  }

  const candidate = value as Partial<SatelliteEnvelope>;
  if (!isSatelliteMessageType(candidate.type)) {
    return {
      ok: false,
      code: 'INVALID_MESSAGE_TYPE',
      message: 'Envelope trouxe type invalido.',
    };
  }

  if (!String(candidate.messageId || '').trim()) {
    return {
      ok: false,
      code: 'INVALID_MESSAGE_ID',
      message: 'Envelope deve conter messageId.',
    };
  }

  if (!String(candidate.timestamp || '').trim()) {
    return {
      ok: false,
      code: 'INVALID_TIMESTAMP',
      message: 'Envelope deve conter timestamp.',
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
