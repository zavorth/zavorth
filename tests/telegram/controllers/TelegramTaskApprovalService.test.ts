import type { Context } from 'grammy';
import { TaskApprovalService } from '../../../src/services/approvals/TaskApprovalService';
import { TaskSecurityPostureService } from '../../../src/services/TaskSecurityPostureService';
import {
  AgentPermissionService,
} from '../../../src/services/permission/AgentPermissionService';
import {
  ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
  type AgentPermissionRespondResult,
} from '../../../src/contracts/permission/AgentPermissionContract';
import type { Task, TaskStatus } from '../../../src/contracts/TaskContract';
import type { TaskManager } from '../../../src/orchestrator/TaskManager';

const USER_ID = 777;
const CHAT_ID = 100;
const NEWER_UPDATED_AT = '2026-08-25T10:00:00.000Z';
const OLDER_UPDATED_AT = '2026-08-25T09:00:00.000Z';

type TaskManagerHarness = {
  getTask: jest.Mock;
  advanceState: jest.Mock;
  getRecentTasks: jest.Mock;
  getRecentTasksByChat: jest.Mock;
};

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    task_id: 'task-golden-0001',
    created_at: OLDER_UPDATED_AT,
    updated_at: NEWER_UPDATED_AT,
    source: 'telegram',
    chat_id: String(CHAT_ID),
    user_id: String(USER_ID),
    raw_message: 'run the deploy command',
    normalized_message: 'run the deploy command',
    command_type: '/run',
    intent: 'unknown',
    target: null,
    workspace: null,
    risk_level: 0,
    status: 'waiting_approval',
    requires_planning: false,
    requires_approval: true,
    approval_status: 'pending',
    planner_used: null,
    executor_used: 'local_executor',
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

function buildContext(): Context & { reply: jest.Mock } {
  return {
    from: { id: USER_ID },
    chat: { id: CHAT_ID },
    reply: jest.fn().mockResolvedValue(undefined),
  } as unknown as Context & { reply: jest.Mock };
}

function buildHarness(tasks: Task[]): TaskManagerHarness {
  const tasksById = new Map(tasks.map((task) => [task.task_id, task]));
  return {
    getTask: jest.fn((taskId: string) => tasksById.get(taskId)),
    advanceState: jest.fn((task: Task, nextStatus: TaskStatus) => {
      task.status = nextStatus;
      if (nextStatus === 'approved') {
        task.approval_status = 'approved';
      }
      if (nextStatus === 'rejected') {
        task.approval_status = 'rejected';
        task.requires_approval = false;
      }
      task.updated_at = NEWER_UPDATED_AT;
    }),
    getRecentTasks: jest.fn(() => [...tasks]),
    getRecentTasksByChat: jest.fn(() => []),
  };
}

function buildService(taskManager: TaskManagerHarness) {
  const persistTask = jest.fn();
  const resumeTaskExecution = jest.fn().mockResolvedValue(undefined);
  const service = new TaskApprovalService({
    taskManager: taskManager as unknown as TaskManager,
    persistTask,
    resumeTaskExecution,
    taskSecurityPosture: new TaskSecurityPostureService(),
  });
  return { service, persistTask, resumeTaskExecution };
}

