import { SharedSurfaceCodexRemoteCommandPack } from '../../src/domain/surface/presentation/shared-surface/SharedSurfaceCodexRemoteCommandPack';

function buildCtx(rawText = '/codexremote') {
  return {
    platform: 'telegram',
    userId: 'telegram-user',
    chatId: 'telegram:chat-1',
    isGroup: false,
    rawText,
    reply: jest.fn(async () => undefined),
    editMessage: jest.fn(async () => undefined),
  };
}

function buildPack(overrides: Record<string, any> = {}): SharedSurfaceCodexRemoteCommandPack {
  return new SharedSurfaceCodexRemoteCommandPack({
    controlPlaneService: {
      buildSnapshot: jest.fn(async () => ({
        narrative: {
          headline: 'Codex Remote active.',
          operatorSummary: 'Session remota pronta.',
          nextAction: 'Abrir ou resume uma session.',
        },
        activeProfile: { id: 'default', label: 'Default Codex' },
        summary: {
          cliReady: true,
          trackedSessions: 1,
          runningSessions: 0,
          readyRemotePaths: 1,
        },
        visibility: { mode: 'visible', pendingApprovals: 0, note: 'Everything visible.' },
        remotePaths: [{ id: 'telegram' }],
        sessionBroker: {
          telegramSummary: 'Codex Remote no Telegram',
          approvals: [],
          sessions: [],
          narrative: { headline: 'Broker ready.' },
          selected: null,
        },
        profiles: {
          narrative: {
            headline: 'Perfis readys.',
            operatorSummary: '1 profile configurado.',
          },
          health: { status: 'healthy', operatorSummary: 'Registry ok.' },
          readiness: { status: 'healthy', operatorSummary: 'CLI ok.' },
          profiles: [],
        },
      })),
    } as any,
    actionService: {
      execute: jest.fn(async () => ({
        action: { note: 'Codex Remote action executed.' },
        permission: null,
        session: null,
      })),
    } as any,
    sessionPlaneService: null,
    ...overrides,
  });
}

describe('SharedSurfaceCodexRemoteCommandPack', () => {
  it('routes profile creation payloads through the action service', async () => {
    const execute = jest.fn(async () => ({
      action: { note: 'Perfil criado.' },
      permission: null,
      session: null,
    }));
    const pack = buildPack({
      actionService: { execute } as any,
    });
    const ctx = buildCtx('/codexremote profile create work');

    await pack.handle(ctx as any, 'profile create work -- {"label":"Work Codex","codexHome":"C:\\\\Users\\\\ermys\\\\.codex-work"}');

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'create-profile',
      profileId: 'work',
      profileLabel: 'Work Codex',
      codexHome: 'C:\\Users\\ermys\\.codex-work',
      runtimeUserId: 'telegram-user',
      sourceSurface: 'telegram',
      sourceChatId: 'telegram:chat-1',
    }));
    expect(ctx.reply).toHaveBeenCalledWith('Perfil criado.');
  });

  it('starts a session from free-text prompt without requiring start --', async () => {
    const execute = jest.fn(async () => ({
      action: { note: 'Session started.' },
      permission: null,
      session: {
        record: {
          sessionId: 'codex-free-1',
          title: 'Codex Remote',
          handoffCommand: null,
        },
        operatorSummary: 'Running.',
        tail: { logLines: [] },
      },
    }));
    const pack = buildPack({
      actionService: { execute } as any,
    });
    const ctx = buildCtx('/codexremote fix the flaky test');

    await pack.handle(ctx as any, 'fix the flaky test');

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'start-session',
      prompt: 'fix the flaky test',
    }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Session started.'));
  });

  it('starts a session when NaturalSlashConvention rewrites free text to start --', async () => {
    const execute = jest.fn(async () => ({
      action: { note: 'Session started.' },
      permission: null,
      session: null,
    }));
    const pack = buildPack({
      actionService: { execute } as any,
    });
    const ctx = buildCtx('/codexremote start -- fix the flaky test');

    await pack.handle(ctx as any, 'start -- fix the flaky test');

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'start-session',
      prompt: 'fix the flaky test',
    }));
  });

  it('renders pending approvals from the Codex Remote control plane', async () => {
    const buildSnapshot = jest.fn(async () => ({
      sessionBroker: {
        approvals: [
          {
            permissionId: 'perm-1',
            kind: 'shell',
            actionId: 'run-command',
            sessionId: 'codex-session-1',
            profileId: 'default',
            reason: 'Run command supervisionado.',
          },
        ],
      },
    }));
    const pack = buildPack({
      controlPlaneService: { buildSnapshot } as any,
    });
    const ctx = buildCtx('/codexremote approvals');

    await pack.handle(ctx as any, 'approvals');

    expect(buildSnapshot).toHaveBeenCalledWith({
      runtimeUserId: 'telegram-user',
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Codex Remote approvals'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('perm-1'));
  });
});
