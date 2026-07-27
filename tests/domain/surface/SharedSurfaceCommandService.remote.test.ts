import { SharedSurfaceCommandService } from '../../../src/services/SharedSurfaceCommandService';
import { ZavorthSmartCommandSurfaceService } from '../../../src/services/ZavorthSmartCommandSurfaceService';
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

  it('blocks explicit /selfmod apply requests for telegram admins without owner or trusted role', async () => {
    (config as any).telegramUserRoles = {
      ...(originalTelegramUserRoles || {}),
      '42': ['admin'],
    };
    const ctx = {
      platform: 'telegram',
      userId: '42',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/selfmod apply preview-1',
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
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('applying or reverting real changes requires owner/trusted'),
    );
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
      status: 'approved',
      scope: 'once',
      executor: 'external_executor',
      kind: 'workspace_access',
      workspace: 'C:\\workspace',
      requested_value: 'workspace',
      resolved_value: 'workspace',
      requested_by: 'telegram-user',
      decided_by: 'telegram-user',
      decision_note: null,
      reason: 'Supervised workspace access.',
    };
    const permissionService = {
      listRequests: jest.fn(async () => [permission]),
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
    // Proposal-time card (may include reply_markup as 2nd arg).
    const permReply = String(ctx.reply.mock.calls[0]?.[0] || '');
    expect(permReply).toContain('Permission approval');
    expect(permReply).toMatch(/\/perm approve 1|buttons/i);
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
    expect(taskApprovalController.handleApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'telegram',
        userId: 'telegram-user',
        chatId: 'telegram:chat-1',
      }),
      'task-123',
    );
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
    expect(taskApprovalController.handleRejection).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'telegram',
        userId: 'telegram-user',
        chatId: 'telegram:chat-1',
      }),
      'task-123',
    );
    expect(taskApprovalController.handleApproval).not.toHaveBeenCalled();
  });

  it('does not keyword-route free-text task approval (agent-first purity)', async () => {
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

    expect(handled).toBe(false);
    expect(taskApprovalController.handleApproval).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('does not keyword-route free-text latest pending task approvals (agent-first purity)', async () => {
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
      getRecentTasks: jest.fn(() => [
        {
          task_id: 'task-2',
          requires_approval: true,
          approval_status: 'pending',
          status: 'waiting_approval',
          raw_message: 'publish the Discord rollout',
        },
      ]),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskApprovalController: taskApprovalController as any,
      taskManager: taskManager as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(false);
    expect(taskManager.getRecentTasks).not.toHaveBeenCalled();
    expect(taskApprovalController.handleApproval).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('does not keyword-route free-text contextual task approvals (agent-first purity)', async () => {
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
      getRecentTasks: jest.fn(() => []),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskApprovalController: taskApprovalController as any,
      taskManager: taskManager as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(false);
    expect(taskApprovalController.handleApproval).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('routes explicit /undo without a task id through the latest undoable task', async () => {
    const smartSpy = jest.spyOn(ZavorthSmartCommandSurfaceService.prototype, 'canHandle').mockReturnValue(false);
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
      getRecentTasks: jest.fn(() => [
        {
          task_id: 'task-2',
          rollback_available: true,
          raw_message: 'ajustar onboarding do discord',
          result_summary: null,
          error_summary: null,
          intent: 'review',
          target: null,
        },
      ]),
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
    expect(taskExecutionController.handleUndo).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'telegram',
        userId: 'telegram-user',
        chatId: 'telegram:chat-1',
      }),
      'task-2',
    );
    smartSpy.mockRestore();
  });

  it('does not keyword-route free-text undo (agent-first purity)', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'undo the discord onboarding task',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const taskExecutionController = {
      handleUndo: jest.fn(async () => undefined),
      resumeTaskExecution: jest.fn(async () => undefined),
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => []),
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

    expect(handled).toBe(false);
    expect(taskExecutionController.handleUndo).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('does not keyword-route free-text recent-task status followups (agent-first purity)', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'e a ultima tarefa-',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => []),
      getTask: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskManager: taskManager as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(false);
    expect(taskManager.getRecentTasks).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('does not keyword-route free-text recent-task next-step followups (agent-first purity)', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'o que falta nela-',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => []),
      getTask: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskManager: taskManager as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(false);
    expect(taskManager.getRecentTasks).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('does not keyword-route free-text task reopen/retry (agent-first purity)', async () => {
    const phrases = [
      'tente de novo a tarefa de onboarding do discord',
      'reabra isso',
      'repita isso com mais foco no discord',
      'do the same again with a shorter summary',
      'do the same for slack',
      'generate another shorter version for the app',
      'now do it for telegram too',
      'usa o mesmo formato da anterior',
      'mantem a ideia mas deixa mais executivo',
      'deixa mais curto',
      'make it more technical',
      'menos marketing',
    ];
    const surfaceTaskDispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({ task: { task_id: 'task-99' } })),
    };
    const taskManager = {
      getRecentTasks: jest.fn(() => []),
      getTask: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      taskManager: taskManager as any,
      surfaceTaskDispatcher: surfaceTaskDispatcher as any,
    });

    for (const rawText of phrases) {
      const ctx = {
        platform: 'telegram',
        userId: 'telegram-user',
        chatId: 'telegram:chat-1',
        isGroup: false,
        rawText,
        reply: jest.fn(async () => undefined),
        editMessage: jest.fn(async () => undefined),
      };
      const handled = await service.maybeHandle(ctx as any);
      expect(handled).toBe(false);
      expect(ctx.reply).not.toHaveBeenCalled();
    }

    expect(surfaceTaskDispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
    expect(taskManager.getRecentTasks).not.toHaveBeenCalled();
  });
});
