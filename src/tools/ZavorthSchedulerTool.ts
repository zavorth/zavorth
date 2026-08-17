/**
 * Zavorth Scheduler Tool.
 * Exposes durable job scheduling, listing, instant execution, and historical telemetry
 * via ToolRegistry and Cognitive Firewall.
 */

import { BaseTool } from './BaseTool.js';
import {
  ZavorthSchedulerEngine,
  PersistentJobStore,
  type ScheduledJob,
  type JobSchedule,
  type JobDeliveryTarget,
} from '../scheduler/index.js';

export interface ZavorthSchedulerInput {
  action: 'create' | 'list' | 'update' | 'delete' | 'run_now' | 'get_history' | 'get_metrics';
  jobId?: string;
  name?: string;
  description?: string;
  prompt?: string;
  scheduleKind?: 'cron' | 'every' | 'at';
  scheduleExpr?: string;
  enabled?: boolean;
  deliveryChannels?: Array<'desktop' | 'cli' | 'webhook'>;
  webhookUrl?: string;
}

export class ZavorthSchedulerTool extends BaseTool {
  public static readonly name = 'zavorth_scheduler';
  public static readonly description =
    'Manages persistent autonomous jobs with restart catchup, load staggering, isolated subagent execution lanes, and multi-channel delivery.';

  public static readonly schema = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'list', 'update', 'delete', 'run_now', 'get_history', 'get_metrics'],
        description: 'Action to perform on the scheduler.',
      },
      jobId: {
        type: 'string',
        description: 'Unique job ID (required for update, delete, run_now, get_history).',
      },
      name: {
        type: 'string',
        description: 'Human-readable name of the scheduled job.',
      },
      description: {
        type: 'string',
        description: 'Detailed purpose of the job.',
      },
      prompt: {
        type: 'string',
        description: 'The autonomous task prompt for the agent to execute on schedule.',
      },
      scheduleKind: {
        type: 'string',
        enum: ['cron', 'every', 'at'],
        description: 'Type of schedule: "cron" (e.g. "0 9 * * *"), "every" (e.g. "2h", "30m"), or "at" (ISO date).',
      },
      scheduleExpr: {
        type: 'string',
        description: 'Schedule expression value.',
      },
      enabled: {
        type: 'boolean',
        description: 'Whether the job is actively enabled.',
      },
      deliveryChannels: {
        type: 'array',
        items: { type: 'string', enum: ['desktop', 'cli', 'webhook'] },
        description: 'Target channels to notify on job completion or failure.',
      },
      webhookUrl: {
        type: 'string',
        description: 'Optional HTTP webhook destination for run completion payloads.',
      },
    },
    required: ['action'] as string[],
  };

  private static globalEngine: ZavorthSchedulerEngine | null = null;

  public static getEngine(): ZavorthSchedulerEngine {
    if (!this.globalEngine) {
      this.globalEngine = new ZavorthSchedulerEngine();
    }
    return this.globalEngine;
  }

  readonly name = ZavorthSchedulerTool.name;
  readonly description = ZavorthSchedulerTool.description;
  readonly parameters = ZavorthSchedulerTool.schema;

  public async execute(args: Record<string, unknown>): Promise<string> {
    return ZavorthSchedulerTool.execute(args as unknown as ZavorthSchedulerInput);
  }

  public static async execute(input: ZavorthSchedulerInput): Promise<string> {
    const engine = this.getEngine();
    const store = engine.getStore();

    switch (input.action) {
      case 'create': {
        if (!input.name || !input.prompt || !input.scheduleExpr) {
          return JSON.stringify({
            status: 'error',
            message: 'name, prompt, and scheduleExpr are required to create a scheduled job.',
          });
        }

        const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const schedule: JobSchedule = {
          kind: input.scheduleKind || 'every',
          expr: input.scheduleExpr,
        };

        const delivery: JobDeliveryTarget[] = (input.deliveryChannels || ['desktop', 'cli']).map((channel) => ({
          channel,
          webhookUrl: channel === 'webhook' ? input.webhookUrl : undefined,
        }));

        const job: ScheduledJob = {
          id: jobId,
          name: input.name,
          description: input.description,
          prompt: input.prompt,
          schedule,
          sessionTarget: 'isolated',
          delivery,
          enabled: input.enabled !== false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          nextRunAt: engine.calculateNextRun(schedule, jobId),
        };

        const saved = store.saveJob(job);
        return JSON.stringify({
          status: 'success',
          action: 'create',
          job: saved,
          message: `Scheduled job "${saved.name}" created with ID ${saved.id}. Next run: ${saved.nextRunAt}.`,
        });
      }

      case 'list': {
        const jobs = store.listJobs();
        return JSON.stringify({
          status: 'success',
          action: 'list',
          total: jobs.length,
          jobs,
        });
      }

      case 'update': {
        if (!input.jobId) {
          return JSON.stringify({
            status: 'error',
            message: 'jobId is required to update a scheduled job.',
          });
        }

        const existing = store.getJob(input.jobId);
        if (!existing) {
          return JSON.stringify({
            status: 'not_found',
            message: `Job '${input.jobId}' was not found.`,
          });
        }

        if (input.name) existing.name = input.name;
        if (input.description !== undefined) existing.description = input.description;
        if (input.prompt) existing.prompt = input.prompt;
        if (input.enabled !== undefined) existing.enabled = input.enabled;
        if (input.scheduleExpr) {
          existing.schedule.expr = input.scheduleExpr;
          if (input.scheduleKind) existing.schedule.kind = input.scheduleKind;
          existing.nextRunAt = engine.calculateNextRun(existing.schedule, existing.id);
        }

        const saved = store.saveJob(existing);
        return JSON.stringify({
          status: 'success',
          action: 'update',
          job: saved,
          message: `Job "${saved.name}" updated successfully.`,
        });
      }

      case 'delete': {
        if (!input.jobId) {
          return JSON.stringify({
            status: 'error',
            message: 'jobId is required to delete a scheduled job.',
          });
        }

        const deleted = store.deleteJob(input.jobId);
        return JSON.stringify({
          status: deleted ? 'success' : 'not_found',
          action: 'delete',
          jobId: input.jobId,
          message: deleted ? `Job '${input.jobId}' deleted.` : `Job '${input.jobId}' not found.`,
        });
      }

      case 'run_now': {
        if (!input.jobId) {
          return JSON.stringify({
            status: 'error',
            message: 'jobId is required to run a job immediately.',
          });
        }

        const job = store.getJob(input.jobId);
        if (!job) {
          return JSON.stringify({
            status: 'not_found',
            message: `Job '${input.jobId}' not found.`,
          });
        }

        const runRecord = await engine.dispatchJob(job);
        return JSON.stringify({
          status: 'success',
          action: 'run_now',
          run: runRecord,
          message: `Job "${job.name}" executed with status: ${runRecord.status} (${runRecord.durationMs}ms).`,
        });
      }

      case 'get_history': {
        const runs = store.listRuns(input.jobId, 25);
        return JSON.stringify({
          status: 'success',
          action: 'get_history',
          jobId: input.jobId || 'all',
          totalRuns: runs.length,
          runs,
        });
      }

      case 'get_metrics': {
        const metrics = engine.getMetrics();
        return JSON.stringify({
          status: 'success',
          action: 'get_metrics',
          metrics,
        });
      }

      default:
        return JSON.stringify({
          status: 'error',
          message: `Unknown action: ${String(input.action)}`,
        });
    }
  }
}
