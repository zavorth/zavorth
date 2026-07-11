import { logger } from '../logger.js';
import type { ScheduledTask } from '../storage/SchedulerRepository.js';
import type {
  SchedulerGovernedScheduledTaskMetadata,
  SchedulerTaskRuntimeDescriptor,
} from './SchedulerService.js';

import {
ZAVORTH_SCHEDULED_TASK_OPERATIONAL_GUARD_CONTRACT_VERSION,
  type ZavorthScheduledTaskOperationalGuardInput,
  type ZavorthScheduledTaskOperationalGuardReceipt,
  type ZavorthScheduledTaskOperationalGuardSnapshot,
  type ZavorthScheduledTaskOperationalGuardStatus,
  type ZavorthScheduledTaskOperationalGuardTask,
  type ZavorthScheduledTaskOperationalTaskStatus,
} from '../contracts/ZavorthScheduledTaskOperationalGuardContract.js';

type SchedulerGuardLike = {
  listTasks(includePaused?: boolean): ScheduledTask[];
  pauseTask?(id: string, reason?: string | null): ScheduledTask | null;
  describeTaskRuntime?(task: ScheduledTask): SchedulerTaskRuntimeDescriptor;
};

type Runtime = {
  schedulerService?: SchedulerGuardLike | null;
  now?: () => Date;
};

const DEFAULT_EXPIRY_WARNING_MS = 24 * 60 * 60 * 1000;

export class ZavorthScheduledTaskOperationalGuardService {
  private readonly scheduler: SchedulerGuardLike | null;
  private readonly now: () => Date;

  public constructor(runtime: Runtime = {}) {
    this.scheduler = runtime.schedulerService || null;
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: ZavorthScheduledTaskOperationalGuardInput = {}): ZavorthScheduledTaskOperationalGuardSnapshot {
    const generatedAt = this.now().toISOString();
    const applyAutoPause = input.applyAutoPause === true;
    const warningMs = normalizeWarningMs(input.approvalExpiryWarningMs);
    const tasks = this.scheduler?.listTasks(true) || [];
    const receipts: ZavorthScheduledTaskOperationalGuardReceipt[] = [{
      id: 'checkpoint-5-scheduled-task-operational-guard',
      kind: 'checkpoint-5-scheduled-task-operational-guard',
      status: 'recorded',
      summary: 'Scheduled task renewal, expiry and auto-pause guard scanned the scheduler state.',
    }];
    const taskCards = tasks.map((task) => this.inspectTask(task, warningMs, applyAutoPause, receipts));
    const summary = {
      totalTasks: taskCards.length,
      governedTasks: taskCards.filter((task) => task.governed).length,
      legacyTasks: taskCards.filter((task) => !task.governed).length,
      approvalExpiredTasks: taskCards.filter((task) => task.approvalExpired).length,
      approvalExpiringTasks: taskCards.filter((task) => task.approvalExpiringSoon).length,
      autoPauseRecommendedTasks: taskCards.filter((task) =>
        task.operationalStatus === 'auto_pause_recommended').length,
      autoPausedTasks: taskCards.filter((task) => task.operationalStatus === 'auto_paused').length,
      workloadExecutionPerformed: false as false,
    };
    receipts.push({
      id: 'checkpoint-5-no-workload-execution',
      kind: 'no-workload-execution',
      status: 'recorded',
      summary: 'Operational guard never dispatches scheduled workloads.',
    });
    const status = resolveStatus(summary);
    return {
      generatedAt,
      contractVersion: ZAVORTH_SCHEDULED_TASK_OPERATIONAL_GUARD_CONTRACT_VERSION,
      source: 'ZavorthScheduledTaskOperationalGuardService',
      gate: 'renewal-expiry-auto-pause',
      status,
      summary,
      tasks: taskCards,
      receipts,
      safety: {
        noWorkloadExecution: true,
        onlySchedulerLifecycleMutation: true,
        explicitApplyRequiredForAutoPause: true,
        reapprovalUsesSurfaceLifecycle: true,
        rawSecretsSerialized: false,
      },
      commands: {
        report: 'node scripts/zavorth-scheduled-task-operational-guard-check.mjs',
        reapprove: '/automations reapprove <id>',
        pause: '/automations pause <id>',
        applyAutoPause: 'npx tsx scripts/zavorth-scheduled-task-operational-guard.ts --apply-auto-pause',
      },
      narrative: narrativeForStatus(status, summary),
    };
  }

  public renderReport(snapshot = this.buildSnapshot()): string {
    const lines = [
      'Scheduled Task Operational Guard',
      '',
      `Status: ${snapshot.status}`,
      snapshot.narrative.operatorSummary,
      `Governadas: ${snapshot.summary.governedTasks}/${snapshot.summary.totalTasks}.`,
      `Approvals expirados: ${snapshot.summary.approvalExpiredTasks}.`,
      `Approvals expirando: ${snapshot.summary.approvalExpiringTasks}.`,
      `Auto-pause recomendado: ${snapshot.summary.autoPauseRecommendedTasks}.`,
      `Auto-pausadas: ${snapshot.summary.autoPausedTasks}.`,
      '',
      'Acoes:',
      `- Reaprovar: ${snapshot.commands.reapprove}`,
      `- Pausar: ${snapshot.commands.pause}`,
    ];
    if (snapshot.tasks.length > 0) {
      lines.push(
        '',
        'Tarefas:',
        ...snapshot.tasks.slice(0, 8).map((task) =>
          `- ${task.shortId}: ${task.operationalStatus} | ${task.detail}${task.recommendedCommand ? ` | ${task.recommendedCommand}` : ''}`),
      );
    }
    return lines.join('\n');
  }

