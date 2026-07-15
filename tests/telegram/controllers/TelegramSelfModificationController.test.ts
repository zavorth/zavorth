import type { Task } from '../../../src/contracts/TaskContract';
import { config } from '../../../src/config/index';
import { TelegramSelfModificationController } from '../../../src/telegram/controllers/TelegramSelfModificationController';

jest.setTimeout(15000);

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    task_id: 'task-selfmod',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source: 'telegram',
    chat_id: '42',
    user_id: '42',
    raw_message: '/selfmod src/sample.ts -- ajuste',
    normalized_message: '/selfmod src/sample.ts -- ajuste',
    command_type: '/selfmod',
    intent: 'unknown',
    target: null,
    workspace: null,
    risk_level: 0,
    status: 'pending',
    requires_planning: false,
    requires_approval: false,
    approval_status: 'not_required',
    planner_used: null,
    executor_used: null,
    fallback_used: false,
    parent_task_id: null,
    actions_planned: [],
    actions_executed: [],
    target_files: [],
    artifacts: [],
    stdout_summary: null,
    stderr_summary: null,
    diff_summary: null,
    result_summary: null,
    error_summary: null,
    rollback_available: false,
    metadata: {},
    ...overrides,
  };
}

describe('TelegramSelfModificationController', () => {
  const originalTelegramUserRoles = config.telegramUserRoles;

  function createController(task = createTask(), overrides: Record<string, any> = {}) {
    const deps = {
      taskManager: {
        createPendingTask: jest.fn().mockReturnValue(task),
        advanceState: jest.fn((currentTask: Task, status: Task['status']) => {
          currentTask.status = status;
        }),
      },
      executionGateway: {
        getModeManager: jest.fn().mockReturnValue({
          getMode: jest.fn().mockReturnValue('BUILD'),
          isSufficientFor: jest.fn().mockReturnValue(true),
        }),
      },
      auditLogger: {
        logEvent: jest.fn().mockResolvedValue(undefined),
      },
      persistTask: jest.fn(),
      selfModificationService: {
        createPreview: jest.fn().mockResolvedValue({
          success: true,
          previewId: 'preview-1',
          relativePath: 'src/sample.ts',
          summary: 'Atualiza o valor exportado.',
          diffSummary: '@@ -1 +1 @@\n-export const value = 1;\n+export const value = 2;',
        }),
        applyPreview: jest.fn().mockResolvedValue({
          success: true,
          previewId: 'preview-1',
          relativePath: 'src/sample.ts',
          summary: 'Aplicado com sucesso.',
          diffSummary: '@@ -1 +1 @@\n-export const value = 1;\n+export const value = 2;',
        }),
      },
      ...overrides,
    } as any;

    return {
      controller: new TelegramSelfModificationController(deps),
      deps,
      task,
    };
  }

  beforeEach(() => {
    config.telegramUserRoles = {
      ...originalTelegramUserRoles,
      '42': ['owner'],
    };
  });

  afterEach(() => {
    config.telegramUserRoles = originalTelegramUserRoles;
  });

  it('parses preview and apply syntaxes', () => {
    const { controller } = createController();

    expect(controller.parseArgs('src/sample.ts -- ajuste o guard')).toEqual({
      mode: 'preview',
      filePath: 'src/sample.ts',
      instruction: 'ajuste o guard',
    });
    expect(controller.parseArgs('preview src/sample.ts -- ajuste o guard')).toEqual({
      mode: 'preview',
      filePath: 'src/sample.ts',
      instruction: 'ajuste o guard',
    });
    expect(controller.parseArgs('apply preview-123')).toEqual({
      mode: 'apply',
      previewId: 'preview-123',
    });
    expect(controller.parseArgs('goal -- criar capability qa sob demanda')).toEqual({
      mode: 'goal',
      goal: 'criar capability qa sob demanda',
    });
    expect(controller.parseArgs('rollback change-123')).toEqual({
      mode: 'rollback',
      changeId: 'change-123',
    });
  });

  it('rejects usage in non-private chats', async () => {
    const ctx = {
      chat: { id: 42, type: 'group' },
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const { controller, deps } = createController();

    await controller.handleCommand(ctx, 'src/sample.ts -- ajuste o guard');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('private chat');
    expect(deps.taskManager.createPendingTask).not.toHaveBeenCalled();
  });

  it('requires BUILD mode', async () => {
    const ctx = {
      chat: { id: 42, type: 'private' },
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const { controller, deps } = createController(createTask(), {
      executionGateway: {
        getModeManager: jest.fn().mockReturnValue({
          getMode: jest.fn().mockReturnValue('WORKSPACE'),
          isSufficientFor: jest.fn().mockReturnValue(false),
        }),
      },
    });

    await controller.handleCommand(ctx, 'src/sample.ts -- ajuste o guard');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('/selfmod requires BUILD mode');
    expect(deps.taskManager.createPendingTask).not.toHaveBeenCalled();
  });

  it('creates a preview and guides the user to apply by preview id', async () => {
    const ctx = {
      chat: { id: 42, type: 'private' },
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const { controller, deps, task } = createController();

    await controller.handleCommand(ctx, 'src/sample.ts -- ajuste o guard');

    expect(deps.selfModificationService.createPreview).toHaveBeenCalledWith('src/sample.ts', 'ajuste o guard', '42');
    expect(task.status).toBe('completed');
    expect(task.metadata.preview_id).toBe('preview-1');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('/selfmod apply preview-1');
    expect(ctx.reply.mock.calls[0]?.[1]).toEqual(expect.any(Object));
  });

  it('applies a stored preview by id', async () => {
    const ctx = {
      chat: { id: 42, type: 'private' },
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const { controller, deps, task } = createController(
      createTask({
        raw_message: '/selfmod apply preview-1',
        normalized_message: '/selfmod apply preview-1',
      }),
    );

    await controller.handleCommand(ctx, 'apply preview-1');

    expect(deps.selfModificationService.applyPreview).toHaveBeenCalledWith('preview-1', '42');
    expect(task.status).toBe('completed');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Self-modification applied');
  });

  it('blocks apply for admins that are not owner or trusted', async () => {
    config.telegramUserRoles = {
      ...originalTelegramUserRoles,
      '42': ['admin'],
    };
    const ctx = {
      chat: { id: 42, type: 'private' },
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const { controller, deps } = createController(
      createTask({
        raw_message: '/selfmod apply preview-1',
        normalized_message: '/selfmod apply preview-1',
      }),
    );

    await controller.handleCommand(ctx, 'apply preview-1');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('owner/trusted');
    expect(deps.taskManager.createPendingTask).not.toHaveBeenCalled();
    expect(deps.selfModificationService.applyPreview).not.toHaveBeenCalled();
  });

  it('dispatches goal previews and rollbacks for trusted operators', async () => {
    config.telegramUserRoles = {
      ...originalTelegramUserRoles,
      '42': ['trusted'],
    };
    const ctx = {
      chat: { id: 42, type: 'private' },
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const { controller, deps } = createController(createTask(), {
      selfModificationService: {
        createPreview: jest.fn(),
        createGoalPreview: jest.fn().mockResolvedValue({
          success: true,
          mode: 'goal',
          previewId: 'goal-preview-1',
          summary: 'Changeset pronto.',
          changeCount: 2,
          validationPlan: ['build', 'launcher dry-run'],
          diffSummary: 'diff',
        }),
        applyPreview: jest.fn(),
        rollbackChangeSet: jest.fn().mockResolvedValue({
          success: true,
          changeId: 'change-123',
          restoredFiles: 2,
          summary: 'Rollback concluido.',
        }),
      },
    });

    await controller.handleCommand(ctx, 'goal -- criar capability de teste');
    await controller.handleCommand(ctx, 'rollback change-123');

    expect(deps.selfModificationService.createGoalPreview).toHaveBeenCalledWith('criar capability de teste', '42');
    expect(deps.selfModificationService.rollbackChangeSet).toHaveBeenCalledWith('change-123', '42');
  });

  it('preserves validation output when a preview is blocked', async () => {
    const ctx = {
      chat: { id: 42, type: 'private' },
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const { controller, deps, task } = createController(createTask(), {
      selfModificationService: {
        createPreview: jest.fn().mockResolvedValue({
          success: false,
          previewId: 'preview-blocked',
          relativePath: 'src/sample.ts',
          summary: 'Preview bloqueado pela validacao.',
          diffSummary: null,
          validationOutput: 'lint: found 2 issues',
        }),
        applyPreview: jest.fn(),
      },
    });

    await controller.handleCommand(ctx, 'src/sample.ts -- ajuste o guard');

    expect(task.status).toBe('failed');
    expect(deps.selfModificationService.createPreview).toHaveBeenCalled();
    expect(String(ctx.reply.mock.calls[0]?.[0] ?? '')).toMatch(/Saida da validacao|validation|Preview|bloqueado/i);
  });
});
