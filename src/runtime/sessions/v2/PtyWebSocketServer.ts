import { logger } from '../../../logger.js';
import type * as http from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  SessionGarbageCollector,
  type SessionGarbageCollectorSweepInput,
  type SessionGarbageCollectorSweepResult,
} from './SessionGarbageCollector.js';
import { SessionManager } from './SessionManager.js';
import type { AgentState, SessionEventMap } from './AgentState.js';
import type { RegisterSessionOwnershipInput, SessionGarbageCollectorPolicy } from './SessionOwnershipContract.js';
import type { SessionRegistryService } from './SessionRegistryService.js';type PtySessionController = {
  getEvents(): {
    on<K extends keyof SessionEventMap>(event: K, listener: SessionEventMap[K]): unknown;
    removeListener<K extends keyof SessionEventMap>(event: K, listener: SessionEventMap[K]): unknown;
  };
  getState(): AgentState;
  startProcess(command?: string, args?: string[]): void;
  write(input: string): void;
  kill(): void;
};

type UpgradeOptions = {
  path?: string;
  authorize?: (req: http.IncomingMessage, url: URL) => boolean;
  authorizeInput?: (req: http.IncomingMessage, url: URL) => boolean;
  resolveSession?: (sessionId: string, url: URL) => PtySessionController;
  resolveOwnership?: (sessionId: string, url: URL) => Omit<RegisterSessionOwnershipInput, 'sessionId'>;
};

type PtyWebSocketServerOptions = {
  sessionRegistry?: SessionRegistryService | null;
  sessionGarbageCollectorPolicy?: Partial<SessionGarbageCollectorPolicy>;
};

export class PtyWebSocketServer {
  private wss: WebSocketServer | null = null;
  private readonly sessions = new Map<string, PtySessionController>();
  private readonly path: string;
  private readonly sessionRegistry: SessionRegistryService | null;
  private readonly sessionGarbageCollectorPolicy: Partial<SessionGarbageCollectorPolicy> | undefined;

  constructor(pathname: string = '/api/web/experimental/session-v2/ws', options: PtyWebSocketServerOptions = {}) {
    this.path = pathname;
    this.sessionRegistry = options.sessionRegistry || null;
    this.sessionGarbageCollectorPolicy = options.sessionGarbageCollectorPolicy;
  }

