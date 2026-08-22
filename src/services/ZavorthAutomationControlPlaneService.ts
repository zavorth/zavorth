import { config } from '../config/index.js';
import { Database } from '../storage/Database.js';
import { SchedulerRepository, type ScheduledTask } from '../storage/SchedulerRepository.js';
import { ZavorthAutomationDeliveryService, type AutomationOutboxStatus } from './ZavorthAutomationDeliveryService.js';
import { MaintenanceAutomationService, type MaintenanceAutomationStatus } from './MaintenanceAutomationService.js';
import { OperationsActionService } from './OperationsActionService.js';
import { RuntimeProfileService } from './RuntimeProfileService.js';
import { SchedulerService } from './SchedulerService.js';
import type { SchedulerTaskRuntimeDescriptor } from './SchedulerService.js';
import { ZavorthScheduledTaskOperationalGuardService } from './ZavorthScheduledTaskOperationalGuardService.js';
import type { ZavorthScheduledTaskOperationalGuardSnapshot } from '../contracts/ZavorthScheduledTaskOperationalGuardContract.js';
import { LogRepository } from '../storage/LogRepository.js';
import { logger } from '../logger.js';

type AutomationPosture = 'healthy' | 'attention' | 'critical';
type AutomationSeverity = 'info' | 'warn' | 'critical';

type AutomationDeps = {
  now?: () => Date;
  workspaceRoot?: string | null;
  deliveryService?: Pick<ZavorthAutomationDeliveryService, 'readRecent'> & Partial<Pick<ZavorthAutomationDeliveryService, 'readOutboxStatus'>> | null;
  runtimeProfileService?: Pick<RuntimeProfileService, 'getProfile' | 'supportsRecurringAutomation'> | null;
  loadSchedulerService?: () => Promise<Pick<SchedulerService, 'listTasks' | 'describeSchedule' | 'findTaskByPrefix'> & Partial<Pick<SchedulerService, 'describeTaskRuntime'>>>;
  loadMaintenanceService?: () => Promise<Pick<MaintenanceAutomationService, 'getStatus'>>;
};

export type ZavorthAutomationControlPlaneSnapshot = {
  generatedAt: string;
  workspaceRoot: string;
  summary: {
    posture: AutomationPosture;
    profile: string;
    recurringSupported: boolean;
    totalTasks: number;
    activeTasks: number;
    pausedTasks: number;
    failedTasks: number;
    autoPausedTasks: number;
    deliveries: number;
    outboxQueued: number;
    budgetedTasks: number;
    governedTasks: number;
    approvalExpiredTasks: number;
    approvalExpiringTasks: number;
    autoPauseRecommendedTasks: number;
    maintenanceEnabled: boolean;
    coreSchedulerDormant: boolean;
  };
  policy: {
    profile: string;
    creationMode: 'preview-only' | 'approval-gated';
    trustPlaneDomain: 'automation';
    schedulerStartsInCore: false;
    approvalRequiredFor: string[];
  };
  budgets: {
    globalConcurrency: number;
    perTaskConcurrency: number;
    maxRuntimeMs: number;
    maxMemoryMb: number;
    retries: number;
    backoffMs: number;
    maintenanceWindows: SchedulerTaskRuntimeDescriptor['budget']['maintenanceWindows'];
  };
  outbox: AutomationOutboxStatus;
  tasks: Array<{
    id: string;
    shortId: string;
    prompt: string;
    schedule: string;
    status: string;
    delivery: string;
    nextRun: string | null;
    lastRun: string | null;
    lastError: string | null;
    budget: SchedulerTaskRuntimeDescriptor['budget'];
    guardrails: SchedulerTaskRuntimeDescriptor['guardrails'];
    autoPause: SchedulerTaskRuntimeDescriptor['autoPause'];
  }>;
  maintenance: MaintenanceAutomationStatus;
  deliveries: Array<{
    taskId: string;
    delivery: string;
    summary: string;
    createdAt: string;
    target: string | null;
  }>;
  actions: Array<{
    id: string;
    label: string;
    severity: AutomationSeverity;
    reason: string;
    command: string | null;
  }>;
  operationalGuard: ZavorthScheduledTaskOperationalGuardSnapshot;
  examples: string[];
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};