  private inspectTask(
    task: ScheduledTask,
    warningMs: number,
    applyAutoPause: boolean,
    receipts: ZavorthScheduledTaskOperationalGuardReceipt[],
  ): ZavorthScheduledTaskOperationalGuardTask {
    const runtime = this.describeRuntime(task);
    const metadata = runtime.guardrails.governedScheduledTask || readGovernedMetadata(task);
    const nowMs = this.now().getTime();
    const expiresAtMs = metadata?.approvalExpiresAt ? Date.parse(metadata.approvalExpiresAt) : Number.NaN;
    const approvalExpired = Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs;
    const approvalExpiringSoon = Number.isFinite(expiresAtMs)
      && expiresAtMs > nowMs
      && expiresAtMs - nowMs <= warningMs;
    const consecutiveFailures = Number(task.consecutive_failures || 0);
    const threshold = Math.max(1, Number(runtime.guardrails.autoPauseAfterConsecutiveFailures || 3));
    const shouldAutoPause = task.status === 'active' && consecutiveFailures >= threshold;
    let operationalStatus = this.resolveTaskStatus({
      task,
      metadata,
      approvalExpired,
      approvalExpiringSoon,
      shouldAutoPause,
    });
    let pausedReason = task.paused_reason || null;
    if ((approvalExpired || shouldAutoPause) && task.status === 'active') {
      receipts.push({
        id: `${task.id}:auto-pause-check`,
        kind: 'auto-pause-check',
        status: applyAutoPause ? 'applied' : 'recommended',
        summary: applyAutoPause
          ? `Auto-pause applied to ${task.id}.`
          : `Auto-pause recommended for ${task.id}.`,
      });
      if (applyAutoPause && this.scheduler?.pauseTask) {
        const reason = approvalExpired
          ? 'auto-paused: governed approval expired'
          : `auto-paused after ${threshold} consecutive failures`;
        const paused = this.scheduler.pauseTask(task.id, reason);
        pausedReason = paused?.paused_reason || reason;
        operationalStatus = 'auto_paused';
        receipts.push({
          id: `${task.id}:auto-pause-applied`,
          kind: 'auto-pause-applied',
          status: 'applied',
          summary: `Scheduler task ${task.id} paused through SchedulerService lifecycle.`,
        });
      }
    }
    if (approvalExpired || approvalExpiringSoon) {
      receipts.push({
        id: `${task.id}:approval-expiry`,
        kind: 'approval-expiry-check',
        status: approvalExpired ? 'recommended' : 'recorded',
        summary: approvalExpired
          ? `Task ${task.id} needs reapproval before it should run again.`
          : `Task ${task.id} approval expires soon.`,
      });
    }
    if (!metadata) {
      receipts.push({
        id: `${task.id}:legacy-task`,
        kind: 'legacy-task-detected',
        status: 'blocked',
        summary: `Task ${task.id} has no governed scheduled task metadata.`,
      });
    }
    return {
      id: task.id,
      shortId: task.id.split('-')[0] || task.id,
      command: task.command,
      schedule: task.schedule,
      status: task.status,
      operationalStatus,
      governed: Boolean(metadata),
      approvalId: metadata?.approvalId || null,
      approvalExpiresAt: metadata?.approvalExpiresAt || null,
      approvalExpired,
      approvalExpiringSoon,
      consecutiveFailures,
      autoPauseThreshold: threshold,
      pausedReason,
      recommendedCommand: this.recommendedCommand(task, operationalStatus),
      detail: this.detailForTask(operationalStatus, metadata, threshold, consecutiveFailures),
    };
  }

  private resolveTaskStatus(input: {
    task: ScheduledTask;
    metadata: SchedulerGovernedScheduledTaskMetadata | null;
    approvalExpired: boolean;
    approvalExpiringSoon: boolean;
    shouldAutoPause: boolean;
  }): ZavorthScheduledTaskOperationalTaskStatus {
    if (String(input.task.paused_reason || '').toLowerCase().includes('auto-paused')) return 'auto_paused';
    if (!input.metadata) return 'legacy';
    if (input.approvalExpired) return 'approval_expired';
    if (input.shouldAutoPause) return 'auto_pause_recommended';
    if (input.approvalExpiringSoon) return 'approval_expiring';
    return 'healthy';
  }

