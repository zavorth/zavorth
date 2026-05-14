import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import { config } from '../../src/config/index.js';
import { CodexRemoteSessionStoreService } from '../../src/services/CodexRemoteSessionStoreService';
import { CodexRemoteSidecarService } from '../../src/services/CodexRemoteSidecarService';

class FakeChildProcess extends EventEmitter {
  public pid: number | null = null;
  public stdout = new EventEmitter();
  public stderr = new EventEmitter();
  public killed = false;

  public kill(): boolean {
    this.killed = true;
    this.emit('exit', 0, null);
    return true;
  }
}

describe('CodexRemoteSidecarService', () => {
  const tempDirs: string[] = [];
  const originalStaleMs = config.codexRemoteSessionStaleMs;

  afterEach(() => {
    jest.restoreAllMocks();
    config.codexRemoteSessionStaleMs = originalStaleMs;
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  function createFixture(now = new Date('2026-04-07T18:10:00.000Z')) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-codex-remote-sidecar-'));
    tempDirs.push(root);
    const store = new CodexRemoteSessionStoreService({
      now: () => now,
      stateFilePath: path.join(root, 'codex-remote-sessions', 'index.json'),
    });
    const child = new FakeChildProcess();
    const notifySessionEvent = jest.fn(async () => ({
      delivered: true,
      targetChatId: '1657675475',
      reason: 'delivered',
    }));
    const sidecar = new CodexRemoteSidecarService({
      now: () => now,
      sessionStoreService: store,
      profileRegistryService: {
        resolveExecutionProfile: jest.fn(() => ({
          id: 'default',
          label: 'Default Codex',
          description: 'padrao',
          codexCliPath: 'C:\\Codex\\codex.exe',
          codexHome: 'C:\\Users\\ermys\\.codex',
          workspaceRoot: root,
          enabled: true,
          active: true,
          source: 'default',
        })),
      } as any,
      notificationService: {
        notifySessionEvent,
      } as any,
      spawnCommand: jest.fn(() => child as any) as any,
      usePowerShellBroker: false,
    });
    const session = store.createSession({
      prompt: 'ship the feature safely',
      profileId: 'default',
      workspaceRoot: root,
      requestedBy: 'telegram-user',
      sourceSurface: 'telegram',
    });
    return { root, store, sidecar, session, child, notifySessionEvent };
  }

  async function waitForSessionStatus(
    store: CodexRemoteSessionStoreService,
    sessionId: string,
    status: string,
  ): Promise<void> {
    const deadline = Date.now() + 250;
    while (Date.now() < deadline) {
      if (store.getSession(sessionId)?.status === status) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  it('starts a tracked Codex Remote session and marks it completed on exit', async () => {
    const { store, sidecar, session, child, notifySessionEvent } = createFixture();

    const running = await sidecar.startSession({
      sessionId: session.sessionId,
      requestedBy: 'telegram-user',
    });
    expect(running.status).toBe('running');

    const liveRecord = store.getSession(session.sessionId);
    expect(liveRecord?.logFilePath).toContain('codex-remote-sessions');
    expect(liveRecord?.metadata).toEqual(
      expect.objectContaining({
        codexRemotePresence: expect.objectContaining({
          state: 'running',
        }),
        codexRemoteGuardrails: expect.objectContaining({
          state: 'healthy',
        }),
      }),
    );

    fs.writeFileSync(liveRecord!.outputFilePath!, 'final answer', 'utf8');
    child.stdout.emit('data', Buffer.from('step 1\n'));
    child.emit('exit', 0, null);
    await waitForSessionStatus(store, session.sessionId, 'completed');

    const completed = store.getSession(session.sessionId);
    expect(completed?.status).toBe('completed');
    expect(completed?.lastOutput).toBe('final answer');
    expect(notifySessionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        lastOutput: 'final answer',
      }),
      expect.objectContaining({
        headline: 'Codex Remote completed',
        status: 'completed',
      }),
    );
  });

  it('invokes codex exec without the legacy output-last-message path argument', async () => {
    const { sidecar, session } = createFixture();
    const spawnMock = (sidecar as any).spawn as jest.Mock;

    await sidecar.startSession({
      sessionId: session.sessionId,
      requestedBy: 'telegram-user',
    });

    const args = spawnMock.mock.calls[0]?.[1] || [];
    expect(args).toContain('exec');
    expect(args).not.toContain('--output-last-message');
    expect(args.some((value: string) => String(value).includes('last-message.txt'))).toBe(false);

    await sidecar.stopSession(session.sessionId);
  });

  it('starts Codex Remote without inheriting unrelated provider secrets', async () => {
    const previousOpenAi = process.env.OPENAI_API_KEY;
    const previousGemini = process.env.GEMINI_API_KEY;
    const previousTelegram = process.env.TELEGRAM_BOT_TOKEN;
    process.env.OPENAI_API_KEY = 'host-openai-secret';
    process.env.GEMINI_API_KEY = 'host-gemini-secret';
    process.env.TELEGRAM_BOT_TOKEN = 'host-telegram-secret';

    try {
      const { sidecar, session } = createFixture();
      const spawnMock = (sidecar as any).spawn as jest.Mock;

      await sidecar.startSession({
        sessionId: session.sessionId,
        requestedBy: 'telegram-user',
      });

      const env = spawnMock.mock.calls[0]?.[2]?.env || {};
      expect(env.CODEX_HOME).toBe('C:\\Users\\ermys\\.codex');
      expect(env.OPENAI_API_KEY).toBeUndefined();
      expect(env.GEMINI_API_KEY).toBeUndefined();
      expect(env.TELEGRAM_BOT_TOKEN).toBeUndefined();

      await sidecar.stopSession(session.sessionId);
    } finally {
      if (previousOpenAi === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousOpenAi;
      if (previousGemini === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previousGemini;
      if (previousTelegram === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
      else process.env.TELEGRAM_BOT_TOKEN = previousTelegram;
    }
  });

  it('sends failure notifications when the process exits non-zero', async () => {
    const { store, sidecar, session, child, notifySessionEvent } = createFixture();

    await sidecar.startSession({
      sessionId: session.sessionId,
      requestedBy: 'telegram-user',
    });

    child.emit('exit', 1, null);
    await waitForSessionStatus(store, session.sessionId, 'failed');

    expect(store.getSession(session.sessionId)?.status).toBe('failed');
    expect(notifySessionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
      }),
      expect.objectContaining({
        headline: 'Codex Remote failed',
        status: 'failed',
      }),
    );
  });

  it('does not emit a duplicate stopped state while a failing exit is still being finalized', async () => {
    const { store, sidecar, session, child, notifySessionEvent } = createFixture();

    await sidecar.startSession({
      sessionId: session.sessionId,
      requestedBy: 'telegram-user',
    });

    child.emit('exit', 1, null);
    await sidecar.ensureSessionFresh(session.sessionId);
    await waitForSessionStatus(store, session.sessionId, 'failed');

    const events = store.getSession(session.sessionId)?.events || [];
    expect(events.some((event) => event.type === 'stopped')).toBe(false);
    expect(events.filter((event) => event.type === 'failed')).toHaveLength(1);
    expect(notifySessionEvent).toHaveBeenCalledTimes(1);
    expect(notifySessionEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'failed',
      }),
      expect.objectContaining({
        headline: 'Codex Remote failed',
      }),
    );
  });

  it('sends stopped notifications when the operator stops the session', async () => {
    const { store, sidecar, session, notifySessionEvent } = createFixture();

    await sidecar.startSession({
      sessionId: session.sessionId,
      requestedBy: 'telegram-user',
    });
    await sidecar.stopSession(session.sessionId);

    expect(store.getSession(session.sessionId)?.status).toBe('stopped');
    expect(notifySessionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'stopped',
      }),
      expect.objectContaining({
        headline: 'Codex Remote stopped',
        status: 'stopped',
      }),
    );
  });

  it('emits stale and timed-out guardrail notifications', async () => {
    config.codexRemoteSessionStaleMs = 0;

    const staleFixture = createFixture(new Date('2026-04-07T18:15:00.000Z'));
    await staleFixture.sidecar.startSession({
      sessionId: staleFixture.session.sessionId,
      requestedBy: 'telegram-user',
    });
    staleFixture.store.updateSession(staleFixture.session.sessionId, {
      status: 'running',
      pid: 5123,
      lastHeartbeatAt: '2026-04-07T18:15:00.000Z',
    });
    await staleFixture.sidecar.ensureSessionFresh(staleFixture.session.sessionId);
    expect(staleFixture.notifySessionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'running',
      }),
      expect.objectContaining({
        headline: 'Codex Remote stale',
        status: 'stale',
      }),
    );
    await staleFixture.sidecar.stopSession(staleFixture.session.sessionId);

    const timedOutFixture = createFixture(new Date('2026-04-07T18:20:00.000Z'));
    timedOutFixture.store.updateSession(timedOutFixture.session.sessionId, {
      status: 'running',
      maxRuntimeSeconds: 1,
      startedAt: '2026-04-07T18:19:00.000Z',
      lastHeartbeatAt: '2026-04-07T18:19:00.000Z',
      pid: 8675,
    });
    await timedOutFixture.sidecar.ensureSessionFresh(timedOutFixture.session.sessionId);
    expect(timedOutFixture.notifySessionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'stopped',
      }),
      expect.objectContaining({
        headline: 'Codex Remote guardrail',
        status: 'timed-out',
      }),
    );
  });
});
