import { logger } from '../logger.js';
import { tService } from '../i18n/services.js';
import { safeParseInt } from '../utils/number.js';
import { v4 as uuidv4 } from 'uuid';
import { SchedulerRepository, type ScheduledTask } from '../storage/SchedulerRepository.js';
import type { ZavorthAutomationDeliveryService } from './ZavorthAutomationDeliveryService.js';
import { RuntimeProfileService } from './RuntimeProfileService.js';
import {
  nextRunFromNaturalSchedule,
  parseNaturalSchedule,
  parseNaturalScheduleAsync,
} from './scheduling/NaturalScheduleParser.js';

export type SchedulerDispatchResult = {
  summary?: string | null;
  deliveredVia?: string[] | null;
};

export type SchedulerTaskBudget = {
  maxRuntimeMs: number;
  maxMemoryMb: number;
  retries: number;
  backoffMs: number;
  maxConcurrentRuns: number;
  maxPerTaskConcurrentRuns: number;
  maintenanceWindows: Array<{
    label: string;
    start: string;
    end: string;
    timezone: 'local';
    heavyTasksOnly: boolean;
  }>;
};

export type SchedulerTaskGuardrails = {
  autoPauseAfterConsecutiveFailures: number;
  idempotencyKeySeed: string;
  outboxTtlMs: number;
  outboxMaxBytes: number;
  pauseCreatesInboxNotice: boolean;
  governedScheduledTask?: SchedulerGovernedScheduledTaskMetadata | null;
};

export type SchedulerTaskRuntimeDescriptor = {
  budget: SchedulerTaskBudget;
  guardrails: SchedulerTaskGuardrails;
  autoPause: {
    threshold: number;
    consecutiveFailures: number;
    paused: boolean;
    pausedReason: string | null;
    lastFailureAt: string | null;
  };
};

export type SchedulerGovernedScheduledTaskMetadata = {
  contractVersion: string;
  gate: 'persisted-scheduled-task-registration';
  registryStatus: string;
  approvalId: string | null;
  approvalExpiresAt: string | null;
  approvalVerificationReason: string;
  approvedScopeHash: string;
  approvedScope: {
    intent: string;
    command: string;
    workspace: string;
    surface: string;
    createdBy: string;
    allowedTools: string[];
  };
  approvedBudget: {
    maxRuntimeMs: number;
    maxTokens: number;
    maxToolCalls: number;
    maxNetworkRequests: number;
    maxCommands: number;
    maxMutations: number;
    maxRetries: number;
  };
  renewalPolicy: string;
  receipts: Array<{
    id: string;
    kind: string;
    status: string;
  }>;
  persistedAt: string;
  executionGatewayRequired: true;
  noDirectToolDispatch: true;
};

export type CommandDispatcher = (
  command: string,
  userId: string,
  task?: ScheduledTask,
) => Promise<SchedulerDispatchResult | void>;

export type ScheduleParserResult = {
  kind: 'interval' | 'calendar_day' | 'calendar_week' | 'cron';
  normalized: string;
  label: string;
  cron?: string;
};

/**
 * SchedulerService recurring task runner.
 * Natural-language schedule understanding belongs to the LLM resolver.
 * Persisted schedules use the canonical JSON schedule contract.
 */
export class SchedulerService {
  private timer: NodeJS.Timeout | null = null;
  private dispatcher: CommandDispatcher | null = null;
  private readonly deliveryService: (
    Pick<ZavorthAutomationDeliveryService, 'deliver'>
    & Partial<Pick<ZavorthAutomationDeliveryService, 'recordSystemNotice'>>
  ) | null;
  private readonly runtimeProfile: Pick<RuntimeProfileService, 'getProfile' | 'supportsRecurringAutomation'>;
  private readonly maxConcurrentRuns: number;
  private readonly maxTaskRuntimeMs: number;
  private readonly maxTaskMemoryMb: number;
  private readonly maxRetries: number;
  private readonly backoffMs: number;
  private runningCount = 0;
  private readonly runningTaskIds = new Set<string>();

