import { ZavorthAgentGateway } from '../../../src/runtime/agent';
import { processTextMessage } from '../../../src/telegram/bot-gateway/support/BotGatewayMessageProcessing';
import { CommandParser } from '../../../src/telegram/CommandParser';

function createTelegramContext(text = 'compare o que mudou nesta pasta') {
  return {
    chat: { id: 4242, type: 'private' },
    from: { id: 42 },
    msg: { message_id: 7, text },
    reply: jest.fn().mockResolvedValue(undefined),
    api: {
      sendChatAction: jest.fn().mockResolvedValue(undefined),
      editMessageText: jest.fn().mockResolvedValue(undefined),
      getChatMember: jest.fn().mockResolvedValue({ status: 'administrator' }),
    },
    replyWithVoice: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function createRuntime(options: {
  sharedSurfaceCommandService?: any;
  agentGateway?: ZavorthAgentGateway;
} = {}) {
  const agentGateway = options.agentGateway || new ZavorthAgentGateway({
    now: () => new Date('2026-04-26T11:00:00.000Z'),
    idFactory: (prefix) => `${prefix}-telegram-universal`,
  });
  const legacyUnifiedGateway = {
    handleEvent: jest.fn(async (input: any) => {
      await input.reply('Resposta via runtime universal do Telegram.');
      return {
        responseText: 'Resposta via runtime universal do Telegram.',
        surface: input.surface,
        intentCategory: 'analysis',
      };
    }),
  };
  const surfaceTaskDispatcher = {
    dispatchTaskMessage: jest.fn().mockResolvedValue(undefined),
  };
  const commandRoutingService = {
    dispatchPrivateCommand: jest.fn().mockResolvedValue(false),
    dispatchGroupCommand: jest.fn().mockResolvedValue(false),
  };

  return {
    runtime: {
      logRepo: { log: jest.fn() },
      parser: new CommandParser(),
      priorityCommandService: { handle: jest.fn().mockResolvedValue(false) },
      securityLock: {
        isLocked: jest.fn().mockReturnValue(false),
        isCommandAllowedWhenLocked: jest.fn().mockReturnValue(true),
      },
      chainController: { handleCommandChain: jest.fn().mockResolvedValue(undefined) },
      hubController: { handleStartCommand: jest.fn().mockResolvedValue(undefined) },
      opsController: {
        handleStatus: jest.fn().mockResolvedValue(undefined),
        handleReadiness: jest.fn().mockResolvedValue(undefined),
        handleReadinessFixes: jest.fn().mockResolvedValue(undefined),
        handleReadyToGo: jest.fn().mockResolvedValue(undefined),
        handleStayOnline: jest.fn().mockResolvedValue(undefined),
      },
      capabilityController: { handleCommand: jest.fn().mockResolvedValue(false) },
      commandRoutingService,
      surfaceTaskDispatcher,
      legacyUnifiedGateway,
      agentGateway,
      surfaceIdentityService: { linkIdentity: jest.fn() },
      workspaceProfileService: { getProfile: jest.fn().mockResolvedValue(null) },
      workspaceCommandService: { resolveInvocation: jest.fn().mockReturnValue(null) },
      telemetryRuntime: { record: jest.fn().mockResolvedValue(undefined) },
      telegramChannelContractService: {
        buildContract: jest.fn(() => ({
          chatId: '4242',
          chatHint: 'telegram:4242',
          threadId: 'telegram:4242',
          transport: 'text',
          isGroup: false,
        })),
      },
      getSharedSurfaceCommandService: jest.fn().mockReturnValue(
        options.sharedSurfaceCommandService ?? null,
      ),
    } as any,
    agentGateway,
    legacyUnifiedGateway,
    surfaceTaskDispatcher,
    commandRoutingService,
  };
}

describe('BotGatewayMessageProcessing universal agent routing', () => {
  it('routes natural Telegram messages through ZavorthAgentGateway before legacy fallback', async () => {
    const ctx = createTelegramContext();
    const { runtime, agentGateway, legacyUnifiedGateway, surfaceTaskDispatcher } = createRuntime();

    await processTextMessage(runtime, ctx, 'compare o que mudou nesta pasta');

    expect(legacyUnifiedGateway.handleEvent).not.toHaveBeenCalled();
    expect(surfaceTaskDispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
    expect(ctx.reply.mock.calls.length).toBeGreaterThan(0);
    const activeRun = agentGateway.buildSnapshot({ activeSessionId: 'telegram:4242' }).activeRun;
    expect(activeRun?.channel).toBe('telegram');
    expect(activeRun?.status).toBe('completed');
    expect(activeRun?.input).toBe('compare o que mudou nesta pasta');
    expect((activeRun?.metadata.responseDecision as any)?.requestedTools).toEqual(expect.arrayContaining(['read_file']));
  });

  it('routes natural equivalents of operator capability commands through the agent loop', async () => {
    const cases = [
      {
        text: 'proponha uma auto melhoria segura para o Zavorth',
        tool: 'selfmod.preview',
      },
    ];

    for (const entry of cases) {
      const ctx = createTelegramContext(entry.text);
      const { runtime, agentGateway, legacyUnifiedGateway, surfaceTaskDispatcher, commandRoutingService } = createRuntime();

      await processTextMessage(runtime, ctx, entry.text);

      expect(commandRoutingService.dispatchPrivateCommand).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ command_type: '/task' }),
        entry.text,
        '42',
      );
      expect(legacyUnifiedGateway.handleEvent).not.toHaveBeenCalled();
      expect(surfaceTaskDispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
      expect(agentGateway.buildSnapshot({ activeSessionId: 'telegram:4242' }).activeRun).toEqual(
        expect.objectContaining({
          channel: 'telegram',
          input: entry.text,
          metadata: expect.objectContaining({
            responseDecision: expect.objectContaining({
              responsePath: 'agent-runtime',
              requestedTools: expect.arrayContaining([entry.tool]),
            }),
          }),
          toolExposure: expect.objectContaining({
            tools: expect.arrayContaining([
              expect.objectContaining({ id: entry.tool }),
            ]),
          }),
        }),
      );
    }
  });

  it('keeps natural Watch Mode requests blocked by policy before legacy fallback', async () => {
    const text = 'ative o Watch Mode para observar a tela';
    const ctx = createTelegramContext(text);
    const { runtime, agentGateway, legacyUnifiedGateway, surfaceTaskDispatcher } = createRuntime();

    await processTextMessage(runtime, ctx, text);

    expect(legacyUnifiedGateway.handleEvent).not.toHaveBeenCalled();
    expect(surfaceTaskDispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Watch Mode visual bloqueado'));
    const activeRun = agentGateway.buildSnapshot({ activeSessionId: 'telegram:4242' }).activeRun;
    expect(activeRun).toEqual(expect.objectContaining({
      channel: 'telegram',
      status: 'failed',
      input: text,
      toolExposure: expect.objectContaining({
        tools: expect.arrayContaining([
          expect.objectContaining({
            id: 'watchmode.control',
            risk: 'danger',
            requiresApproval: true,
          }),
        ]),
      }),
      metadata: expect.objectContaining({
        watchModeVisualProposal: expect.objectContaining({
          blocked: true,
          blockedReason: 'policy-allowlist-required',
          startRunCalled: false,
          computerUseAgentCalled: false,
        }),
      }),
    }));
  });

  it('keeps natural Echo requests behind the existing approval gate', async () => {
    const text = 'use resposta por voz com Echo nesta conversa';
    const ctx = createTelegramContext(text);
    const { runtime, agentGateway, legacyUnifiedGateway, surfaceTaskDispatcher } = createRuntime();

    await processTextMessage(runtime, ctx, text);

    expect(legacyUnifiedGateway.handleEvent).not.toHaveBeenCalled();
    expect(surfaceTaskDispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Preciso da sua confirmacao'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('approval:'));
    const activeRun = agentGateway.buildSnapshot({ activeSessionId: 'telegram:4242' }).activeRun;
    expect(activeRun).toEqual(expect.objectContaining({
      channel: 'telegram',
      status: 'waiting_approval',
      input: text,
      toolExposure: expect.objectContaining({
        tools: expect.arrayContaining([
          expect.objectContaining({
            id: 'echo_hands',
            requiresApproval: true,
            risk: 'danger',
          }),
        ]),
      }),
    }));
  });

  it('routes natural swarm requests into a structured approval proposal without calling the legacy shortcut', async () => {
    const text = 'monte uma equipe de agentes para revisar esta arquitetura';
    const ctx = createTelegramContext(text);
    const { runtime, agentGateway, legacyUnifiedGateway, surfaceTaskDispatcher, commandRoutingService } = createRuntime();

    await processTextMessage(runtime, ctx, text);

    expect(commandRoutingService.dispatchPrivateCommand).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ command_type: '/task' }),
      text,
      '42',
    );
    expect(legacyUnifiedGateway.handleEvent).not.toHaveBeenCalled();
    expect(surfaceTaskDispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Proposta de swarm estruturado preparada.'));
    const activeRun = agentGateway.buildSnapshot({ activeSessionId: 'telegram:4242' }).activeRun;
    expect(activeRun).toEqual(expect.objectContaining({
      channel: 'telegram',
      status: 'waiting_approval',
      input: text,
      metadata: expect.objectContaining({
        executionEscalation: expect.objectContaining({
          target: 'swarm',
          reason: 'complex-objective-swarm',
        }),
        swarmEscalationProposal: expect.objectContaining({
          launchServiceCalled: false,
        }),
      }),
    }));
    expect(activeRun?.approvals).toEqual([
      expect.objectContaining({
        status: 'pending',
        risk: 'attention',
      }),
    ]);
  });

  it('routes low-signal Telegram conversation through the canonical AgentGateway', async () => {
    const ctx = createTelegramContext('ol?');
    const { runtime, agentGateway, legacyUnifiedGateway, surfaceTaskDispatcher } = createRuntime();

    await processTextMessage(runtime, ctx, 'ol?');

    expect(legacyUnifiedGateway.handleEvent).not.toHaveBeenCalled();
    expect(surfaceTaskDispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
    expect(agentGateway.buildSnapshot({ activeSessionId: 'telegram:4242' }).activeRun).toEqual(expect.objectContaining({
      channel: 'telegram',
      status: 'completed',
      input: 'ol?',
      metadata: expect.objectContaining({
        responseDecision: expect.objectContaining({
          responsePath: 'fast-chat',
        }),
      }),
    }));
    expect(ctx.reply.mock.calls.length).toBeGreaterThan(0);
  });

  it('keeps passive Telegram links as natural LLM conversation instead of capability lists', async () => {
    const ctx = createTelegramContext('olha isso aqui https://example.com/artigo');
    const { runtime, agentGateway, legacyUnifiedGateway, surfaceTaskDispatcher } = createRuntime();

    await processTextMessage(runtime, ctx, 'olha isso aqui https://example.com/artigo');

    expect(legacyUnifiedGateway.handleEvent).not.toHaveBeenCalled();
    expect(surfaceTaskDispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
    const activeRun = agentGateway.buildSnapshot({ activeSessionId: 'telegram:4242' }).activeRun;
    expect(activeRun).toEqual(expect.objectContaining({
      channel: 'telegram',
      status: 'completed',
      input: 'olha isso aqui https://example.com/artigo',
      metadata: expect.objectContaining({
        responseDecision: expect.objectContaining({
          responsePath: 'fast-chat',
          requestedTools: [],
        }),
        naturalFirstRoute: expect.objectContaining({
          route: 'llm-reply',
        }),
      }),
    }));
    expect(ctx.reply.mock.calls.some((call: any[]) => String(call[0]).includes('Capability Negotiation'))).toBe(false);
    expect(ctx.reply.mock.calls.some((call: any[]) => String(call[0]).includes('Recibo Zavorth'))).toBe(false);
  });

  it('holds risky Telegram requests at the universal approval gate', async () => {
    const ctx = createTelegramContext('corrija o arquivo e rode npm test');
    const { runtime, agentGateway, legacyUnifiedGateway, surfaceTaskDispatcher } = createRuntime();

    await processTextMessage(runtime, ctx, 'corrija o arquivo e rode npm test');

    expect(legacyUnifiedGateway.handleEvent).not.toHaveBeenCalled();
    expect(surfaceTaskDispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Preciso da sua confirmacao'));
    const activeRun = agentGateway.buildSnapshot({ activeSessionId: 'telegram:4242' }).activeRun;
    expect(activeRun).toEqual(expect.objectContaining({
      status: 'waiting_approval',
      channel: 'telegram',
    }));
    expect(activeRun?.approvals).toEqual([
      expect.objectContaining({
        status: 'pending',
        risk: 'danger',
      }),
    ]);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Zavorth'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('responda "Aprovo"'));
  });

  it('runs the Telegram daily assistant loop from task to approval to receipt', async () => {
    const executor = jest.fn(() => ({
      status: 'completed' as const,
      summary: 'Daily task executed after approval.',
      replyText: 'Tarefa diaria concluida depois da aprovacao.',
      events: [
        {
          kind: 'status' as const,
          title: 'Daily assistant executor',
          detail: 'Executor governado acionado apos approval.',
          status: 'done' as const,
        },
      ],
      metadata: {
        dailyAssistantExecutor: true,
      },
    }));
    const agentGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T11:00:00.000Z'),
      idFactory: (prefix) => `${prefix}-telegram-daily`,
      executor,
    });
    const { runtime } = createRuntime({ agentGateway });
    const taskCtx = createTelegramContext('corrija o arquivo e rode npm test');

    await processTextMessage(runtime, taskCtx, 'corrija o arquivo e rode npm test');

    const pendingRun = agentGateway.buildSnapshot({ activeSessionId: 'telegram:4242' }).activeRun;
    const approvalId = pendingRun?.approvals[0]?.id || '';
    expect(pendingRun).toEqual(expect.objectContaining({
      channel: 'telegram',
      status: 'waiting_approval',
    }));
    expect(approvalId).toBeTruthy();
    expect(executor).not.toHaveBeenCalled();
    expect(taskCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Zavorth'));
    expect(taskCtx.reply).toHaveBeenCalledWith(expect.stringContaining(`approval: ${approvalId} (pending)`));

    const approvalCtx = createTelegramContext(`aprovar ${approvalId}`);
    await processTextMessage(runtime, approvalCtx, `aprovar ${approvalId}`);

    expect(executor).toHaveBeenCalledTimes(1);
    const completedRun = agentGateway.buildSnapshot({ activeSessionId: 'telegram:4242' }).activeRun;
    expect(completedRun).toEqual(expect.objectContaining({
      channel: 'telegram',
      status: 'completed',
      summary: 'Daily task executed after approval.',
    }));
    expect(approvalCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Tarefa diaria concluida depois da aprovacao.'));
    expect(approvalCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Zavorth'));
    expect(approvalCtx.reply).toHaveBeenCalledWith(expect.stringContaining(`approval: ${approvalId} (approved)`));
    expect(approvalCtx.reply.mock.calls.some((call: any[]) => String(call[0]).includes('responda "Aprovo"'))).toBe(false);
  });

  it('does not steal explicit slash commands from the Telegram command router', async () => {
    const ctx = createTelegramContext('/help');
    const { runtime, agentGateway, legacyUnifiedGateway, commandRoutingService } = createRuntime();
    commandRoutingService.dispatchPrivateCommand.mockResolvedValue(true);

    await processTextMessage(runtime, ctx, '/help');

    expect(commandRoutingService.dispatchPrivateCommand).toHaveBeenCalled();
    expect(legacyUnifiedGateway.handleEvent).not.toHaveBeenCalled();
    expect(agentGateway.listRuns()).toHaveLength(0);
  });

  it('does not let critical operator slash commands fall through to the agent or task dispatcher', async () => {
    const criticalCommands = [
      '/approve task-1',
      '/reject task-1',
      '/lock secret',
      '/unlock secret',
      '/doctor desktop',
      '/reload',
    ];

    for (const command of criticalCommands) {
      const ctx = createTelegramContext(command);
      const { runtime, agentGateway, legacyUnifiedGateway, surfaceTaskDispatcher } = createRuntime();

      await processTextMessage(runtime, ctx, command);

      expect(legacyUnifiedGateway.handleEvent).not.toHaveBeenCalled();
      expect(surfaceTaskDispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
      expect(agentGateway.listRuns()).toHaveLength(0);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Comando operador'),
      );
    }
  });

  it('keeps /doctor available through the shared surface operator boundary', async () => {
    const sharedSurfaceCommandService = {
      handleCommand: jest.fn(async (input: any) => {
        await input.context.reply('Doctor compartilhado respondeu.');
        return {
          ok: true,
          handled: true,
          status: 'ok',
          summary: 'Doctor handled by shared surface.',
          messages: ['Doctor compartilhado respondeu.'],
          correlation: {},
          error: null,
          metadata: {},
        };
      }),
    };
    const ctx = createTelegramContext('/doctor desktop');
    const { runtime, agentGateway, legacyUnifiedGateway, surfaceTaskDispatcher } = createRuntime({
      sharedSurfaceCommandService,
    });

    await processTextMessage(runtime, ctx, '/doctor desktop');

    expect(sharedSurfaceCommandService.handleCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedCommand: expect.objectContaining({
          command_type: '/doctor',
          command_args: 'desktop',
        }),
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith('Doctor compartilhado respondeu.', undefined);
    expect(legacyUnifiedGateway.handleEvent).not.toHaveBeenCalled();
    expect(surfaceTaskDispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
    expect(agentGateway.listRuns()).toHaveLength(0);
  });
});
