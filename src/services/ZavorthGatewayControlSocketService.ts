import type * as http from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { handleGatewayControlSocketMessage } from './zavorth-gateway-control-socket/controlSocketDispatch.js';
import {
  activateGatewayControlSession,
  initializeGatewayControlConnection,
} from './zavorth-gateway-control-socket/controlSocketSession.js';
import { logger } from '../logger.js';
import type {
GatewayConnectionState,
  GatewayControlReplayMode,
  GatewayControlSocketDeps,
  GatewayControlSocketEvent,
  GatewayControlSocketResponse,
} from './zavorth-gateway-control-socket/controlSocketTypes.js';

export type { GatewayControlSocketDeps } from './zavorth-gateway-control-socket/controlSocketTypes.js';

export class ZavorthGatewayControlSocketService {
  private readonly defaultPath: string;
  private wss: WebSocketServer | null = null;

  constructor(pathname: string = '/api/web/gateway/ws') {
    this.defaultPath = pathname;
  }

  public handleUpgrade(
    req: http.IncomingMessage,
    socket: Duplex,
    head: Buffer,
    deps: GatewayControlSocketDeps,
  ): boolean {
    const pathname = deps.path || this.defaultPath;
    const origin = req.headers.host || '127.0.0.1';
    const url = new URL(req.url || '/', `ws://${origin}`);
    if (url.pathname !== pathname) {
      return false;
    }

    if (deps.unavailableReason) {
      socket.write(
        'HTTP/1.1 503 Service Unavailable\r\nContent-Type: text/plain; charset=utf-8\r\nConnection: close\r\n\r\n'
        + deps.unavailableReason,
      );
      socket.destroy();
      return true;
    }

    if (deps.authorize && !deps.authorize(req, url)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return true;
    }

    const requestedSessionId = String(url.searchParams.get('sessionId') || '').trim();
    const resolvedSessionId = requestedSessionId
      || String(deps.resolveSessionId(url) || '').trim()
      || deps.createSession();

    this.ensureNoServerInstance();
    this.wss!.handleUpgrade(req, socket, head, (ws) => {
      void this.initializeConnection(ws, resolvedSessionId, url, deps);
    });
    return true;
  }

  public shutdown(): void {
    this.wss?.clients.forEach((client) => {
      try {
        client.close();
      } catch (error) { // Ignore close failures while shutting down the gateway. logger.warn('[Zavorth way Control Socket] resource cleanup failed', error); }
    });
    this.wss?.close();
    this.wss = null;
  }

  private ensureNoServerInstance(): void {
    if (this.wss) {
      return;
    }
    this.wss = new WebSocketServer({ noServer: true });
  }

  private async initializeConnection(
    ws: WebSocket,
    sessionId: string,
    url: URL,
    deps: GatewayControlSocketDeps,
  ): Promise<void> {
    const send = (payload: GatewayControlSocketEvent) => this.send(ws, payload);
    await initializeGatewayControlConnection({
      ws,
      sessionId,
      url,
      deps,
      send,
      activateSession: (state, targetSessionId, replayMode) => this.activateSession(
        state,
        targetSessionId,
        deps,
        replayMode,
        send,
      ),
      onMessage: (state, rawMessage) => this.handleMessage(ws, state, rawMessage, deps),
    });
  }

  private activateSession(
    state: GatewayConnectionState,
    sessionId: string,
    deps: GatewayControlSocketDeps,
    replayMode: GatewayControlReplayMode,
    send: (payload: GatewayControlSocketEvent) => void,
  ): Promise<void> {
    return activateGatewayControlSession({
      state,
      sessionId,
      deps,
      replayMode,
      send,
    });
  }

  private handleMessage(
    ws: WebSocket,
    state: GatewayConnectionState,
    rawMessage: string,
    deps: GatewayControlSocketDeps,
  ): Promise<void> {
    return handleGatewayControlSocketMessage({
      rawMessage,
      state,
      deps,
      activateSession: (sessionId, replayMode) => this.activateSession(
        state,
        sessionId,
        deps,
        replayMode,
        (payload) => this.send(ws, payload),
      ),
      sendResponse: (id, result) => this.sendResponse(ws, id, result),
      sendError: (id, code, message) => this.sendError(ws, id, code, message),
    });
  }

  private send(ws: WebSocket, payload: GatewayControlSocketEvent): void {
    if (ws.readyState !== ws.OPEN) {
      return;
    }
    ws.send(JSON.stringify(payload));
  }

  private sendResponse(ws: WebSocket, id: string | null, result: unknown): void {
    const payload: GatewayControlSocketResponse = {
      type: 'response',
      id,
      ok: true,
      result,
    };
    this.send(ws, payload);
  }

  private sendError(ws: WebSocket, id: string | null, code: string, message: string): void {
    const payload: GatewayControlSocketResponse = {
      type: 'response',
      id,
      ok: false,
      error: {
        code,
        message,
      },
    };
    this.send(ws, payload);
  }
}