  constructor(
    private repo: SchedulerRepository,
    runtime: {
      deliveryService?: (
        Pick<ZavorthAutomationDeliveryService, 'deliver'>
        & Partial<Pick<ZavorthAutomationDeliveryService, 'recordSystemNotice'>>
      ) | null;
      runtimeProfileService?: Pick<RuntimeProfileService, 'getProfile' | 'supportsRecurringAutomation'>;
      maxConcurrentRuns?: number;
      maxTaskRuntimeMs?: number;
      maxTaskMemoryMb?: number;
      maxRetries?: number;
      backoffMs?: number;
    } = {},
  ) {
    this.deliveryService = runtime.deliveryService || null;
    this.runtimeProfile = runtime.runtimeProfileService || new RuntimeProfileService();
    const profile = this.runtimeProfile.getProfile();
    this.maxConcurrentRuns = Math.max(1, Math.min(runtime.maxConcurrentRuns || (profile === 'full' ? 2 : 1), 2));
    this.maxTaskRuntimeMs = Math.max(5_000, Math.min(runtime.maxTaskRuntimeMs || 10 * 60 * 1000, 60 * 60 * 1000));
    this.maxTaskMemoryMb = Math.max(64, Math.min(runtime.maxTaskMemoryMb || 256, 4096));
    this.maxRetries = Math.max(0, Math.min(runtime.maxRetries || 2, 5));
    this.backoffMs = Math.max(1_000, Math.min(runtime.backoffMs || 30 * 1000, 10 * 60 * 1000));
  }

  public start(dispatcher: CommandDispatcher): void {
    if (!this.runtimeProfile.supportsRecurringAutomation()) {
      this.dispatcher = dispatcher;
      logger.info('SchedulerService in preview mode: core profile does not start recurring loop.');
      return;
    }
    this.dispatcher = dispatcher;

    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, 30000);
    this.timer.unref?.();
    logger.info('SchedulerService iniciado.');
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public scheduleTask(
    command: string,
    schedule: string,
    userId: string,
    options: {
      intentText?: string | null;
      delivery?: ScheduledTask['delivery'];
      deliveryTarget?: string | null;
      budget?: Partial<SchedulerTaskBudget> | null;
      guardrails?: Partial<SchedulerTaskGuardrails> | null;
      governedScheduledTask?: SchedulerGovernedScheduledTaskMetadata | null;
    } = {},
  ): ScheduledTask {
    const parsed = this.parseSchedule(schedule);
    if (!parsed) {
      throw new Error('Invalid schedule payload. Provide a canonical JSON schedule produced by the schedule resolver.');
    }

    return this.createTaskFromParsedSchedule(command, parsed, userId, options);
  }

  public async scheduleTaskAsync(
    command: string,
    schedule: string,
    userId: string,
    options: {
      intentText?: string | null;
      delivery?: ScheduledTask['delivery'];
      deliveryTarget?: string | null;
      budget?: Partial<SchedulerTaskBudget> | null;
      guardrails?: Partial<SchedulerTaskGuardrails> | null;
      governedScheduledTask?: SchedulerGovernedScheduledTaskMetadata | null;
    } = {},
  ): Promise<ScheduledTask> {
    const parsed = await this.parseScheduleAsync(schedule);
    if (!parsed) {
      throw new Error('Invalid schedule payload. Provide a canonical JSON schedule or connect a schedule resolver for natural language.');
    }

    return this.createTaskFromParsedSchedule(command, parsed, userId, options);
  }

  private createTaskFromParsedSchedule(
    command: string,
    parsed: ScheduleParserResult,
    userId: string,
    options: {
      intentText?: string | null;
      delivery?: ScheduledTask['delivery'];
      deliveryTarget?: string | null;
      budget?: Partial<SchedulerTaskBudget> | null;
      guardrails?: Partial<SchedulerTaskGuardrails> | null;
      governedScheduledTask?: SchedulerGovernedScheduledTaskMetadata | null;
    },
  ): ScheduledTask {
    const nextRun = this.calculateNextRun(parsed.normalized, new Date());
    if (!nextRun) {
      throw new Error('Could not calculate the next schedule execution.');
    }

    const task: ScheduledTask = {
      id: uuidv4(),
      command,
      schedule: parsed.normalized,
      created_at: new Date().toISOString(),
      last_run: null,
      next_run: nextRun.toISOString(),
      created_by: userId,
      status: 'active',
      intent_text: String(options.intentText || '').trim() || command,
      delivery: options.delivery || 'app',
      delivery_target: String(options.deliveryTarget || '').trim() || null,
      last_status: 'idle',
      last_error: null,
      last_result: null,
      run_count: 0,
      failure_count: 0,
      budget_json: JSON.stringify(this.buildBudget(options.budget || null)),
      guardrail_json: JSON.stringify(this.buildGuardrails(
        command,
        parsed.normalized,
        userId,
        options.guardrails || null,
        options.governedScheduledTask || null,
      )),
      paused_reason: null,
      last_failure_at: null,
      consecutive_failures: 0,
    };

    this.repo.createTask(task);
    return task;
  }

