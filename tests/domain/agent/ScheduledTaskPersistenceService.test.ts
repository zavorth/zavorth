import type { ScheduledTask } from '../../../src/storage/SchedulerRepository.js';
import { ZavorthScheduledTaskPersistenceService } from '../../../src/services/ZavorthScheduledTaskPersistenceService.js';
import {
  ZAVORTH_SCHEDULED_TASK_PERSISTENCE_CONTRACT_VERSION,
} from '../../../src/contracts/ZavorthScheduledTaskPersistenceContract.js';

describe('ZavorthScheduledTaskPersistenceService', () => {
  const now = () => new Date('2026-05-12T12:00:00.000Z');
  const cwd = () => 'C:/TESTES DEV/zavorth-core/Zavorth';

  it('previews governed metadata without SchedulerService persistence', async () => {
    const service = new ZavorthScheduledTaskPersistenceService({ now, cwd });
    const snapshot = await service.buildSnapshot({
      scheduledTask: approvedScheduledTask(),
    });

    expect(snapshot.contractVersion).toBe(ZAVORTH_SCHEDULED_TASK_PERSISTENCE_CONTRACT_VERSION);
    expect(snapshot.status).toBe('preview_ready');
    expect(snapshot.summary.runtimeReady).toBe(true);
    expect(snapshot.summary.taskPersisted).toBe(false);
    expect(snapshot.summary.executionPerformed).toBe(false);
    expect(snapshot.governedMetadata?.approvedScopeHash).toBeTruthy();
  });

  it('persists approved recurring work through SchedulerService metadata', async () => {
    const scheduler = new MemoryScheduler();
    const service = new ZavorthScheduledTaskPersistenceService({ now, cwd, schedulerService: scheduler });
    const snapshot = await service.buildSnapshot({
      action: 'register',
      scheduledTask: approvedScheduledTask(),
    });

    expect(snapshot.status).toBe('persisted');
    expect(snapshot.summary.taskPersisted).toBe(true);
    expect(snapshot.summary.taskGoverned).toBe(true);
    expect(snapshot.task?.guardrail_json).toContain('governedScheduledTask');
    expect(snapshot.task?.budget_json).toContain('maxRuntimeMs');
    expect(scheduler.scheduleTask).toHaveBeenCalledWith(
      expect.any(String),
      'every 15m',
      'owner',
      expect.objectContaining({
        governedScheduledTask: expect.objectContaining({
          phase: 'phase-3-persisted-scheduled-task-registration',
        }),
      }),
    );
  });

  it('does not persist when approval is missing', async () => {
    const scheduler = new MemoryScheduler();
    const service = new ZavorthScheduledTaskPersistenceService({ now, cwd, schedulerService: scheduler });
    const snapshot = await service.buildSnapshot({
      action: 'register',
      scheduledTask: {},
    });

    expect(snapshot.status).toBe('needs_reapproval');
    expect(snapshot.summary.taskPersisted).toBe(false);
    expect(scheduler.scheduleTask).not.toHaveBeenCalled();
  });

  it('pauses, resumes and revokes only governed scheduled tasks', async () => {
    const scheduler = new MemoryScheduler();
    const service = new ZavorthScheduledTaskPersistenceService({ now, cwd, schedulerService: scheduler });
    const registered = await service.buildSnapshot({
      action: 'register',
      scheduledTask: approvedScheduledTask(),
    });

    const taskId = registered.task?.id || '';
    const paused = await service.buildSnapshot({
      action: 'pause',
      taskId,
      scheduledTask: approvedScheduledTask(),
    });
    expect(paused.status).toBe('paused');
    expect(paused.task?.status).toBe('paused');

    const resumed = await service.buildSnapshot({
      action: 'resume',
      taskId,
      scheduledTask: approvedScheduledTask(),
    });
    const revoked = await service.buildSnapshot({
      action: 'revoke',
      taskId,
      scheduledTask: approvedScheduledTask(),
    });

    expect(resumed.status).toBe('resumed');
    expect(resumed.task?.status).toBe('active');
    expect(revoked.status).toBe('revoked');
    expect(scheduler.removeTask).toHaveBeenCalledWith(taskId);
  });

  it('blocks lifecycle actions against legacy non-governed scheduler tasks', async () => {
    const scheduler = new MemoryScheduler();
    const legacy = scheduler.addLegacyTask();
    const service = new ZavorthScheduledTaskPersistenceService({ now, cwd, schedulerService: scheduler });

    const snapshot = await service.buildSnapshot({
      action: 'pause',
      taskId: legacy.id,
      scheduledTask: approvedScheduledTask(),
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.summary.taskGoverned).toBe(false);
  });

  it('reapproves a governed task without changing its command or schedule', async () => {
    const scheduler = new MemoryScheduler();
    const service = new ZavorthScheduledTaskPersistenceService({ now, cwd, schedulerService: scheduler });
    const registered = await service.buildSnapshot({
      action: 'register',
      scheduledTask: approvedScheduledTask(),
    });
    const taskId = registered.task?.id || '';

    const reapproved = await service.buildSnapshot({
      action: 'reapprove',
      taskId,
      scheduledTask: {
        ...approvedScheduledTask('approval-456'),
        command: 'try to change command',
        schedule: 'every 2h',
      },
    });

    expect(reapproved.status).toBe('reapproved');
    expect(reapproved.task?.command).toBe('Enviar resumo operacional');
    expect(reapproved.task?.schedule).toBe('every 15m');
    expect(reapproved.governedMetadata?.approvalId).toBe('approval-456');
    expect(scheduler.updateTaskRuntimeMetadata).toHaveBeenCalledWith(
      taskId,
      expect.objectContaining({
        governedScheduledTask: expect.objectContaining({
          approvalId: 'approval-456',
          approvedScope: expect.objectContaining({
            command: 'Enviar resumo operacional',
          }),
        }),
      }),
    );
  });
});

function approvedScheduledTask(approvalId = 'approval-123') {
  return {
    intent: 'Enviar resumo operacional do workspace',
    command: 'Enviar resumo operacional',
    schedule: 'every 15m',
    workspace: 'C:/TESTES DEV/zavorth-core/Zavorth',
    surface: 'telegram' as const,
    createdBy: 'owner',
    allowedTools: ['web_search'],
    approval: {
      ownerConfirmed: true,
      approvalId,
      approvedBy: 'owner',
    },
  };
}

class MemoryScheduler {
  public readonly scheduleTask = jest.fn((
    command: string,
    schedule: string,
    userId: string,
    options: any = {},
  ): ScheduledTask => {
    const task = this.makeTask(`fixture-task-${this.tasks.size + 1}`, command, schedule, userId, options);
    this.tasks.set(task.id, task);
    return task;
  });
  public readonly pauseTask = jest.fn((id: string): ScheduledTask | null => {
    const task = this.tasks.get(id);
    if (!task) return null;
    task.status = 'paused';
    return task;
  });
  public readonly resumeTask = jest.fn((id: string): ScheduledTask | null => {
    const task = this.tasks.get(id);
    if (!task) return null;
    task.status = 'active';
    return task;
  });
  public readonly removeTask = jest.fn((id: string): boolean => this.tasks.delete(id));
  public readonly updateTaskRuntimeMetadata = jest.fn((id: string, input: any): ScheduledTask | null => {
    const task = this.tasks.get(id);
    if (!task) return null;
    task.budget_json = JSON.stringify(input.budget || {});
    task.guardrail_json = JSON.stringify({
      ...(input.guardrails || {}),
      governedScheduledTask: input.governedScheduledTask || null,
    });
    return task;
  });
  private readonly tasks = new Map<string, ScheduledTask>();

  public findTaskByPrefix(idPrefix: string): ScheduledTask | null {
    return Array.from(this.tasks.values()).find((entry) => entry.id.startsWith(idPrefix)) || null;
  }

  public getTask(id: string): ScheduledTask | null {
    return this.tasks.get(id) || null;
  }

  public addLegacyTask(): ScheduledTask {
    const task = this.makeTask('legacy-task-1', 'legacy', 'every 1h', 'owner', {});
    this.tasks.set(task.id, task);
    return task;
  }

  private makeTask(id: string, command: string, schedule: string, userId: string, options: any): ScheduledTask {
    return {
      id,
      command,
      schedule,
      created_at: '2026-05-12T12:00:00.000Z',
      last_run: null,
      next_run: '2026-05-12T12:15:00.000Z',
      created_by: userId,
      status: 'active',
      intent_text: options.intentText || command,
      delivery: options.delivery || 'app',
      delivery_target: options.deliveryTarget || null,
      last_status: 'idle',
      last_error: null,
      last_result: null,
      run_count: 0,
      failure_count: 0,
      budget_json: JSON.stringify(options.budget || {}),
      guardrail_json: JSON.stringify({
        ...(options.guardrails || {}),
        governedScheduledTask: options.governedScheduledTask || null,
      }),
      paused_reason: null,
      last_failure_at: null,
      consecutive_failures: 0,
    };
  }
}
