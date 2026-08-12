import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { AgentState, SessionEventMap } from '../../src/runtime/sessions/v2/AgentState.js';
import {
  ExperimentalSessionV2Service,
  type ExperimentalSessionV2Controller,
} from '../../src/services/SessionV2Service.js';

class FakeSessionController implements ExperimentalSessionV2Controller {
  private readonly events = new EventEmitter();
  private readonly state: AgentState;

  constructor(private readonly sessionId: string, cwd: string) {
    this.state = {
      id: sessionId,
      status: 'IDLE',
      startedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      context: {
        cwd,
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
    return {
      ...this.state,
      context: {
        ...this.state.context,
        env: { ...this.state.context.env },
      },
      logs: [...this.state.logs],
    };
  }

  public startProcess(): void {
    this.state.status = 'PROCESSING';
    this.events.emit('state:change', this.getState());
  }

  public write(input: string): void {
    this.state.status = 'PROCESSING';
    this.state.lastActiveAt = new Date().toISOString();
    this.state.logs.push(`[stdin] ${input}`);
    this.events.emit('pty:input', input);
    this.events.emit('pty:data', `ack:${input}`);
  }

  public kill(): void {
    this.state.status = 'IDLE';
    this.state.lastActiveAt = new Date().toISOString();
    this.events.emit('pty:exit', 0);
    this.events.emit('state:change', this.getState());
  }
}

describe('ExperimentalSessionV2Service', () => {
  it('creates, writes, records and exposes memory for experimental sessions', () => {
    const tempParent = path.join(process.cwd(), 'tmp');
    fs.mkdirSync(tempParent, { recursive: true });
    const tempRoot = fs.mkdtempSync(path.join(tempParent, 'zavorth-session-v2-'));
    const service = new ExperimentalSessionV2Service({
      recordingDir: path.join(tempRoot, 'recordings'),
      sessionFactory: (sessionId, cwd) => new FakeSessionController(sessionId, cwd),
    });

    const session = service.createSession({
      sessionId: 'session-v2-1',
      cwd: tempRoot,
      record: true,
    });
    const afterWrite = service.writeSession('session-v2-1', 'hello world\n');
    const memory = service.queryMemory('session-v2-1', 'hello');
    const afterKill = service.killSession('session-v2-1');
    const recordings = service.listRecordings('session-v2-1');
    const recording = service.getRecording(recordings[0]?.filename || '');

    expect(session.sessionId).toBe('session-v2-1');
    expect(session.state.context.cwd).toBe(path.resolve(tempRoot).replace(/\\/g, '/'));
    expect(afterWrite.memory.activeMessageCount).toBeGreaterThan(0);
    expect(memory.context.recentMessages.join('\n')).toContain('hello world');
    expect(afterKill.recording.lastSavedPath).toEqual(expect.stringContaining('session-v2-1-'));
    expect(recordings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filename: expect.stringContaining('session-v2-1-'),
        }),
      ]),
    );
    expect(recording).toEqual(expect.objectContaining({
      filename: recordings[0].filename,
      path: recordings[0].path,
    }));
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('rejects terminal session cwd values outside the approved workspace roots', () => {
    const service = new ExperimentalSessionV2Service({
      sessionFactory: (sessionId, cwd) => new FakeSessionController(sessionId, cwd),
    });

    expect(() => service.createSession({
      sessionId: 'outside-cwd',
      cwd: os.tmpdir(),
      record: false,
    })).toThrow('[SECURITY] Workspace nao autorizado');
  });

  it('returns stable snapshots when listing sessions', () => {
    const service = new ExperimentalSessionV2Service({
      sessionFactory: (sessionId, cwd) => new FakeSessionController(sessionId, cwd),
    });

    service.createSession({ sessionId: 'first', record: false });
    service.createSession({ sessionId: 'second', record: false });

    const sessions = service.listSessions();

    expect(sessions).toHaveLength(2);
    expect(sessions.map((entry) => entry.sessionId).sort()).toEqual(['first', 'second']);
    expect(sessions.every((entry) => entry.recording.enabled === false)).toBe(true);
  });
});
