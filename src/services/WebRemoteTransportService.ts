import {
  SATELLITE_WS_PATH,
  validateSatelliteEnvelope,
  type SatelliteAuthChallengePayload,
  type SatelliteAuthResponsePayload,
  type SatelliteCapabilityInvokePayload,
  type SatelliteCapabilityResultPayload,
  type SatelliteChatResponsePayload,
  type SatelliteChatSendPayload,
  type SatelliteEnvelope,
  type SatelliteErrorPayload,
  type SatelliteHeartbeatPingPayload,
  type SatelliteHeartbeatPongPayload,
  type SatelliteMessageType,
  type SatelliteStatusPayload,
} from '../contracts/SatelliteContract.js';
import { logger } from '../logger.js';

import { randomUUID } from 'crypto';
import * as http from 'http';
import os from 'os';
import type { Duplex } from 'stream';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import {
  getDefaultCapabilityRegistry,
  type CapabilityRegistry,
} from '../capabilities/CapabilityRegistry.js';

import { ZavorthControlAuthService } from './ZavorthControlAuthService.js';
import { asErrorLike } from '../utils/errorLike.js';

export interface SatelliteSession {
  sessionId: string;
  authenticatedAt: string | null;
  authNonce: string | null;
  lastHeartbeat: string;
  messageCount: number;
  send: (envelope: SatelliteEnvelope) => void;
}

export type SatelliteMessageHandler = (
  session: SatelliteSession,
  envelope: SatelliteEnvelope,
) => Promise<void>;

export type SatelliteChatHandler = (
  payload: SatelliteChatSendPayload,
  session: SatelliteSession,
  envelope: SatelliteEnvelope<SatelliteChatSendPayload>,
) => Promise<SatelliteChatResponsePayload | string>;

export type SatelliteCapabilityInvoker = (
  payload: SatelliteCapabilityInvokePayload,
  session: SatelliteSession,
  envelope: SatelliteEnvelope<SatelliteCapabilityInvokePayload>,
  capability: unknown,
) => Promise<SatelliteCapabilityResultPayload | unknown>;

export type SatelliteHeartbeatHandler = (
  payload: SatelliteHeartbeatPingPayload,
  session: SatelliteSession,
  envelope: SatelliteEnvelope<SatelliteHeartbeatPingPayload>,
) => Promise<unknown>;

export type SatelliteTransportServiceOptions = {
  auth?: ZavorthControlAuthService | null;
  path?: string;
  agentName?: string;
  capabilityRegistry?: Pick<CapabilityRegistry, 'getAll'>;
  statusCapabilities?: string[] | (() => string[]);
  handleChatSend?: SatelliteChatHandler | null;
  invokeCapability?: SatelliteCapabilityInvoker | null;
  handleHeartbeat?: SatelliteHeartbeatHandler | null;
  now?: () => Date;
};

export type SatelliteUpgradeOptions = {
  path?: string;
  unavailableReason?: string | null;
};

export class WebRemoteTransportService {
  private readonly sessions = new Map<string, SatelliteSession>();
  private readonly messageHandlers = new Map<SatelliteMessageType, SatelliteMessageHandler>();
  private readonly auth: ZavorthControlAuthService | null;
  private readonly path: string;
  private readonly agentName: string;
  private readonly capabilityRegistry: Pick<CapabilityRegistry, 'getAll'>;
  private readonly statusCapabilities: string[] | (() => string[]) | null;
  private readonly chatHandler: SatelliteChatHandler | null;
  private readonly capabilityInvoker: SatelliteCapabilityInvoker | null;
  private readonly heartbeatHandler: SatelliteHeartbeatHandler | null;
  private readonly now: () => Date;
  private readonly startTime: number;
  private wss: WebSocketServer | null = null;

  constructor(options: SatelliteTransportServiceOptions = {}) {
    this.auth = options.auth || null;
    this.path = options.path || SATELLITE_WS_PATH;
    this.agentName = options.agentName || 'Zavorth';
    this.capabilityRegistry = options.capabilityRegistry || getDefaultCapabilityRegistry();
    this.statusCapabilities = options.statusCapabilities || null;
    this.chatHandler = options.handleChatSend || null;
    this.capabilityInvoker = options.invokeCapability || null;
    this.heartbeatHandler = options.handleHeartbeat || null;
    this.now = options.now || (() => new Date());
    this.startTime = this.now().getTime();
    this.registerDefaultHandlers();
  }

