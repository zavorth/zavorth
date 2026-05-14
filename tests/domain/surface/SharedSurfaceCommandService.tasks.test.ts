import { SharedSurfaceCommandService } from '../../../src/services/SharedSurfaceCommandService';
import { DiscordSurfacePolicyService } from '../../../src/services/DiscordSurfacePolicyService';
import { config } from '../../../src/config/index';

describe('SharedSurfaceCommandService', () => {
  const originalProvider = config.llmProvider;
  const originalGeminiKeys = [...config.geminiApiKeys];
  const originalOpenAiKey = config.openaiApiKey;
  const originalOpenRouterKey = config.openRouterApiKey;
  const originalTelegramUserRoles = config.telegramUserRoles;
  const originalSelfmodPolicy = config.zavorthSelfmodPolicy;

  afterEach(() => {
    (config as any).llmProvider = originalProvider;
    (config as any).geminiApiKeys = [...originalGeminiKeys];
    (config as any).openaiApiKey = originalOpenAiKey;
    (config as any).openRouterApiKey = originalOpenRouterKey;
    (config as any).telegramUserRoles = originalTelegramUserRoles;
    (config as any).zavorthSelfmodPolicy = originalSelfmodPolicy;
  });

  it('opens a new canonical task variation from concise more-detailed followup language', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'mais detalhado',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-111' },
        parsed: { command_type: '/task' },
        runtimeUserId: 'telegram-user',
        sourceUserId: 'telegram-user',
        tenantId: null,
        tenantContext: null,
      })),
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => ([
        {
          task_id: 'task-14',
          status: 'completed',
          command_type: '/task',
          raw_message: 'gerar resumo do channel mesh',
          normalized_message: 'gerar resumo do channel mesh',
          result_summary: 'Resumo entregue.',
          error_summary: null,
          intent: 'research',
          target: null,
          metadata: {},
        },
      ])),
      getTask: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskManager: taskManager as any,
      surfaceTaskDispatcher: surfaceTaskDispatcher as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(surfaceTaskDispatcher.dispatchTaskMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'gerar resumo do channel mesh\n\nAjuste adicional para esta nova variacao: deixar mais detalhado',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Ajuste aplicado: deixar mais detalhado'));
  });

  it('opens a new canonical task variation from composite refinement language', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'faz uma versao mais curta e mais tecnica',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-112' },
        parsed: { command_type: '/task' },
        runtimeUserId: 'telegram-user',
        sourceUserId: 'telegram-user',
        tenantId: null,
        tenantContext: null,
      })),
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => ([
        {
          task_id: 'task-15',
          status: 'completed',
          command_type: '/task',
          raw_message: 'escrever overview do node mesh',
          normalized_message: 'escrever overview do node mesh',
          result_summary: 'Overview entregue.',
          error_summary: null,
          intent: 'writing',
          target: null,
          metadata: {},
        },
      ])),
      getTask: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskManager: taskManager as any,
      surfaceTaskDispatcher: surfaceTaskDispatcher as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(surfaceTaskDispatcher.dispatchTaskMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'escrever overview do node mesh\n\nAjuste adicional para esta nova variacao: deixar mais curta e mais tecnica',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Ajuste aplicado: deixar mais curta e mais tecnica'));
  });

  it('opens a new canonical task variation from multi-channel adaptation language', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'faz isso para slack e telegram',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-113' },
        parsed: { command_type: '/task' },
        runtimeUserId: 'telegram-user',
        sourceUserId: 'telegram-user',
        tenantId: null,
        tenantContext: null,
      })),
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => ([
        {
          task_id: 'task-16',
          status: 'completed',
          command_type: '/task',
          raw_message: 'fechar onboarding do discord',
          normalized_message: 'fechar onboarding do discord',
          result_summary: 'Entrega concluida.',
          error_summary: null,
          intent: 'ops',
          target: null,
          metadata: {},
        },
      ])),
      getTask: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskManager: taskManager as any,
      surfaceTaskDispatcher: surfaceTaskDispatcher as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(surfaceTaskDispatcher.dispatchTaskMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'fechar onboarding do discord\n\nAjuste adicional para esta nova variacao: adaptar para slack e telegram',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Ajuste aplicado: adaptar para slack e telegram'));
  });

  it('previews task variation options before opening a new task when requested', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'me mostre as opcoes antes de abrir a nova task',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-114' },
      })),
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => ([
        {
          task_id: 'task-17',
          status: 'completed',
          command_type: '/task',
          raw_message: 'gerar resumo do channel mesh',
          normalized_message: 'gerar resumo do channel mesh',
          result_summary: 'Resumo entregue.',
          error_summary: null,
          intent: 'research',
          target: null,
          metadata: {},
        },
      ])),
      getTask: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskManager: taskManager as any,
      surfaceTaskDispatcher: surfaceTaskDispatcher as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(surfaceTaskDispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('ver as opcoes antes de abrir uma nova variacao da tarefa recente'),
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Ainda nao abri nenhuma nova task. Aqui estao as opcoes mais naturais para essa variacao:'),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('faz isso para slack e telegram'));
  });

  it('opens a new canonical task variation from preview option selection language', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'abre a segunda opcao',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-115' },
        parsed: { command_type: '/task' },
        runtimeUserId: 'telegram-user',
        sourceUserId: 'telegram-user',
        tenantId: null,
        tenantContext: null,
      })),
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => ([
        {
          task_id: 'task-18',
          status: 'completed',
          command_type: '/task',
          raw_message: 'escrever overview do node mesh',
          normalized_message: 'escrever overview do node mesh',
          result_summary: 'Overview entregue.',
          error_summary: null,
          intent: 'writing',
          target: null,
          metadata: {},
        },
      ])),
      getTask: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskManager: taskManager as any,
      surfaceTaskDispatcher: surfaceTaskDispatcher as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(surfaceTaskDispatcher.dispatchTaskMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'escrever overview do node mesh\n\nAjuste adicional para esta nova variacao: deixar mais tecnico',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('segunda opcao da tarefa recente'));
  });

  it('opens a new canonical task variation from contrasted refinement language', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'faz a versao mais tecnica, nao a mais curta',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-116' },
        parsed: { command_type: '/task' },
        runtimeUserId: 'telegram-user',
        sourceUserId: 'telegram-user',
        tenantId: null,
        tenantContext: null,
      })),
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => ([
        {
          task_id: 'task-19',
          status: 'completed',
          command_type: '/task',
          raw_message: 'escrever overview do node mesh',
          normalized_message: 'escrever overview do node mesh',
          result_summary: 'Overview entregue.',
          error_summary: null,
          intent: 'writing',
          target: null,
          metadata: {},
        },
      ])),
      getTask: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskManager: taskManager as any,
      surfaceTaskDispatcher: surfaceTaskDispatcher as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(surfaceTaskDispatcher.dispatchTaskMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'escrever overview do node mesh\n\nAjuste adicional para esta nova variacao: deixar mais tecnica, nao mais curta',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Ajuste aplicado: deixar mais tecnica, nao mais curta'));
  });

  it('recommends the best task variation for a target channel without opening a new task', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'qual dessas variacoes fica melhor para Telegram',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-117' },
      })),
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => ([
        {
          task_id: 'task-20',
          status: 'completed',
          command_type: '/task',
          raw_message: 'fechar onboarding do discord',
          normalized_message: 'fechar onboarding do discord',
          result_summary: 'Entrega concluida.',
          error_summary: null,
          intent: 'ops',
          target: null,
          metadata: {},
        },
      ])),
      getTask: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskManager: taskManager as any,
      surfaceTaskDispatcher: surfaceTaskDispatcher as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(surfaceTaskDispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('quer uma recomendacao de variacao antes de abrir algo novo para a tarefa recente'),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Melhor opcao agora: adaptar para Telegram'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Se quiser, posso abrir essa nova task canonica agora.'));
  });

  it('uses short conversation memory to open the recommended variation', async () => {
    const task = {
      task_id: 'task-21',
      status: 'completed',
      command_type: '/task',
      raw_message: 'fechar onboarding do discord',
      normalized_message: 'fechar onboarding do discord',
      result_summary: 'Entrega concluida.',
      error_summary: null,
      intent: 'ops',
      target: null,
      metadata: {},
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => ([task])),
      getTask: jest.fn(() => task),
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-118' },
        parsed: { command_type: '/task' },
        runtimeUserId: 'telegram-user',
        sourceUserId: 'telegram-user',
        tenantId: null,
        tenantContext: null,
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskManager: taskManager as any,
      surfaceTaskDispatcher: surfaceTaskDispatcher as any,
    });

    const compareCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'qual dessas variacoes fica melhor para Telegram',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const followupCtx = {
      ...compareCtx,
      rawText: 'vai com a recomendada',
      reply: jest.fn(async () => undefined),
    };

    expect(await service.maybeHandle(compareCtx as any)).toBe(true);
    expect(await service.maybeHandle(followupCtx as any)).toBe(true);

    expect(surfaceTaskDispatcher.dispatchTaskMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'fechar onboarding do discord\n\nAjuste adicional para esta nova variacao: adaptar para Telegram',
      }),
    );
    expect(followupCtx.reply).toHaveBeenCalledWith(expect.stringContaining('seguir com a variacao recomendada'));
  });

  it('uses short conversation memory to open the currently pointed variation', async () => {
    const task = {
      task_id: 'task-22',
      status: 'completed',
      command_type: '/task',
      raw_message: 'gerar resumo do channel mesh',
      normalized_message: 'gerar resumo do channel mesh',
      result_summary: 'Resumo entregue.',
      error_summary: null,
      intent: 'research',
      target: null,
      metadata: {},
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => ([task])),
      getTask: jest.fn(() => task),
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-119' },
        parsed: { command_type: '/task' },
        runtimeUserId: 'telegram-user',
        sourceUserId: 'telegram-user',
        tenantId: null,
        tenantContext: null,
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskManager: taskManager as any,
      surfaceTaskDispatcher: surfaceTaskDispatcher as any,
    });

    const previewCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'me mostre as opcoes antes de abrir a nova task',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const followupCtx = {
      ...previewCtx,
      rawText: 'abre essa mesmo',
      reply: jest.fn(async () => undefined),
    };

    expect(await service.maybeHandle(previewCtx as any)).toBe(true);
    expect(await service.maybeHandle(followupCtx as any)).toBe(true);

    expect(surfaceTaskDispatcher.dispatchTaskMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'gerar resumo do channel mesh\n\nAjuste adicional para esta nova variacao: deixar mais curto',
      }),
    );
    expect(followupCtx.reply).toHaveBeenCalledWith(expect.stringContaining('seguir com essa mesma variacao'));
  });

  it('uses short conversation memory to switch to another preview option', async () => {
    const task = {
      task_id: 'task-23',
      status: 'completed',
      command_type: '/task',
      raw_message: 'escrever overview do node mesh',
      normalized_message: 'escrever overview do node mesh',
      result_summary: 'Overview entregue.',
      error_summary: null,
      intent: 'writing',
      target: null,
      metadata: {},
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => ([task])),
      getTask: jest.fn(() => task),
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-120' },
        parsed: { command_type: '/task' },
        runtimeUserId: 'telegram-user',
        sourceUserId: 'telegram-user',
        tenantId: null,
        tenantContext: null,
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskManager: taskManager as any,
      surfaceTaskDispatcher: surfaceTaskDispatcher as any,
    });

    const previewCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'me mostre as opcoes antes de abrir a nova task',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const followupCtx = {
      ...previewCtx,
      rawText: 'na verdade a terceira',
      reply: jest.fn(async () => undefined),
    };

    expect(await service.maybeHandle(previewCtx as any)).toBe(true);
    expect(await service.maybeHandle(followupCtx as any)).toBe(true);

    expect(surfaceTaskDispatcher.dispatchTaskMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'escrever overview do node mesh\n\nAjuste adicional para esta nova variacao: deixar menos marketing',
      }),
    );
    expect(followupCtx.reply).toHaveBeenCalledWith(expect.stringContaining('terceira opcao da conversa recente'));
  });

  it('uses short conversation memory to open the two strongest recent variations', async () => {
    const task = {
      task_id: 'task-24',
      status: 'completed',
      command_type: '/task',
      raw_message: 'fechar onboarding do discord',
      normalized_message: 'fechar onboarding do discord',
      result_summary: 'Entrega concluida.',
      error_summary: null,
      intent: 'ops',
      target: null,
      metadata: {},
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => ([task])),
      getTask: jest.fn(() => task),
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async (..._args) => ({
        task: { task_id: surfaceTaskDispatcher.dispatchTaskMessage.mock.calls.length === 1 ? 'task-121' : 'task-122' },
        parsed: { command_type: '/task' },
        runtimeUserId: 'telegram-user',
        sourceUserId: 'telegram-user',
        tenantId: null,
        tenantContext: null,
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskManager: taskManager as any,
      surfaceTaskDispatcher: surfaceTaskDispatcher as any,
    });

    const compareCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'qual dessas variacoes fica melhor para Telegram',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const followupCtx = {
      ...compareCtx,
      rawText: 'faz as duas',
      reply: jest.fn(async () => undefined),
    };

    expect(await service.maybeHandle(compareCtx as any)).toBe(true);
    expect(await service.maybeHandle(followupCtx as any)).toBe(true);

    expect(surfaceTaskDispatcher.dispatchTaskMessage).toHaveBeenCalledTimes(2);
    expect(surfaceTaskDispatcher.dispatchTaskMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        text: 'fechar onboarding do discord\n\nAjuste adicional para esta nova variacao: adaptar para Telegram',
      }),
    );
    expect(surfaceTaskDispatcher.dispatchTaskMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        text: 'fechar onboarding do discord\n\nAjuste adicional para esta nova variacao: deixar mais tecnico',
      }),
    );
    expect(followupCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Abri mais de uma variacao canonica'));
  });

  it('routes natural learning actions through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'promova o candidate:wf-1 no learning',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const learningPlaneService = {
      buildSnapshot: jest.fn(() => ({
        summary: {
          total: 1,
          pending: 0,
          approved: 1,
          rejected: 0,
          promoted: 1,
          published: 0,
          quarantined: 0,
          highConfidence: 1,
        },
        candidates: [],
        narrative: {
          headline: 'Learning atualizado.',
          operatorSummary: '1 promovido.',
        },
      })),
      executeAction: jest.fn(() => ({
        generatedAt: '2026-04-09T15:10:00.000Z',
        candidateId: 'candidate:wf-1',
        actionId: 'promote',
        status: 'applied',
        ok: true,
        summary: 'Ship playbook promovido para trusted local.',
        details: ['Gate explicito aplicado.'],
        snapshot: {
          generatedAt: '2026-04-09T15:10:00.000Z',
          summary: {
            total: 1,
            pending: 0,
            approved: 1,
            rejected: 0,
            promoted: 1,
            published: 0,
            quarantined: 0,
            highConfidence: 1,
          },
          candidates: [],
          narrative: {
            headline: 'Learning atualizado.',
            operatorSummary: '1 promovido.',
          },
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      learningPlaneService: learningPlaneService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(learningPlaneService.executeAction).toHaveBeenCalledWith({
      candidateId: 'candidate:wf-1',
      actionId: 'promote',
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('promover o candidato candidate:wf-1'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('trusted local'));
  });

  it('routes natural workflow requests through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'workflow research sobre channel mesh',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const workflowController = {
      handleWorkflow: jest.fn(async () => undefined),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      workflowController: workflowController as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(workflowController.handleWorkflow).toHaveBeenCalledWith(
      ctx,
      'research channel mesh',
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('workflow research'));
  });

  it('resumes the most recent matching workflow from natural language', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'continue o workflow de onboarding do discord',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const workflowController = {
      handleWorkflow: jest.fn(async () => undefined),
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => ([
        {
          task_id: 'task-2',
          command_type: '/workflow',
          raw_message: 'workflow review fechar onboarding do discord',
          result_summary: 'Workflow review do onboarding do discord em andamento.',
          error_summary: null,
          metadata: {
            workflow_run_id: 'wf-onboarding-2',
            workflow_objective: 'fechar onboarding do discord',
          },
        },
        {
          task_id: 'task-1',
          command_type: '/workflow',
          raw_message: 'workflow review rollout do slack',
          result_summary: 'Workflow do slack.',
          error_summary: null,
          metadata: {
            workflow_run_id: 'wf-slack-1',
            workflow_objective: 'rollout do slack',
          },
        },
      ])),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      workflowController: workflowController as any,
      taskManager: taskManager as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(taskManager.getRecentTasks).toHaveBeenCalledWith(50, 'telegram-user');
    expect(workflowController.handleWorkflow).toHaveBeenCalledWith(
      ctx,
      'resume wf-onboarding-2',
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('retomar o workflow mais relacionado a onboarding discord'));
  });

  it('routes natural task resume requests to workflow resume when the task belongs to a workflow', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'continue a tarefa de onboarding do discord',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const workflowController = {
      handleWorkflow: jest.fn(async () => undefined),
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => ([
        {
          task_id: 'task-2',
          status: 'approved',
          requires_approval: false,
          approval_status: 'approved',
          command_type: '/workflow',
          raw_message: 'workflow review fechar onboarding do discord',
          result_summary: 'Workflow review em pausa.',
          error_summary: null,
          intent: 'review',
          target: null,
          metadata: {
            workflow_run_id: 'wf-onboarding-2',
            workflow_stage_id: 'stage-review',
            workflow_objective: 'fechar onboarding do discord',
          },
        },
      ])),
      getTask: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      workflowController: workflowController as any,
      taskManager: taskManager as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(workflowController.handleWorkflow).toHaveBeenCalledWith(
      ctx,
      'resume wf-onboarding-2 stage-review',
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('retomar a tarefa mais relacionada a onboarding discord'));
  });

  it('routes explicit /workflow commands through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/workflow review fechar onboarding do discord',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const workflowController = {
      handleWorkflow: jest.fn(async () => undefined),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      workflowController: workflowController as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(workflowController.handleWorkflow).toHaveBeenCalledWith(
      ctx,
      'review fechar onboarding do discord',
    );
  });

  it('routes natural channel onboarding requests through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'Quero colocar voce no discord',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const buildTurn = jest.fn(async () => ({
      channelId: 'discord',
      mode: 'native',
      assistant: { selected: { channelId: 'discord' }, channels: null },
      extractedEntries: [],
      remainingEnvKeys: ['DISCORD_BOT_TOKEN'],
      applyResult: null,
      doctorResult: null,
      sendTest: null,
      promotionReady: false,
      naturalReply: 'Discord preparado para o proximo passo do Channel Mesh.\n\nAinda faltam: DISCORD_BOT_TOKEN.',
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      naturalChannelSetupTurnService: { buildTurn } as any,
      integrationHubService: {
        buildIntegrationSnapshot: jest.fn(() => ({ manifest: { id: 'discord' } })),
        renderConnectReport: jest.fn(),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(buildTurn).toHaveBeenCalledWith(expect.objectContaining({
      channelId: 'discord',
      requestedBy: 'telegram-user',
    }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('colocar o Zavorth no Discord'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Discord preparado para o proximo passo do Channel Mesh.'));
  });

  it('applies a channel scaffold from natural language after a guided channel request', async () => {
    const execute = jest.fn(async ({ channelId }: any) => ({
      summary: `${String(channelId || '').trim()} preparado para o proximo passo do Channel Mesh.`,
      details: ['Fluxo guiado pronto.'],
      selected: {
        label: 'Discord',
        actionHint: 'Siga o onboarding oficial.',
      },
    }));
    const applyScaffold = jest.fn(() => ({
      generatedAt: '2026-04-11T10:00:00.000Z',
      channelId: 'discord',
      mode: 'native',
      env: {
        filePath: 'C:\\repo\\.env',
        writtenKeys: ['DISCORD_BOT_TOKEN', 'DISCORD_ALLOWED_GUILD_IDS'],
        preservedKeys: [],
        created: false,
      },
      directoriesCreated: [],
      report: { generatedAt: '2026-04-11T10:00:00.000Z', channels: [] },
      nextSteps: ['Preencha DISCORD_BOT_TOKEN.', 'Rode npm run test:channels:smoke.'],
    }));
    const buildPlanForChannel = jest.fn(() => ({
      channelId: 'discord',
      label: 'Discord',
      readiness: 'partial',
      configured: false,
      implementationState: 'full',
      transport: 'native',
      currentMode: null,
      modes: ['native', 'bridge'],
      recommendedMode: 'native',
      summary: 'Discord pode ser preparado.',
      webhookPath: null,
      localWebhookUrl: null,
      publicWebhookUrl: null,
      requiredEnvKeys: ['DISCORD_BOT_TOKEN', 'DISCORD_ALLOWED_GUILD_IDS'],
      missingEnvKeys: ['DISCORD_BOT_TOKEN', 'DISCORD_ALLOWED_GUILD_IDS'],
      scaffoldEntries: [],
      notes: [],
      commands: {
        inspect: 'npm run channels:install -- --json',
        apply: 'npm run channels:install -- --channel discord --mode native --apply',
        doctor: 'npm run test:channels:smoke',
      },
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      channelActionService: { execute } as any,
      channelInstallService: { buildPlanForChannel, applyScaffold } as any,
      integrationHubService: {
        buildIntegrationSnapshot: jest.fn(() => null),
      } as any,
    });

    const startCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'quero colocar voce no discord',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const applyCtx = {
      ...startCtx,
      rawText: 'aplique o scaffold',
      reply: jest.fn(async () => undefined),
    };

    expect(await service.maybeHandle(startCtx as any)).toBe(true);
    expect(await service.maybeHandle(applyCtx as any)).toBe(true);

    expect(applyScaffold).toHaveBeenCalledWith({
      channelId: 'discord',
      mode: 'native',
    });
    expect(applyCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Scaffold seguro aplicado para discord'));
    expect(applyCtx.reply).toHaveBeenCalledWith(expect.stringContaining('DISCORD_BOT_TOKEN'));
  });

  it('routes natural channel onboarding requests for iMessage phrased as entrar', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'quero entrar no iMessage',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const buildTurn = jest.fn(async () => ({
      channelId: 'imessage',
      mode: 'mac-bridge',
      assistant: { selected: { channelId: 'imessage' }, channels: null },
      extractedEntries: [],
      remainingEnvKeys: ['IMESSAGE_NODE_ID'],
      applyResult: null,
      doctorResult: null,
      sendTest: null,
      promotionReady: false,
      naturalReply: 'iMessage preparado para o proximo passo do Channel Mesh.',
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      naturalChannelSetupTurnService: { buildTurn } as any,
      integrationHubService: {
        buildIntegrationSnapshot: jest.fn(() => null),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(buildTurn).toHaveBeenCalledWith(expect.objectContaining({
      channelId: 'imessage',
      requestedBy: 'telegram-user',
    }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('colocar o Zavorth no iMessage'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('iMessage preparado para o proximo passo do Channel Mesh.'));
  });

  it('previews channel options before connecting when requested', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'me mostre as opcoes de canal antes de conectar',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const execute = jest.fn(async () => ({
      summary: 'n/d',
      details: [],
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      channelActionService: { execute } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(execute).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Ainda nao preparei nenhum canal. Aqui estao as opcoes mais naturais para onboarding agora:'),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('1. Telegram'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('3. Slack'));
  });

  it('recommends a channel before onboarding when asked', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'qual canal fica melhor para trabalho',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const execute = jest.fn(async () => ({
      summary: 'n/d',
      details: [],
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      channelActionService: { execute } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(execute).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Melhor opcao: Slack'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('para uso de trabalho, Slack normalmente oferece o melhor encaixe'));
  });

});