  public updateTaskRuntimeMetadata(
    id: string,
    input: {
      budget?: Partial<SchedulerTaskBudget> | null;
      guardrails?: Partial<SchedulerTaskGuardrails> | null;
      governedScheduledTask?: SchedulerGovernedScheduledTaskMetadata | null;
      pausedReason?: string | null;
    },
  ): ScheduledTask | null {
    const task = this.repo.getTask(id);
    if (!task) {
      return null;
    }
    const budget = this.buildBudget({
      ...this.parseBudget(task.budget_json),
      ...(input.budget || {}),
    });
    const existingGuardrails = this.parseGuardrails(
      task.guardrail_json,
      task.command,
      task.schedule,
      task.created_by || 'system',
    );
    const guardrails = this.buildGuardrails(
      task.command,
      task.schedule,
      task.created_by || 'system',
      {
        ...existingGuardrails,
        ...(input.guardrails || {}),
      },
      input.governedScheduledTask === undefined
        ? existingGuardrails.governedScheduledTask || null
        : input.governedScheduledTask,
    );
    this.repo.updateRuntimeMetadata(id, {
      budgetJson: JSON.stringify(budget),
      guardrailJson: JSON.stringify(guardrails),
      pausedReason: input.pausedReason,
    });
    return this.getTask(id);
  }

  public listTasks(includePaused = true): ScheduledTask[] {
    const tasks = includePaused ? this.repo.listTasks() : this.repo.listActiveTasks();
    return tasks.map((entry) => ({ ...entry }));
  }

  public getTask(id: string): ScheduledTask | null {
    const task = this.repo.getTask(id);
    return task ? { ...task } : null;
  }

  public findTaskByPrefix(idPrefix: string): ScheduledTask | null {
    const normalizedPrefix = String(idPrefix || '').trim().toLowerCase();
    if (!normalizedPrefix) {
      return null;
    }
    return this.listTasks(true).find((entry) => hasPrefix(entry.id.toLowerCase(), normalizedPrefix)) || null;
  }

  public pauseTask(id: string, reason?: string | null): ScheduledTask | null {
    const task = this.repo.getTask(id);
    if (!task) {
      return null;
    }
    this.repo.updateStatus(id, 'paused', reason);
    return this.getTask(id);
  }

  public resumeTask(id: string): ScheduledTask | null {
    const task = this.repo.getTask(id);
    if (!task) {
      return null;
    }
    this.repo.updateStatus(id, 'active');
    return this.getTask(id);
  }

  public async manualTrigger(taskId: string): Promise<{ ok: boolean; message: string }> {
    const task = this.repo.getTask(taskId) || this.findTaskByPrefix(taskId);
    if (!task) {
      return { ok: false, message: `Scheduled task not found: ${taskId}` };
    }
    if (!this.dispatcher) {
      return { ok: false, message: 'Scheduler is not running' };
    }
    if (this.runningTaskIds.has(task.id)) {
      return { ok: false, message: `Task ${task.id} is already running` };
    }
    const runtime = this.describeTaskRuntime(task);
    this.runningCount += 1;
    this.runningTaskIds.add(task.id);
    try {
      const result = await this.runWithTimeout(
        this.dispatcher(task.command, task.created_by || 'system', task),
        runtime.budget.maxRuntimeMs,
      );
      const summary = result && typeof result === 'object' ? result.summary : result;
      const message = String(summary || '').trim() || 'Task executed successfully';
      return { ok: true, message };
    } catch (error: unknown) {
      return { ok: false, message: this.extractErrorMessage(error) };
    } finally {
      this.runningCount = Math.max(0, this.runningCount - 1);
      this.runningTaskIds.delete(task.id);
    }
  }

  public removeTask(id: string): boolean {
    const task = this.repo.getTask(id);
    if (!task) {
      return false;
    }
    this.repo.deleteTask(id);
    return true;
  }

  public parseSchedule(schedule: string): ScheduleParserResult | null {
    const parsed = parseNaturalSchedule(schedule);
    return this.toScheduleParserResult(parsed);
  }

  public async parseScheduleAsync(schedule: string): Promise<ScheduleParserResult | null> {
    const parsed = await parseNaturalScheduleAsync(schedule);
    return this.toScheduleParserResult(parsed);
  }