export class ZavorthAutomationControlPlaneService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string;
  private readonly deliveryService: Pick<ZavorthAutomationDeliveryService, 'readRecent'> & Partial<Pick<ZavorthAutomationDeliveryService, 'readOutboxStatus'>>;
  private readonly runtimeProfile: Pick<RuntimeProfileService, 'getProfile' | 'supportsRecurringAutomation'>;
  private readonly loadSchedulerService: () => Promise<Pick<SchedulerService, 'listTasks' | 'describeSchedule' | 'findTaskByPrefix'> & Partial<Pick<SchedulerService, 'describeTaskRuntime'>>>;
  private readonly loadMaintenanceService: () => Promise<Pick<MaintenanceAutomationService, 'getStatus'>>;

  constructor(runtime: AutomationDeps = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceRoot = String(runtime.workspaceRoot || config.projectRoot || process.cwd()).trim();
    this.deliveryService = runtime.deliveryService || new ZavorthAutomationDeliveryService();
    this.runtimeProfile = runtime.runtimeProfileService || new RuntimeProfileService();
    this.loadSchedulerService =
      runtime.loadSchedulerService
      || (async () => {
        const db = await Database.getInstance();
        return new SchedulerService(
          new SchedulerRepository(db),
          { deliveryService: new ZavorthAutomationDeliveryService() },
        );
      });
    this.loadMaintenanceService =
      runtime.loadMaintenanceService
      || (async () => {
        const logRepo = new LogRepository();
        await logRepo.init();
        return new MaintenanceAutomationService(new OperationsActionService(logRepo), logRepo);
      });
  }

  public async buildSnapshot(input: { query?: string | null; limit?: number } = {}): Promise<ZavorthAutomationControlPlaneSnapshot> {
    const scheduler = await this.loadSchedulerService();
    const maintenance = await this.loadMaintenanceService();
    const query = String(input.query || '').trim().toLowerCase();
    const tasks = scheduler
      .listTasks(true)
      .filter((entry) => !query || this.matchesQuery(entry, query));
    const runtimeDescriptors = new Map<string, SchedulerTaskRuntimeDescriptor>();
    for (const task of tasks) {
      runtimeDescriptors.set(task.id, this.describeTaskRuntime(scheduler, task));
    }
    const taskCards = tasks.slice(0, Math.max(1, Number(input.limit || 8))).map((entry) => ({
      id: entry.id,
      shortId: entry.id.split('-')[0] || entry.id,
      prompt: String(entry.intent_text || entry.command || '').trim(),
      schedule: scheduler.describeSchedule(entry.schedule),
      status: String(entry.last_status || entry.status || 'idle'),
      delivery: String(entry.delivery || 'app'),
      nextRun: entry.next_run || null,
      lastRun: entry.last_run || null,
      lastError: entry.last_error || null,
      budget: runtimeDescriptors.get(entry.id)?.budget || this.defaultTaskRuntime(entry).budget,
      guardrails: runtimeDescriptors.get(entry.id)?.guardrails || this.defaultTaskRuntime(entry).guardrails,
      autoPause: runtimeDescriptors.get(entry.id)?.autoPause || this.defaultTaskRuntime(entry).autoPause,
    }));
    const maintenanceStatus = maintenance.getStatus();
    const deliveries = this.deliveryService.readRecent(6).map((entry) => ({
      taskId: entry.taskId,
      delivery: entry.delivery,
      summary: entry.summary,
      createdAt: entry.createdAt,
      target: entry.target,
    }));
    const outbox = this.readOutboxStatus();
    const budgetBaseline = this.resolveBudgetBaseline(runtimeDescriptors);
    const operationalGuard = new ZavorthScheduledTaskOperationalGuardService({
      schedulerService: scheduler as unknown as { listTasks: (includePaused?: boolean) => ScheduledTask[] },
      now: this.now,
    }).buildSnapshot();
    const basePosture = this.resolvePosture(tasks, maintenanceStatus);
    const summary = {
      posture: operationalGuard.status === 'critical'
        ? 'critical' as const
        : operationalGuard.status === 'attention'
          ? 'attention' as const
          : basePosture,
      profile: this.runtimeProfile.getProfile(),
      recurringSupported: this.runtimeProfile.supportsRecurringAutomation(),
      totalTasks: tasks.length,
      activeTasks: tasks.filter((entry) => entry.status === 'active').length,
      pausedTasks: tasks.filter((entry) => entry.status === 'paused').length,
      failedTasks: tasks.filter((entry) => String(entry.last_status || '') === 'failed').length,
      autoPausedTasks: tasks.filter((entry) => String(entry.paused_reason || '').toLowerCase().includes('auto-paused')).length,
      deliveries: deliveries.length,
      outboxQueued: outbox.queuedDeliveries,
      budgetedTasks: tasks.filter((entry) => Boolean(entry.budget_json && entry.guardrail_json)).length,
      governedTasks: operationalGuard.summary.governedTasks,
      approvalExpiredTasks: operationalGuard.summary.approvalExpiredTasks,
      approvalExpiringTasks: operationalGuard.summary.approvalExpiringTasks,
      autoPauseRecommendedTasks: operationalGuard.summary.autoPauseRecommendedTasks,
      maintenanceEnabled: maintenanceStatus.enabled,
      coreSchedulerDormant: !this.runtimeProfile.supportsRecurringAutomation(),
    };
    const creationMode: ZavorthAutomationControlPlaneSnapshot['policy']['creationMode'] =
      summary.recurringSupported ? 'approval-gated' : 'preview-only';
    const policy = {
      profile: summary.profile,
      creationMode,
      trustPlaneDomain: 'automation' as const,
      schedulerStartsInCore: false as const,
      approvalRequiredFor: ['create', 'resume', 'maintenance-on', 'maintenance-run'],
    };
    const budgets = {
      globalConcurrency: budgetBaseline.maxConcurrentRuns,
      perTaskConcurrency: budgetBaseline.maxPerTaskConcurrentRuns,
      maxRuntimeMs: budgetBaseline.maxRuntimeMs,
      maxMemoryMb: budgetBaseline.maxMemoryMb,
      retries: budgetBaseline.retries,
      backoffMs: budgetBaseline.backoffMs,
      maintenanceWindows: budgetBaseline.maintenanceWindows,
    };
    const actions = this.buildActions({
      tasks,
      maintenance: maintenanceStatus,
      recurringSupported: summary.recurringSupported,
      outbox,
      operationalGuard,
    });
    return {
      generatedAt: this.now().toISOString(),
      workspaceRoot: this.workspaceRoot,
      summary,
      policy,
      budgets,
      outbox,
      tasks: taskCards,
      maintenance: maintenanceStatus,
      deliveries,
      actions,
      operationalGuard,
      examples: [
        'review my channels on a recurring cadence',
        'review the node mesh on a recurring cadence',
        'send the rollout summary by email on a recurring cadence',
        'check transports through webhook https://example.com/hook on a recurring cadence',
      ],
      narrative: {
        headline: 'Automations e scheduled runs',
        operatorSummary:
          `${summary.activeTasks} active automation(s), ${summary.failedTasks} with recent failure, `
          + `${summary.autoPausedTasks} auto-paused task(s) and ${summary.outboxQueued} queued delivery item(s) in the outbox.`,
        nextAction: actions[0]?.label || 'Create the first natural-first automation.',
      },
    };
  }

  public async renderReport(input: { query?: string | null; limit?: number } = {}): Promise<string> {
    const snapshot = await this.buildSnapshot(input);
    const lines = [
      'Scheduled runs: Automations e scheduled runs',
      '',
      snapshot.narrative.operatorSummary,
      `Postura: ${snapshot.summary.posture}.`,
      `Perfil: ${snapshot.summary.profile}.`,
      `Recurrence supported: ${snapshot.summary.recurringSupported ? 'yes' : 'no'}.`,
      `Modo de criaction: ${snapshot.policy.creationMode}.`,
      `Budget: concurrency ${snapshot.budgets.globalConcurrency}/${snapshot.budgets.perTaskConcurrency} | runtime ${snapshot.budgets.maxRuntimeMs}ms | retries ${snapshot.budgets.retries}.`,
      `Outbox: ${snapshot.outbox.queuedDeliveries} pending | bounded=${snapshot.outbox.bounded ? 'yes' : 'no'}.`,
      `Guard: expirados ${snapshot.summary.approvalExpiredTasks} | expirando ${snapshot.summary.approvalExpiringTasks} | auto-pause recomendado ${snapshot.summary.autoPauseRecommendedTasks}.`,
      `maintenance recorrente: ${snapshot.maintenance.enabled ? 'ativa' : 'desativada'}.`,
      '',
      'Exemplos:',
      ...snapshot.examples.map((entry) => `- ${entry}`),
    ];
    if (snapshot.tasks.length > 0) {
      lines.push(
        '',
        'Automations:',
        ...snapshot.tasks.map((entry) =>
          `- ${entry.shortId}: ${entry.schedule} -> ${entry.prompt} | ${entry.delivery} | ${entry.status}`),
      );
    }
    if (snapshot.actions.length > 0) {
      lines.push(
        '',
        'Actions sugeridas:',
        ...snapshot.actions.map((entry) =>
          `- ${entry.label}: ${entry.reason}${entry.command ? ` | ${entry.command}` : ''}`),
      );
    }
    return lines.join('\n');
  }

  private buildActions(input: {
    tasks: ScheduledTask[];
    maintenance: MaintenanceAutomationStatus;
    recurringSupported: boolean;
    outbox: AutomationOutboxStatus;
    operationalGuard: ZavorthScheduledTaskOperationalGuardSnapshot;
  }): ZavorthAutomationControlPlaneSnapshot['actions'] {
    const actions: ZavorthAutomationControlPlaneSnapshot['actions'] = [];
    if (!input.recurringSupported) {
      actions.push({
        id: 'switch-profile',
        label: 'Subir o profile para ops/full',
        severity: 'warn',
        reason: 'The current profile does not expose recurrence as an official surface yet.',
        command: 'ZAVORTH_PROFILE=ops',
      });
    }
    if (input.tasks.length === 0) {
      actions.push({
        id: 'create-first-automation',
        label: 'Create the first automation',
        severity: 'info',
        reason: 'There is no natural-first automation registered on this host yet.',
        command: '/automations review my channels on a recurring cadence',
      });
    }
    const failedTask = input.tasks.find((entry) => String(entry.last_status || '') === 'failed');
    const autoPausedTask = input.tasks.find((entry) => String(entry.paused_reason || '').toLowerCase().includes('auto-paused'));
    const expiringTask = input.operationalGuard.tasks.find((entry) =>
      entry.operationalStatus === 'approval_expired' || entry.operationalStatus === 'approval_expiring');
    const autoPauseCandidate = input.operationalGuard.tasks.find((entry) =>
      entry.operationalStatus === 'auto_pause_recommended');
    if (expiringTask) {
      actions.push({
        id: 'reapprove-expiring-schedule',
        label: 'Reapprove recurring automation',
        severity: expiringTask.operationalStatus === 'approval_expired' ? 'critical' : 'warn',
        reason: expiringTask.detail,
        command: expiringTask.recommendedCommand,
      });
    }
    if (autoPauseCandidate) {
      actions.push({
        id: 'pause-noisy-schedule',
        label: 'Pause unstable automation',
        severity: 'critical',
        reason: autoPauseCandidate.detail,
        command: autoPauseCandidate.recommendedCommand,
      });
    }
    if (autoPausedTask) {
      actions.push({
        id: 'review-auto-paused-automation',
        label: 'Review auto-paused automation',
        severity: 'critical',
        reason: autoPausedTask.paused_reason || 'An automation paused itself after repeated failures.',
        command: `/automations pause ${autoPausedTask.id.split('-')[0]}`,
      });
    }
    if (failedTask) {
      actions.push({
        id: 'pause-failing-automation',
        label: 'Pause the failing automation',
        severity: 'critical',
        reason: failedTask.last_error || 'An automation failed recently and needs review.',
        command: `/automations pause ${failedTask.id.split('-')[0]}`,
      });
    }
    if (!input.maintenance.enabled) {
      actions.push({
        id: 'enable-maintenance',
        label: 'Ligar a maintenance recorrente',
        severity: 'warn',
        reason: 'Maintenance automation is still disabled on the current host.',
        command: '/automations maintenance on',
      });
    }
    if (input.outbox.queuedDeliveries > 0) {
      actions.push({
        id: 'drain-outbox',
        label: 'Drenar outbox de automations',
        severity: 'warn',
        reason: `${input.outbox.queuedDeliveries} delivery item(s) waiting for the local bridge.`,
        command: 'npm run ops:automations',
      });
    }
    return actions.slice(0, 6);
  }

  private resolvePosture(tasks: ScheduledTask[], maintenance: MaintenanceAutomationStatus): AutomationPosture {
    if (tasks.some((entry) => String(entry.last_status || '') === 'failed')) {
      return 'critical';
    }
    if (!maintenance.enabled || tasks.length === 0) {
      return 'attention';
    }
    return 'healthy';
  }

  private matchesQuery(task: ScheduledTask, query: string): boolean {
    return [
      task.id,
      task.command,
      task.intent_text,
      task.schedule,
      task.delivery,
      task.delivery_target,
      task.last_error,
    ]
      .map((entry) => String(entry || '').toLowerCase())
      .some((entry) => entry.includes(query));
  }

  private describeTaskRuntime(
    scheduler: Partial<Pick<SchedulerService, 'describeTaskRuntime'>>,
    task: ScheduledTask,
  ): SchedulerTaskRuntimeDescriptor {
    try {
      if (typeof scheduler.describeTaskRuntime === 'function') {
        return scheduler.describeTaskRuntime(task);
      }
    } catch (error: unknown) {
      logger.warn('[Zavorth Automation Control Plane] search failed', error);
    }
    return this.defaultTaskRuntime(task);
  }

  private defaultTaskRuntime(task: ScheduledTask): SchedulerTaskRuntimeDescriptor {
    const budget = this.parseJson(task.budget_json);
    const guardrails = this.parseJson(task.guardrail_json);
    return {
      budget: {
        maxRuntimeMs: this.toNumber(budget.maxRuntimeMs, 10 * 60 * 1000),
        maxMemoryMb: this.toNumber(budget.maxMemoryMb, 256),
        retries: this.toNumber(budget.retries, 2),
        backoffMs: this.toNumber(budget.backoffMs, 30 * 1000),
        maxConcurrentRuns: this.toNumber(budget.maxConcurrentRuns, this.runtimeProfile.getProfile() === 'full' ? 2 : 1),
        maxPerTaskConcurrentRuns: 1,
        maintenanceWindows: Array.isArray(budget.maintenanceWindows) && budget.maintenanceWindows.length > 0
          ? budget.maintenanceWindows
          : [{
            label: 'default-nightly-maintenance',
            start: '04:00',
            end: '06:00',
            timezone: 'local' as const,
            heavyTasksOnly: true,
          }],
      },
      guardrails: {
        autoPauseAfterConsecutiveFailures: this.toNumber(guardrails.autoPauseAfterConsecutiveFailures, 3),
        idempotencyKeySeed: String(guardrails.idempotencyKeySeed || `task:${task.command}:${task.schedule}:${task.created_by || 'system'}`),
        outboxTtlMs: this.toNumber(guardrails.outboxTtlMs, 7 * 24 * 60 * 60 * 1000),
        outboxMaxBytes: this.toNumber(guardrails.outboxMaxBytes, 100 * 1024 * 1024),
        pauseCreatesInboxNotice: guardrails.pauseCreatesInboxNotice !== false,
      },
      autoPause: {
        threshold: this.toNumber(guardrails.autoPauseAfterConsecutiveFailures, 3),
        consecutiveFailures: Number(task.consecutive_failures || 0),
        paused: task.status === 'paused',
        pausedReason: task.paused_reason || null,
        lastFailureAt: task.last_failure_at || null,
      },
    };
  }

  private resolveBudgetBaseline(
    runtimeDescriptors: Map<string, SchedulerTaskRuntimeDescriptor>,
  ): SchedulerTaskRuntimeDescriptor['budget'] {
    return Array.from(runtimeDescriptors.values())[0]?.budget || this.defaultTaskRuntime({
      id: 'default',
      command: 'automation',
      schedule: '{"kind":"calendar_day","targetHour":9,"targetMinute":0}',
      created_at: this.now().toISOString(),
      last_run: null,
      next_run: null,
      created_by: 'system',
      status: 'paused',
    }).budget;
  }

  private readOutboxStatus(): AutomationOutboxStatus {
    try {
      if (typeof this.deliveryService.readOutboxStatus === 'function') {
        return this.deliveryService.readOutboxStatus();
      }
    } catch (error: unknown) {// fallback abaixo
      logger.warn('[Zavorth Automation Control Plane] creation failed', error);
    }
    return {
      deliveryReportFile: config.automationDeliveryReportFile,
      webhookOutboxFile: config.automationWebhookOutboxFile,
      emailOutboxDir: config.emailOutboxDir,
      bounded: true,
      retention: {
        ttlMs: 7 * 24 * 60 * 60 * 1000,
        maxBytes: 100 * 1024 * 1024,
        maxRotatedFiles: 5,
        maxEmailFiles: 200,
      },
      deliveryRecords: 0,
      queuedDeliveries: 0,
      webhookQueued: 0,
      emailQueued: 0,
      externalDeliveries: 0,
      idempotencyKeys: 0,
      lastQueuedAt: null,
      recommendation: 'Outbox without read dedicada in this runtime.',
    };
  }

  private parseJson(value: unknown): Record<string, any> {
    if (value && typeof value === 'object') {
      return value as Record<string, any>;
    }
    try {
      const parsed = JSON.parse(String(value || '{}'));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error: unknown) {logger.warn('[Zavorth Automation Control Plane] JSON parse failed', error); return {}; }
  }

  private toNumber(value: unknown, fallback: number): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : fallback;
  }
}
