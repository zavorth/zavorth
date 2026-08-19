import { ZavorthScheduledTaskPersistenceService } from './ZavorthScheduledTaskPersistenceService.js';
import type { ScheduledTask } from '../storage/SchedulerRepository.js';
import type {
  SchedulerGovernedScheduledTaskMetadata,
  SchedulerTaskBudget,
  SchedulerTaskGuardrails,
} from './SchedulerService.js';
import type { ZavorthCrossSurfaceProjectionSurface } from '../contracts/ZavorthCrossSurfaceRuntimeProjectionContract.js';
import type { ZavorthScheduledTaskInput } from '../contracts/ZavorthScheduledTaskContract.js';
import {
  ZAVORTH_SCHEDULED_TASK_SURFACE_CONTRACT_VERSION,
  type ZavorthScheduledTaskSurfaceLifecycleInput,
  type ZavorthScheduledTaskSurfaceRegisterInput,
  type ZavorthScheduledTaskSurfaceResult,
  type ZavorthScheduledTaskSurfaceStatus,
  type ZavorthScheduledTaskSurfaceTaskCard,
} from '../contracts/ZavorthScheduledTaskSurfaceContract.js';

import type { ZavorthPersistedScheduledTask } from '../contracts/ZavorthScheduledTaskPersistenceContract.js';
import { logger } from '../logger.js';

type SchedulerSurfaceLike = {
  scheduleTask(
    command: string,
    schedule: string,
    userId: string,
    options?: {
      intentText?: string | null;
      delivery?: ScheduledTask['delivery'];
      deliveryTarget?: string | null;
      budget?: Partial<SchedulerTaskBudget> | null;
      guardrails?: Partial<SchedulerTaskGuardrails> | null;
      governedScheduledTask?: SchedulerGovernedScheduledTaskMetadata | null;
    },
  ): ScheduledTask;
  listTasks?(includePaused?: boolean): ScheduledTask[];
  findTaskByPrefix?(idPrefix: string): ScheduledTask | null;
  getTask?(id: string): ScheduledTask | null;
  pauseTask?(id: string): ScheduledTask | null;
  resumeTask?(id: string): ScheduledTask | null;
  removeTask?(id: string): boolean;
  updateTaskRuntimeMetadata?(
    id: string,
    input: {
      budget?: Partial<SchedulerTaskBudget> | null;
      guardrails?: Partial<SchedulerTaskGuardrails> | null;
      governedScheduledTask?: SchedulerGovernedScheduledTaskMetadata | null;
      pausedReason?: string | null;
    },
  ): ScheduledTask | null;
};

