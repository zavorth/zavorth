import type { ScheduledTask } from '../../../src/storage/SchedulerRepository.js';
import { ZavorthScheduledTaskSurfaceService } from '../../../src/services/ZavorthScheduledTaskSurfaceService.js';


describe('ZavorthScheduledTaskSurfaceService', () => {
  const now = () => new Date('2026-05-12T10:00:00.000Z');

  it('registers an explicit surface schedule through the governed persistence service', async () => {
    const scheduler = new MemoryScheduler();
    const service = new ZavorthScheduledTaskSurfaceService({ schedulerService: scheduler, now });

    const result = await service.register({
      intent: 'status recorrente',
      command: '/status',
      schedule: 'every 1h',
      requestedBy: 'u1',
      surface: 'telegram',
      approvalId: 'surface-approval-1',
      approvedBy: 'u1',
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('completed');
    expect(result.persistence?.status).toBe('persisted');
    expect(scheduler.scheduleTask).toHaveBeenCalledWith(
      '/status',
      'every 1h',
      'u1',
      expect.objectContaining({
        governedScheduledTask: expect.objectContaining({
          stage: 'checkpoint-3-persisted-scheduled-task-registration',
          approvalId: 'surface-approval-1',
        }),
      }),
    );
  });

  it('lists governed and legacy tasks without mutating them', () => {
    const scheduler = new MemoryScheduler();
    scheduler.addLegacyTask();
    scheduler.addGovernedTask();
    const service = new ZavorthScheduledTaskSurfaceService({ schedulerService: scheduler, now });

    const result = service.list();

    expect(result.ok).toBe(true);
    expect(result.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ governed: false }),
      expect.objectContaining({ governed: true }),
    ]));
    expect(scheduler.removeTask).not.toHaveBeenCalled();
  });

  it('revokes only governed scheduled tasks through lifecycle persistence', async () => {
    const scheduler = new MemoryScheduler();
    const legacy = scheduler.addLegacyTask();
    const governed = scheduler.addGovernedTask();
    const service = new ZavorthScheduledTaskSurfaceService({ schedulerService: scheduler, now });

    const blocked = await service.lifecycle({
      action: 'revoke',
      taskId: legacy.id,
      requestedBy: 'u1',
      surface: 'telegram',
      approvalId: 'surface-revoke-1',
    });
    const revoked = await service.lifecycle({
      action: 'revoke',
      taskId: governed.id,
      requestedBy: 'u1',
      surface: 'telegram',
      approvalId: 'surface-revoke-2',
    });

    expect(blocked.ok).toBe(false);
    expect(blocked.status).toBe('blocked');
    expect(revoked.ok).toBe(true);
    expect(revoked.persistence?.status).toBe('revoked');
    expect(scheduler.removeTask).toHaveBeenCalledWith(governed.id);
    expect(scheduler.removeTask).not.toHaveBeenCalledWith(legacy.id);
  });
});

class MemoryScheduler {
  private readonly tasks = new Map<string, ScheduledTask>();

  public readonly scheduleTask = jest.fn((
    command: string,
    schedule: string,
    userId: string,
    options: any = {},
  ): ScheduledTask => {
    const task = this.makeTask(`task-${this.tasks.size + 1}`, command, schedule, userId, options);
    this.tasks.set(task.id, task);
    return task;
  });

  public readonly removeTask = jest.fn((id: string): boolean => this.tasks.delete(id));

  public listTasks(): ScheduledTask[] {
    return [...this.tasks.values()];
  }

  public findTaskByPrefix(idPrefix: string): ScheduledTask | null {
    return this.listTasks().find((task) => task.id.startsWith(idPrefix)) || null;
  }

  public getTask(id: string): ScheduledTask | null {
    return this.tasks.get(id) || null;
  }

  public pauseTask(id: string): ScheduledTask | null {
    const task = this.getTask(id);
    if (task) task.status = 'paused';
    return task;
  }

  public resumeTask(id: string): ScheduledTask | null {
    const task = this.getTask(id);
    if (task) task.status = 'active';
    return task;
  }

  public updateTaskRuntimeMetadata(id: string, input: any): ScheduledTask | null {
    const task = this.getTask(id);
    if (!task) return null;
    task.budget_json = JSON.stringify(input.budget || {});
    task.guardrail_json = JSON.stringify({
      ...(input.guardrails || {}),
      governedScheduledTask: input.governedScheduledTask || null,
    });
    return task;
  }

  public addLegacyTask(): ScheduledTask {
    const task = this.makeTask(`legacy-${this.tasks.size + 1}`, '/status', 'every 1h', 'u1', {});
    this.tasks.set(task.id, task);
    return task;
  }

  public addGovernedTask(): ScheduledTask {
    const task = this.makeTask(`governed-${this.tasks.size + 1}`, '/status', 'every 1h', 'u1', {
      governedScheduledTask: governedMetadata(),
    });
    this.tasks.set(task.id, task);
    return task;
  }

  private makeTask(id: string, command: string, schedule: string, userId: string, options: any): ScheduledTask {
    return {
      id,
      command,
      schedule,
      created_at: '2026-05-12T10:00:00.000Z',
      last_run: null,
      next_run: '2026-05-12T11:00:00.000Z',
      created_by: userId,
      status: 'active',
      last_status: 'idle',
      last_error: null,
      consecutive_failures: 0,
      paused_reason: null,
      delivery: 'telegram',
      delivery_target: null,
      intent_text: command,
      budget_json: JSON.stringify(options.budget || {}),
      guardrail_json: JSON.stringify({
        ...(options.guardrails || {}),
        governedScheduledTask: options.governedScheduledTask || null,
      }),
    };
  }
}

function governedMetadata() {
  return {
    contractVersion: '2026-05-12.persisted-scheduled-task-registration-checkpoint-3',
    stage: 'checkpoint-3-persisted-scheduled-task-registration',
    registryStatus: 'active',
    approvalId: 'existing-approval',
    approvalExpiresAt: '2026-05-19T10:00:00.000Z',
    approvalVerificationReason: 'valid',
    approvedScopeHash: 'hash',
    approvedScope: {
      intent: 'status recorrente',
      command: '/status',
      workspace: __dirname,
      surface: 'telegram',
      createdBy: 'u1',
      allowedTools: ['scheduled_task_dispatch'],
    },
    approvedBudget: {
      maxRuntimeMs: 600000,
      maxTokens: 6000,
      maxToolCalls: 8,
      maxNetworkRequests: 0,
      maxCommands: 1,
      maxMutations: 0,
      maxRetries: 2,
    },
    renewalPolicy: 'require_reapproval',
    receipts: [],
    persistedAt: '2026-05-12T10:00:00.000Z',
    executionGatewayRequired: true,
    noDirectToolDispatch: true,
  };
}
