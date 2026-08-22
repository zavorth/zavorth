import { TelegramSecurityController } from '../../../src/telegram/controllers/TelegramSecurityController';

interface MockBot {
  api: {
    deleteMessage: jest.Mock;
  };
}

interface MockContext {
  chat: { id: number };
  message?: { message_id: number };
  reply: jest.Mock;
}

interface MockSecurityLock {
  setPassword: jest.Mock;
  isPasswordConfigured: jest.Mock;
  lock: jest.Mock;
  isLocked: jest.Mock;
  unlock: jest.Mock;
}

interface MockChatCleanup {
  getTrackedCount: jest.Mock;
  clearChat: jest.Mock;
}

interface MockHostIdentityService {
  getStatus: jest.Mock;
  authorizeCurrentHost?: jest.Mock;
}

interface MockManifestService {
  buildManifest: jest.Mock;
}

function createBot(): MockBot {
  return {
    api: {
      deleteMessage: jest.fn().mockResolvedValue(undefined),
    },
  } as unknown as MockBot;
}

describe('TelegramSecurityController', () => {
  it('configures the lock password and deletes the sensitive command message', async () => {
    const bot = createBot();
    const ctx: MockContext = {
      chat: { id: 42 },
      message: { message_id: 9 },
      reply: jest.fn().mockResolvedValue(undefined),
    };
    const securityLock: MockSecurityLock = {
      setPassword: jest.fn(),
      isPasswordConfigured: jest.fn().mockReturnValue(true),
      lock: jest.fn(),
      isLocked: jest.fn(),
      unlock: jest.fn(),
    } as unknown as MockSecurityLock;

    const controller = new TelegramSecurityController(bot, {} as unknown as never, {} as unknown as never, securityLock);
    await controller.handleLock(ctx, 'set segredo-forte');

    expect(securityLock.setPassword).toHaveBeenCalledWith('segredo-forte');
    expect(bot.api.deleteMessage).toHaveBeenCalledWith(42, 9);
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Password configured successfully');
  });

  it('clears the chat using the cleanup service when messages are tracked', async () => {
    const bot = createBot();
    const ctx: MockContext = {
      chat: { id: 77 },
      reply: jest.fn().mockResolvedValue(undefined),
    };
    const chatCleanup: MockChatCleanup = {
      getTrackedCount: jest.fn().mockReturnValue(3),
      clearChat: jest.fn().mockResolvedValue({ message: 'Limpeza concluida.' }),
    } as unknown as MockChatCleanup;

    const controller = new TelegramSecurityController(bot, {} as unknown as never, chatCleanup, {} as unknown as never);
    await controller.handleClear(ctx);

    expect(chatCleanup.clearChat).toHaveBeenCalledWith(bot, '77');
    expect(ctx.reply.mock.calls[1][0]).toContain('Limpeza concluida.');
  });

  it('renders host access status with manifest guidance', async () => {
    const bot = createBot();
    const ctx: MockContext = {
      reply: jest.fn().mockResolvedValue(undefined),
    };
    const hostIdentityService: MockHostIdentityService = {
      getStatus: jest.fn().mockReturnValue({
        authorized: false,
        firstRun: true,
        currentFingerprint: 'fp-current',
        storedFingerprint: 'fp-stored',
      }),
    } as unknown as MockHostIdentityService;
    const manifestService: MockManifestService = {
      buildManifest: jest.fn().mockResolvedValue({
        summary: 'Zavorth pronto para uso local.',
        local: {
          ready: true,
          appUrl: 'http://127.0.0.1:33333/dashboard',
        },
        remote: {
          ready: false,
          appUrl: null,
        },
        auth: {
          authorizedHost: false,
        },
        surfaces: [
          { id: 'control', label: 'Dashboard', entry: 'http://127.0.0.1:33333/dashboard' },
          { id: 'telegram', label: 'Telegram', entry: '/start' },
        ],
        nextSteps: [
          {
            title: 'Trust host',
            description: 'Run /hostauth trust.',
          },
        ],
        commands: {
          access: 'npm run ops:access',
          start: 'npm run ops:up',
          remote: 'npm run ops:remote',
          trust: '/hostauth trust',
        },
      }),
    } as unknown as MockManifestService;

    const controller = new TelegramSecurityController(
      bot,
      {} as unknown as never,
      {} as unknown as never,
      {} as unknown as never,
      hostIdentityService,
      manifestService,
    );

    await controller.handleHostAuth(ctx, 'status');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Host access status:');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Dashboard: http://127.0.0.1:33333/dashboard');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Trust host: Run /hostauth trust.');
  });

  it('shows refreshed guidance after trusting the host', async () => {
    const bot = createBot();
    const ctx: MockContext = {
      reply: jest.fn().mockResolvedValue(undefined),
    };
    const hostIdentityService: MockHostIdentityService = {
      authorizeCurrentHost: jest.fn().mockReturnValue({
        fingerprint: 'fp-new',
        hostname: 'dev-box',
        authorizedAt: '2026-04-05T10:00:00.000Z',
      }),
    } as unknown as MockHostIdentityService;
    const manifestService: MockManifestService = {
      buildManifest: jest.fn().mockResolvedValue({
        summary: 'Zavorth pronto para uso local e remoto.',
        local: {
          ready: true,
          appUrl: 'http://127.0.0.1:33333/dashboard',
        },
        remote: {
          ready: true,
          appUrl: 'https://zavorth.example.com/zavorthControl',
        },
        auth: {
          authorizedHost: true,
        },
        surfaces: [
          { id: 'control', label: 'Dashboard', entry: 'http://127.0.0.1:33333/dashboard' },
          { id: 'telegram', label: 'Telegram', entry: '/start' },
        ],
        nextSteps: [],
        commands: {
          access: 'npm run ops:access',
          start: 'npm run ops:up',
          remote: 'npm run ops:remote',
          trust: '/hostauth trust',
        },
      }),
    } as unknown as MockManifestService;

    const controller = new TelegramSecurityController(
      bot,
      {} as unknown as never,
      {} as unknown as never,
      {} as unknown as never,
      hostIdentityService,
      manifestService,
    );

    await controller.handleHostAuth(ctx, 'trust');

    expect(hostIdentityService.authorizeCurrentHost).toHaveBeenCalled();
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Host reauthorized.');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Zavorth pronto para uso local e remoto.');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('npm run ops:remote');
  });
});

