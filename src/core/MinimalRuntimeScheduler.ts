import type { MinimalRuntimeEvent, MinimalRuntimeEventBus } from './MinimalRuntimeEventBus.js';
import type { MinimalRuntimeProfile } from './MinimalRuntimeProfileRegistry.js';

export type MinimalRuntimeScheduleMode = 'event' | 'adaptive';

export type MinimalRuntimeScheduledTask = {
  id: string;
  label: string;
  mode: MinimalRuntimeScheduleMode;
  enabled: boolean;
  eventTypes?: string[];
  baseIntervalMs?: number;
  idleIntervalMs?: number;
  pressureIntervalMs?: number;
  run?: (event?: MinimalRuntimeEvent) => void | Promise<void>;
};

export type MinimalRuntimeSchedulerSnapshot = {
  version: 1;
  generatedAt: string;
  profileId: string;
  pollingMode: MinimalRuntimeProfile['pollingMode'];
  maintenanceMode: MinimalRuntimeProfile['maintenanceMode'];
  taskCount: number;
  activeTimers: number;
  eventFirstTasks: number;
  adaptiveTasks: number;
  executions: number;
  failures: number;
  tasks: Array<{
    id: string;
    label: string;
    mode: MinimalRuntimeScheduleMode;
    enabled: boolean;
    active: boolean;
    eventTypes: string[];
    intervalMs: number | null;
    executions: number;
    failures: number;
    lastRunAt: string | null;
  }>;
};

type RegisteredTask = MinimalRuntimeScheduledTask & {
  timer: ReturnType<typeof setInterval> | null;
  intervalMs: number | null;
  executions: number;
  failures: number;
  lastRunAt: string | null;
  unsubscribers: Array<() => void>;
};

export class MinimalRuntimeScheduler {
  private readonly tasks = new Map<string, RegisteredTask>();

  constructor(
    private readonly profile: MinimalRuntimeProfile,
    private readonly eventBus: MinimalRuntimeEventBus,
  ) {}

  public register(task: MinimalRuntimeScheduledTask): void {
    const id = this.normalizeId(task.id);
    if (!id) {
      throw new Error('Scheduled task id is required.');
    }
    this.unregister(id);
    const registered: RegisteredTask = {
      ...task,
      id,
      enabled: task.enabled !== false,
      mode: task.mode,
      eventTypes: Array.isArray(task.eventTypes) ? task.eventTypes.filter(Boolean) : [],
      timer: null,
      intervalMs: null,
      executions: 0,
      failures: 0,
      lastRunAt: null,
      unsubscribers: [],
    };
    this.tasks.set(id, registered);
    this.attachEventTriggers(registered);
  }

  public unregister(id: string): void {
    const task = this.tasks.get(this.normalizeId(id));
    if (!task) {
      return;
    }
    this.stop(task.id);
    for (const unsubscribe of task.unsubscribers) {
      unsubscribe();
    }
    this.tasks.delete(task.id);
  }

  public start(id: string): void {
    const task = this.tasks.get(this.normalizeId(id));
    if (!task || !task.enabled || task.mode !== 'adaptive' || task.timer) {
      return;
    }
    const intervalMs = this.resolveIntervalMs(task);
    if (intervalMs <= 0) {
      return;
    }
    task.intervalMs = intervalMs;
    task.timer = setInterval(() => {
      void this.runTask(task);
    }, intervalMs);
    task.timer.unref?.();
  }

  public stop(id: string): void {
    const task = this.tasks.get(this.normalizeId(id));
    if (!task?.timer) {
      return;
    }
    clearInterval(task.timer);
    task.timer = null;
    task.intervalMs = null;
  }

  public stopAll(): void {
    for (const task of this.tasks.values()) {
      this.stop(task.id);
    }
  }

  public snapshot(): MinimalRuntimeSchedulerSnapshot {
    const tasks = Array.from(this.tasks.values());
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      profileId: this.profile.id,
      pollingMode: this.profile.pollingMode,
      maintenanceMode: this.profile.maintenanceMode,
      taskCount: tasks.length,
      activeTimers: tasks.filter((task) => Boolean(task.timer)).length,
      eventFirstTasks: tasks.filter((task) => task.mode === 'event').length,
      adaptiveTasks: tasks.filter((task) => task.mode === 'adaptive').length,
      executions: tasks.reduce((total, task) => total + task.executions, 0),
      failures: tasks.reduce((total, task) => total + task.failures, 0),
      tasks: tasks.map((task) => ({
        id: task.id,
        label: task.label,
        mode: task.mode,
        enabled: task.enabled,
        active: Boolean(task.timer),
        eventTypes: task.eventTypes || [],
        intervalMs: task.intervalMs,
        executions: task.executions,
        failures: task.failures,
        lastRunAt: task.lastRunAt,
      })),
    };
  }

  private attachEventTriggers(task: RegisteredTask): void {
    for (const eventType of task.eventTypes || []) {
      task.unsubscribers.push(
        this.eventBus.on(eventType, async (event) => {
          if (!task.enabled) {
            return;
          }
          await this.runTask(task, event);
        }),
      );
    }
  }

  private async runTask(task: RegisteredTask, event?: MinimalRuntimeEvent): Promise<void> {
    task.executions += 1;
    task.lastRunAt = new Date().toISOString();
    if (!task.run) {
      return;
    }
    try {
      await task.run(event);
    } catch (error: any) { const err = error; const e = error;
      task.failures += 1;
    }
  }

  private resolveIntervalMs(task: RegisteredTask): number {
    if (this.profile.pollingMode === 'event-first') {
      return Math.max(0, Number(task.pressureIntervalMs || task.idleIntervalMs || 0) || 0);
    }
    if (this.profile.pollingMode === 'dev-watch') {
      return Math.max(0, Number(task.baseIntervalMs || task.idleIntervalMs || 0) || 0);
    }
    return Math.max(0, Number(task.idleIntervalMs || task.baseIntervalMs || 0) || 0);
  }

  private normalizeId(id: string): string {
    return String(id || '').trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
  }
}
