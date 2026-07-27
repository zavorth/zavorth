import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';
import {
  AutonomySchedulePlane,
  bindAutonomySchedulePlane,
  resolveAutonomyScheduleStorageDir,
  type AutonomyRoutineRiskLevel,
  type AutonomyRoutineScheduleType,
} from '../services/AutonomySchedulePlane.js';
import type { TaskPlaneService } from '../services/TaskPlaneService.js';

export class ZavorthCronSchedulerTool extends BaseTool {
  public readonly name = 'zavorth_cron_scheduler';

  public readonly description =
    'Schedules and manages recurring tasks with support for cron expressions, intervals, one-time execution, and natural language. Integrated with the Zavorth governance system.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'create', 'list', 'delete', 'enable', 'disable', 'run_now', 'status', 'update', 'process_due', 'kill_switch', 'freeze_scope'.",
      },
      job_id: {
        type: 'string',
        description: 'Job ID (for delete, enable, disable, run_now, status, update).',
      },
      name: {
        type: 'string',
        description: 'Descriptive name of the job.',
      },
      schedule: {
        type: 'string',
        description: 'Schedule as a cron expression, interval in milliseconds, ISO timestamp, or natural-language request resolved by the configured LLM into the canonical schedule schema.',
      },
      schedule_type: {
        type: 'string',
        description: "Type: 'cron', 'interval', 'once', 'natural_language'. Default: auto-detected.",
      },
      interval_ms: {
        type: 'number',
        description: 'Interval in milliseconds (for schedule_type=interval).',
      },
      task_description: {
        type: 'string',
        description: 'Description of the task to be executed.',
      },
      channel: {
        type: 'string',
        description: 'Result delivery channel (telegram, discord, slack, email, etc).',
      },
      risk_level: {
        type: 'string',
        description: "Risk level: 'low', 'medium', 'high', 'critical'. Default: 'medium'.",
      },
      requires_approval: {
        type: 'boolean',
        description: 'If true, requires approval before execution. Default: based on risk_level.',
      },
      scope: {
        type: 'string',
        description: 'Scope tag for freeze/unfreeze, or kill_switch value activate/clear.',
      },
    },
    required: ['action'],
  };

  private readonly plane: AutonomySchedulePlane;

  constructor(options?: {
    storageDir?: string;
    runtimeDir?: string;
    taskPlane?: TaskPlaneService | null;
    plane?: AutonomySchedulePlane | null;
  }) {
    super();
    // Prefer injected plane; otherwise bind the canonical runtimeDir/cron plane (same as CLI/control/daemon).
    let plane: AutonomySchedulePlane;
    if (options?.plane) {
      plane = options.plane;
    } else if (options?.storageDir) {
      // Explicit storageDir wins when callers need a test isolation root.
      plane = new AutonomySchedulePlane({
        storageDir: options.storageDir,
        taskPlane: options?.taskPlane || null,
      });
    } else {
      const runtimeDir = options?.runtimeDir || path.join(process.cwd(), 'data', 'runtime');
      plane = bindAutonomySchedulePlane({
        runtimeDir,
        taskPlane: options?.taskPlane || null,
        plane: null,
      });
    }
    this.plane = plane;
  }

  public getSchedulePlane(): AutonomySchedulePlane {
    return this.plane;
  }

  public getStorageDir(): string {
    return this.plane.getStorageDir();
  }

  public static canonicalStorageDir(runtimeDir: string): string {
    return resolveAutonomyScheduleStorageDir(runtimeDir);
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: the "action" parameter is required.';

    const validActions = [
      'create', 'list', 'delete', 'enable', 'disable', 'run_now', 'status', 'update',
      'process_due', 'kill_switch', 'freeze_scope', 'unfreeze_scope',
    ];
    if (!validActions.includes(action)) {
      return `Error: invalid action "${action}". Use: ${validActions.join(', ')}.`;
    }

    try {
      switch (action) {
        case 'create': return this.createJob(args);
        case 'list': return this.listJobs();
        case 'delete': return this.deleteJob(args);
        case 'enable': return this.toggleJob(args, true);
        case 'disable': return this.toggleJob(args, false);
        case 'run_now': return this.runNow(args);
        case 'status': return this.jobStatus(args);
        case 'update': return this.updateJob(args);
        case 'process_due': return this.processDue();
        case 'kill_switch': return this.killSwitch(args);
        case 'freeze_scope': return this.freezeScope(args, true);
        case 'unfreeze_scope': return this.freezeScope(args, false);
        default: return `Error: action "${action}" not implemented.`;
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Cron] operation failed', error);
      const message = error instanceof Error ? err.message : String(error);
      return `CronScheduler error: ${message}`;
    }
  }

  private createJob(args: Record<string, unknown>): string {
    const result = this.plane.createRoutine({
      name: typeof args.name === 'string' ? args.name : undefined,
      schedule: String(args.schedule || ''),
      scheduleType: args.schedule_type
        ? String(args.schedule_type) as AutonomyRoutineScheduleType
        : undefined,
      intervalMs: typeof args.interval_ms === 'number' ? args.interval_ms : undefined,
      taskDescription: String(args.task_description || ''),
      channel: typeof args.channel === 'string' ? args.channel : undefined,
      riskLevel: args.risk_level
        ? String(args.risk_level) as AutonomyRoutineRiskLevel
        : undefined,
      requiresApproval: typeof args.requires_approval === 'boolean' ? args.requires_approval : undefined,
      actor: 'zavorth_cron_scheduler',
    });
    if (!result.ok || !result.routine) {
      return `Error: ${result.blockedReason || result.summary}`;
    }
    const job = result.routine;
    const lines: string[] = [
      `Job "${job.name}" created successfully.`,
      `  - ID: ${job.id}`,
      `  - Schedule: ${job.schedule} (${job.scheduleType})`,
      `  - Risk: ${job.riskLevel}`,
      `  ? Approval required: ${job.requiresApproval ? 'Yes' : 'No'}`,
      `  ? Enabled: ${job.enabled ? 'Yes' : 'No'}`,
    ];
    if (job.requiresApproval && !job.enabled) {
      lines.push('  - ⚠️ Job created DISABLED. Use "enable" after reviewing and approving.');
    }
    return lines.join('\n');
  }

  private listJobs(): string {
    const snapshot = this.plane.snapshot();
    if (snapshot.routines.length === 0) return 'No scheduled jobs.';
    const lines: string[] = [`Scheduled jobs (${snapshot.routines.length}):`];
    for (const job of snapshot.routines) {
      const status = job.enabled ? '✅' : '⏸️';
      const risk = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' }[job.riskLevel];
      lines.push(`  ${status} ${risk} [${job.id}] ${job.name} — ${job.schedule} (${job.scheduleType}) runs:${job.runCount}`);
    }
    return lines.join('\n');
  }

  private deleteJob(args: Record<string, unknown>): string {
    const jobId = String(args.job_id || '');
    if (!jobId) return 'Error: "job_id" is required.';
    const result = this.plane.deleteRoutine({ routineId: jobId, actor: 'zavorth_cron_scheduler' });
    if (!result.ok || !result.routine) {
      return `Error: ${result.blockedReason || result.summary}`;
    }
    const job = result.routine;
    if (job.riskLevel === 'critical' || job.runCount > 0) {
      return `Job "${job.name}" (${jobId}) deleted. Warning: job had risk ${job.riskLevel} and ${job.runCount} previous executions.`;
    }
    return `Job "${job.name}" (${jobId}) deleted.`;
  }

  private toggleJob(args: Record<string, unknown>, enabled: boolean): string {
    const jobId = String(args.job_id || '');
    if (!jobId) return 'Error: "job_id" is required.';
    const result = enabled
      ? this.plane.enableRoutine({ routineId: jobId, actor: 'zavorth_cron_scheduler' })
      : this.plane.disableRoutine({ routineId: jobId, actor: 'zavorth_cron_scheduler' });
    if (!result.ok || !result.routine) {
      return `Error: ${result.blockedReason || result.summary}`;
    }
    const job = result.routine;
    return `Job "${job.name}" (${jobId}) ${enabled ? 'enabled' : 'disabled'}.${job.nextRunAt ? ` Next execution: ${job.nextRunAt}` : ''}`;
  }

  private runNow(args: Record<string, unknown>): string {
    const jobId = String(args.job_id || '');
    if (!jobId) return 'Error: "job_id" is required.';
    const result = this.plane.runNow({ routineId: jobId, actor: 'zavorth_cron_scheduler' });
    if (!result.ok || !result.routine) {
      return `Error: ${result.blockedReason || result.summary}`;
    }
    const job = result.routine;
    return `Job "${job.name}" (${jobId}) manually triggered. Task: "${job.taskDescription}". Execution #${job.runCount}.`;
  }

  private jobStatus(args: Record<string, unknown>): string {
    const jobId = String(args.job_id || '');
    if (!jobId) return 'Error: "job_id" is required.';
    const job = this.plane.getRoutine(jobId);
    if (!job) return `Error: job "${jobId}" not found.`;
    const lines: string[] = [
      `Job: ${job.name} (${job.id})`,
      `  - Schedule: ${job.schedule} (${job.scheduleType})`,
      `  - Task: ${job.taskDescription}`,
      `  - Channel: ${job.channel || 'none'}`,
      `  ? Enabled: ${job.enabled ? 'Yes' : 'No'}`,
      `  - Risk: ${job.riskLevel}`,
      `  ? Approval: ${job.requiresApproval ? 'Required' : 'Not required'}`,
      `  - Executions: ${job.runCount}`,
      `  - Last execution: ${job.lastRunAt || 'never'}`,
      `  - Next execution: ${job.nextRunAt || 'not scheduled'}`,
      `  - Last result: ${job.lastResult || 'none'}`,
      `  - Created: ${job.createdAt}`,
      `  - Updated: ${job.updatedAt}`,
    ];
    return lines.join('\n');
  }

  private updateJob(args: Record<string, unknown>): string {
    const jobId = String(args.job_id || '');
    if (!jobId) return 'Error: "job_id" is required.';
    const result = this.plane.updateRoutine({
      routineId: jobId,
      name: typeof args.name === 'string' ? args.name : undefined,
      schedule: args.schedule ? String(args.schedule) : '',
      scheduleType: args.schedule_type
        ? String(args.schedule_type) as AutonomyRoutineScheduleType
        : undefined,
      intervalMs: typeof args.interval_ms === 'number' ? args.interval_ms : undefined,
      taskDescription: args.task_description ? String(args.task_description) : '',
      channel: typeof args.channel === 'string' ? args.channel : undefined,
      riskLevel: args.risk_level
        ? String(args.risk_level) as AutonomyRoutineRiskLevel
        : undefined,
      requiresApproval: typeof args.requires_approval === 'boolean' ? args.requires_approval : undefined,
      actor: 'zavorth_cron_scheduler',
    });
    if (!result.ok || !result.routine) {
      return `Error: ${result.blockedReason || result.summary}`;
    }
    return `Job "${result.routine.name}" (${jobId}) updated successfully.`;
  }

  private processDue(): string {
    const result = this.plane.processDue({ actor: 'zavorth_cron_scheduler' });
    if (!result.ok) {
      return `Error: ${result.blockedReason || result.summary}`;
    }
    return [
      result.summary,
      ...result.materialized.map((entry) => `- ${entry.routineId} -> task ${entry.taskId || 'preview'} next=${entry.nextRunAt || 'none'}`),
    ].join('\n');
  }

  private killSwitch(args: Record<string, unknown>): string {
    const mode = String(args.scope || args.mode || args.value || 'activate').toLowerCase();
    const result = mode === 'clear' || mode === 'off' || mode === 'disable'
      ? this.plane.clearKillSwitch('zavorth_cron_scheduler')
      : this.plane.activateKillSwitch('zavorth_cron_scheduler');
    return result.summary;
  }

  private freezeScope(args: Record<string, unknown>, freeze: boolean): string {
    const scope = String(args.scope || args.job_id || '');
    if (!scope) return 'Error: "scope" is required.';
    const result = freeze
      ? this.plane.freezeScope(scope, 'zavorth_cron_scheduler')
      : this.plane.unfreezeScope(scope, 'zavorth_cron_scheduler');
    return result.summary;
  }
}
