import { TelegramGroupAdminController } from '../../../src/telegram/controllers/TelegramGroupAdminController';

describe('TelegramGroupAdminController', () => {
  function createWelcomeServiceMock(overrides: Record<string, any> = {}) {
    return {
      setGroupRules: jest.fn().mockResolvedValue(undefined),
      getGroupRules: jest.fn().mockResolvedValue(null),
      getConfig: jest.fn().mockResolvedValue(null),
      getDefaultWelcomeMessage: jest.fn().mockReturnValue('Boas-vindas padrao'),
      getDefaultGoodbyeMessage: jest.fn().mockReturnValue('Despedida padrao'),
      setWelcomeMessage: jest.fn().mockResolvedValue(undefined),
      setGoodbyeMessage: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    } as any;
  }

  function createDeps(welcomeService: any) {
    return {
      warnService: {
        warn: jest.fn().mockResolvedValue({ warnCount: 1, limitReached: false, limitAction: 'ban' }),
        getLimitConfig: jest.fn().mockResolvedValue({ max_warns: 3, action_on_limit: 'ban' }),
        getWarns: jest.fn().mockResolvedValue([]),
        clearWarns: jest.fn().mockResolvedValue(0),
      },
      moderationService: {
        banUser: jest.fn().mockResolvedValue({ success: true, error: null }),
        kickUser: jest.fn().mockResolvedValue({ success: true, error: null }),
        muteUser: jest.fn().mockResolvedValue({ success: true, error: null }),
        unmuteUser: jest.fn().mockResolvedValue({ success: true, error: null }),
        deleteMessage: jest.fn().mockResolvedValue(true),
      },
      statsService: {
        getTotalMessages: jest.fn().mockResolvedValue(0),
        getTopMembers: jest.fn().mockResolvedValue([]),
      },
      welcomeService,
      antiSpamService: {
        enableAntiLink: jest.fn().mockResolvedValue(undefined),
        enableFloodProtection: jest.fn().mockResolvedValue(undefined),
        addBannedWord: jest.fn().mockResolvedValue(undefined),
        removeBannedWord: jest.fn().mockResolvedValue(true),
        getBannedWords: jest.fn().mockResolvedValue([]),
        getConfig: jest.fn().mockResolvedValue(null),
      },
      messageFilterService: {
        getBlockedTypes: jest.fn().mockResolvedValue([]),
        setFilter: jest.fn().mockResolvedValue(undefined),
      },
    } as any;
  }

  it.skip('updates and displays group rules through /regras', async () => {
    const welcomeService = createWelcomeServiceMock({
      getGroupRules: jest.fn().mockResolvedValue('1. Seja gentil com todos'),
    });
    const controller = new TelegramGroupAdminController(createDeps(welcomeService));
    const ctx = {
      chat: { id: -1001, type: 'supergroup' },
      from: { id: 10 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handleRegras(ctx, '1. Seja gentil com todos');

    expect(ctx.reply).toHaveBeenCalledWith('📜 Regras do grupo atualizadas com sucesso!');

    const db = await Database.getInstance();
    db.close();
    (Database as any).instance = null;
    (Database as any).initPromise = null;

    const reloadedRules = await new WelcomeService().getGroupRules(String(ctx.chat.id));
    expect(reloadedRules).toBe('1. Seja gentil com todos');
  });

  it('uses reply target duration for /mute and does not treat invalid durations as permanent', async () => {
    const welcomeService = createWelcomeServiceMock();
    const deps = createDeps(welcomeService);
    const controller = new TelegramGroupAdminController(deps);
    const ctx = {
      chat: { id: -1001, type: 'supergroup' },
      from: { id: 10 },
      message: { reply_to_message: { from: { id: 42 } } },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handleMute(ctx, '30m');

    expect(deps.moderationService.muteUser).toHaveBeenCalledWith(-1001, 42, '10', 1800);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('silenciado'),
      expect.objectContaining({ parse_mode: 'Markdown' }),
    );
  });

  it('keeps the full reason when warning a replied user', async () => {
    const welcomeService = createWelcomeServiceMock();
    const deps = createDeps(welcomeService);
    const controller = new TelegramGroupAdminController(deps);
    const ctx = {
      chat: { id: -1001, type: 'supergroup' },
      from: { id: 10 },
      message: { reply_to_message: { from: { id: 42 } } },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handleWarn(ctx, 'spam link');

    expect(deps.warnService.warn).toHaveBeenCalledWith('-1001', '42', 'spam link', '10');
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('advertencia'),
      expect.objectContaining({ parse_mode: 'Markdown' }),
    );
  });

  it('applies the configured moderation action when warn limit is reached', async () => {
    const welcomeService = createWelcomeServiceMock();
    const deps = createDeps(welcomeService);
    deps.warnService.warn.mockResolvedValue({
      warnCount: 3,
      limitReached: true,
      limitAction: 'ban',
    });
    deps.warnService.getLimitConfig.mockResolvedValue({
      max_warns: 3,
      action_on_limit: 'ban',
    });

    const controller = new TelegramGroupAdminController(deps);
    const ctx = {
      chat: { id: -1001, type: 'supergroup' },
      from: { id: 10 },
      message: { reply_to_message: { from: { id: 42 } } },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handleWarn(ctx, 'spam link');

    expect(deps.moderationService.banUser).toHaveBeenCalledWith(-1001, 42, '10');
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Limite atingido'),
      expect.objectContaining({ parse_mode: 'Markdown' }),
    );
  });

  it('applies the configured moderation action when the warn limit is reached', async () => {
    const welcomeService = createWelcomeServiceMock();
    const deps = createDeps(welcomeService);
    deps.warnService.warn.mockResolvedValue({
      warnCount: 3,
      limitReached: true,
      limitAction: 'kick',
    });
    const controller = new TelegramGroupAdminController(deps);
    const ctx = {
      chat: { id: -1001, type: 'supergroup' },
      from: { id: 10 },
      message: { reply_to_message: { from: { id: 42 } } },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handleWarn(ctx, 'spam reincidente');

    expect(deps.moderationService.kickUser).toHaveBeenCalledWith(-1001, 42, '10');
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Limite atingido'),
      expect.objectContaining({ parse_mode: 'Markdown' }),
    );
  });

  it('rejects invalid mute durations instead of converting them to permanent mutes', async () => {
    const welcomeService = createWelcomeServiceMock();
    const deps = createDeps(welcomeService);
    const controller = new TelegramGroupAdminController(deps);
    const ctx = {
      chat: { id: -1001, type: 'supergroup' },
      from: { id: 10 },
      message: { reply_to_message: { from: { id: 42 } } },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handleMute(ctx, '30');

    expect(deps.moderationService.muteUser).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Duracao invalida'),
      expect.objectContaining({ parse_mode: 'Markdown' }),
    );
  });

  it('delegates anti-spam toggles and replies with the new protection summary copy', async () => {
    const welcomeService = createWelcomeServiceMock();
    const deps = createDeps(welcomeService);
    const controller = new TelegramGroupAdminController(deps);
    const ctx = {
      chat: { id: -1001, type: 'supergroup' },
      from: { id: 10 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handleAntiSpam(ctx, 'antilink off');

    expect(deps.antiSpamService.enableAntiLink).toHaveBeenCalledWith('-1001', false);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Antilink desativado.'));
  });

  it('delegates filter configuration and enables the selected message type', async () => {
    const welcomeService = createWelcomeServiceMock();
    const deps = createDeps(welcomeService);
    const controller = new TelegramGroupAdminController(deps);
    const ctx = {
      chat: { id: -1001, type: 'supergroup' },
      from: { id: 10 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handleFilter(ctx, 'photo on');

    expect(deps.messageFilterService.setFilter).toHaveBeenCalledWith('-1001', 'photo', true);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Filtro de **photo** ativado'),
      expect.objectContaining({ parse_mode: 'Markdown' }),
    );
  });
});
