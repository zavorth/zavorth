import type { Context } from 'grammy';
import { TelegramPermissionController } from '../../../src/gateways/channels/telegram/controllers/TelegramPermissionController';
import type {
  TelegramPermissionControllerDeps,
} from '../../../src/gateways/channels/telegram/controllers/TelegramPermissionController';
import { config } from '../../../src/config/index';
import { PermissionService } from '../../../src/services/PermissionService';
import { HostIdentityService } from '../../../src/services/HostIdentityService';
import type { Task, TaskStatus } from '../../../src/contracts/TaskContract';
import type { TaskManager } from '../../../src/orchestrator/TaskManager';
import { ApprovalCoordinator } from '../../../src/services/approvals/ApprovalCoordinator';
import { SurfaceDecisionSpine } from '../../../src/services/approvals/SurfaceDecisionSpine';
import { TaskDecisionPort } from '../../../src/services/approvals/ports/TaskDecisionPort';

const USER_ID = 42;
const CHAT_ID = 9001;
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
    task_id: 'task-spine-0000001',
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

type ControllerOverrides = Partial<TelegramPermissionControllerDeps> & {
  taskManager?: TaskManagerHarness;
};

function createController(overrides: ControllerOverrides = {}) {
  const resumeTaskExecution = overrides.resumeTaskExecution ?? jest.fn().mockResolvedValue(undefined);
  const deps: TelegramPermissionControllerDeps = {
    permissionService: {
      listRequests: jest.fn().mockResolvedValue([]),
      approveRequest: jest.fn(),
      rejectRequest: jest.fn(),
      getRequest: jest.fn().mockResolvedValue(null),
    } as unknown as PermissionService,
    taskManager: (overrides.taskManager ?? buildHarness([buildTask()])) as unknown as TaskManager,
    persistTask: jest.fn(),
    getZavorthBridgeController: jest.fn(),
    resumeTaskExecution,
    hostIdentityService: overrides.hostIdentityService,
    decisionSpine: overrides.decisionSpine,
    resolveUserRoles: overrides.resolveUserRoles,
  };
  return {
    controller: new TelegramPermissionController(deps),
    resumeTaskExecution,
    persistTask: deps.persistTask,
  };
}

function buildContext(): Context & { reply: jest.Mock } {
  return {
    from: { id: USER_ID },
    chat: { id: CHAT_ID },
    reply: jest.fn().mockResolvedValue(undefined),
  } as unknown as Context & { reply: jest.Mock };
}

