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

  it('blocks explicit selfmod apply requests for telegram admins without owner or trusted role', async () => {
    (config as any).telegramUserRoles = {
      ...(originalTelegramUserRoles || {}),
      '42': ['admin'],
    };
    const ctx = {
      platform: 'telegram',
      userId: '42',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'selfmod apply preview-1',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const selfModificationCommandService = {
      createPreview: jest.fn(),
      createGoalPreview: jest.fn(),
      applyPreview: jest.fn(),
      rollbackChangeSet: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      selfModificationCommandService: selfModificationCommandService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(selfModificationCommandService.applyPreview).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('aplicar ou reverter mudancas reais exige owner/trusted'));
  });

  it('routes explicit /perm commands through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/perm show perm-123',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const permission = {
      permission_id: 'perm-123',
      status: 'pending',
      scope: 'once',
      executor: 'external_executor',
      kind: 'workspace_access',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requested_value: 'workspace',
      resolved_value: 'workspace',
      requested_by: 'telegram-user',
      decided_by: null,
      decision_note: null,
      reason: 'Acesso supervisionado ao workspace.',
    };
    const permissionService = {
      listRequests: jest.fn(async () => ([permission])),
      getRequest: jest.fn(async () => permission),
      approveRequest: jest.fn(),
      rejectRequest: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      permissionService: permissionService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(permissionService.getRequest).toHaveBeenCalledWith('perm-123');
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Detalhe da permissao'));
  });

  it('routes explicit /approve commands through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/approve task-123',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const taskApprovalController = {
      handleApproval: jest.fn(async () => undefined),
      handleRejection: jest.fn(async () => undefined),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskApprovalController: taskApprovalController as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(taskApprovalController.handleApproval).toHaveBeenCalledWith(ctx, 'task-123');
    expect(taskApprovalController.handleRejection).not.toHaveBeenCalled();
  });

  it('routes explicit /reject commands through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/reject task-123',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const taskApprovalController = {
      handleApproval: jest.fn(async () => undefined),
      handleRejection: jest.fn(async () => undefined),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskApprovalController: taskApprovalController as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(taskApprovalController.handleRejection).toHaveBeenCalledWith(ctx, 'task-123');
    expect(taskApprovalController.handleApproval).not.toHaveBeenCalled();
  });

  it('routes natural task approval requests through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'aprove a tarefa task-123',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const taskApprovalController = {
      handleApproval: jest.fn(async () => undefined),
      handleRejection: jest.fn(async () => undefined),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskApprovalController: taskApprovalController as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(taskApprovalController.handleApproval).toHaveBeenCalledWith(ctx, 'task-123');
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('aprovar a tarefa task-123'));
  });

  it('routes natural latest pending task approvals through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'aprove a ultima tarefa pendente',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const taskApprovalController = {
      handleApproval: jest.fn(async () => undefined),
      handleRejection: jest.fn(async () => undefined),
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => ([
        {
          task_id: 'task-2',
          requires_approval: true,
          approval_status: 'pending',
          status: 'waiting_approval',
          raw_message: 'publicar o rollout do discord',
          result_summary: null,
          error_summary: null,
          intent: 'ship',
          target: null,
          metadata: {},
        },
        {
          task_id: 'task-1',
          requires_approval: true,
          approval_status: 'pending',
          status: 'waiting_approval',
          raw_message: 'ajustar docs',
          result_summary: null,
          error_summary: null,
          intent: 'docs',
          target: null,
          metadata: {},
        },
      ])),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskApprovalController: taskApprovalController as any,
      taskManager: taskManager as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(taskManager.getRecentTasks).toHaveBeenCalledWith(50, 'telegram-user');
    expect(taskApprovalController.handleApproval).toHaveBeenCalledWith(ctx, 'task-2');
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('mais recente com approval pendente'));
  });

  it('routes natural contextual task approvals through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'aprove a tarefa de onboarding do discord',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const taskApprovalController = {
      handleApproval: jest.fn(async () => undefined),
      handleRejection: jest.fn(async () => undefined),
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => ([
        {
          task_id: 'task-2',
          requires_approval: true,
          approval_status: 'pending',
          status: 'waiting_approval',
          raw_message: 'fechar onboarding do discord',
          result_summary: 'Tarefa do onboarding do discord aguardando approval.',
          error_summary: null,
          intent: 'review',
          target: null,
          metadata: {
            workflow_objective: 'fechar onboarding do discord',
          },
        },
        {
          task_id: 'task-1',
          requires_approval: true,
          approval_status: 'pending',
          status: 'waiting_approval',
          raw_message: 'rollout do slack',
          result_summary: null,
          error_summary: null,
          intent: 'ship',
          target: null,
          metadata: {
            workflow_objective: 'rollout do slack',
          },
        },
      ])),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskApprovalController: taskApprovalController as any,
      taskManager: taskManager as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(taskApprovalController.handleApproval).toHaveBeenCalledWith(ctx, 'task-2');
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('mais relacionada a onboarding discord'));
  });

  it('routes explicit /undo without a task id through the latest undoable task', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/undo',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const taskExecutionController = {
      handleUndo: jest.fn(async () => undefined),
      resumeTaskExecution: jest.fn(async () => undefined),
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => ([
        {
          task_id: 'task-2',
          rollback_available: true,
          raw_message: 'ajustar onboarding do discord',
          result_summary: null,
          error_summary: null,
          intent: 'review',
          target: null,
        },
      ])),
      getTask: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskExecutionController: taskExecutionController as any,
      taskManager: taskManager as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(taskExecutionController.handleUndo).toHaveBeenCalledWith(ctx, 'task-2');
  });

  it('routes natural undo requests through the latest matching task', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'desfaca a tarefa de onboarding do discord',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const taskExecutionController = {
      handleUndo: jest.fn(async () => undefined),
      resumeTaskExecution: jest.fn(async () => undefined),
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => ([
        {
          task_id: 'task-2',
          rollback_available: true,
          raw_message: 'ajustar onboarding do discord',
          result_summary: null,
          error_summary: null,
          intent: 'review',
          target: null,
        },
        {
          task_id: 'task-1',
          rollback_available: true,
          raw_message: 'rollout do slack',
          result_summary: null,
          error_summary: null,
          intent: 'ship',
          target: null,
        },
      ])),
      getTask: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskExecutionController: taskExecutionController as any,
      taskManager: taskManager as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(taskExecutionController.handleUndo).toHaveBeenCalledWith(ctx, 'task-2');
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('desfazer a tarefa mais relacionada a onboarding discord'));
  });

  it('routes natural recent-task status followups through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'e a ultima tarefa?',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => ([
        {
          task_id: 'task-2',
          status: 'running',
          command_type: '/workflow',
          raw_message: 'workflow review fechar onboarding do discord',
          normalized_message: 'workflow review fechar onboarding do discord',
          result_summary: 'Workflow review em andamento.',
          error_summary: null,
          intent: 'review',
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
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(taskManager.getRecentTasks).toHaveBeenCalledWith(20, 'telegram-user');
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('status da tarefa recente'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('A ultima tarefa ainda esta em andamento.'));
  });

  it('routes natural recent-task next-step followups through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'o que falta nela?',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => ([
        {
          task_id: 'task-2',
          status: 'waiting_approval',
          requires_approval: true,
          approval_status: 'pending',
          command_type: '/task',
          raw_message: 'publicar o rollout do discord',
          normalized_message: 'publicar o rollout do discord',
          result_summary: null,
          error_summary: null,
          intent: 'ship',
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
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('proximo passo da tarefa recente'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Proximo passo: aprovar a tarefa com /approve task-2'));
  });

  it('reopens a retryable task as a new canonical task from natural language', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'tente de novo a tarefa de onboarding do discord',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-99' },
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
          task_id: 'task-2',
          status: 'failed',
          command_type: '/task',
          raw_message: 'fechar onboarding do discord',
          normalized_message: 'fechar onboarding do discord',
          result_summary: null,
          error_summary: 'falhou no doctor',
          intent: 'review',
          target: null,
          metadata: {
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
      taskManager: taskManager as any,
      surfaceTaskDispatcher: surfaceTaskDispatcher as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(surfaceTaskDispatcher.dispatchTaskMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'telegram',
        chatId: 'telegram:chat-1',
        text: 'fechar onboarding do discord',
        sourceUserId: 'telegram-user',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('reabrir a tarefa mais relacionada a onboarding discord'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Nova task: task-99'));
  });

  it('reopens a retryable recent task from pronoun followup language', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'reabra isso',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-100' },
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
          task_id: 'task-3',
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
        text: 'gerar resumo do channel mesh',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('reabrir a tarefa mais recente elegivel para retry canonico'));
  });

  it('opens a new canonical task variation from pronoun followup language', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'repita isso com mais foco no discord',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-101' },
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
          task_id: 'task-4',
          status: 'completed',
          command_type: '/task',
          raw_message: 'fechar onboarding do slack',
          normalized_message: 'fechar onboarding do slack',
          result_summary: 'Pedido entregue.',
          error_summary: null,
          intent: 'review',
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
        text: 'fechar onboarding do slack\n\nAjuste adicional para esta nova variacao: mais foco no discord',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('nova versao canonica da tarefa recente'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Ajuste aplicado: mais foco no discord'));
  });

  it('opens a new canonical task variation from explicit similar-again language', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'faca igual de novo com um resumo mais curto',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-102' },
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
          task_id: 'task-5',
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
        text: 'gerar resumo do channel mesh\n\nAjuste adicional para esta nova variacao: um resumo mais curto',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('nova task canonica'));
  });

  it('opens a new canonical task variation from channel adaptation language', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'faca a mesma coisa para o slack',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-103' },
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
          task_id: 'task-6',
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
        text: 'fechar onboarding do discord\n\nAjuste adicional para esta nova variacao: adaptar para o slack',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('nova versao canonica da tarefa recente'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Ajuste aplicado: adaptar para o slack'));
  });

  it('opens a new canonical task variation from alternate-version language', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'gera outra versao mais curta para o app',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-104' },
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
          task_id: 'task-7',
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
        text: 'gerar resumo do channel mesh\n\nAjuste adicional para esta nova variacao: mais curta para o app',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('nova task canonica'));
  });

  it('opens a new canonical task variation from conversational followup channel language', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'agora faz para telegram tambem',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-105' },
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
          task_id: 'task-8',
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
        text: 'fechar onboarding do discord\n\nAjuste adicional para esta nova variacao: adaptar para telegram tambem',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('nova versao canonica da tarefa recente'));
  });

  it('opens a new canonical task variation from same-format followup language', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'usa o mesmo formato da anterior',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-106' },
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
          task_id: 'task-9',
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
        text: 'gerar resumo do channel mesh\n\nAjuste adicional para esta nova variacao: usar o mesmo formato da versao anterior',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Ajuste aplicado: usar o mesmo formato da versao anterior'));
  });

  it('opens a new canonical task variation from preserve-idea executive language', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'mantem a ideia mas deixa mais executivo',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-107' },
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
          task_id: 'task-10',
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
        text: 'escrever overview do node mesh\n\nAjuste adicional para esta nova variacao: manter a ideia, mas deixar mais executivo',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Ajuste aplicado: manter a ideia, mas deixar mais executivo'));
  });

  it('opens a new canonical task variation from concise shorter followup language', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'deixa mais curto',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-108' },
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
          task_id: 'task-11',
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
        text: 'escrever overview do node mesh\n\nAjuste adicional para esta nova variacao: deixar mais curto',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Ajuste aplicado: deixar mais curto'));
  });

  it('opens a new canonical task variation from concise technical followup language', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'faz mais tecnico',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-109' },
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
          task_id: 'task-12',
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
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Ajuste aplicado: deixar mais tecnico'));
  });

  it('opens a new canonical task variation from concise less-marketing followup language', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'menos marketing',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
      threadId: null,
      transport: 'text',
      composerPayload: null,
    };
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-110' },
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
          task_id: 'task-13',
          status: 'completed',
          command_type: '/task',
          raw_message: 'escrever copy do runtime preview',
          normalized_message: 'escrever copy do runtime preview',
          result_summary: 'Copy entregue.',
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
        text: 'escrever copy do runtime preview\n\nAjuste adicional para esta nova variacao: deixar menos marketing',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Ajuste aplicado: deixar menos marketing'));
  });

});
