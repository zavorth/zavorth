import { BotGateway } from '../../src/telegram/BotGateway';
import { config } from '../../src/config/index';
import { TelegramCommandRoutingService } from '../../src/telegram/TelegramCommandRoutingService';

type HandlerMap = Map<string, (...args: any[]) => Promise<void> | void>;

function createGatewayHarness() {
  const handlers: HandlerMap = new Map();
  let middleware: ((ctx: any, next: jest.Mock) => Promise<void>) | null = null;

  const gateway = Object.create(BotGateway.prototype) as any;
  gateway.bot = {
    use: jest.fn((fn: any) => {
      middleware = fn;
    }),
    on: jest.fn((event: string | string[], handler: any) => {
      const key = Array.isArray(event) ? event.join('|') : event;
      handlers.set(key, handler);
    }),
    catch: jest.fn(),
  };

  gateway.logRepo = { log: jest.fn() };
  gateway.menuController = { renderHelpCard: jest.fn(), getHelpText: jest.fn() };
  gateway.opsController = {
    parseRemoteModeCommand: jest.fn(() => null),
    handleRemoteMode: jest.fn(),
    handleStatus: jest.fn(),
    handleModels: jest.fn(),
    handleAudit: jest.fn(),
    handleDashboard: jest.fn(),
    handleOperationalMode: jest.fn(),
    handleWslCommand: jest.fn(),
  };
  gateway.zavorthBridgeController = {
    parsePromptCommand: jest.fn(() => null),
    parseControlCommand: jest.fn(() => null),
    handlePrompt: jest.fn(),
    handleControl: jest.fn(),
    handleModelCommand: jest.fn(),
    handleWindowAction: jest.fn(),
    handleBridgeStatus: jest.fn(),
    handleSessionAction: jest.fn(),
  };
  gateway.securityLock = {
    isLocked: jest.fn(() => false),
    isCommandAllowedWhenLocked: jest.fn(() => true),
  };
  gateway.chainController = { handleCommandChain: jest.fn() };
  gateway.funController = { handle: jest.fn() };
  gateway.hubController = {
    handleStartCommand: jest.fn(),
    handleSettingsCommand: jest.fn(),
    handleMenuCommand: jest.fn(),
  };
  gateway.menuController = { renderHelpCard: jest.fn() };
  gateway.groupEventController = {
    handleNewMembers: jest.fn(),
    handleLeftMember: jest.fn(),
    processAntiSpam: jest.fn().mockResolvedValue(false),
    processMessageFilter: jest.fn().mockResolvedValue(false),
    trackMessage: jest.fn().mockResolvedValue(undefined),
  };
  gateway.mediaController = {
    handlePhoto: jest.fn(),
    handleVoice: jest.fn(),
    handleVideo: jest.fn(),
    handleDocument: jest.fn(),
  };
  gateway.groupAdminController = {
    handleBan: jest.fn(),
    handleKick: jest.fn(),
    handleMute: jest.fn(),
    handleUnmute: jest.fn(),
    handleWarn: jest.fn(),
    handleWarns: jest.fn(),
    handleClearWarns: jest.fn(),
    handleRegras: jest.fn(),
    handleStats: jest.fn(),
    handleSetWelcome: jest.fn(),
    handleSetBye: jest.fn(),
    handleAntiSpam: jest.fn(),
    handleFilter: jest.fn(),
  };
  gateway.callbackController = { handleCallback: jest.fn() };
  gateway.securityController = {
    handleCleanup: jest.fn(),
    handleClear: jest.fn(),
    handleLock: jest.fn(),
    handleUnlock: jest.fn(),
    handleHostAuth: jest.fn(),
  };
  gateway.providerController = { handleModel: jest.fn() };
  gateway.permissionController = {
    handlePermissionCommand: jest.fn(),
    handlePermissionAllowCommand: jest.fn(),
    handlePermissionRevokeCommand: jest.fn(),
    handleApproval: jest.fn(),
    handleRejection: jest.fn(),
  };
  gateway.schedulerController = {
    handleSchedule: jest.fn(),
    handleReport: jest.fn(),
    handleListSchedules: jest.fn(),
    handleUnschedule: jest.fn(),
  };
  gateway.researchController = {
    handleResearch: jest.fn(),
    handleDeepResearch: jest.fn(),
  };
  gateway.knowledgeController = {
    handleSave: jest.fn(),
    handleSnippet: jest.fn(),
    handleSnippets: jest.fn(),
    handleRemember: jest.fn(),
    handleRecall: jest.fn(),
    handleMemory: jest.fn(),
    handleForget: jest.fn(),
  };
  gateway.executionController = {
    handleUndo: jest.fn(),
  };
  gateway.selfModificationController = {
    handleCommand: jest.fn(),
  };
  gateway.fileDeliveryController = {
    shouldHandleFreeForm: jest.fn().mockReturnValue(false),
    handleFreeForm: jest.fn(),
  };
  gateway.commandRoutingService = new TelegramCommandRoutingService({
    menuController: gateway.menuController,
    opsController: gateway.opsController,
    hubController: gateway.hubController,
    securityController: gateway.securityController,
    providerController: gateway.providerController,
    permissionController: gateway.permissionController,
    schedulerController: gateway.schedulerController,
    funController: gateway.funController,
    groupAdminController: gateway.groupAdminController,
    researchController: gateway.researchController,
    knowledgeController: gateway.knowledgeController,
    executionController: gateway.executionController,
    selfModificationController: gateway.selfModificationController,
    zavorthBridgeController: gateway.zavorthBridgeController,
    fileDeliveryController: gateway.fileDeliveryController,
  });
  gateway.processTextMessage = jest.fn().mockResolvedValue(undefined);
  return { gateway, handlers, getMiddleware: () => middleware };
}