  private toScheduleParserResult(
    parsed: ReturnType<typeof parseNaturalSchedule>,
  ): ScheduleParserResult | null {
    if (!parsed) return null;
    if (parsed.kind === 'interval') {
      return {
        kind: 'interval',
        normalized: parsed.normalized,
        label: parsed.label,
        cron: parsed.cron || undefined,
      };
    }
    if (parsed.kind === 'calendar_day') {
      return {
        kind: 'calendar_day',
        normalized: parsed.normalized,
        label: parsed.label,
        cron: parsed.cron || undefined,
      };
    }
    if (parsed.kind === 'calendar_week') {
      return {
        kind: 'calendar_week',
        normalized: parsed.normalized,
        label: parsed.label,
        cron: parsed.cron || undefined,
      };
    }
    if (parsed.kind === 'one_shot') {
      return null;
    }
    return {
      kind: 'cron',
      normalized: parsed.normalized,
      label: parsed.label,
      cron: parsed.cron || undefined,
    };
  }

  public describeSchedule(schedule: string): string {
    const parsed = this.parseSchedule(schedule);
    return parsed?.label || schedule;
  }

  public describeTaskRuntime(task: ScheduledTask): SchedulerTaskRuntimeDescriptor {
    const guardrails = this.parseGuardrails(task.guardrail_json, task.command, task.schedule, task.created_by || 'system');
    return {
      budget: this.parseBudget(task.budget_json),
      guardrails,
      autoPause: {
        threshold: guardrails.autoPauseAfterConsecutiveFailures,
        consecutiveFailures: Number(task.consecutive_failures || 0),
        paused: task.status === 'paused',
        pausedReason: task.paused_reason || null,
        lastFailureAt: task.last_failure_at || null,
      },
    };
  }

  private async tick(): Promise<void> {
    if (!this.dispatcher) {
      return;
    }

    try {
      const tasks = this.repo.listActiveTasks();
      const now = new Date();

      for (const task of tasks) {
        if (!task.next_run || new Date(task.next_run) > now) {
          continue;
        }
        if (this.runningCount >= this.maxConcurrentRuns) {
          continue;
        }
        if (this.runningTaskIds.has(task.id)) {
          continue;
        }

        const nextRunDate = this.calculateNextRun(
          task.schedule,
          new Date(task.next_run || now.toISOString()),
        );
        const nextRun = nextRunDate ? nextRunDate.toISOString() : null;
        const currentRunCount = Number(task.run_count || 0) + 1;
        const runtime = this.describeTaskRuntime(task);
        this.runningCount += 1;
        this.runningTaskIds.add(task.id);
        try {
          const result = await this.runWithTimeout(
            this.dispatcher(task.command, task.created_by || 'system', task),
            runtime.budget.maxRuntimeMs,
          );
          const summary = result && typeof result === 'object' ? result.summary : null;
          if (task.delivery && task.delivery !== 'telegram' && this.deliveryService) {
            this.deliveryService.deliver(task, summary);
          }
          this.repo.updateLastRun(task.id, {
            lastRun: now.toISOString(),
            nextRun,
            lastStatus: 'completed',
            lastError: null,
            lastResult: String(summary || '').trim() || null,
            runCount: currentRunCount,
            failureCount: Number(task.failure_count || 0),
            lastFailureAt: null,
            consecutiveFailures: 0,
          });
        } catch (error: unknown) {const consecutiveFailures = Number(task.consecutive_failures || 0) + 1;
          const shouldAutoPause = consecutiveFailures >= runtime.guardrails.autoPauseAfterConsecutiveFailures;
          this.repo.updateLastRun(task.id, {
            lastRun: now.toISOString(),
            nextRun,
            lastStatus: 'failed',
            lastError: this.extractErrorMessage(error),
            lastResult: null,
            runCount: currentRunCount,
            failureCount: Number(task.failure_count || 0) + 1,
            lastFailureAt: now.toISOString(),
            consecutiveFailures,
          });
          if (shouldAutoPause) {
            const pausedReason = `auto-paused after ${runtime.guardrails.autoPauseAfterConsecutiveFailures} consecutive failures`;
            this.repo.updateStatus(task.id, 'paused', pausedReason);
            this.deliveryService?.recordSystemNotice?.({
              taskId: task.id,
              prompt: task.intent_text || task.command,
              summary: tService('scheduler_runtime.auto_paused', {
                reason: pausedReason,
                error: this.extractErrorMessage(error),
              }),
            });
          }
          logger.error(tService('scheduler_runtime.trigger_failed', { id: task.id }), error);
        } finally {
          this.runningCount = Math.max(0, this.runningCount - 1);
          this.runningTaskIds.delete(task.id);
        }
      }
    } catch (error: unknown) {logger.error(tService('scheduler_runtime.tick_error'), error);
    }
  }

