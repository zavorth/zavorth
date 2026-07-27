import { ZavorthStayOnlineService } from '../../src/services/ZavorthStayOnlineService.js';

describe('ZavorthStayOnlineService', () => {
  it('keeps a ready verdict when Ready To Go and keepalive are healthy', async () => {
    let writtenPayload: any = null;
    const service = new ZavorthStayOnlineService({
      now: () => new Date('2026-05-16T12:00:00.000Z'),
      projectRoot: 'C:/zavorth-test',
      readyToGo: {
        buildSnapshot: jest.fn(async () => readyToGoSnapshot()),
      },
      keepaliveStatus: {
        readSnapshot: jest.fn(() => keepaliveSnapshot()),
      },
      mkdirSync: jest.fn(),
      writeFileSync: jest.fn((_file, content) => {
        writtenPayload = JSON.parse(String(content));
      }) as any,
    });

    const snapshot = await service.buildSnapshot({ intervalMs: 30_000 });
    const notification = service.buildNotification({ current: snapshot });

    expect(snapshot.contractVersion).toBe('zavorth-stay-online/1');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.remoteReady).toBe(true);
    expect(snapshot.summary.keepaliveOk).toBe(true);
    expect(snapshot.notificationPolicy).toEqual(expect.objectContaining({
      quietByDefault: true,
      repeatedWarningRequiresOptIn: true,
      telegramFormat: 'operator-briefing',
    }));
    expect(snapshot.heartbeat.written).toBe(true);
    expect(writtenPayload.heartbeat.written).toBe(true);
    expect(notification.shouldNotify).toBe(false);
    expect(notification.message).toContain('sem notificaction por pattern');
    expect(service.renderCli(snapshot)).toContain('Zavorth Stay Online');
  });

  it('can explicitly notify the initial ready heartbeat when the operator asks for it', async () => {
    const service = new ZavorthStayOnlineService({
      now: () => new Date('2026-05-16T12:00:00.000Z'),
      projectRoot: 'C:/zavorth-test',
      readyToGo: {
        buildSnapshot: jest.fn(async () => readyToGoSnapshot()),
      },
      keepaliveStatus: {
        readSnapshot: jest.fn(() => keepaliveSnapshot()),
      },
      mkdirSync: jest.fn(),
      writeFileSync: jest.fn() as any,
    });

    const snapshot = await service.buildSnapshot({ intervalMs: 30_000 });
    const notification = service.buildNotification({
      current: snapshot,
      notifyReadyOnStart: true,
    });

    expect(notification.shouldNotify).toBe(true);
    expect(notification.reason).toBe('first-check');
    expect(notification.message).toContain('READY');
    expect(notification.message).toContain('Impacto:');
    expect(notification.message).toContain('Next:');
    expect(notification.compactLogLine).toContain('status=ready');
  });

  it('warns but does not block remote use when keepalive snapshot is missing', async () => {
    const service = new ZavorthStayOnlineService({
      now: () => new Date('2026-05-16T12:00:00.000Z'),
      readyToGo: {
        buildSnapshot: jest.fn(async () => readyToGoSnapshot()),
      },
      keepaliveStatus: {
        readSnapshot: jest.fn(() => null),
      },
      mkdirSync: jest.fn(),
      writeFileSync: jest.fn() as any,
    });

    const snapshot = await service.buildSnapshot({ writeSnapshot: false });

    expect(snapshot.status).toBe('attention');
    expect(snapshot.remoteReady).toBe(true);
    expect(snapshot.alerts[0]).toEqual(expect.objectContaining({
      id: 'alert-keepalive',
      command: 'npm run ops:remote:keepalive',
    }));
    expect(snapshot.safety).toEqual(expect.objectContaining({
      noApprovalBypass: true,
      selfHealIsCommandProposalOnly: true,
    }));
  });

  it('blocks remote trust when a required Ready To Go guarantee is blocked', async () => {
    const service = new ZavorthStayOnlineService({
      readyToGo: {
        buildSnapshot: jest.fn(async () => readyToGoSnapshot({
          status: 'blocked',
          remoteReady: false,
          localReady: false,
          channels: { dashboard: 'blocked', telegram: 'attention', approvals: 'ready' },
          summary: { providerDefaultRoutes: 0, providerLiveReady: 0, providerLiveFailed: 1 },
        })),
      },
      keepaliveStatus: {
        readSnapshot: jest.fn(() => keepaliveSnapshot()),
      },
      mkdirSync: jest.fn(),
      writeFileSync: jest.fn() as any,
    });

    const snapshot = await service.buildSnapshot({ writeSnapshot: false });
    const notification = service.buildNotification({ current: snapshot });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.remoteReady).toBe(false);
    expect(snapshot.summary.requiredBlocked).toBeGreaterThan(0);
    expect(notification.severity).toBe('critical');
    expect(notification.shouldNotify).toBe(true);
    expect(notification.message).toContain('BLOQUEADO');
    expect(notification.message).toContain('Aviso:');
    expect(notification.compactLogLine).toContain('reason=first-check');
  });

  it('renders Telegram as a directed operator briefing instead of raw logs', async () => {
    const service = new ZavorthStayOnlineService({
      now: () => new Date('2026-05-16T12:00:00.000Z'),
      projectRoot: 'C:/zavorth-test',
      readyToGo: {
        buildSnapshot: jest.fn(async () => readyToGoSnapshot()),
      },
      keepaliveStatus: {
        readSnapshot: jest.fn(() => null),
      },
      mkdirSync: jest.fn(),
      writeFileSync: jest.fn() as any,
    });

    const snapshot = await service.buildSnapshot({ writeSnapshot: false });
    const text = service.renderTelegram(snapshot);

    expect(text).toContain('ATENCAO');
    expect(text).toContain('Impacto:');
    expect(text).toContain('Aviso:');
    expect(text).toContain('Next:');
    expect(text).toContain('npm run ops:remote:keepalive');
  });

  it('does not repeat non-critical warning notifications unless the operator opts in', async () => {
    const service = new ZavorthStayOnlineService({
      now: () => new Date('2026-05-16T12:00:00.000Z'),
      projectRoot: 'C:/zavorth-test',
      readyToGo: {
        buildSnapshot: jest.fn(async () => readyToGoSnapshot()),
      },
      keepaliveStatus: {
        readSnapshot: jest.fn(() => null),
      },
      mkdirSync: jest.fn(),
      writeFileSync: jest.fn() as any,
    });

    const previous = await service.buildSnapshot({ writeSnapshot: false, sequence: 1 });
    const current = await service.buildSnapshot({ writeSnapshot: false, sequence: 2 });
    current.alerts[0] = {
      ...current.alerts[0],
      message: `${current.alerts[0].message} Novo detalhe operacional.`,
    };

    const quiet = service.buildNotification({ previous, current });
    const optedIn = service.buildNotification({ previous, current, notifyWarnings: true });

    expect(quiet.shouldNotify).toBe(false);
    expect(quiet.reason).toBe('quiet');
    expect(optedIn.shouldNotify).toBe(true);
    expect(optedIn.reason).toBe('active-alert');
  });

  it('only sends periodic OK pings when the current state is ready', async () => {
    const service = new ZavorthStayOnlineService({
      now: () => new Date('2026-05-16T12:00:00.000Z'),
      projectRoot: 'C:/zavorth-test',
      readyToGo: {
        buildSnapshot: jest.fn(async () => readyToGoSnapshot()),
      },
      keepaliveStatus: {
        readSnapshot: jest.fn(() => null),
      },
      mkdirSync: jest.fn(),
      writeFileSync: jest.fn() as any,
    });

    const previous = await service.buildSnapshot({ writeSnapshot: false, sequence: 1 });
    const current = await service.buildSnapshot({ writeSnapshot: false, sequence: 2 });
    const notification = service.buildNotification({ previous, current, notifyOkEvery: 2 });

    expect(notification.shouldNotify).toBe(false);
    expect(notification.reason).toBe('quiet');
  });
});