  private describeRuntime(task: ScheduledTask): SchedulerTaskRuntimeDescriptor {
    if (this.scheduler?.describeTaskRuntime) {
      return this.scheduler.describeTaskRuntime(task);
    }
    const guardrails = readGuardrails(task);
    return {
      budget: {
        maxRuntimeMs: 10 * 60 * 1000,
        maxMemoryMb: 256,
        retries: 2,
        backoffMs: 30 * 1000,
        maxConcurrentRuns: 1,
        maxPerTaskConcurrentRuns: 1,
        maintenanceWindows: [],
      },
      guardrails: {
        autoPauseAfterConsecutiveFailures: Number(guardrails.autoPauseAfterConsecutiveFailures || 3),
        idempotencyKeySeed: String(guardrails.idempotencyKeySeed || `task:${task.id}`),
        outboxTtlMs: Number(guardrails.outboxTtlMs || 7 * 24 * 60 * 60 * 1000),
        outboxMaxBytes: Number(guardrails.outboxMaxBytes || 100 * 1024 * 1024),
        pauseCreatesInboxNotice: guardrails.pauseCreatesInboxNotice !== false,
        governedScheduledTask: readGovernedMetadata(task),
      },
      autoPause: {
        threshold: Number(guardrails.autoPauseAfterConsecutiveFailures || 3),
        consecutiveFailures: Number(task.consecutive_failures || 0),
        paused: task.status === 'paused',
        pausedReason: task.paused_reason || null,
        lastFailureAt: task.last_failure_at || null,
      },
    };
  }

  private recommendedCommand(
    task: ScheduledTask,
    status: ZavorthScheduledTaskOperationalTaskStatus,
  ): string | null {
    const shortId = task.id.split('-')[0] || task.id;
    if (status === 'approval_expired' || status === 'approval_expiring') return `/automations reapprove ${shortId}`;
    if (status === 'auto_pause_recommended') return `/automations pause ${shortId}`;
    if (status === 'legacy') return `/unschedule ${shortId}`;
    return null;
  }

  private detailForTask(
    status: ZavorthScheduledTaskOperationalTaskStatus,
    metadata: SchedulerGovernedScheduledTaskMetadata | null,
    threshold: number,
    failures: number,
  ): string {
    if (status === 'legacy') return 'tarefa legado sem metadata governada';
    if (status === 'approval_expired') return `approval ${metadata?.approvalId || 'n/d'} expirado`;
    if (status === 'approval_expiring') return `approval ${metadata?.approvalId || 'n/d'} expira em breve`;
    if (status === 'auto_pause_recommended') return `falhas consecutivas ${failures}/${threshold}`;
    if (status === 'auto_paused') return 'pausada automaticamente pelo guard operacional';
    return 'operacional';
  }
}

function resolveStatus(summary: ZavorthScheduledTaskOperationalGuardSnapshot['summary']): ZavorthScheduledTaskOperationalGuardStatus {
  if (summary.approvalExpiredTasks > 0 || summary.autoPausedTasks > 0 || summary.legacyTasks > 0) return 'critical';
  if (summary.approvalExpiringTasks > 0 || summary.autoPauseRecommendedTasks > 0) return 'attention';
  return 'healthy';
}

function narrativeForStatus(
  status: ZavorthScheduledTaskOperationalGuardStatus,
  summary: ZavorthScheduledTaskOperationalGuardSnapshot['summary'],
): ZavorthScheduledTaskOperationalGuardSnapshot['narrative'] {
  if (status === 'healthy') {
    return {
      headline: 'Scheduled tasks are operationally healthy.',
      operatorSummary: 'No governed scheduled task needs renewal, expiry handling or auto-pause.',
      nextAction: 'Continue monitoring scheduled runs.',
    };
  }
  if (status === 'attention') {
    return {
      headline: 'Scheduled tasks need operator attention.',
      operatorSummary:
        `${summary.approvalExpiringTasks} approval(s) expiring soon and ${summary.autoPauseRecommendedTasks} task(s) near auto-pause.`,
      nextAction: 'Reapprove expiring tasks or pause noisy tasks before the next scheduler tick.',
    };
  }
  return {
    headline: 'Scheduled task guard found critical issues.',
    operatorSummary:
      `${summary.approvalExpiredTasks} expired approval(s), ${summary.autoPausedTasks} auto-paused task(s), ${summary.legacyTasks} legacy task(s).`,
    nextAction: 'Run reapprove, inspect legacy tasks, or apply auto-pause explicitly.',
  };
}

function normalizeWarningMs(value: unknown): number {
  const numeric = Number(value || DEFAULT_EXPIRY_WARNING_MS);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_EXPIRY_WARNING_MS;
  return Math.min(numeric, 30 * 24 * 60 * 60 * 1000);
}

function readGuardrails(task: ScheduledTask): Record<string, any> {
  try {
    const parsed = JSON.parse(String(task.guardrail_json || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error: unknown) {logger.warn('[Zavorth Scheduled Task Operational Guard] JSON parse failed', error); return {}; }
}

function readGovernedMetadata(task: ScheduledTask): SchedulerGovernedScheduledTaskMetadata | null {
  const metadata = readGuardrails(task).governedScheduledTask;
  return metadata?.gate === 'persisted-scheduled-task-registration'
    ? metadata as SchedulerGovernedScheduledTaskMetadata
    : null;
}