  private calculateNextRun(schedule: string, fromDate: Date = new Date()): Date | null {
    const natural = parseNaturalSchedule(schedule, fromDate);
    if (!natural) {
      return null;
    }
    return nextRunFromNaturalSchedule(natural, fromDate);
  }

  private buildDefaultBudget(): SchedulerTaskBudget {
    return {
      maxRuntimeMs: this.maxTaskRuntimeMs,
      maxMemoryMb: this.maxTaskMemoryMb,
      retries: this.maxRetries,
      backoffMs: this.backoffMs,
      maxConcurrentRuns: this.maxConcurrentRuns,
      maxPerTaskConcurrentRuns: 1,
      maintenanceWindows: [
        {
          label: 'default-nightly-maintenance',
          start: '04:00',
          end: '06:00',
          timezone: 'local',
          heavyTasksOnly: true,
        },
      ],
    };
  }

  private buildBudget(input: Partial<SchedulerTaskBudget> | null | undefined): SchedulerTaskBudget {
    const defaults = this.buildDefaultBudget();
    return {
      maxRuntimeMs: this.toBoundedNumber(input?.maxRuntimeMs, defaults.maxRuntimeMs, 5_000, 60 * 60 * 1000),
      maxMemoryMb: this.toBoundedNumber(input?.maxMemoryMb, defaults.maxMemoryMb, 64, 4096),
      retries: this.toBoundedNumber(input?.retries, defaults.retries, 0, 5),
      backoffMs: this.toBoundedNumber(input?.backoffMs, defaults.backoffMs, 1_000, 10 * 60 * 1000),
      maxConcurrentRuns: this.toBoundedNumber(input?.maxConcurrentRuns, defaults.maxConcurrentRuns, 1, 2),
      maxPerTaskConcurrentRuns: this.toBoundedNumber(input?.maxPerTaskConcurrentRuns, 1, 1, 1),
      maintenanceWindows: Array.isArray(input?.maintenanceWindows) && input.maintenanceWindows.length > 0
        ? input.maintenanceWindows.slice(0, 3)
        : defaults.maintenanceWindows,
    };
  }

  private buildDefaultGuardrails(command: string, schedule: string, userId: string): SchedulerTaskGuardrails {
    return {
      autoPauseAfterConsecutiveFailures: 3,
      idempotencyKeySeed: `task:${command}:${schedule}:${userId}`,
      outboxTtlMs: 7 * 24 * 60 * 60 * 1000,
      outboxMaxBytes: 100 * 1024 * 1024,
      pauseCreatesInboxNotice: true,
      governedScheduledTask: null,
    };
  }

  private buildGuardrails(
    command: string,
    schedule: string,
    userId: string,
    input: Partial<SchedulerTaskGuardrails> | null | undefined,
    governedScheduledTask: SchedulerGovernedScheduledTaskMetadata | null,
  ): SchedulerTaskGuardrails {
    const defaults = this.buildDefaultGuardrails(command, schedule, userId);
    return {
      autoPauseAfterConsecutiveFailures: this.toBoundedNumber(
        input?.autoPauseAfterConsecutiveFailures,
        defaults.autoPauseAfterConsecutiveFailures,
        1,
        10,
      ),
      idempotencyKeySeed: String(input?.idempotencyKeySeed || defaults.idempotencyKeySeed).trim(),
      outboxTtlMs: this.toBoundedNumber(input?.outboxTtlMs, defaults.outboxTtlMs, 60_000, 30 * 24 * 60 * 60 * 1000),
      outboxMaxBytes: this.toBoundedNumber(input?.outboxMaxBytes, defaults.outboxMaxBytes, 1024, 500 * 1024 * 1024),
      pauseCreatesInboxNotice: input?.pauseCreatesInboxNotice !== false,
      governedScheduledTask,
    };
  }

