import { TelegramPermissionController } from '../../../src/telegram/controllers/TelegramPermissionController';

interface MockTask {
  task_id: string;
  created_at: string;
  updated_at: string;
  source: string;
  chat_id: string;
  user_id: string;
  raw_message: string;
  normalized_message: string;
  command_type: string;
  intent: string;
  target: unknown;
  workspace: string;
  risk_level: number;
  status: string;
  requires_planning: boolean;
  requires_approval: boolean;
  approval_status: string;
  planner_used: unknown;
  executor_used: unknown;
  fallback_used: boolean;
  parent_task_id: unknown;
  actions_planned: unknown[];
  actions_executed: unknown[];
  target_files: unknown[];
  artifacts: unknown[];
  stdout_summary: unknown;
  stderr_summary: unknown;
  diff_summary: unknown;
  result_summary: unknown;
  error_summary: unknown;
  rollback_available: boolean;
  metadata: {
    traceId: string;
    approval_history?: unknown[];
  };
}

interface MockTelemetryRuntime {
  record: jest.Mock;
}

interface MockAuditLogger {
  logApprovalDecision: jest.Mock;
}

interface MockTaskManager {
  getTask: jest.Mock;
  advanceState: jest.Mock;
}

interface MockBotApi {
  sendMessage: jest.Mock;
}

interface MockControllerDeps {
  permissionService: {
    listRequests: jest.Mock;
  };
  taskManager: MockTaskManager;
  botApi: MockBotApi;
  persistTask: jest.Mock;
  getZavorthBridgeController: jest.Mock;
  resumeTaskExecution: jest.Mock;
  telemetryRuntime: MockTelemetryRuntime;
  auditLogger?: MockAuditLogger;
}

function createWaitingApprovalTask(): MockTask {
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

function createController(task: MockTask, telemetryRuntime: MockTelemetryRuntime, auditLogger?: MockAuditLogger) {
  const taskManager: MockTaskManager = {
    getTask: jest.fn().mockImplementation((taskId: string) => (taskId === task.task_id ? task : undefined)),
    advanceState: jest.fn().mockImplementation((targetTask: MockTask, nextStatus: string) => {
      targetTask.status = nextStatus;
    }),
  };

  return {
    controller: new TelegramPermissionController({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([]),
      },
      taskManager,
      botApi: { sendMessage: jest.fn() },
      persistTask: jest.fn(),
      getZavorthBridgeController: jest.fn(),
      resumeTaskExecution: jest.fn().mockResolvedValue(undefined),
      telemetryRuntime,
      auditLogger,
    }),
    taskManager,
  };
}

describe('TelegramPermissionController telemetry', () => {
  it('records successful explicit task approvals', async () => {
    const telemetryRuntime: MockTelemetryRuntime = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const auditLogger: MockAuditLogger = {
      logApprovalDecision: jest.fn().mockResolvedValue(undefined),
    };
    const task = createWaitingApprovalTask();
    const { controller } = createController(task, telemetryRuntime, auditLogger);
    const ctx = {
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as { from: { id: number }; reply: jest.Mock };

    await controller.handleApproval(ctx as Parameters<typeof controller.handleApproval>[0], task.task_id);

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
    const telemetryRuntime: MockTelemetryRuntime = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const auditLogger: MockAuditLogger = {
      logApprovalDecision: jest.fn().mockResolvedValue(undefined),
    };
    const task = createWaitingApprovalTask();
    const { controller } = createController(task, telemetryRuntime, auditLogger);
    const ctx = {
      from: { id: 77 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as { from: { id: number }; reply: jest.Mock };

    await controller.handleRejection(ctx as Parameters<typeof controller.handleRejection>[0], task.task_id);

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