describe('BotGateway group flow', () => {
  const originalAllowedUserIds = [...config.allowedUserIds];

  afterEach(() => {
    config.allowedUserIds = [...originalAllowedUserIds];
  });

  it('lets group text stay in moderation/stats flow without invoking AI', async () => {
    const { gateway, handlers } = createGatewayHarness();
    gateway.registerMiddlewares();
    gateway.registerHandlers();

    const handler = handlers.get('message:text');
    expect(handler).toBeDefined();

    const ctx = {
      chat: { id: -100, type: 'supergroup' },
      from: { id: 42 },
      message: { text: 'oi pessoal', message_id: 10 },
      api: {
        getChatMember: jest.fn().mockResolvedValue({ status: 'member' }),
      },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await handler!(ctx);

    expect(gateway.groupEventController.processAntiSpam).toHaveBeenCalledWith(ctx);
    expect(gateway.groupEventController.processMessageFilter).toHaveBeenCalledWith(ctx);
    expect(gateway.groupEventController.trackMessage).toHaveBeenCalledWith(ctx);
    expect(gateway.processTextMessage).not.toHaveBeenCalled();
  });

  it('reopens natural-language group AI for allowed ids after moderation and stats', async () => {
    config.allowedUserIds = ['42'];

    const { gateway, handlers } = createGatewayHarness();
    gateway.registerMiddlewares();
    gateway.registerHandlers();

    const handler = handlers.get('message:text');
    expect(handler).toBeDefined();

    const ctx = {
      chat: { id: -100, type: 'supergroup' },
      from: { id: 42 },
      message: { text: 'continue essa tarefa', message_id: 14 },
      api: {
        getChatMember: jest.fn(),
      },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await handler!(ctx);

    expect(gateway.groupEventController.processAntiSpam).toHaveBeenCalledWith(ctx);
    expect(gateway.groupEventController.processMessageFilter).toHaveBeenCalledWith(ctx);
    expect(gateway.groupEventController.trackMessage).toHaveBeenCalledWith(ctx);
    expect(gateway.processTextMessage).toHaveBeenCalledWith(ctx, 'continue essa tarefa');
    expect(ctx.api.getChatMember).not.toHaveBeenCalled();
  });

  it('normalizes /ban@bot commands and allows Telegram admins through', async () => {
    const { gateway, handlers, getMiddleware } = createGatewayHarness();
    gateway.registerMiddlewares();
    gateway.registerHandlers();

    const middleware = getMiddleware();
    expect(middleware).toBeDefined();

    const next = jest.fn().mockResolvedValue(undefined);
    const ctx = {
      chat: { id: -100, type: 'supergroup' },
      from: { id: 42 },
      message: { text: '/ban@ZavorthBot 123456', message_id: 11 },
      api: {
        getChatMember: jest.fn().mockResolvedValue({ status: 'administrator' }),
      },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await middleware!(ctx, next);

    expect(ctx.api.getChatMember).toHaveBeenCalledWith(-100, 42);
    expect(next).toHaveBeenCalled();

    const handler = handlers.get('message:text');
    await handler!(ctx);
    expect(gateway.groupAdminController.handleBan).toHaveBeenCalledWith(ctx, '123456');
    expect(gateway.processTextMessage).not.toHaveBeenCalled();
  });

  it('stops media processing when anti-spam or filter blocks a captioned upload', async () => {
    const { gateway, handlers } = createGatewayHarness();
    gateway.groupEventController.processAntiSpam.mockResolvedValueOnce(true);
    gateway.registerMiddlewares();
    gateway.registerHandlers();

    const photoHandler = handlers.get('message:photo');
    expect(photoHandler).toBeDefined();

    const ctx = {
      chat: { id: -100, type: 'supergroup' },
      from: { id: 42 },
      message: {
        photo: [{ file_id: 'photo-1' }],
        caption: 'link https://example.com',
        message_id: 12,
      },
      api: {},
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await photoHandler!(ctx);

    expect(gateway.groupEventController.processAntiSpam).toHaveBeenCalledWith(ctx);
    expect(gateway.groupEventController.processMessageFilter).not.toHaveBeenCalled();
    expect(gateway.groupEventController.trackMessage).not.toHaveBeenCalled();
    expect(gateway.mediaController.handlePhoto).not.toHaveBeenCalled();
  });

  it('does not invoke media AI for non-authorized group uploads after moderation and stats', async () => {
    config.allowedUserIds = ['42'];

    const { gateway, handlers } = createGatewayHarness();
    gateway.registerMiddlewares();
    gateway.registerHandlers();

    const photoHandler = handlers.get('message:photo');
    expect(photoHandler).toBeDefined();

    const ctx = {
      chat: { id: -100, type: 'supergroup' },
      from: { id: 999 },
      message: {
        photo: [{ file_id: 'photo-2' }],
        message_id: 13,
      },
      api: {
        getChatMember: jest.fn().mockResolvedValue({ status: 'member' }),
      },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await photoHandler!(ctx);

    expect(gateway.groupEventController.processAntiSpam).toHaveBeenCalledWith(ctx);
    expect(gateway.groupEventController.processMessageFilter).toHaveBeenCalledWith(ctx);
    expect(gateway.groupEventController.trackMessage).toHaveBeenCalledWith(ctx);
    expect(gateway.mediaController.handlePhoto).not.toHaveBeenCalled();
  });

  it('reopens group media AI for Telegram admins after moderation and stats', async () => {
    const { gateway, handlers } = createGatewayHarness();
    gateway.registerMiddlewares();
    gateway.registerHandlers();

    const photoHandler = handlers.get('message:photo');
    expect(photoHandler).toBeDefined();

    const ctx = {
      chat: { id: -100, type: 'supergroup' },
      from: { id: 777 },
      message: {
        photo: [{ file_id: 'photo-3' }],
        message_id: 15,
      },
      api: {
        getChatMember: jest.fn().mockResolvedValue({ status: 'administrator' }),
      },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await photoHandler!(ctx);

    expect(gateway.groupEventController.processAntiSpam).toHaveBeenCalledWith(ctx);
    expect(gateway.groupEventController.processMessageFilter).toHaveBeenCalledWith(ctx);
    expect(gateway.groupEventController.trackMessage).toHaveBeenCalledWith(ctx);
    expect(ctx.api.getChatMember).toHaveBeenCalledWith(-100, 777);
    expect(gateway.mediaController.handlePhoto).toHaveBeenCalledWith(ctx);
  });
});
