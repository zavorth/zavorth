import * as http from 'http';
import { EventEmitter } from 'events';
import { once } from 'events';
import { WebSocket } from 'ws';
import type { AgentState, SessionEventMap } from '../../../../src/runtime/sessions/v2/AgentState.js';
import { PtyWebSocketServer } from '../../../../src/runtime/sessions/v2/PtyWebSocketServer.js';
import { SessionRegistryService } from '../../../../src/runtime/sessions/v2/SessionRegistryService.js';

class FakeSocketSession {
  private readonly events = new EventEmitter();
  private readonly state: AgentState;

  constructor(sessionId: string) {
    this.state = {
      id: sessionId,
      status: 'IDLE',
      startedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      context: {
        cwd: process.cwd(),
        env: {},
        activeTool: null,
      },
      logs: [],
    };
  }

  public getEvents() {
    return this.events as EventEmitter & {
      on<K extends keyof SessionEventMap>(event: K, listener: SessionEventMap[K]): EventEmitter;
      removeListener<K extends keyof SessionEventMap>(event: K, listener: SessionEventMap[K]): EventEmitter;
    };
  }

  public getState(): AgentState {
    return { ...this.state, context: { ...this.state.context, env: {} }, logs: [...this.state.logs] };
  }

  public startProcess(): void {
    this.state.status = 'PROCESSING';
    this.events.emit('state:change', this.getState());
  }

  public write(input: string): void {
    this.events.emit('pty:data', `ack:${input}`);
  }

  public readonly kill = jest.fn(() => {
    this.state.status = 'IDLE';
    this.events.emit('pty:exit', 0);
    this.events.emit('state:change', this.getState());
  });
}

describe('PtyWebSocketServer', () => {
  const originalLiveTerminalInput = process.env.ZAVORTH_LIVE_TERMINAL_INPUT;

  afterEach(() => {
    if (typeof originalLiveTerminalInput === 'string') {
      process.env.ZAVORTH_LIVE_TERMINAL_INPUT = originalLiveTerminalInput;
    } else {
      delete process.env.ZAVORTH_LIVE_TERMINAL_INPUT;
    }
  });

  it('bridges init, input and kill through the experimental websocket transport', async () => {
    process.env.ZAVORTH_LIVE_TERMINAL_INPUT = 'trusted';

    const registry = new SessionRegistryService({
      now: () => new Date('2026-04-27T16:00:00.000Z'),
      idFactory: (prefix) => `${prefix}-ws`,
    });
    const ptyServer = new PtyWebSocketServer('/api/web/experimental/session-v2/ws', {
      sessionRegistry: registry,
    });
    const server = http.createServer();
    const sessions = new Map<string, FakeSocketSession>();

    server.on('upgrade', (req, socket, head) => {
      const handled = ptyServer.handleUpgrade(req, socket, head, {
        path: '/api/web/experimental/session-v2/ws',
        authorizeInput: () => true,
        resolveOwnership: (sessionId) => ({
          kind: 'live_terminal',
          surface: 'web',
          taskId: `terminal-${sessionId}`,
          ownerRef: `live-terminal:${sessionId}`,
        }),
        resolveSession: (sessionId) => {
          const existing = sessions.get(sessionId);
          if (existing) {
            return existing;
          }
          const session = new FakeSocketSession(sessionId);
          session.startProcess();
          sessions.set(sessionId, session);
          return session;
        },
      });
      if (!handled) {
        socket.destroy();
      }
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Server did not expose a TCP port.');
    }

    const client = new WebSocket(`ws://127.0.0.1:${address.port}/api/web/experimental/session-v2/ws?sessionId=ws-session-1`);
    const messages: string[] = [];
    client.on('message', (payload) => {
      messages.push(payload.toString());
    });

    await once(client, 'open');
    client.send(JSON.stringify({ type: 'pty:input', input: 'hello\n' }));

    await new Promise((resolve) => setTimeout(resolve, 100));
    client.send(JSON.stringify({ type: 'kill' }));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(messages.some((message) => message.includes('"type":"init"'))).toBe(true);
    expect(messages.some((message) => message.includes('ack:hello'))).toBe(true);
    expect(messages.some((message) => message.includes('"type":"state:change"'))).toBe(true);
    expect(registry.getSession('ws-session-1')).toEqual(expect.objectContaining({
      sessionId: 'ws-session-1',
      ownerRef: 'live-terminal:ws-session-1',
      kind: 'live_terminal',
      surface: 'web',
      taskId: 'terminal-ws-session-1',
      status: 'active',
    }));

    client.close();
    await once(client, 'close');
    ptyServer.shutdown();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('sweeps orphaned PTY sessions explicitly and returns cleanup receipts', async () => {
    const registry = new SessionRegistryService({
      now: () => new Date('2026-04-27T16:30:00.000Z'),
      idFactory: (prefix) => `${prefix}-pty`,
    });
    const ptyServer = new PtyWebSocketServer('/api/web/experimental/session-v2/ws', {
      sessionRegistry: registry,
      sessionGarbageCollectorPolicy: {
        orphanAfterMs: 1000,
        reapAfterMs: 1000,
      },
    });
    const server = http.createServer();
    const session = new FakeSocketSession('orphan-pty-1');

    server.on('upgrade', (req, socket, head) => {
      const handled = ptyServer.handleUpgrade(req, socket, head, {
        path: '/api/web/experimental/session-v2/ws',
        authorizeInput: () => true,
        resolveOwnership: () => ({
          kind: 'pty',
          surface: 'web',
          ownerRef: 'run:missing-owner',
        }),
        resolveSession: () => session,
      });
      if (!handled) {
        socket.destroy();
      }
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Server did not expose a TCP port.');
    }

    const client = new WebSocket(`ws://127.0.0.1:${address.port}/api/web/experimental/session-v2/ws?sessionId=orphan-pty-1`);
    await once(client, 'open');

    const orphanSweep = await ptyServer.sweepOrphanedSessions({
      now: '2026-04-27T16:30:02.000Z',
      activeOwnerRefs: [],
    });

    expect(orphanSweep.orphaned).toEqual([
      expect.objectContaining({
        sessionId: 'orphan-pty-1',
        status: 'orphaned',
        orphanReason: 'owner_not_active',
      }),
    ]);
    expect(orphanSweep.receipts).toEqual([
      expect.objectContaining({
        action: 'marked_orphan',
        sessionId: 'orphan-pty-1',
        reason: 'owner_not_active',
      }),
    ]);
    expect(session.kill).not.toHaveBeenCalled();
    expect(ptyServer.getSession('orphan-pty-1')).toBe(session);

    const reapSweep = await ptyServer.sweepOrphanedSessions({
      now: '2026-04-27T16:30:04.000Z',
      activeOwnerRefs: [],
    });

    expect(reapSweep.reaped).toEqual([
      expect.objectContaining({
        sessionId: 'orphan-pty-1',
        status: 'reaped',
      }),
    ]);
    expect(reapSweep.receipts).toEqual([
      expect.objectContaining({
        action: 'reaped',
        sessionId: 'orphan-pty-1',
        reason: 'orphan_reap_policy',
      }),
    ]);
    expect(session.kill).toHaveBeenCalledTimes(1);
    expect(ptyServer.getSession('orphan-pty-1')).toBeUndefined();

    client.close();
    await once(client, 'close');
    ptyServer.shutdown();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