describe('TaskApprovalService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('bare /approve golden flow', () => {
    it('approves the most recent pending task and replies with the pinned template', async () => {
      const task = buildTask();
      const taskManager = buildHarness([task]);
      const { service, persistTask, resumeTaskExecution } = buildService(taskManager);
      const ctx = buildContext();

      await service.handleApproval(ctx, '');

      expect(taskManager.getRecentTasks).toHaveBeenCalledWith(50, String(USER_ID));
      expect(taskManager.getRecentTasksByChat).toHaveBeenCalledWith(String(CHAT_ID), 50);
      expect(ctx.reply).toHaveBeenCalledWith(
        [
          'Allowed (once).',
          'Allowed once.',
          `Short reference: ${task.task_id.substring(0, 8)}`,
          'Resuming execution now.',
        ].join('\n'),
      );
      expect(task.requires_approval).toBe(false);
      expect(task.approval_status).toBe('approved');
      expect(task.status).toBe('running');
      expect(persistTask).toHaveBeenCalledTimes(1);
      expect(persistTask).toHaveBeenCalledWith(task);
      expect(resumeTaskExecution).toHaveBeenCalledTimes(1);
      expect(resumeTaskExecution).toHaveBeenCalledWith(ctx, task);
    });

    it('records the telegram approval decision in task security metadata', async () => {
      const task = buildTask();
      const { service } = buildService(buildHarness([task]));
      const ctx = buildContext();

      await service.handleApproval(ctx, '');

      expect(task.metadata.permissionChoice).toBe('once');
      expect(task.metadata.highRiskApprovedAt).toEqual(expect.any(String));
      expect(task.metadata.explicitTaskApprovalAt).toEqual(expect.any(String));
      expect(task.metadata.last_approval_decision).toEqual(
        expect.objectContaining({
          action: 'approve',
          actor: String(USER_ID),
          source: 'telegram_approve',
          permissionChoice: 'once',
          permissionScope: 'once',
          required_high_risk_pin: false,
        }),
      );
    });
  });

  describe('pending task reference resolution', () => {
    it('resolves ordinals against pending tasks sorted newest first', async () => {
      const older = buildTask({
        task_id: 'task-older-000001',
        updated_at: OLDER_UPDATED_AT,
      });
      const newer = buildTask({
        task_id: 'task-newer-000001',
        updated_at: NEWER_UPDATED_AT,
      });
      const taskManager = buildHarness([older, newer]);
      const { service, resumeTaskExecution } = buildService(taskManager);
      const ctx = buildContext();

      await service.handleApproval(ctx, '2');

      expect(ctx.reply).toHaveBeenCalledWith(
        [
          'Allowed (once).',
          'Allowed once.',
          `Short reference: ${older.task_id.substring(0, 8)}`,
          'Resuming execution now.',
        ].join('\n'),
      );
      expect(resumeTaskExecution).toHaveBeenCalledWith(ctx, older);
    });

    it('resolves short-id prefixes through recent tasks for this user', async () => {
      const task = buildTask({ task_id: 'task-prefix-ab12' });
      const taskManager = buildHarness([task]);
      const { service } = buildService(taskManager);
      const ctx = buildContext();

      await service.handleApproval(ctx, `${task.task_id.substring(0, 8)} once`);

      expect(taskManager.getRecentTasks).toHaveBeenCalledWith(100, String(USER_ID));
      expect(ctx.reply).toHaveBeenCalledWith(
        [
          'Allowed (once).',
          'Allowed once.',
          `Short reference: ${task.task_id.substring(0, 8)}`,
          'Resuming execution now.',
        ].join('\n'),
      );
    });

    it('rejects an explicit reference that matches no recent task', async () => {
      const { service } = buildService(buildHarness([buildTask()]));
      const ctx = buildContext();

      await service.handleApproval(ctx, 'deadbeef');

      expect(ctx.reply).toHaveBeenCalledWith(
        'I could not process this approval.\n\nReason: No pending task matched that reference. Use /approve, /approve 1, or tap Approve — not a long id.',
      );
    });

    it('fails bare approve when several tasks are waiting', async () => {
      const { service } = buildService(
        buildHarness([
          buildTask({ task_id: 'task-first-000001' }),
          buildTask({ task_id: 'task-second-000002' }),
        ]),
      );
      const ctx = buildContext();

      await service.handleApproval(ctx, '');

      expect(ctx.reply).toHaveBeenCalledWith(
        'I could not process this approval.\n\nReason: Several tasks are waiting (2). Use /approve 1 (or 2…), or tap Approve — not a long id.',
      );
    });

    it('fails when no pending tasks exist at all', async () => {
      const { service } = buildService(buildHarness([]));
      const ctx = buildContext();

      await service.handleApproval(ctx, '');

      expect(ctx.reply).toHaveBeenCalledWith(
        'I could not process this approval.\n\nReason: No pending task to approve. Use /approve, /approve 1, or tap Approve — not a long id.',
      );
    });

    it('fails for an ordinal beyond the pending list', async () => {
      const { service } = buildService(
        buildHarness([
          buildTask({ task_id: 'task-first-000001' }),
          buildTask({ task_id: 'task-second-000002' }),
        ]),
      );
      const ctx = buildContext();

      await service.handleApproval(ctx, '5');

      expect(ctx.reply).toHaveBeenCalledWith(
        'I could not process this approval.\n\nReason: No pending task at position 5. Use /approve 1…2, or tap Approve — not a long id.',
      );
    });

    it('refuses to approve a task that is no longer waiting for approval', async () => {
      const task = buildTask({ status: 'completed', approval_status: 'approved' });
      const taskManager = buildHarness([task]);
      const { service, resumeTaskExecution } = buildService(taskManager);
      const ctx = buildContext();

      await service.handleApproval(ctx, task.task_id);

      expect(ctx.reply).toHaveBeenCalledWith(
        `I could not process this approval.\n\nReason: Task ${task.task_id} is not waiting for approval. Current status: completed`,
      );
      expect(resumeTaskExecution).not.toHaveBeenCalled();
    });
  });

  describe('scope word parsing', () => {
    it.each([
      ['session', 'Allowed (session).', 'Allowed for this session.'],
      ['always', 'Allowed (always).', 'Always allowed for this tool/pattern.'],
    ])(
      'persists choice %s and echoes its remembered message',
      async (choice, expectedHeader, expectedMessage) => {
        const respondSpy = jest
          .spyOn(AgentPermissionService.prototype, 'respond')
          .mockImplementation((input) =>
            ({
              contractVersion: ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
              choice: input.choice,
              allowed: true,
              remembered: input.choice !== 'once',
              scope: input.choice,
              expiresAt: input.choice === 'session' ? new Date().toISOString() : null,
              message:
                input.choice === 'session'
                  ? 'Allowed for this session.'
                  : 'Always allowed for this tool/pattern.',
            }) as AgentPermissionRespondResult,
          );
        const task = buildTask();
        const { service } = buildService(buildHarness([task]));
        const ctx = buildContext();

        await service.handleApproval(ctx, `${task.task_id.substring(0, 8)} ${choice}`);

        expect(respondSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            choice,
            toolName: 'local_executor',
            pattern: 'run the deploy command',
            surface: 'telegram',
            actorId: String(USER_ID),
            sessionId: String(CHAT_ID),
          }),
        );
        expect(ctx.reply).toHaveBeenCalledWith(
          [
            expectedHeader,
            expectedMessage,
            `Short reference: ${task.task_id.substring(0, 8)}`,
            'Resuming execution now.',
          ].join('\n'),
        );
        expect(task.metadata.permissionChoice).toBe(choice);
      },
    );

    it('maps the approve scope word onto a one-shot allow', async () => {
      const task = buildTask();
      const { service } = buildService(buildHarness([task]));
      const ctx = buildContext();

      await service.handleApproval(ctx, `${task.task_id.substring(0, 8)} approve`);

      expect(ctx.reply).toHaveBeenCalledWith(
        [
          'Allowed (once).',
          'Allowed once.',
          `Short reference: ${task.task_id.substring(0, 8)}`,
          'Resuming execution now.',
        ].join('\n'),
      );
      expect(task.metadata.permissionChoice).toBe('once');
    });

    it('falls back to one-shot allow for unrecognized scope words', async () => {
      const task = buildTask();
      const { service } = buildService(buildHarness([task]));
      const ctx = buildContext();

      await service.handleApproval(ctx, `${task.task_id.substring(0, 8)} banana`);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Allowed (once).\nAllowed once.'),
      );
      expect(task.metadata.permissionChoice).toBe('once');
    });

    it('routes the deny scope word into the rejection flow', async () => {
      const task = buildTask();
      const taskManager = buildHarness([task]);
      const { service, persistTask, resumeTaskExecution } = buildService(taskManager);
      const ctx = buildContext();

      await service.handleApproval(ctx, `${task.task_id.substring(0, 8)} deny`);

      expect(ctx.reply).toHaveBeenCalledWith(
        `Done. Task ${task.task_id.substring(0, 8)} was rejected and I will not continue it.`,
      );
      expect(task.approval_status).toBe('rejected');
      expect(task.requires_approval).toBe(false);
      expect(persistTask).toHaveBeenCalledWith(task);
      expect(resumeTaskExecution).not.toHaveBeenCalled();
    });
  });

  describe('high-risk approvals', () => {
    it('marks the high-risk pin requirement while still approving explicitly', async () => {
      const task = buildTask({ risk_level: 4 });
      const { service } = buildService(buildHarness([task]));
      const ctx = buildContext();

      await service.handleApproval(ctx, '');

      expect(task.metadata.last_approval_decision).toEqual(
        expect.objectContaining({
          action: 'approve',
          required_high_risk_pin: true,
          source: 'telegram_approve',
        }),
      );
      expect(task.metadata.highRiskGate).toEqual(
        expect.objectContaining({
          reason: 'high_risk_approved',
          highRisk: true,
        }),
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Allowed (once).\nAllowed once.'),
      );
    });
  });

  describe('/reject flow', () => {
    it('rejects by full task id with the pinned success reply', async () => {
      const task = buildTask();
      const taskManager = buildHarness([task]);
      const { service, persistTask, resumeTaskExecution } = buildService(taskManager);
      const ctx = buildContext();

      await service.handleRejection(ctx, task.task_id);

      expect(ctx.reply).toHaveBeenCalledWith(
        `Done. Task ${task.task_id.substring(0, 8)} was rejected and I will not continue it.`,
      );
      expect(task.approval_status).toBe('rejected');
      expect(task.requires_approval).toBe(false);
      expect(persistTask).toHaveBeenCalledWith(task);
      expect(resumeTaskExecution).not.toHaveBeenCalled();
      expect(task.metadata.last_approval_decision).toEqual(
        expect.objectContaining({
          action: 'reject',
          actor: String(USER_ID),
          source: 'telegram_reject',
        }),
      );
    });

    it('resolves bare numeric rejections against pending tasks', async () => {
      const older = buildTask({ task_id: 'task-older-reject', updated_at: OLDER_UPDATED_AT });
      const newer = buildTask({ task_id: 'task-newer-reject', updated_at: NEWER_UPDATED_AT });
      const { service } = buildService(buildHarness([older, newer]));
      const ctx = buildContext();

      await service.handleRejection(ctx, '1');

      expect(ctx.reply).toHaveBeenCalledWith(
        `Done. Task ${newer.task_id.substring(0, 8)} was rejected and I will not continue it.`,
      );
    });

    it('replies with the pinned failure form when there is nothing to reject', async () => {
      const { service } = buildService(buildHarness([]));
      const ctx = buildContext();

      await service.handleRejection(ctx, '');

      expect(ctx.reply).toHaveBeenCalledWith(
        'I could not record this rejection.\n\nReason: No pending task to approve. Use /approve, /approve 1, or tap Approve — not a long id.',
      );
    });
  });
});
