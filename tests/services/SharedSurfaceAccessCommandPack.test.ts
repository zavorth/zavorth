import { SharedSurfaceAccessCommandPack } from '../../src/domain/surface/application/shared-surface/SharedSurfaceAccessCommandPack';

function buildCtx(rawText = '/access') {
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

function buildManifest() {
  return {
    summary: 'Acesso local pronto e remoto em preparacao.',
    local: {
      ready: true,
      appUrl: 'http://localhost:3000/app',
      dashboardUrl: 'http://localhost:3000/dashboard',
      apiBaseUrl: 'http://localhost:3000/api',
    },
    remote: {
      ready: false,
      baseUrl: 'https://zavorth.example.dev',
      appUrl: '',
      requiresHttps: true,
    },
    auth: {
      required: true,
      source: 'ZAVORTH_WEB_TOKEN',
      authorizedHost: true,
    },
    guides: {
      local: ['Abrir app local.', 'Validar token web.'],
    },
    surfaces: [
      {
        label: 'App web',
        entry: 'http://localhost:3000/app',
        remoteEntry: 'https://zavorth.example.dev/app',
        ready: true,
      },
    ],
    commands: {
      access: '/access',
      remote: '/access remote',
      trust: '/trust',
      start: 'npm run ops:start',
      bootstrap: 'npm run ops:bootstrap -- --repair',
      manifest: 'npm run ops:access',
    },
    nextSteps: [
      {
        title: 'Validar remoto oficial',
        description: 'Confirmar URL publica.',
      },
    ],
  };
}

function buildPack(overrides: Record<string, any> = {}): SharedSurfaceAccessCommandPack {
  return new SharedSurfaceAccessCommandPack({
    runtimeAccessManifestService: {
      buildManifest: jest.fn(async () => buildManifest()),
    } as any,
    runtimeBootstrapService: {
      inspectLive: jest.fn(async () => ({
        summary: 'Bootstrap quase fechado.',
        env: {
          envFilePresent: true,
          llmProvider: 'openai',
          llmCredentialReady: true,
        },
        dependencies: {
          installRequired: false,
          buildRequired: false,
        },
        supervisedRuntime: {
          accessReadiness: {
            local: { ready: true },
            remote: { ready: false },
          },
        },
        actions: [
          {
            title: 'Subir runtime supervisionado',
            command: 'npm run dev:supervised',
          },
        ],
      })),
    } as any,
    runtimeInstallJourneyService: {
      run: jest.fn(async () => ({
        phases: [
          {
            status: 'pending',
            title: 'Autostart no sistema',
            command: 'npm run launcher:startup:install',
          },
        ],
      })),
    } as any,
    runtimeOfficialRemoteAccessService: {
      inspect: jest.fn(async () => ({
        remote: {
          ready: false,
          baseUrl: 'https://zavorth.example.dev',
          appUrl: '',
        },
        recommendedPathId: 'cloudflare',
        recommendedPathReason: 'Ainda falta validar a URL publica oficial.',
        nextSteps: ['Validar tunnel oficial.'],
      })),
    } as any,
    sharedSurfaceParityService: {
      buildManifest: jest.fn(() => ({
        summary: 'Web e Telegram estao alinhados para access, bootstrap e workflow.',
        recommended: [
          {
            surfaceCommand: '/access',
            description: 'Abrir manifesto de acesso.',
          },
        ],
      })),
    } as any,
    ...overrides,
  });
}

describe('SharedSurfaceAccessCommandPack', () => {
  it('surfaces official remote access and parity details in /access', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/access');

    const handled = await pack.maybeHandle(ctx as any, '/access', '');

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Manifesto de acesso do Zavorth'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Acesso local pronto e remoto em preparacao.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Paridade web/Telegram: Web e Telegram estao alinhados'));
  });

  it('renders local access details in /access local', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/access local');

    const handled = await pack.maybeHandle(ctx as any, '/access', 'local');

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Acesso local do Zavorth'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('http://localhost:3000/app'));
  });

  it('surfaces official install journey and parity details in /bootstrap', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/bootstrap');

    const handled = await pack.maybeHandle(ctx as any, '/bootstrap', '');

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Bootstrap operacional do Zavorth'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Acesso remoto oficial: pendente | Ainda falta validar a URL publica oficial.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Autostart no sistema: npm run launcher:startup:install'));
  });

  it('ignores unrelated commands', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/platform');

    const handled = await pack.maybeHandle(ctx as any, '/platform', '');

    expect(handled).toBe(false);
    expect(ctx.reply).not.toHaveBeenCalled();
  });
});