function readyToGoSnapshot(overrides: Record<string, any> = {}) {
  const summary = {
    providerDefaultRoutes: 1,
    providerLiveReady: 1,
    providerLiveFailed: 0,
    ...(overrides.summary || {}),
  };
  const channels = {
    dashboard: 'ready',
    telegram: 'ready',
    approvals: 'ready',
    ...(overrides.channels || {}),
  };
  return {
    contractVersion: 'zavorth-ready-to-go/1',
    schemaVersion: 1,
    surface: 'zavorth-ready-to-go',
    generatedAt: '2026-05-16T12:00:00.000Z',
    status: overrides.status || 'ready',
    remoteReady: overrides.remoteReady ?? true,
    localReady: overrides.localReady ?? true,
    headline: overrides.headline || 'You can leave the PC: Zavorth is ready for remote use.',
    summary,
    provider: {
      activeProvider: 'openai',
      lanes: [],
    },
    channels,
    actions: {
      fixes: 'zavorth readiness fixes',
    },
  } as any;
}

function keepaliveSnapshot() {
  return {
    ok: true,
    updatedAt: '2026-05-16T12:00:00.000Z',
    intervalMs: 60_000,
    nodeHostId: 'node-host',
    notes: [],
    stale: false,
    summary: {
      total: 2,
      ready: 2,
      unhealthy: 0,
      restarts: 0,
    },
    processes: [
      {
        name: 'gateway',
        ready: true,
        lastCheckAt: '2026-05-16T12:00:00.000Z',
        lastStartAt: '2026-05-16T12:00:00.000Z',
        lastReadyAt: '2026-05-16T12:00:00.000Z',
        lastError: null,
        restarts: 0,
      },
    ],
  };
}
