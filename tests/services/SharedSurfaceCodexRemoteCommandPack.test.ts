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
          headline: 'Codex Remote ativo.',
          operatorSummary: 'Sessao remota pronta.',
          nextAction: 'Abrir ou retomar uma sessao.',
        },
        activeProfile: { id: 'default', label: 'Default Codex' },
        summary: {
          cliReady: true,
          trackedSessions: 1,
          runningSessions: 0,
          readyRemotePaths: 1,
        },
        visibility: { mode: 'visible', pendingApprovals: 0, note: 'Tudo visivel.' },
        remotePaths: [{ id: 'telegram' }],
        sessionBroker: {
          telegramSummary: 'Codex Remote no Telegram',
          approvals: [],
          sessions: [],
          narrative: { headline: 'Broker pronto.' },
          selected: null,
        },
        profiles: {
          narrative: {
            headline: 'Perfis prontos.',
            operatorSummary: '1 perfil configurado.',
          },
          health: { status: 'healthy', operatorSummary: 'Registry ok.' },
          readiness: { status: 'healthy', operatorSummary: 'CLI ok.' },
          profiles: [],
        },
      })),
    } as any,
    actionService: {
      execute: jest.fn(async () => ({
        action: { note: 'Acao Codex Remote executada.' },
        permission: null,
        session: null,
      })),
    } as any,
    sessionPlaneService: null,
    ...overrides,
  });
}

describe('SharedSurfaceCodexRemoteCommandPack', () => {
  it('parses natural approval intents for Codex Remote', () => {
    const pack = buildPack();

    const command = pack.parseNaturalIntent(
      'Codex Remote, aprove a permissao 1d5bb7f7-99ee-4bdd-ad6b-823d23b2d3c1',
    );

    expect(command).toBe('/codexremote approve 1d5bb7f7-99ee-4bdd-ad6b-823d23b2d3c1');
  });

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
            reason: 'Executar comando supervisionado.',
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
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Aprovacoes do Codex Remote'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('perm-1'));
  });
});
