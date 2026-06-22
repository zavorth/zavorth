import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  schedule_type: 'cron' | 'interval' | 'once' | 'natural_language';
  interval_ms?: number;
  task_description: string;
  channel?: string;
  enabled: boolean;
  last_run: string | null;
  next_run: string | null;
  run_count: number;
  last_result: string | null;
  created_at: string;
  updated_at: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  requires_approval: boolean;
}

export class ZavorthCronSchedulerTool extends BaseTool {
  public readonly name = 'zavorth_cron_scheduler';

  public readonly description =
    'Schedules and manages recurring tasks with support for cron expressions, intervals, one-time execution, and natural language. Integrated with the Zavorth governance system.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'create', 'list', 'delete', 'enable', 'disable', 'run_now', 'status', 'update'.",
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
        description: "Schedule: cron expression ('0 9 * * *'), interval in ms, ISO date for 'once', or natural language text ('every day at 9am').",
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
    },
    required: ['action'],
  };

  private readonly storageDir: string;

  constructor(options?: { storageDir?: string }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'cron');
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: the "action" parameter is required.';

    const validActions = ['create', 'list', 'delete', 'enable', 'disable', 'run_now', 'status', 'update'];
    if (!validActions.includes(action)) {
      return `Error: invalid action "${action}". Use: ${validActions.join(', ')}.`;
    }

    this.ensureStorageDir();

    try {
      switch (action) {
        case 'create': return this.createJob(args);
        case 'list': return this.listJobs(args);
        case 'delete': return this.deleteJob(args);
        case 'enable': return this.toggleJob(args, true);
        case 'disable': return this.toggleJob(args, false);
        case 'run_now': return this.runNow(args);
        case 'status': return this.jobStatus(args);
        case 'update': return this.updateJob(args);
        default: return `Error: action "${action}" not implemented.`;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `CronScheduler error: ${message}`;
    }
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private jobPath(jobId: string): string {
    return path.join(this.storageDir, `${jobId}.json`);
  }

  private loadJob(jobId: string): CronJob | null {
    const filePath = this.jobPath(jobId);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CronJob;
  }

  private saveJob(job: CronJob): void {
    fs.writeFileSync(this.jobPath(job.id), JSON.stringify(job, null, 2), 'utf-8');
  }

  private listAllJobIds(): string[] {
    if (!fs.existsSync(this.storageDir)) return [];
    return fs.readdirSync(this.storageDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));
  }

  private detectScheduleType(schedule: string, intervalMs?: number): CronJob['schedule_type'] {
    if (intervalMs !== undefined) return 'interval';
    if (/^[\d/*,\-]+\s+[\d/*,\-]+\s+[\d/*,\-]+\s+[\d/*,\-]+\s+[\d/*,\-]+$/.test(schedule.trim())) return 'cron';
    if (/^\d{4}-\d{2}-\d{2}T/.test(schedule.trim())) return 'once';
    return 'natural_language';
  }

  private computeNextRun(job: CronJob): string | null {
    if (!job.enabled) return null;
    const now = Date.now();

    if (job.schedule_type === 'interval' && job.interval_ms) {
      return new Date(now + job.interval_ms).toISOString();
    }

    if (job.schedule_type === 'once') {
      const target = new Date(job.schedule).getTime();
      return target > now ? new Date(target).toISOString() : null;
    }

    return null;
  }

  private inferRiskLevel(taskDescription: string): CronJob['risk_level'] {
    const desc = taskDescription.toLowerCase();
    if (/\b(delete|remove|drop|destroy|kill|rm\s+-rf)\b/u.test(desc)) return 'critical';
    if (/\b(send|post|publish|deploy|execute|run|modify|write|edit)\b/u.test(desc)) return 'high';
    if (/\b(read|check|monitor|scan|list|query|search)\b/u.test(desc)) return 'low';
    return 'medium';
  }

  private createJob(args: Record<string, unknown>): string {
    const schedule = String(args.schedule || '');
    if (!schedule) return 'Error: the "schedule" parameter is required.';

    const taskDescription = String(args.task_description || '');
    if (!taskDescription) return 'Error: the "task_description" parameter is required.';

    const name = String(args.name || `job_${Date.now()}`);
    const jobId = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 48);

    if (this.loadJob(jobId)) {
      return `Error: job "${jobId}" already exists. Use "update" to modify.`;
    }

    const scheduleType = this.detectScheduleType(schedule, args.interval_ms as number | undefined);
    const riskLevel = args.risk_level
      ? String(args.risk_level) as CronJob['risk_level']
      : this.inferRiskLevel(taskDescription);
    const requiresApproval = typeof args.requires_approval === 'boolean'
      ? args.requires_approval
      : ['high', 'critical'].includes(riskLevel);

    const job: CronJob = {
      id: jobId,
      name,
      schedule,
      schedule_type: scheduleType,
      interval_ms: typeof args.interval_ms === 'number' ? args.interval_ms : undefined,
      task_description: taskDescription,
      channel: typeof args.channel === 'string' ? args.channel : undefined,
      enabled: !requiresApproval,
      last_run: null,
      next_run: null,
      run_count: 0,
      last_result: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      risk_level: riskLevel,
      requires_approval: requiresApproval,
    };

    job.next_run = this.computeNextRun(job);
    this.saveJob(job);

    const lines: string[] = [
      `Job "${name}" created successfully.`,
      `  - ID: ${jobId}`,
      `  - Schedule: ${schedule} (${scheduleType})`,
      `  - Risk: ${riskLevel}`,
      `  - Approval required: ${requiresApproval ? 'Yes' : 'No'}`,
      `  - Enabled: ${job.enabled ? 'Yes' : 'No'}`,
    ];
    if (requiresApproval) {
      lines.push(`  - ⚠️ Job created DISABLED. Use "enable" after reviewing and approving.`);
    }
    return lines.join('\n');
  }

  private listJobs(_args: Record<string, unknown>): string {
    const jobIds = this.listAllJobIds();
    if (jobIds.length === 0) return 'No scheduled jobs.';

    const lines: string[] = [`Scheduled jobs (${jobIds.length}):`];
    for (const id of jobIds) {
      const job = this.loadJob(id);
      if (!job) continue;
      const status = job.enabled ? '✅' : '⏸️';
      const risk = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' }[job.risk_level];
      lines.push(`  ${status} ${risk} [${job.id}] ${job.name} — ${job.schedule} (${job.schedule_type}) runs:${job.run_count}`);
    }
    return lines.join('\n');
  }

  private deleteJob(args: Record<string, unknown>): string {
    const jobId = String(args.job_id || '');
    if (!jobId) return 'Error: "job_id" is required.';

    const job = this.loadJob(jobId);
    if (!job) return `Error: job "${jobId}" not found.`;

    if (job.risk_level === 'critical' || job.run_count > 0) {
      fs.unlinkSync(this.jobPath(jobId));
      return `Job "${job.name}" (${jobId}) deleted. Warning: job had risk ${job.risk_level} and ${job.run_count} previous executions.`;
    }

    fs.unlinkSync(this.jobPath(jobId));
    return `Job "${job.name}" (${jobId}) deleted.`;
  }

  private toggleJob(args: Record<string, unknown>, enabled: boolean): string {
    const jobId = String(args.job_id || '');
    if (!jobId) return 'Error: "job_id" is required.';

    const job = this.loadJob(jobId);
    if (!job) return `Error: job "${jobId}" not found.`;

    if (enabled && job.requires_approval) {
      job.requires_approval = false;
    }

    job.enabled = enabled;
    job.next_run = this.computeNextRun(job);
    job.updated_at = new Date().toISOString();
    this.saveJob(job);

    return `Job "${job.name}" (${jobId}) ${enabled ? 'enabled' : 'disabled'}.${job.next_run ? ` Next execution: ${job.next_run}` : ''}`;
  }

  private runNow(args: Record<string, unknown>): string {
    const jobId = String(args.job_id || '');
    if (!jobId) return 'Error: "job_id" is required.';

    const job = this.loadJob(jobId);
    if (!job) return `Error: job "${jobId}" not found.`;

    job.last_run = new Date().toISOString();
    job.run_count += 1;
    job.last_result = 'manual_trigger_pending';
    job.next_run = this.computeNextRun(job);
    job.updated_at = new Date().toISOString();
    this.saveJob(job);

    return `Job "${job.name}" (${jobId}) manually triggered. Task: "${job.task_description}". Execution #${job.run_count}.`;
  }

  private jobStatus(args: Record<string, unknown>): string {
    const jobId = String(args.job_id || '');
    if (!jobId) return 'Error: "job_id" is required.';

    const job = this.loadJob(jobId);
    if (!job) return `Error: job "${jobId}" not found.`;

    const lines: string[] = [
      `Job: ${job.name} (${job.id})`,
      `  - Schedule: ${job.schedule} (${job.schedule_type})`,
      `  - Task: ${job.task_description}`,
      `  - Channel: ${job.channel || 'none'}`,
      `  - Enabled: ${job.enabled ? 'Yes' : 'No'}`,
      `  - Risk: ${job.risk_level}`,
      `  - Approval: ${job.requires_approval ? 'Required' : 'Not required'}`,
      `  - Executions: ${job.run_count}`,
      `  - Last execution: ${job.last_run || 'never'}`,
      `  - Next execution: ${job.next_run || 'not scheduled'}`,
      `  - Last result: ${job.last_result || 'none'}`,
      `  - Created: ${job.created_at}`,
      `  - Updated: ${job.updated_at}`,
    ];
    return lines.join('\n');
  }

  private updateJob(args: Record<string, unknown>): string {
    const jobId = String(args.job_id || '');
    if (!jobId) return 'Error: "job_id" is required.';

    const job = this.loadJob(jobId);
    if (!job) return `Error: job "${jobId}" not found.`;

    if (args.name) job.name = String(args.name);
    if (args.schedule) {
      job.schedule = String(args.schedule);
      job.schedule_type = this.detectScheduleType(job.schedule, args.interval_ms as number | undefined);
    }
    if (typeof args.interval_ms === 'number') {
      job.interval_ms = args.interval_ms;
      if (job.schedule_type !== 'interval') job.schedule_type = 'interval';
    }
    if (args.task_description) job.task_description = String(args.task_description);
    if (args.channel) job.channel = String(args.channel);
    if (args.risk_level) {
      job.risk_level = String(args.risk_level) as CronJob['risk_level'];
      if (['high', 'critical'].includes(job.risk_level)) {
        job.requires_approval = true;
      }
    }
    if (typeof args.requires_approval === 'boolean') {
      job.requires_approval = args.requires_approval;
    }

    job.next_run = this.computeNextRun(job);
    job.updated_at = new Date().toISOString();
    this.saveJob(job);

    return `Job "${job.name}" (${jobId}) updated successfully.`;
  }
}
