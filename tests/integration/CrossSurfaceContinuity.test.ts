import { WebAppConversationService } from '../../src/services/WebAppConversationService';
import { ChannelCommandParser } from '../../src/channels/commands/ChannelCommandParser';
import { BotGateway } from '../../src/telegram/BotGateway';

function createRealtimeMock() {
  const messages: Array<{ role: string; content: string; kind?: string | null }> = [];
  return {
    messages,
    ensureSession: jest.fn(),
    getChatId: jest.fn((sessionId: string) => `web:${sessionId}`),
    recordUserMessage: jest.fn((_sessionId: string, content: string) => {
      messages.push({ role: 'user', content });
      return messages[messages.length - 1];
    }),
    recordAssistantMessage: jest.fn((_sessionId: string, content: string, _taskId?: string | null, kind?: string | null) => {
      messages.push({ role: 'assistant', content, kind });
      return messages[messages.length - 1];
    }),
    getResolvedSnapshot: jest.fn(async (sessionId: string) => ({
      sessionId,
      chatId: `web:${sessionId}`,
      messages,
      tasks: [],
      permissions: [],
      continuity: null,
      replay: null,
      handoff: null,
      workflowRuns: [],
    })),
    captureBaseline: jest.fn(async () => undefined),
  };
}

function createRuntime() {
  return {
    webUserId: 'web-user',
    taskManager: {
      getTask: jest.fn(() => null),
    },
    permissionService: {
      listRequests: jest.fn(async () => []),
    },
    parser: {
      parse: jest.fn(),
    },
    taskOrchestrationController: {
      handleTaskMessage: jest.fn(),
    },
    permissionController: {
      resolvePermissionReference: jest.fn(),
      shortPermissionId: jest.fn(),
      handlePermissionCallback: jest.fn(),
      handleApproval: jest.fn(),
      handleRejection: jest.fn(),
      formatPermissionCreatedMessage: jest.fn(),
    },
    surfaceTaskDispatcher: null,
  };
}

function createTelegramGateway(sharedSurfaceCommandService: any) {
  const gateway = Object.create(BotGateway.prototype) as any;
  gateway.parser = new ChannelCommandParser();
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

describe('Cross-surface continuity', () => {
  it('projects web and Telegram shared commands into the same canonical boundary contract', async () => {
    const boundaryRequests: Array<{
      surface: string;
      requestedBy: string | null;
      chatId?: string | null;
      threadId?: string | null;
      rawText: string;
    }> = [];
    const surfaceApi = {
      handleCommand: jest.fn(async (input: any) => {
        boundaryRequests.push({
          surface: input.request.surface,
          requestedBy: input.request.requestedBy ?? null,
          chatId: input.request.chatId ?? null,
          threadId: input.request.threadId ?? null,
          rawText: input.context.rawText,
        });
        await input.context.reply(`Boundary ${input.request.surface}: ${input.context.rawText}`);
        return {
          ok: true,
          handled: true,
          status: 'ok',
          summary: `Handled by ${input.request.surface}.`,
          messages: [`Boundary ${input.request.surface}: ${input.context.rawText}`],
          correlation: {
            traceId: `trace-${input.request.surface}`,
            runId: `run-${input.request.surface}`,
            sessionId: input.request.threadId || input.request.chatId,
            approvalId: null,
            artifactId: null,
          },
          error: null,
          metadata: {},
        };
      }),
    };

    const realtime = createRealtimeMock();
    const sendToSession = jest.fn(async () => ({ taskId: 'legacy-task-should-not-run' }));
    const webService = new WebAppConversationService({
      runtime: createRuntime() as any,
      realtime: realtime as any,
      getGatewaySessionTools: () => ({ sendToSession } as any),
      getSharedSurfaceCommandService: () => surfaceApi as any,
    });

    const webResult = await webService.processChatSend({
      sessionId: 'session-web-cross',
      message: '/codexremote sessions',
    });

    const telegramGateway = createTelegramGateway(surfaceApi);
    const telegramCtx = createTelegramContext();
    await telegramGateway.processTextMessage(telegramCtx, '/codexremote sessions');

    expect(boundaryRequests).toEqual([
      expect.objectContaining({
        surface: 'web',
        requestedBy: 'web-user',
        threadId: 'session-web-cross',
        rawText: '/codexremote sessions',
      }),
      expect.objectContaining({
        surface: 'telegram',
        requestedBy: '42',
        chatId: '99',
        rawText: '/codexremote sessions',
      }),
    ]);
    expect(sendToSession).not.toHaveBeenCalled();
    expect((telegramGateway.surfaceTaskDispatcher.dispatchTaskMessage as jest.Mock)).not.toHaveBeenCalled();
    expect(webResult.taskId).toBeNull();
    expect(realtime.recordAssistantMessage).toHaveBeenCalledWith(
      'session-web-cross',
      'Boundary web: /codexremote sessions',
      null,
      'shared-surface',
    );
    expect(telegramCtx.reply).toHaveBeenCalledWith('Boundary telegram: /codexremote sessions', undefined);
  });
});