  public initialize(port: number = 8080) {
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws: WebSocket, request: http.IncomingMessage) => {
      const url = new URL(request.url || '/', `ws://${request.headers.host || '127.0.0.1'}`);
      const sessionId = url.searchParams.get('sessionId') || `session-${Date.now()}`;
      const session = this.resolveStandaloneSession(sessionId, this.buildLiveTerminalOwnership(sessionId, url));
      this.bindSessionToWebSocket(session, ws, this.isInputAllowedFromEnv());
    });

    logger.info(`[PtyWebSocketServer] WebSockets online on ws://127.0.0.1:${port}`);
  }

  public handleUpgrade(
    req: http.IncomingMessage,
    socket: Duplex,
    head: Buffer,
    options: UpgradeOptions = {},
  ): boolean {
    const pathname = options.path || this.path;
    const origin = req.headers.host || '127.0.0.1';
    const url = new URL(req.url || '/', `ws://${origin}`);
    if (url.pathname !== pathname) {
      return false;
    }

    if (options.authorize && !options.authorize(req, url)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return true;
    }

    const sessionId = String(url.searchParams.get('sessionId') || '').trim() || `session-${Date.now()}`;
    const ownership = options.resolveOwnership?.(sessionId, url);
    const session = options.resolveSession
      ? options.resolveSession(sessionId, url)
      : this.resolveStandaloneSession(sessionId, ownership || this.buildLiveTerminalOwnership(sessionId, url));
    if (options.resolveSession) {
      this.ensureResolvedSessionOwnership(sessionId, url, ownership);
    }

    this.ensureNoServerInstance();
    this.wss!.handleUpgrade(req, socket, head, (ws) => {
      this.bindSessionToWebSocket(session, ws, Boolean(options.authorizeInput?.(req, url)));
    });
    return true;
  }

  public getSession(sessionId: string): PtySessionController | undefined {
    return this.sessions.get(sessionId);
  }

  public async sweepOrphanedSessions(
    input: SessionGarbageCollectorSweepInput = {},
  ): Promise<SessionGarbageCollectorSweepResult> {
    if (!this.sessionRegistry) {
      return this.buildEmptySweepResult();
    }

    const collector = new SessionGarbageCollector({
      registry: this.sessionRegistry,
      policy: this.sessionGarbageCollectorPolicy,
      terminateSession: (record) => {
        const session = this.sessions.get(record.sessionId);
        if (!session) {
          return;
        }
        session.kill();
        this.sessions.delete(record.sessionId);
      },
    });
    return collector.sweep(input);
  }

  public shutdown() {
    this.sessions.forEach((session) => session.kill());
    this.sessions.clear();
    this.wss?.close();
    this.wss = null;
  }

  private ensureNoServerInstance(): void {
    if (this.wss) {
      return;
    }
    this.wss = new WebSocketServer({ noServer: true });
  }

  private resolveStandaloneSession(
    sessionId: string,
    ownership?: Omit<RegisterSessionOwnershipInput, 'sessionId'>,
  ): PtySessionController {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      return existing;
    }

    const session = new SessionManager(sessionId, process.cwd(), {
      sessionRegistry: this.sessionRegistry || undefined,
      ownership: ownership || this.buildLiveTerminalOwnership(sessionId),
    });
    this.sessions.set(sessionId, session);
    session.startProcess();
    return session;
  }

  private ensureResolvedSessionOwnership(
    sessionId: string,
    url: URL,
    ownership?: Omit<RegisterSessionOwnershipInput, 'sessionId'>,
  ): void {
    if (!this.sessionRegistry) {
      return;
    }
    if (!ownership && this.sessionRegistry.getSession(sessionId)) {
      return;
    }
    this.sessionRegistry.registerSession({
      ...this.buildLiveTerminalOwnership(sessionId, url),
      ...ownership,
      sessionId,
    });
  }

  private buildLiveTerminalOwnership(
    sessionId: string,
    url?: URL,
  ): Omit<RegisterSessionOwnershipInput, 'sessionId'> {
    return {
      kind: 'live_terminal',
      surface: 'websocket',
      taskId: sessionId,
      ownerRef: `live-terminal:${sessionId}`,
      metadata: {
        transport: 'websocket',
        path: url?.pathname || this.path,
      },
    };
  }

  private buildEmptySweepResult(): SessionGarbageCollectorSweepResult {
    return {
      checked: 0,
      kept: [],
      orphaned: [],
      reaped: [],
      receipts: [],
    };
  }

  private bindSessionToWebSocket(session: PtySessionController, ws: WebSocket, allowInput: boolean) {
    if (!this.sessions.has(session.getState().id)) {
      this.sessions.set(session.getState().id, session);
    }

    ws.send(JSON.stringify({ type: 'init', sessionId: session.getState().id, state: session.getState() }));

    const onData = (data: string) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'pty:data', data }));
      }
    };

    const onError = (error: string) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'pty:error', error }));
      }
    };

    const onStateChange = (state: AgentState) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'state:change', state }));
      }
    };

    session.getEvents().on('pty:data', onData);
    session.getEvents().on('pty:error', onError);
    session.getEvents().on('state:change', onStateChange);

    ws.on('message', (message) => {
      try {
        const payload = JSON.parse(message.toString());
        if (payload.type === 'pty:input' && payload.input) {
          if (!allowInput) {
            ws.send(JSON.stringify({
              type: 'pty:error',
              error: 'Input bloqueado pela policy do Live Terminal. Use ZAVORTH_LIVE_TERMINAL_INPUT=trusted para liberar.',
            }));
            return;
          }
          session.write(String(payload.input));
        }
        if (payload.type === 'kill') {
          if (!allowInput) {
            ws.send(JSON.stringify({
              type: 'pty:error',
              error: 'Kill bloqueado pela policy do Live Terminal.',
            }));
            return;
          }
          session.kill();
        }
      } catch (error: unknown) {if (!allowInput) {
          ws.send(JSON.stringify({
            type: 'pty:error',
            error: 'Input bruto bloqueado pela policy do Live Terminal.',
          }));
          return;
        }
        session.write(message.toString());
      }
    });

    ws.on('close', () => {
      session.getEvents().removeListener('pty:data', onData);
      session.getEvents().removeListener('pty:error', onError);
      session.getEvents().removeListener('state:change', onStateChange);
    });
  }

  private isInputAllowedFromEnv(): boolean {
    const profile = String(
      process.env.ZAVORTH_LIVE_TERMINAL_INPUT
      || process.env.ZAVORTH_MCP_PROFILE
      || 'safe',
    ).trim().toLowerCase();
    return profile === 'trusted' || profile === 'dangerous' || profile === 'true';
  }
}