type Runtime = {
  schedulerService?: SchedulerSurfaceLike | null;
  now?: () => Date;
  cwd?: () => string;
};

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class ZavorthScheduledTaskSurfaceService {
  private readonly scheduler: SchedulerSurfaceLike | null;
  private readonly now: () => Date;
  private readonly cwd: () => string;

  public constructor(runtime: Runtime = {}) {
    this.scheduler = runtime.schedulerService || null;
    this.now = runtime.now || (() => new Date());
    this.cwd = runtime.cwd || (() => process.cwd());
  }

  public async register(input: ZavorthScheduledTaskSurfaceRegisterInput): Promise<ZavorthScheduledTaskSurfaceResult> {
    if (!this.scheduler) {
      return this.result({
        action: 'register',
        status: 'blocked',
        summary: 'SchedulerService is unavailable for governed schedule registration.',
        details: ['The surface did not execute any mutation.'],
      });
    }

    const scheduledTask = this.buildRegisterInput(input);
    const persistence = new ZavorthScheduledTaskPersistenceService({
      schedulerService: this.scheduler,
      now: this.now,
      cwd: () => scheduledTask.workspace || this.cwd(),
    });
    const snapshot = await persistence.buildSnapshot({
      action: 'register',
      scheduledTask,
      scheduler: {
        delivery: input.delivery || null,
        deliveryTarget: input.deliveryTarget || null,
      },
    });
    const ok = snapshot.status === 'persisted';
    return this.result({
      action: 'register',
      status: ok ? 'completed' : this.statusFromPersistence(snapshot.status),
      summary: ok ? `Governed schedule created: ${snapshot.task?.id?.split('-')[0] || 'n/a'}.`
        : `Governed schedule blocked: ${snapshot.narrative.operatorSummary}`,
      details: this.detailsFromPersistence(snapshot),
      task: snapshot.task ? this.toTaskCard(snapshot.task) : null,
      persistence: snapshot,
    });
  }

  public list(): ZavorthScheduledTaskSurfaceResult {
    const tasks = this.scheduler?.listTasks?.(true).map((task) => this.toTaskCard(task)) || [];
    return this.result({
      action: 'list',
      status: tasks.length > 0 ? 'completed' : 'empty',
      summary: tasks.length > 0
        ? `${tasks.length} governed schedule(s) found.`
        : 'No governed schedules found.',
      details: tasks.length > 0
        ? tasks.map((task) => `${task.shortId}: ${task.schedule} -> ${task.command} | ${task.governed ? 'governed' : 'legacy'}`)
        : ['Use /schedule with a natural request to create the first governed schedule.'],
      tasks,
    });
  }

  public async lifecycle(input: ZavorthScheduledTaskSurfaceLifecycleInput): Promise<ZavorthScheduledTaskSurfaceResult> {
    if (!this.scheduler) {
      return this.result({
        action: input.action === 'revoke' ? 'revoke' : input.action,
        status: 'blocked',
        summary: 'SchedulerService is unavailable for governed schedule lifecycle.',
        details: ['The surface did not execute any mutation.'],
      });
    }
    const task = this.findTask(input.taskId);
    if (!task) {
      return this.result({
        action: input.action === 'revoke' ? 'revoke' : input.action,
        status: 'blocked',
        summary: 'Schedule not found.',
        details: [`ID informado: ${input.taskId || 'n/d'}.`],
      });
    }

    const scheduledTask = this.buildLifecycleInput(input, task);
    const persistence = new ZavorthScheduledTaskPersistenceService({
      schedulerService: this.scheduler,
      now: this.now,
      cwd: () => scheduledTask.workspace || this.cwd(),
    });
    const snapshot = await persistence.buildSnapshot({
      action: input.action,
      taskId: input.taskId,
      scheduledTask,
    });
    const ok = ['paused', 'resumed', 'revoked', 'reapproved'].includes(snapshot.status);
    return this.result({
      action: input.action === 'revoke' ? 'revoke' : input.action,
      status: ok ? 'completed' : this.statusFromPersistence(snapshot.status),
      summary: ok ? `Lifecycle governado aplicado: ${snapshot.status}.`
        : `Lifecycle governado blocked: ${snapshot.narrative.operatorSummary}`,
      details: this.detailsFromPersistence(snapshot),
      task: snapshot.task ? this.toTaskCard(snapshot.task) : this.toTaskCard(task),
      persistence: snapshot,
    });
  }

  public render(result: ZavorthScheduledTaskSurfaceResult): string {
    const lines = [
      'Agendamentos governados do Zavorth',
      '',
      result.summary,
      ...result.details.map((entry) => `- ${entry}`),
    ];
    if (result.task) {
      lines.push(
        '',
        `ID: ${result.task.shortId}`,
        `Comando: ${result.task.command}`,
        `Frequencia: ${result.task.schedule}`,
        `Governed: ${result.task.governed ? 'yes' : 'no'}`,
      );
    }
    if (result.tasks.length > 0 && !result.task) {
      lines.push('', 'Tarefas:', ...result.tasks.map((task) =>
        `- ${task.shortId}: ${task.schedule} -> ${task.command} | ${task.governed ? 'governado' : 'legado'}`));
    }
    lines.push('', 'Workload execution: not performed in this action.');
    return lines.join('\n');
  }

  private buildRegisterInput(input: ZavorthScheduledTaskSurfaceRegisterInput): ZavorthScheduledTaskInput {
    const requestedBy = clean(input.requestedBy) || 'operator';
    return {
      intent: clean(input.intent) || clean(input.command) || 'scheduled task',
      command: clean(input.command),
      schedule: clean(input.schedule),
      workspace: clean(input.workspace) || this.cwd(),
      surface: input.surface,
      createdBy: requestedBy,
      allowedTools: input.allowedTools || ['scheduled_task_dispatch'],
      budget: {
        maxRuntimeMs: 10 * 60 * 1000,
        maxTokens: 6000,
        maxToolCalls: 8,
        maxNetworkRequests: clampNonNegative(input.maxNetworkRequests, 0),
        maxCommands: clampNonNegative(input.maxCommands, 1),
        maxMutations: clampNonNegative(input.maxMutations, 0),
        maxRetries: 2,
      },
      approval: {
        ownerConfirmed: true,
        approvalId: clean(input.approvalId) || this.buildApprovalId('register', requestedBy),
        approvedBy: clean(input.approvedBy) || requestedBy,
        ttlMs: clampTtl(input.ttlMs),
      },
      policy: {
        requireApproval: true,
        renewalPolicy: 'require_reapproval',
        noCompound: true,
      },
    };
  }

  private buildLifecycleInput(
    input: ZavorthScheduledTaskSurfaceLifecycleInput,
    task: ScheduledTask,
  ): ZavorthScheduledTaskInput {
    const requestedBy = clean(input.requestedBy) || 'operator';
    const metadata = readGovernedMetadata(task);
    return {
      intent: metadata?.approvedScope.intent || task.intent_text || `Lifecycle ${input.action} for schedule`,
      command: task.command,
      schedule: task.schedule,
      workspace: metadata?.approvedScope.workspace || this.cwd(),
      surface: (metadata?.approvedScope.surface as ZavorthCrossSurfaceProjectionSurface) || input.surface,
      createdBy: requestedBy,
      allowedTools: metadata?.approvedScope.allowedTools || ['scheduled_task_dispatch'],
      budget: {
        maxRuntimeMs: metadata?.approvedBudget.maxRuntimeMs || 10 * 60 * 1000,
        maxTokens: metadata?.approvedBudget.maxTokens || 6000,
        maxToolCalls: metadata?.approvedBudget.maxToolCalls || 8,
        maxNetworkRequests: metadata?.approvedBudget.maxNetworkRequests || 0,
        maxCommands: metadata?.approvedBudget.maxCommands || 1,
        maxMutations: metadata?.approvedBudget.maxMutations || 0,
        maxRetries: metadata?.approvedBudget.maxRetries || 2,
      },
      approval: {
        ownerConfirmed: true,
        approvalId: clean(input.approvalId) || this.buildApprovalId(input.action, requestedBy),
        approvedBy: clean(input.approvedBy) || requestedBy,
        ttlMs: clampTtl(input.ttlMs),
      },
      policy: {
        requireApproval: true,
        renewalPolicy: 'require_reapproval',
        noCompound: true,
      },
    };
  }

  private findTask(taskId: string): ScheduledTask | null {
    const normalized = clean(taskId);
    if (!normalized || !this.scheduler) return null;
    return this.scheduler.findTaskByPrefix?.(normalized)
      || this.scheduler.getTask?.(normalized)
      || null;
  }

  private toTaskCard(task: ScheduledTask | ZavorthPersistedScheduledTask): ZavorthScheduledTaskSurfaceTaskCard {
    const metadata = readGovernedMetadata(task);
    return {
      id: task.id,
      shortId: task.id.split('-')[0] || task.id,
      command: task.command,
      schedule: task.schedule,
      status: String(task.status || 'unknown'),
      nextRun: task.next_run || null,
      lastRun: task.last_run || null,
      governed: Boolean(metadata),
      approvalId: metadata?.approvalId || null,
      surface: metadata?.approvedScope.surface || task.delivery || null,
    };
  }

  private detailsFromPersistence(snapshot: NonNullable<ZavorthScheduledTaskSurfaceResult['persistence']>): string[] {
    return [
      `Status de persistencia: ${snapshot.status}.`,
      `Runtime: ${snapshot.runtime.status}.`,
      `Scheduler available: ${snapshot.summary.schedulerAvailable ? 'yes' : 'no'}.`,
      `Governed metadata: ${snapshot.summary.taskGoverned ? 'yes' : 'no'}.`,
      `Approval: ${snapshot.summary.approvalFresh ? 'ok' : 'pending'}.`,
    ];
  }

  private statusFromPersistence(status: string): ZavorthScheduledTaskSurfaceStatus {
    if (status === 'preview_ready') return 'ready';
    if (status === 'needs_reapproval' || status === 'expired') return 'waiting_approval';
    return 'blocked';
  }

  private buildApprovalId(action: string, requestedBy: string): string {
    const safeUser = requestedBy.replace(/[^a-z0-9_.:-]/gi, '-').slice(0, 48) || 'operator';
    return `surface-schedule-${action}-${safeUser}-${this.now().getTime()}`;
  }

  private result(input: {
    action: ZavorthScheduledTaskSurfaceResult['action'];
    status: ZavorthScheduledTaskSurfaceStatus;
    summary: string;
    details: string[];
    task?: ZavorthScheduledTaskSurfaceTaskCard | null;
    tasks?: ZavorthScheduledTaskSurfaceTaskCard[];
    persistence?: ZavorthScheduledTaskSurfaceResult['persistence'];
  }): ZavorthScheduledTaskSurfaceResult {
    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SCHEDULED_TASK_SURFACE_CONTRACT_VERSION,
      source: 'ZavorthScheduledTaskSurfaceService',
      gate: 'governed-scheduled-task-surfaces',
      action: input.action,
      status: input.status,
      ok: input.status === 'completed' || input.status === 'ready' || input.status === 'empty',
      summary: input.summary,
      details: input.details,
      task: input.task || null,
      tasks: input.tasks || [],
      persistence: input.persistence || null,
      safety: {
        usesPersistenceService: true,
        noLegacyDirectSchedulerMutation: true,
        noDirectWorkloadExecution: true,
        approvalEnvelopeRequiredForMutation: true,
        rawSecretsSerialized: false,
      },
      commands: {
        list: '/schedules',
        register: '/schedule <request>',
        revoke: '/unschedule <id>',
        automations: '/automations <request natural>',
      },
    };
  }
}

function readGovernedMetadata(task: ScheduledTask): SchedulerGovernedScheduledTaskMetadata | null {
  try {
    const parsed = task.guardrail_json ? JSON.parse(task.guardrail_json) : null;
    const metadata = parsed?.governedScheduledTask;
    return metadata?.stage === 'checkpoint-3-persisted-scheduled-task-registration' ? metadata : null;
  } catch (error: unknown) {logger.warn('[Zavorth Scheduled Task Surface] JSON parse failed', error); return null; }
}

function clean(value: unknown): string {
  return String(value || '').trim();
}

function clampTtl(value: number | null | undefined): number {
  const numeric = Number(value || DEFAULT_TTL_MS);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_TTL_MS;
  return Math.min(numeric, DEFAULT_TTL_MS);
}

function clampNonNegative(value: number | null | undefined, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Math.floor(numeric);
}
