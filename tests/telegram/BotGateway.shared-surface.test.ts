import { CommandParser } from '../../src/telegram/CommandParser';
import { BotGateway } from '../../src/telegram/BotGateway';

describe('BotGateway shared surface fallback', () => {
  function createGatewayHarness(sharedSurfaceCommandService: any) {
    const gateway = Object.create(BotGateway.prototype) as any;
    gateway.parser = new CommandParser();
    gateway.surfaceIdentityService = {
      linkIdentity: jest.fn(),
    };
    gateway.logRepo = {
      log: jest.fn(),
    };
    gateway.recordIncomingMessageTelemetry = jest.fn().mockResolvedValue(undefined);
    gateway.priorityCommandService = {
      handle: jest.fn().mockResolvedValue(false),
    };
    gateway.workspaceProfileService = {
      getProfile: jest.fn(),
    };
    gateway.workspaceCommandService = {
      resolveInvocation: jest.fn(),
    };
    gateway.securityLock = {
      isLocked: jest.fn(() => false),
      isCommandAllowedWhenLocked: jest.fn(() => true),
    };
    gateway.chainController = {
      handleCommandChain: jest.fn(),
    };
    gateway.hubController = {
      handleStartCommand: jest.fn(),
    };
    gateway.opsController = {
      handleStatus: jest.fn(),
      handleReadiness: jest.fn(),
      handleReadinessFixes: jest.fn(),
      handleReadyToGo: jest.fn(),
      handleStayOnline: jest.fn(),
    };
    gateway.capabilityController = {
      handleCommand: jest.fn().mockResolvedValue(false),
    };
    gateway.commandRoutingService = {
      dispatchPrivateCommand: jest.fn().mockResolvedValue(false),
    };
    gateway.sharedSurfaceCommandService = sharedSurfaceCommandService;
    gateway.surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn().mockResolvedValue(undefined),
    };
    gateway.legacyUnifiedGateway = null;
    return gateway;
  }

  function createTelegramContext() {
    return {
      chat: { id: 99, type: 'private' },
      from: { id: 42 },
      msg: { message_id: 777 },
      api: {
        editMessageText: jest.fn().mockResolvedValue(undefined),
      },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
  }

  it('routes /codexremote through the shared surface before generic task dispatch', async () => {
    const sharedSurfaceCommandService = {
      maybeHandle: jest.fn().mockResolvedValue(true),
    };
    const gateway = createGatewayHarness(sharedSurfaceCommandService);
    const ctx = createTelegramContext();

    await gateway.processTextMessage(ctx, '/codexremote sessions');

    expect(gateway.commandRoutingService.dispatchPrivateCommand).toHaveBeenCalled();
    expect(sharedSurfaceCommandService.maybeHandle).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'telegram',
        userId: '42',
        chatId: '99',
        rawText: '/codexremote sessions',
        transport: 'slash_command',
      }),
      expect.objectContaining({
        command_type: '/codexremote',
        command_args: 'sessions',
      }),
    );
    expect(gateway.surfaceTaskDispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
  });

  it('routes Telegram shared commands through the canonical Surface API when available', async () => {
    const surfaceApi = {
      handleCommand: jest.fn(async (input: any) => {
        await input.context.reply(`Boundary ${input.request.surface}: ${input.context.rawText}`);
        return {
          ok: true,
          handled: true,
          status: 'ok',
          summary: 'Handled by canonical telegram boundary.',
          messages: [`Boundary ${input.request.surface}: ${input.context.rawText}`],
          correlation: {
            traceId: 'trace-telegram',
            runId: 'run-telegram',
            sessionId: input.request.threadId || input.request.chatId,
            approvalId: null,
            artifactId: null,
          },
          error: null,
          metadata: {},
        };
      }),
    };
    const gateway = createGatewayHarness(surfaceApi);
    const ctx = createTelegramContext();

    await gateway.processTextMessage(ctx, '/codexremote sessions');

    expect(surfaceApi.handleCommand).toHaveBeenCalledWith(expect.objectContaining({
      context: expect.objectContaining({
        platform: 'telegram',
        userId: '42',
        chatId: '99',
        rawText: '/codexremote sessions',
      }),
      parsedCommand: expect.objectContaining({
        command_type: '/codexremote',
        command_args: 'sessions',
      }),
      request: expect.objectContaining({
        surface: 'telegram',
        requestedBy: '42',
        chatId: '99',
      }),
    }));
    expect(ctx.reply).toHaveBeenCalledWith('Boundary telegram: /codexremote sessions', undefined);
    expect(gateway.surfaceTaskDispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
  });

  it('uses LegacyUnifiedGatewayAdapter only as a fallback when AgentGateway is absent', async () => {
    const gateway = createGatewayHarness(null);
    gateway.legacyUnifiedGateway = {
      handleEvent: jest.fn(async (event: any) => {
        await event.reply('Response through the unified gateway.');
        return {
          responseText: 'Response through the unified gateway.',
          surface: 'telegram',
          intentCategory: 'delegated',
          firewallStats: '',
          fastModelSuggested: false,
        };
      }),
    };
    const ctx = createTelegramContext();

    await gateway.processTextMessage(ctx, 'consegue me ouvir-', [{ mimeType: 'audio/ogg', data: 'abc' }]);

    expect(gateway.legacyUnifiedGateway.handleEvent).toHaveBeenCalledWith(expect.objectContaining({
      surface: 'telegram',
      chatId: '99',
      userId: '42',
      text: 'consegue me ouvir-',
      inlineData: [{ mimeType: 'audio/ogg', data: 'abc' }],
      metadata: expect.objectContaining({
        phase: 'legacy-unified-conversation-fallback-v1',
        isVoiceInput: true,
      }),
    }));
    expect(ctx.reply).toHaveBeenCalledWith('Response through the unified gateway.', undefined);
    expect(gateway.surfaceTaskDispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
  });

  it('marks voice ingress as voice input even without forwarding raw audio', async () => {
    const gateway = createGatewayHarness(null);
    gateway.legacyUnifiedGateway = {
      handleEvent: jest.fn(async (event: any) => {
        await event.reply('Response through the unified gateway.');
        return {
          responseText: 'Response through the unified gateway.',
          surface: 'telegram',
          intentCategory: 'delegated',
          firewallStats: '',
          fastModelSuggested: false,
        };
      }),
    };
    const ctx = createTelegramContext();

    await gateway.processTextMessage(ctx, 'resuma isso', undefined, {
      transport: 'voice',
      preferredLanguageCode: 'en-US',
      traceId: 'trace-voice-1',
    });

    expect(gateway.legacyUnifiedGateway.handleEvent).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        phase: 'legacy-unified-conversation-fallback-v1',
        isVoiceInput: true,
        preferredLanguageCode: 'en-US',
        traceId: 'trace-voice-1',
      }),
    }));
  });
});