  public handleUpgrade(
    req: http.IncomingMessage,
    socket: Duplex,
    head: Buffer,
    options: SatelliteUpgradeOptions = {},
  ): boolean {
    const requestUrl = new URL(req.url || '/', `ws://${req.headers.host || 'localhost'}`);
    const expectedPath = options.path || this.path;
    if (requestUrl.pathname !== expectedPath) {
      return false;
    }

    if (options.unavailableReason) {
      socket.write(
        'HTTP/1.1 503 Service Unavailable\r\n'
        + 'Content-Type: text/plain; charset=utf-8\r\n'
        + 'Connection: close\r\n\r\n'
        + options.unavailableReason,
      );
      socket.destroy();
      return true;
    }

    const requestedSessionId = String(requestUrl.searchParams.get('sessionId') || '').trim();
    const sessionId = requestedSessionId || `satellite-${randomUUID()}`;
    this.ensureWebSocketServer();
    this.wss!.handleUpgrade(req, socket, head, (ws) => {
      this.attachWebSocket(ws, sessionId);
    });
    return true;
  }

  public shutdown(): void {
    this.wss?.clients.forEach((client) => {
      try {
        client.close();
      } catch (error: unknown) {// Ignore shutdown errors.
      logger.warn('[Satellite Transport] resource cleanup failed', error);
    }
    });
    this.wss?.close();
    this.wss = null;
    this.sessions.clear();
  }

  public onConnect(
    sessionId: string,
    sendFn: (envelope: SatelliteEnvelope) => void,
  ): SatelliteSession {
    const session: SatelliteSession = {
      sessionId,
      authenticatedAt: null,
      authNonce: null,
      lastHeartbeat: this.now().toISOString(),
      messageCount: 0,
      send: sendFn,
    };

    this.sessions.set(sessionId, session);
    logger.info(`[SatelliteTransport] New connection: ${sessionId}`);

    if (this.auth) {
      this.sendChallenge(session);
    } else {
      session.authenticatedAt = this.now().toISOString();
      this.sendEnvelope(session, 'auth.ok', { message: 'Auth disabled.' });
    }

    return session;
  }

  public onDisconnect(sessionId: string): void {
    this.sessions.delete(sessionId);
    logger.info(`[SatelliteTransport] Disconnected: ${sessionId}`);
  }

