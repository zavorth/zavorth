import { TelegramPermissionController } from '../../../src/telegram/controllers/TelegramPermissionController';

describe('TelegramPermissionController telemetry', () => {
  function createWaitingApprovalTask() {
    const now = new Date().toISOString();
    return {
      task_id: 'task-approval-1',
      created_at: now,
      updated_at: now,
      source: 'telegram',
      chat_id: 'chat-1',
      user_id: 'user-1',
      raw_message: '/run npm test',
      normalized_message: '/run npm test',
      command_type: '/run',
      intent: 'shell_execution',
      target: null,
      workspace: 'C:/workspace/zavorth',
      risk_level: 1,
      status: 'waiting_approval',
      requires_planning: false,
      requires_approval: true,
      approval_status: 'pending',
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
      metadata: {
        traceId: 'trace-task-approval-1',
      },
    };
  }

  function createController(task: any, telemetryRuntime: any, auditLogger?: any) {
    const taskManager = {
      getTask: jest.fn().mockImplementation((taskId: string) => (taskId === task.task_id ? task : undefined)),
      advanceState: jest.fn().mockImplementation((targetTask: any, nextStatus: string) => {
        targetTask.status = nextStatus;
      }),
    };

    return {
      controller: new TelegramPermissionController({
        permissionService: {
          listRequests: jest.fn().mockResolvedValue([]),
        } as any,
        taskManager: taskManager as any,
        botApi: { sendMessage: jest.fn() },
        persistTask: jest.fn(),
        getZavorthBridgeController: jest.fn() as any,
        resumeTaskExecution: jest.fn().mockResolvedValue(undefined),
        telemetryRuntime,
        auditLogger,
      }),
      taskManager,
    };
  }

  it('records successful explicit task approvals', async () => {
    const telemetryRuntime = {
      record: jest.fn().mockResolvedValue(undefined),
    } as any;
    const auditLogger = {
      logApprovalDecision: jest.fn().mockResolvedValue(undefined),
    } as any;
    const task = createWaitingApprovalTask();
    const { controller } = createController(task, telemetryRuntime, auditLogger);
    const ctx = {
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handleApproval(ctx, task.task_id);

    expect(telemetryRuntime.record).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: 'trace-task-approval-1',
        source: 'telegram-permission-controller',
        eventType: 'task.approval.approve',
        status: 'approved',
        payload: expect.objectContaining({
          taskId: task.task_id,
          userId: '42',
        }),
      }),
    );
    expect(task.metadata.approval_history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'approve',
          actor: '42',
          source: 'telegram_approve',
        }),
      ]),
    );
    expect(auditLogger.logApprovalDecision).toHaveBeenCalledWith(
      task,
      'approve',
      '42',
      expect.objectContaining({
        requiredHighRiskPin: false,
      }),
    );
  });

  it('records successful explicit task rejections', async () => {
    const telemetryRuntime = {
      record: jest.fn().mockResolvedValue(undefined),
    } as any;
    const auditLogger = {
      logApprovalDecision: jest.fn().mockResolvedValue(undefined),
    } as any;
    const task = createWaitingApprovalTask();
    const { controller } = createController(task, telemetryRuntime, auditLogger);
    const ctx = {
      from: { id: 77 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handleRejection(ctx, task.task_id);

    expect(telemetryRuntime.record).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: 'trace-task-approval-1',
        source: 'telegram-permission-controller',
        eventType: 'task.approval.reject',
        status: 'rejected',
        payload: expect.objectContaining({
          taskId: task.task_id,
          userId: '77',
        }),
      }),
    );
    expect(task.metadata.approval_history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'reject',
          actor: '77',
          source: 'telegram_reject',
        }),
      ]),
    );
    expect(auditLogger.logApprovalDecision).toHaveBeenCalledWith(
      task,
      'reject',
      '77',
      {},
    );
  });
});