describe('Telegram permission controller spine wiring', () => {
  const originalTelegramUserRoles = { ...(config.telegramUserRoles || {}) };

  beforeEach(() => {
    (config as Record<string, unknown>).telegramUserRoles = {
      ...originalTelegramUserRoles,
      [String(USER_ID)]: ['admin'],
    };
  });

  afterEach(() => {
    (config as Record<string, unknown>).telegramUserRoles = { ...originalTelegramUserRoles };
    jest.restoreAllMocks();
  });

  describe('self-built spine', () => {
    it('approves through the spine and reproduces the pinned golden reply', async () => {
      const task = buildTask();
      const { controller, resumeTaskExecution } = createController({
        taskManager: buildHarness([task]),
      });
      const ctx = buildContext();

      await controller.handleApproval(ctx, '');

      expect(ctx.reply).toHaveBeenCalledWith(
        [
          'Allowed (once).',
          'Allowed once.',
          `Short reference: ${task.task_id.substring(0, 8)}`,
          'Resuming execution now.',
        ].join('\n'),
      );
      expect(resumeTaskExecution).toHaveBeenCalledTimes(1);
      expect(resumeTaskExecution).toHaveBeenCalledWith(ctx, task);
    });

    it('hands ordinal raw args to the engine untouched (/approve 2 resolves the older task)', async () => {
      const older = buildTask({
        task_id: 'task-older-spine',
        updated_at: OLDER_UPDATED_AT,
      });
      const newer = buildTask({
        task_id: 'task-newer-spine',
        updated_at: NEWER_UPDATED_AT,
      });
      const harness = buildHarness([older, newer]);
      const { controller, resumeTaskExecution } = createController({ taskManager: harness });
      const ctx = buildContext();

      await controller.handleApproval(ctx, '2');

      expect(harness.getRecentTasks).toHaveBeenCalledWith(50, String(USER_ID));
      expect(older.approval_status).toBe('approved');
      expect(newer.approval_status).toBe('pending');
      expect(resumeTaskExecution).toHaveBeenCalledWith(ctx, older);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining(`Short reference: ${older.task_id.substring(0, 8)}`),
      );
    });

    it('rejects through the spine with the pinned rejection reply', async () => {
      const task = buildTask();
      const { controller, resumeTaskExecution } = createController({
        taskManager: buildHarness([task]),
      });
      const ctx = buildContext();

      await controller.handleRejection(ctx, task.task_id);

      expect(ctx.reply).toHaveBeenCalledWith(
        `Done. Task ${task.task_id.substring(0, 8)} was rejected and I will not continue it.`,
      );
      expect(task.approval_status).toBe('rejected');
      expect(resumeTaskExecution).not.toHaveBeenCalled();
    });

    it('blocks non-admin decisions at the spine gate before reaching the engine', async () => {
      (config as Record<string, unknown>).telegramUserRoles = {
        ...originalTelegramUserRoles,
        [String(USER_ID)]: ['vice-owner'],
      };
      const harness = buildHarness([buildTask()]);
      const { controller, resumeTaskExecution } = createController({ taskManager: harness });
      const ctx = buildContext();

      await controller.handleApproval(ctx, 'task-spine-0000001');

      expect(ctx.reply).toHaveBeenCalledWith(
        'Only administrators can decide on approvals/permissions.',
      );
      expect(harness.getTask).not.toHaveBeenCalled();
      expect(resumeTaskExecution).not.toHaveBeenCalled();
    });

    it('blocks approvals while the host is read-only', async () => {
      const task = buildTask();
      const harness = buildHarness([task]);
      const hostIdentityService = {
        getStatus: jest.fn().mockReturnValue({
          authorized: false,
          firstRun: false,
          currentFingerprint: 'fp',
          storedFingerprint: 'stored',
        }),
      };
      const { controller, resumeTaskExecution } = createController({
        taskManager: harness,
        hostIdentityService: hostIdentityService as unknown as HostIdentityService,
      });
      const ctx = buildContext();

      await controller.handleApproval(ctx, '');

      expect(ctx.reply).toHaveBeenCalledWith(
        'New host detected. Zavorth is in read-only mode until /hostauth trust.',
      );
      expect(task.approval_status).toBe('pending');
      expect(resumeTaskExecution).not.toHaveBeenCalled();
    });
  });

  describe('injected spine', () => {
    function createInjectedSpine(options: {
      respond: jest.Mock;
      handleApproval: jest.Mock;
      handleRejection: jest.Mock;
      allowed: boolean;
    }): SurfaceDecisionSpine {
      const spine = new SurfaceDecisionSpine({
        coordinator: new ApprovalCoordinator({
          findPendingApproval: () => null,
          approve: async () => null,
          reject: async () => null,
          listRuns: () => [],
        }),
        scopeMemory: {
          respond: options.respond,
          evaluate: jest.fn().mockReturnValue({
            contractVersion: 1,
            action: 'ask',
            reason: 'ask',
            matchedRule: null,
            satisfiedBy: null,
          }),
        },
        accessGate: async ({ userId }) =>
          options.allowed && userId === String(USER_ID)
            ? { allowed: true }
            : { allowed: false, reason: 'Only administrators can decide on approvals/permissions.' },
      });
      spine.registerDecisionPort(
        'task',
        new TaskDecisionPort({
          handleApproval: options.handleApproval,
          handleRejection: options.handleRejection,
        }),
      );
      return spine;
    }

    it('passes raw args to the engine verbatim and skips spine scope memory', async () => {
      const respond = jest.fn();
      const handleApproval = jest.fn(async (ctx: { reply(text: string): Promise<unknown> }, args: string) => {
        await ctx.reply(`ENGINE:${args}`);
      });
      const handleRejection = jest.fn().mockResolvedValue(undefined);
      const spine = createInjectedSpine({ respond, handleApproval, handleRejection, allowed: true });
      const { controller } = createController({ decisionSpine: spine });
      const ctx = buildContext();

      await controller.handleApproval(ctx, '2');

      expect(handleApproval).toHaveBeenCalledWith(ctx, '2');
      expect(ctx.reply).toHaveBeenCalledWith('ENGINE:2');
      expect(respond).not.toHaveBeenCalled();
    });

    it('enforces the injected gate before any engine call', async () => {
      const respond = jest.fn();
      const handleApproval = jest.fn().mockResolvedValue(undefined);
      const handleRejection = jest.fn().mockResolvedValue(undefined);
      const spine = createInjectedSpine({ respond, handleApproval, handleRejection, allowed: false });
      const { controller, resumeTaskExecution } = createController({ decisionSpine: spine });
      const ctx = buildContext();

      await controller.handleApproval(ctx, 'task-spine-0000001');

      expect(handleApproval).not.toHaveBeenCalled();
      expect(respond).not.toHaveBeenCalled();
      expect(resumeTaskExecution).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(
        'Only administrators can decide on approvals/permissions.',
      );
    });
  });
});