  public async onMessage(sessionId: string, raw: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`[SatelliteTransport] Message from unknown session: ${sessionId}`);
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error: unknown) {this.sendError(session, 'INVALID_MESSAGE', 'Invalid JSON message.');
      return;
    }

    const validation = validateSatelliteEnvelope(parsed);
    if (!validation.ok) {
      this.sendError(session, validation.code, validation.message);
      return;
    }

    const envelope = validation.envelope;
    session.messageCount++;

    if (
      !session.authenticatedAt
      && envelope.type !== 'auth.response'
      && envelope.type !== 'heartbeat.ping'
    ) {
      this.sendError(session, 'NOT_AUTHENTICATED', 'Authentication required.', envelope.messageId);
      return;
    }

    const handler = this.messageHandlers.get(envelope.type);
    if (!handler) {
      this.sendError(
        session,
        'UNKNOWN_MESSAGE_TYPE',
        `Unrecognized message type: ${envelope.type}`,
        envelope.messageId,
      );
      return;
    }

    try {
      await handler(session, envelope);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.error(
        `[SatelliteTransport] Handler error (${envelope.type}): ${
          error instanceof Error ? err.message : String(error)
        }`,
      );
      this.sendError(session, 'HANDLER_ERROR', 'Internal error while processing message.', envelope.messageId);
    }
  }

  public registerHandler(type: SatelliteMessageType, handler: SatelliteMessageHandler): void {
    this.messageHandlers.set(type, handler);
  }

  public getActiveSessionCount(): number {
    return this.sessions.size;
  }

  public getActiveSessions(): Array<{
    sessionId: string;
    authenticatedAt: string | null;
    lastHeartbeat: string;
    messageCount: number;
  }> {
    return Array.from(this.sessions.values()).map((session) => ({
      sessionId: session.sessionId,
      authenticatedAt: session.authenticatedAt,
      lastHeartbeat: session.lastHeartbeat,
      messageCount: session.messageCount,
    }));
  }

  private registerDefaultHandlers(): void {
    this.messageHandlers.set('heartbeat.ping', async (session, envelope) => {
      const payload = this.asRecord(envelope.payload) as SatelliteHeartbeatPingPayload;
      session.lastHeartbeat = this.now().toISOString();
      let nodeMesh: unknown = null;
      if (this.heartbeatHandler) {
        nodeMesh = await this.heartbeatHandler(payload, session, envelope as SatelliteEnvelope<SatelliteHeartbeatPingPayload>);
      }
      this.sendEnvelope(
        session,
        'heartbeat.pong',
        {
          ok: true,
          serverTime: this.now().toISOString(),
          nodeMesh,
        } satisfies SatelliteHeartbeatPongPayload,
        envelope.messageId,
      );
    });

    this.messageHandlers.set('auth.response', async (session, envelope) => {
      const payload = this.asRecord(envelope.payload) as SatelliteAuthResponsePayload;

      if (!this.auth) {
        session.authenticatedAt = this.now().toISOString();
        this.sendEnvelope(session, 'auth.ok', { message: 'Auth disabled.' }, envelope.messageId);
        return;
      }

      if (!payload.nonce || payload.nonce !== session.authNonce) {
        this.sendEnvelope(
          session,
          'auth.error',
          {
            code: 'INVALID_NONCE',
            message: 'Challenge expirado or invalid.',
          } satisfies SatelliteErrorPayload,
          envelope.messageId,
        );
        return;
      }

      if (this.auth.validate(payload.token)) {
        session.authenticatedAt = this.now().toISOString();
        session.authNonce = null;
        logger.info(`[SatelliteTransport] Session authenticated: ${session.sessionId}`);
        this.sendEnvelope(session, 'auth.ok', { message: 'Authenticated.' }, envelope.messageId);
      } else {
        this.sendEnvelope(
          session,
          'auth.error',
          {
            code: 'INVALID_TOKEN',
            message: 'Token invalid.',
          } satisfies SatelliteErrorPayload,
          envelope.messageId,
        );
      }
    });

    this.messageHandlers.set('status.request', async (session, envelope) => {
      const status: SatelliteStatusPayload = {
        online: true,
        agentName: this.agentName,
        capabilities: this.resolveStatusCapabilities(),
        host: {
          hostname: os.hostname(),
          platform: `${os.platform()} ${os.arch()}`,
          uptime: Math.floor((this.now().getTime() - this.startTime) / 1000),
        },
      };
      this.sendEnvelope(session, 'status.response', status, envelope.messageId);
    });

    this.messageHandlers.set('chat.send', async (session, envelope) => {
      const payload = this.asRecord(envelope.payload) as SatelliteChatSendPayload;
      const text = String(payload.text || '').trim();
      if (!text) {
        this.sendError(session, 'EMPTY_CHAT_MESSAGE', 'Empty message.', envelope.messageId);
        return;
      }
      if (!this.chatHandler) {
        this.sendError(session, 'CHAT_HANDLER_UNAVAILABLE', 'Gateway de chat unavailable.', envelope.messageId);
        return;
      }

      const result = await this.chatHandler(
        { ...payload, text },
        session,
        envelope as SatelliteEnvelope<SatelliteChatSendPayload>,
      );
      this.sendEnvelope(session, 'chat.response', this.normalizeChatResponse(result), envelope.messageId);
    });

    this.messageHandlers.set('capability.invoke', async (session, envelope) => {
      const payload = this.asRecord(envelope.payload) as SatelliteCapabilityInvokePayload;
      const capabilityId = String(payload.capabilityId || '').trim();
      if (!capabilityId) {
        this.sendCapabilityResult(session, envelope.messageId, {
          ok: false,
          result: null,
          error: 'capabilityId missing.',
        });
        return;
      }

      const capability = this.findCapability(capabilityId);
      if (!capability) {
        this.sendCapabilityResult(session, envelope.messageId, {
          ok: false,
          result: null,
          error: `Capability not registered: ${capabilityId}`,
        });
        return;
      }
      if (!this.capabilityInvoker) {
        this.sendCapabilityResult(session, envelope.messageId, {
          ok: false,
          result: {
            capabilityId,
            registered: true,
          },
          error: 'Dispatcher de capability unavailable.',
        });
        return;
      }

      const result = await this.capabilityInvoker(
        {
          ...payload,
          capabilityId,
          args: this.asRecord(payload.args),
        },
        session,
        envelope as SatelliteEnvelope<SatelliteCapabilityInvokePayload>,
        capability,
      );
      this.sendCapabilityResult(session, envelope.messageId, this.normalizeCapabilityResult(result));
    });
  }

  private sendChallenge(session: SatelliteSession): void {
    const nonce = randomUUID();
    session.authNonce = nonce;
    const challenge: SatelliteAuthChallengePayload = {
      authType: 'zavorthControl-token',
      nonce,
    };
    this.sendEnvelope(session, 'auth.challenge', challenge);
  }

  private sendError(session: SatelliteSession, code: string, message: string, replyTo?: string): void {
    this.sendEnvelope(session, 'error', { code, message } satisfies SatelliteErrorPayload, replyTo);
  }

  private sendCapabilityResult(
    session: SatelliteSession,
    replyTo: string,
    payload: SatelliteCapabilityResultPayload,
  ): void {
    this.sendEnvelope(session, 'capability.result', payload, replyTo);
  }

  private sendEnvelope(
    session: SatelliteSession,
    type: SatelliteMessageType,
    payload: unknown,
    replyTo?: string,
  ): void {
    const envelope: SatelliteEnvelope = {
      type,
      messageId: randomUUID(),
      replyTo: replyTo || null,
      payload,
      timestamp: this.now().toISOString(),
      sessionId: session.sessionId,
    };

    try {
      session.send(envelope);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.error(
        `[SatelliteTransport] Send failed to ${session.sessionId}: ${
          error instanceof Error ? err.message : String(error)
        }`,
      );
    }
  }

  private ensureWebSocketServer(): void {
    if (!this.wss) {
      this.wss = new WebSocketServer({ noServer: true });
    }
  }

  private attachWebSocket(ws: WebSocket, sessionId: string): void {
    const session = this.onConnect(sessionId, (envelope) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(envelope));
      }
    });

    ws.on('message', (data) => {
      void this.onMessage(session.sessionId, this.rawMessageToString(data));
    });
    ws.on('close', () => this.onDisconnect(session.sessionId));
    ws.on('error', () => this.onDisconnect(session.sessionId));
  }

  private rawMessageToString(data: RawData): string {
    if (typeof data === 'string') {
      return data;
    }
    if (Buffer.isBuffer(data)) {
      return data.toString('utf8');
    }
    if (Array.isArray(data)) {
      return Buffer.concat(data).toString('utf8');
    }
    return Buffer.from(data).toString('utf8');
  }

  private resolveStatusCapabilities(): string[] {
    if (typeof this.statusCapabilities === 'function') {
      return this.normalizeCapabilityList(this.statusCapabilities());
    }
    if (Array.isArray(this.statusCapabilities)) {
      return this.normalizeCapabilityList(this.statusCapabilities);
    }
    return this.normalizeCapabilityList(
      this.capabilityRegistry.getAll()
        .filter((capability) => capability.enabled !== false)
        .map((capability) => capability.id),
    );
  }

  private findCapability(capabilityId: string): unknown | null {
    const normalized = String(capabilityId || '').trim();
    if (!normalized) {
      return null;
    }
    return this.capabilityRegistry.getAll().find((capability) => (
      capability.id === normalized
      || capability.command?.handler_action === normalized
      || capability.command?.command === normalized
      || capability.command?.command === `/${normalized}`
    )) || null;
  }

  private normalizeCapabilityList(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean))).sort();
  }

  private normalizeChatResponse(value: SatelliteChatResponsePayload | string): SatelliteChatResponsePayload {
    if (typeof value === 'string') {
      return {
        text: value,
        streaming: false,
        artifacts: null,
      };
    }
    return {
      text: String(value.text || ''),
      streaming: Boolean(value.streaming),
      artifacts: value.artifacts || null,
    };
  }

  private normalizeCapabilityResult(value: SatelliteCapabilityResultPayload | unknown): SatelliteCapabilityResultPayload {
    if (value && typeof value === 'object') {
      const candidate = value as Record<string, unknown>;
      if (typeof candidate.ok === 'boolean' && ('result' in candidate || 'error' in candidate)) {
        return {
          ok: candidate.ok,
          result: candidate.result ?? null,
          error: candidate.error == null ? null : String(candidate.error),
        };
      }
    }
    return {
      ok: true,
      result: value,
      error: null,
    };
  }

  private asRecord(value: unknown): Record<string, any> { // eslint-disable-line @typescript-eslint/no-explicit-any
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }
}

export const SatelliteTransportService = WebRemoteTransportService;

