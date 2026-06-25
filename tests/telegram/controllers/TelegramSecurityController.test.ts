import { TelegramSecurityController } from '../../../src/telegram/controllers/TelegramSecurityController';

describe('TelegramSecurityController', () => {
  function createBot() {
    return {
      api: {
        deleteMessage: jest.fn().mockResolvedValue(undefined),
      },
    } as any;
  }

  it('configures the lock password and deletes the sensitive command message', async () => {
    const bot = createBot();
    const ctx = {
      chat: { id: 42 },
      message: { message_id: 9 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const securityLock = {
      setPassword: jest.fn(),
      isPasswordConfigured: jest.fn().mockReturnValue(true),
      lock: jest.fn(),
      isLocked: jest.fn(),
      unlock: jest.fn(),
    } as any;

    const controller = new TelegramSecurityController(bot, {} as any, {} as any, securityLock);
    await controller.handleLock(ctx, 'set segredo-forte');

    expect(securityLock.setPassword).toHaveBeenCalledWith('segredo-forte');
    expect(bot.api.deleteMessage).toHaveBeenCalledWith(42, 9);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Password configured successfully'));
  });

  it('clears the chat using the cleanup service when messages are tracked', async () => {
    const bot = createBot();
    const ctx = {
      chat: { id: 77 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const chatCleanup = {
      getTrackedCount: jest.fn().mockReturnValue(3),
      clearChat: jest.fn().mockResolvedValue({ message: 'Limpeza concluida.' }),
    } as any;

    const controller = new TelegramSecurityController(bot, {} as any, chatCleanup, {} as any);
    await controller.handleClear(ctx);

    expect(chatCleanup.clearChat).toHaveBeenCalledWith(bot, '77');
    expect(ctx.reply.mock.calls[1][0]).toContain('Limpeza concluida.');
  });

  it('renders host access status with manifest guidance', async () => {
    const bot = createBot();
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const hostIdentityService = {
      getStatus: jest.fn().mockReturnValue({
        authorized: false,
        firstRun: true,
        currentFingerprint: 'fp-current',
        storedFingerprint: 'fp-stored',
      }),
    } as any;
    const manifestService = {
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
    } as any;

    const controller = new TelegramSecurityController(
      bot,
      {} as any,
      {} as any,
      {} as any,
      hostIdentityService,
      manifestService,
    );

    await controller.handleHostAuth(ctx, 'status');

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Host access status:'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Dashboard: http://127.0.0.1:33333/dashboard'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Trust host: Run /hostauth trust.'));
  });

  it('shows refreshed guidance after trusting the host', async () => {
    const bot = createBot();
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const hostIdentityService = {
      authorizeCurrentHost: jest.fn().mockReturnValue({
        fingerprint: 'fp-new',
        hostname: 'dev-box',
        authorizedAt: '2026-04-05T10:00:00.000Z',
      }),
    } as any;
    const manifestService = {
      buildManifest: jest.fn().mockResolvedValue({
        summary: 'Zavorth pronto para uso local e remoto.',
        local: {
          ready: true,
          appUrl: 'http://127.0.0.1:33333/dashboard',
        },
        remote: {
          ready: true,
          appUrl: 'https://zavorth.example.com/dashboard',
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
    } as any;

    const controller = new TelegramSecurityController(
      bot,
      {} as any,
      {} as any,
      {} as any,
      hostIdentityService,
      manifestService,
    );

    await controller.handleHostAuth(ctx, 'trust');

    expect(hostIdentityService.authorizeCurrentHost).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Host reautorizado.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Zavorth pronto para uso local e remoto.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('npm run ops:remote'));
  });
});

