import { CoreOrchestrator } from '../../src/core/CoreOrchestrator';
import { DiscordSurfacePolicyService } from '../../src/services/DiscordSurfacePolicyService';
import { createTestLogRepo } from '../helpers/testLogRepoUtils.js';

describe('CoreOrchestrator role-aware broadcasts', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps preflight gate order declarative and stable', () => {
    const logRepo = createTestLogRepo();
    const orchestrator = new CoreOrchestrator(logRepo);

    const pipeline = (orchestrator as any).buildPreflightPipeline();

    expect(pipeline.map((handler: any) => handler.id)).toEqual([
      'shared-surface-command-api',
      'discord-public-server-gate',
      'unsupported-slash-command-gate',
    ]);
    expect(pipeline.map((handler: any) => handler.priority)).toEqual([10, 20, 30]);
  });

  it('skips gateways that do not declare support for role-aware broadcast', async () => {
    const logRepo = createTestLogRepo();
    const orchestrator = new CoreOrchestrator(logRepo);
    const roleAwareGateway = { supportsRoleAwareBroadcast: true, broadcast: jest.fn().mockResolvedValue(undefined) };
    const legacyGateway = { broadcast: jest.fn().mockResolvedValue(undefined) };

    orchestrator.registerGateway('telegram', roleAwareGateway);
    orchestrator.registerGateway('legacy', legacyGateway);

    await orchestrator.broadcast('ola', ['operator']);

    expect(roleAwareGateway.broadcast).toHaveBeenCalledWith('ola', ['operator']);
    expect(legacyGateway.broadcast).not.toHaveBeenCalled();
    expect(logRepo.log).toHaveBeenCalledWith(
      'warn',
      'CoreOrchestrator',
      expect.stringContaining('role'),
    );
  });

  it('treats gateways with recipient resolution as role-aware for broadcasts', async () => {
    const logRepo = createTestLogRepo();
    const orchestrator = new CoreOrchestrator(logRepo);
    const discordGateway = {
      resolveBroadcastRecipients: jest.fn().mockReturnValue(['channel-1']),
      broadcast: jest.fn().mockResolvedValue(undefined),
    };

    orchestrator.registerGateway('discord', discordGateway as any);

    await orchestrator.broadcast('ola discord', ['operator']);

    expect(discordGateway.broadcast).toHaveBeenCalledWith('ola discord', ['operator']);
  });

  it('delegates shared text messages to the shared surface dispatcher', async () => {
    const logRepo = createTestLogRepo();
    const orchestrator = new CoreOrchestrator(
      logRepo,
      new DiscordSurfacePolicyService({
        publicServerMode: false,
        commandExposure: 'operator',
      }),
    );
    const dispatcher = {
      dispatchTaskMessage: jest.fn().mockResolvedValue({ task: { task_id: 'task-1' } }),
    };
    orchestrator.attachSurfaceTaskDispatcher(dispatcher as any);
    orchestrator.registerGateway('discord', {
      getIdentityHints: () => ({
        linkedBy: 'discord-native-gateway',
        verificationMethod: 'discord-bot-token',
      }),
    } as any);

    await orchestrator.processMessage({
      platform: 'discord',
      userId: 'discord-user',
      chatId: 'discord:guild:1:channel:2',
      isGroup: true,
      rawText: 'continue a tarefa atual',
      reply: jest.fn().mockResolvedValue(undefined),
      editMessage: jest.fn().mockResolvedValue(undefined),
    });

    expect(dispatcher.dispatchTaskMessage).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'discord',
      chatId: 'discord:guild:1:channel:2',
      sourceUserId: 'discord-user',
      text: 'continue a tarefa atual',
      identity: expect.objectContaining({
        linkedBy: 'discord-native-gateway',
        verificationMethod: 'discord-bot-token',
      }),
      composerPayload: null,
      surfacePolicy: expect.objectContaining({
        publicServerMode: false,
        forceApprovalForExecution: false,
      }),
    }));
  });

  it('routes natural multi-surface messages through ZavorthAgentGateway before legacy fallback or dispatcher', async () => {
    const logRepo = createTestLogRepo();
    const surfaceOperationalIntentService = {
      decideResponse: jest.fn().mockResolvedValue({
        schemaVersion: 1,
        mode: 'conversation',
        confidence: 'high',
        reason: 'Respond as normal chat; do not wake the agent runtime.',
        sourceReason: 'conversation-only',
        target: { type: 'none', value: null },
        requestedTools: [],
        responsePath: 'fast-chat',
        shouldCreateArtifact: false,
        shouldShowArtifactInChat: false,
        artifactPolicy: {
          shouldCreateArtifact: false,
          shouldShowArtifactInChat: false,
          reason: 'conversation-response-does-not-create-artifact',
        },
        diagnostics: {
          surface: 'discord',
          shouldExecute: false,
          semantic: false,
        },
      }),
    };
    const orchestrator = new CoreOrchestrator(
      logRepo,
      new DiscordSurfacePolicyService({
        publicServerMode: false,
        commandExposure: 'operator',
      }),
      surfaceOperationalIntentService,
    );
    const reply = jest.fn().mockResolvedValue(undefined);
    const dispatcher = {
      dispatchTaskMessage: jest.fn().mockResolvedValue({ task: { task_id: 'task-should-not-run' } }),
    };
    const legacyUnifiedGateway = {
      recordEvent: jest.fn(),
      handleEvent: jest.fn(async (event: any) => {
        await event.reply(`Legacy: ${event.text}`);
      }),
    };
    const agentGateway = {
      handle: jest.fn(async (request: any) => ({
        ok: true,
        run: {
          summary: `Agent summary: ${request.text}`,
        },
        replies: [
          {
            text: `Agent: ${request.text}`,
          },
        ],
      })),
    };
    orchestrator.attachSurfaceTaskDispatcher(dispatcher as any);
    orchestrator.attachLegacyUnifiedGatewayAdapter(legacyUnifiedGateway as any);
    orchestrator.attachAgentGateway(agentGateway as any);

    await orchestrator.processMessage({
      platform: 'discord',
      userId: 'discord-user',
      chatId: 'discord:dm:42',
      isGroup: false,
      transport: 'text',
      rawText: 'olá, me explica o estado atual',
      reply,
      editMessage: jest.fn().mockResolvedValue(undefined),
    });

    expect(agentGateway.handle).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'discord',
      sessionId: 'discord:dm:42',
      text: 'olá, me explica o estado atual',
      metadata: expect.objectContaining({
        source: 'core-orchestrator',
        platform: 'discord',
        legacyUnifiedGatewayAvailable: true,
        legacyUnifiedGatewayBypassed: true,
        surfaceTaskDispatcherAvailable: true,
        responseDecision: expect.objectContaining({
          responsePath: 'fast-chat',
        }),
      }),
    }), {});
    expect(reply).toHaveBeenCalledWith('Agent: olá, me explica o estado atual');
    expect(legacyUnifiedGateway.recordEvent).not.toHaveBeenCalled();
    expect(legacyUnifiedGateway.handleEvent).not.toHaveBeenCalled();
    expect(dispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
  });

  it('wraps execution-intent natural messages in ZavorthAgentGateway before calling SurfaceTaskDispatchService', async () => {
    const logRepo = createTestLogRepo();
    const surfaceOperationalIntentService = {
      decideResponse: jest.fn().mockResolvedValue({
        schemaVersion: 1,
        mode: 'operation',
        confidence: 'high',
        reason: 'Execute through the agent runtime (tool-affordance-detected).',
        sourceReason: 'tool-affordance-detected',
        target: { type: 'folder', value: null },
        requestedTools: ['read_file'],
        responsePath: 'agent-runtime',
        shouldCreateArtifact: false,
        shouldShowArtifactInChat: false,
        artifactPolicy: {
          shouldCreateArtifact: false,
          shouldShowArtifactInChat: false,
          reason: 'operation-without-user-facing-artifact',
        },
        diagnostics: {
          surface: 'slack',
          shouldExecute: true,
          semantic: false,
        },
      }),
    };
    const orchestrator = new CoreOrchestrator(
      logRepo,
      new DiscordSurfacePolicyService(),
      surfaceOperationalIntentService,
    );
    const order: string[] = [];
    const reply = jest.fn().mockResolvedValue(undefined);
    const dispatcher = {
      dispatchTaskMessage: jest.fn(async () => {
        order.push('dispatcher');
        return {
          task: { task_id: 'task-agent-wrapped' },
          parsed: {},
          runtimeUserId: 'slack-user',
          sourceUserId: 'slack-user',
          tenantId: null,
          tenantContext: null,
        };
      }),
    };
    const agentGateway = {
      handle: jest.fn(async (_request: any, options: any) => {
        order.push('agent');
        expect(options.executor).toEqual(expect.any(Function));
        const executorResult = await options.executor({
          request: _request,
          run: { id: 'agent-run-core' },
        });
        return {
          ok: true,
          run: {
            summary: executorResult.summary,
            metadata: executorResult.metadata,
          },
          replies: [
            {
              text: 'Agent wrapped dispatch',
            },
          ],
        };
      }),
    };
    orchestrator.attachSurfaceTaskDispatcher(dispatcher as any);
    orchestrator.attachAgentGateway(agentGateway as any);

    await orchestrator.processMessage({
      platform: 'slack',
      userId: 'slack-user',
      chatId: 'slack:channel:ops',
      isGroup: true,
      transport: 'text',
      rawText: 'liste a pasta downloads',
      reply,
      editMessage: jest.fn().mockResolvedValue(undefined),
    });

    expect(order).toEqual(['agent', 'dispatcher']);
    expect(agentGateway.handle).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'api',
      text: 'liste a pasta downloads',
      requestedTools: ['read_file'],
      metadata: expect.objectContaining({
        surfaceTaskDispatcherDeferred: true,
      }),
    }), expect.objectContaining({
      executor: expect.any(Function),
    }));
    expect(dispatcher.dispatchTaskMessage).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'slack',
      chatId: 'slack:channel:ops',
      text: 'liste a pasta downloads',
      sourceUserId: 'slack-user',
      sessionId: 'slack:channel:ops',
    }));
    expect(reply).toHaveBeenCalledWith('Agent wrapped dispatch');
  });

  it('routes Discord natural conversation through LegacyUnifiedGatewayAdapter fallback before the legacy dispatcher', async () => {
    const logRepo = createTestLogRepo();
    const orchestrator = new CoreOrchestrator(
      logRepo,
      new DiscordSurfacePolicyService({
        publicServerMode: false,
        commandExposure: 'operator',
      }),
    );
    const reply = jest.fn().mockResolvedValue(undefined);
    const dispatcher = {
      dispatchTaskMessage: jest.fn().mockResolvedValue({ task: { task_id: 'task-legacy' } }),
    };
    const legacyUnifiedGateway = {
      recordEvent: jest.fn(),
      handleEvent: jest.fn(async (event: any) => {
        await event.reply(`Gateway: ${event.text}`);
        return {
          responseText: `Gateway: ${event.text}`,
          surface: event.surface,
          intentCategory: 'delegated',
          firewallStats: 'test',
          fastModelSuggested: false,
        };
      }),
    };

    orchestrator.attachSurfaceTaskDispatcher(dispatcher as any);
    orchestrator.attachLegacyUnifiedGatewayAdapter(legacyUnifiedGateway as any);

    await orchestrator.processMessage({
      platform: 'discord',
      userId: 'discord-user',
      chatId: 'discord:dm:42',
      isGroup: false,
      transport: 'text',
      rawText: 'me explique o plano atual',
      reply,
      editMessage: jest.fn().mockResolvedValue(undefined),
    });

    expect(legacyUnifiedGateway.handleEvent).toHaveBeenCalledWith(expect.objectContaining({
      surface: 'discord',
      userId: 'discord-user',
      chatId: 'discord:dm:42',
      text: 'me explique o plano atual',
      metadata: expect.objectContaining({
        phase: 'legacy-unified-conversation-fallback-v1',
        transport: 'text',
      }),
    }));
    expect(legacyUnifiedGateway.recordEvent).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith('Gateway: me explique o plano atual');
    expect(dispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
  });

  it('passes LegacyUnifiedGatewayAdapter replies through the Echo output stage', async () => {
    const logRepo = createTestLogRepo();
    const orchestrator = new CoreOrchestrator(
      logRepo,
      new DiscordSurfacePolicyService({
        publicServerMode: false,
        commandExposure: 'operator',
      }),
    );
    const reply = jest.fn().mockResolvedValue(undefined);
    const outputStage = {
      deliver: jest.fn(async (request: any) => {
        await request.sink.sendText(`stage:${request.text}`);
        return { delivered: 'text' };
      }),
    };
    const legacyUnifiedGateway = {
      recordEvent: jest.fn(),
      handleEvent: jest.fn(async (event: any) => {
        await event.reply(`Gateway: ${event.text}`);
        return {
          responseText: `Gateway: ${event.text}`,
          surface: event.surface,
          intentCategory: 'delegated',
          firewallStats: 'test',
          fastModelSuggested: false,
        };
      }),
    };

    orchestrator.attachLegacyUnifiedGatewayAdapter(legacyUnifiedGateway as any);
    orchestrator.attachEchoOutputStage(outputStage as any);

    await orchestrator.processMessage({
      platform: 'discord',
      userId: 'discord-user',
      chatId: 'discord:dm:42',
      isGroup: false,
      transport: 'text',
      rawText: 'resuma as novidades',
      reply,
      editMessage: jest.fn().mockResolvedValue(undefined),
    });

    expect(outputStage.deliver).toHaveBeenCalledWith(expect.objectContaining({
      surface: 'discord',
      text: 'Gateway: resuma as novidades',
      rawInput: 'resuma as novidades',
      requestedBy: 'discord-user',
      sessionId: 'discord:dm:42',
    }));
    expect(reply).toHaveBeenCalledWith('stage:Gateway: resuma as novidades');
  });

  it('keeps Discord guild traffic slash-only in public-server mode', async () => {
    const logRepo = createTestLogRepo();
    const reply = jest.fn().mockResolvedValue(undefined);
    const dispatcher = {
      dispatchTaskMessage: jest.fn().mockResolvedValue({ task: { task_id: 'task-1' } }),
    };
    const orchestrator = new CoreOrchestrator(
      logRepo,
      new DiscordSurfacePolicyService({
        publicServerMode: true,
        allowedChannelIds: ['channel-2'],
        commandExposure: 'minimal',
      }),
    );
    orchestrator.attachSurfaceTaskDispatcher(dispatcher as any);

    await orchestrator.processMessage({
      platform: 'discord',
      userId: 'discord-user',
      chatId: 'discord:guild:1:channel:2',
      isGroup: true,
      transport: 'text',
      rawText: '/task continue a tarefa atual',
      reply,
      editMessage: jest.fn().mockResolvedValue(undefined),
    });

    expect(reply).toHaveBeenCalledWith(expect.stringContaining('use os slash commands'));
    expect(dispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
  });

  it('does not advertise operational commands when public Discord users send unsupported text commands', async () => {
    const logRepo = createTestLogRepo();
    const reply = jest.fn().mockResolvedValue(undefined);
    const dispatcher = {
      dispatchTaskMessage: jest.fn().mockResolvedValue({ task: { task_id: 'task-1' } }),
    };
    const orchestrator = new CoreOrchestrator(
      logRepo,
      new DiscordSurfacePolicyService({
        publicServerMode: true,
        allowedChannelIds: ['channel-2'],
        commandExposure: 'minimal',
      }),
    );
    orchestrator.attachSurfaceTaskDispatcher(dispatcher as any);

    await orchestrator.processMessage({
      platform: 'discord',
      userId: 'discord-user',
      chatId: 'discord:guild:1:channel:2',
      isGroup: true,
      transport: 'text',
      rawText: '/perm list',
      reply,
      editMessage: jest.fn().mockResolvedValue(undefined),
    });

    expect(reply).toHaveBeenCalledWith('No Discord publico, use os slash commands do Zavorth nos canais liberados.');
    expect(reply).not.toHaveBeenCalledWith(expect.stringContaining('/autorepair'));
    expect(dispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
  });

  it('routes shared operational commands through the shared service before the dispatcher', async () => {
    const logRepo = createTestLogRepo();
    const orchestrator = new CoreOrchestrator(logRepo);
    const dispatcher = {
      dispatchTaskMessage: jest.fn().mockResolvedValue({ task: { task_id: 'task-1' } }),
    };
    const sharedService = {
      maybeHandle: jest.fn().mockResolvedValue(true),
      isSupportedCommand: jest.fn().mockReturnValue(true),
    };

    orchestrator.attachSurfaceTaskDispatcher(dispatcher as any);
    orchestrator.attachSharedSurfaceCommandService(sharedService as any);

    await orchestrator.processMessage({
      platform: 'discord',
      userId: 'discord-user',
      chatId: 'discord:guild:1:channel:2',
      isGroup: true,
      rawText: '/status',
      reply: jest.fn().mockResolvedValue(undefined),
      editMessage: jest.fn().mockResolvedValue(undefined),
    });

    expect(sharedService.maybeHandle).toHaveBeenCalled();
    expect(dispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
  });

  it('routes shared operational commands through the canonical Surface API when available', async () => {
    const logRepo = createTestLogRepo();
    const orchestrator = new CoreOrchestrator(logRepo);
    const reply = jest.fn().mockResolvedValue(undefined);
    const dispatcher = {
      dispatchTaskMessage: jest.fn().mockResolvedValue({ task: { task_id: 'task-1' } }),
    };
    const agentGateway = {
      handle: jest.fn(),
    };
    const surfaceApi = {
      handleCommand: jest.fn(async (input: any) => {
        await input.context.reply(`Boundary ${input.request.surface}: ${input.context.rawText}`);
        return {
          ok: true,
          handled: true,
          status: 'ok',
          summary: 'Handled by canonical core boundary.',
          messages: [`Boundary ${input.request.surface}: ${input.context.rawText}`],
          correlation: {
            traceId: 'trace-core',
            runId: 'run-core',
            sessionId: input.request.chatId,
            approvalId: null,
            artifactId: null,
          },
          error: null,
          metadata: {},
        };
      }),
    };

    orchestrator.attachSurfaceTaskDispatcher(dispatcher as any);
    orchestrator.attachSharedSurfaceCommandService(surfaceApi as any);
    orchestrator.attachAgentGateway(agentGateway as any);

    await orchestrator.processMessage({
      platform: 'discord',
      userId: 'discord-user',
      chatId: 'discord:guild:1:channel:2',
      isGroup: true,
      rawText: '/status',
      reply,
      editMessage: jest.fn().mockResolvedValue(undefined),
    });

    expect(surfaceApi.handleCommand).toHaveBeenCalledWith(expect.objectContaining({
      context: expect.objectContaining({
        platform: 'discord',
        rawText: '/status',
      }),
      request: expect.objectContaining({
        surface: 'discord',
        requestedBy: 'discord-user',
      }),
    }));
    expect(reply).toHaveBeenCalledWith('Boundary discord: /status');
    expect(agentGateway.handle).not.toHaveBeenCalled();
    expect(dispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
  });

  it('rejects unsupported slash commands outside the primary gateway', async () => {
    const logRepo = createTestLogRepo();
    const orchestrator = new CoreOrchestrator(logRepo);
    const reply = jest.fn().mockResolvedValue(undefined);
    const agentGateway = {
      handle: jest.fn(),
    };
    orchestrator.attachAgentGateway(agentGateway as any);

    await orchestrator.processMessage({
      platform: 'discord',
      userId: 'discord-user',
      chatId: 'discord:guild:1:channel:2',
      isGroup: true,
      rawText: '/perm list',
      reply,
      editMessage: jest.fn().mockResolvedValue(undefined),
    });

    expect(reply).toHaveBeenCalledWith(expect.stringContaining('/autorepair'));
    expect(agentGateway.handle).not.toHaveBeenCalled();
  });
});