  private parseBudget(rawValue: unknown): SchedulerTaskBudget {
    const parsed = this.parseJsonObject(rawValue);
    const defaults = this.buildDefaultBudget();
    return {
      maxRuntimeMs: this.toBoundedNumber(parsed.maxRuntimeMs, defaults.maxRuntimeMs, 5_000, 60 * 60 * 1000),
      maxMemoryMb: this.toBoundedNumber(parsed.maxMemoryMb, defaults.maxMemoryMb, 64, 4096),
      retries: this.toBoundedNumber(parsed.retries, defaults.retries, 0, 5),
      backoffMs: this.toBoundedNumber(parsed.backoffMs, defaults.backoffMs, 1_000, 10 * 60 * 1000),
      maxConcurrentRuns: this.toBoundedNumber(parsed.maxConcurrentRuns, defaults.maxConcurrentRuns, 1, 2),
      maxPerTaskConcurrentRuns: this.toBoundedNumber(parsed.maxPerTaskConcurrentRuns, 1, 1, 1),
      maintenanceWindows: Array.isArray(parsed.maintenanceWindows) && parsed.maintenanceWindows.length > 0
        ? parsed.maintenanceWindows.slice(0, 3).map((entry: Record<string, unknown>) => ({
          label: String(entry?.label || 'maintenance').trim(),
          start: String(entry?.start || '04:00').trim(),
          end: String(entry?.end || '06:00').trim(),
          timezone: 'local' as const,
          heavyTasksOnly: entry?.heavyTasksOnly !== false,
        }))
        : defaults.maintenanceWindows,
    };
  }

  private parseGuardrails(
    rawValue: unknown,
    command: string,
    schedule: string,
    userId: string,
  ): SchedulerTaskGuardrails {
    const parsed = this.parseJsonObject(rawValue);
    const defaults = this.buildDefaultGuardrails(command, schedule, userId);
    return {
      autoPauseAfterConsecutiveFailures: this.toBoundedNumber(
        parsed.autoPauseAfterConsecutiveFailures,
        defaults.autoPauseAfterConsecutiveFailures,
        1,
        10,
      ),
      idempotencyKeySeed: String(parsed.idempotencyKeySeed || defaults.idempotencyKeySeed).trim(),
      outboxTtlMs: this.toBoundedNumber(parsed.outboxTtlMs, defaults.outboxTtlMs, 60_000, 30 * 24 * 60 * 60 * 1000),
      outboxMaxBytes: this.toBoundedNumber(parsed.outboxMaxBytes, defaults.outboxMaxBytes, 1024, 500 * 1024 * 1024),
      pauseCreatesInboxNotice: parsed.pauseCreatesInboxNotice !== false,
      governedScheduledTask: this.parseGovernedScheduledTaskMetadata(parsed.governedScheduledTask),
    };
  }

  private parseGovernedScheduledTaskMetadata(value: unknown): SchedulerGovernedScheduledTaskMetadata | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const record = value as Record<string, unknown>;
    if (
      typeof record.contractVersion !== 'string'
      || record.gate !== 'persisted-scheduled-task-registration'
      || typeof record.approvedScopeHash !== 'string'
      || !record.approvedScope
      || !record.approvedBudget
    ) {
      return null;
    }
    return record as SchedulerGovernedScheduledTaskMetadata;
  }

  private parseJsonObject(rawValue: unknown): Record<string, unknown> {
    if (rawValue && typeof rawValue === 'object') {
      return rawValue as Record<string, unknown>;
    }
    try {
      const parsed = JSON.parse(String(rawValue || '{}'));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error: unknown) {logger.warn('[SchedulerService] JSON parse failed', error); return {}; }
  }

  private toBoundedNumber(value: unknown, fallback: number, min: number, max: number): number {
    const numeric = Number(value);
    const candidate = Number.isFinite(numeric) ? numeric : fallback;
    return Math.max(min, Math.min(Math.round(candidate), max));
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: NodeJS.Timeout | null = null;
    return new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Automation run exceeded budget maxRuntimeMs=${timeoutMs}.`));
      }, timeoutMs);
      timer.unref?.();
      promise
        .then(resolve)
        .catch(reject)
        .finally(() => {
          if (timer) {
            clearTimeout(timer);
          }
        });
    });
  }
}

function hasPrefix(value: string, prefix: string): boolean {
  if (prefix.length > value.length) {
    return false;
  }
  for (let index = 0; index < prefix.length; index += 1) {
    if (value.charAt(index) !== prefix.charAt(index)) {
      return false;
    }
  }
  return true;
}
