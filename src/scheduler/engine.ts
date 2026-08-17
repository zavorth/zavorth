/**
 * Zavorth Scheduler Engine.
 * Central coordinator for durable cron jobs, interval scheduling, restart catchup,
 * load staggering, isolated lane execution, and multi-channel delivery.
 */

import { logger } from '../logger.js';
import { PersistentJobStore } from './store.js';
import { CatchupRecovery } from './catchup.js';
import { JobStagger } from './stagger.js';
import { IsolatedExecutionLane } from './isolated-lane.js';
import { JobDeliveryDispatcher } from './delivery.js';
import type {
  ScheduledJob,
  JobRunRecord,
  JobSchedule,
  SchedulerMetrics,
} from './types.js';

export interface SchedulerEngineConfig {
  store?: PersistentJobStore;
  tickIntervalMs?: number;
  enableCatchupOnStart?: boolean;
  enableStagger?: boolean;
}

export class ZavorthSchedulerEngine {
  private readonly store: PersistentJobStore;
  private readonly tickIntervalMs: number;
  private readonly enableCatchupOnStart: boolean;
  private readonly enableStagger: boolean;

  private isRunning = false;
  private tickTimer: NodeJS.Timeout | null = null;
  private lastTickAt?: string;

  constructor(config: SchedulerEngineConfig = {}) {
    this.store = config.store || new PersistentJobStore();
    this.tickIntervalMs = config.tickIntervalMs || 10_000;
    this.enableCatchupOnStart = config.enableCatchupOnStart ?? true;
    this.enableStagger = config.enableStagger ?? true;
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('[SchedulerEngine] Starting Zavorth Scheduler Engine.');

    // 1. Run catchup evaluation on startup
    if (this.enableCatchupOnStart) {
      await this.runStartupCatchup();
    }

    // 2. Schedule all active jobs
    this.recomputeNextRuns();

    // 3. Start tick loop
    this.tickTimer = setInterval(() => {
      void this.tick();
    }, this.tickIntervalMs);
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    logger.info('[SchedulerEngine] Stopped Zavorth Scheduler Engine.');
  }

  public async tick(now: Date = new Date()): Promise<void> {
    this.lastTickAt = now.toISOString();
    const jobs = this.store.listJobs({ enabledOnly: true });

    for (const job of jobs) {
      if (!job.nextRunAt) {
        job.nextRunAt = this.calculateNextRun(job.schedule, job.id, now);
        this.store.saveJob(job);
        continue;
      }

      const nextRunTime = new Date(job.nextRunAt).getTime();
      if (now.getTime() >= nextRunTime) {
        // Time to execute!
        await this.dispatchJob(job);
      }
    }
  }

  public async dispatchJob(job: ScheduledJob): Promise<JobRunRecord> {
    logger.info(`[SchedulerEngine] Dispatching job "${job.name}" (${job.id}).`);

    // 1. Run in isolated execution lane
    const runRecord = await IsolatedExecutionLane.execute(job);

    // 2. Deliver result to configured targets
    const delivered = await JobDeliveryDispatcher.dispatch(runRecord, job.delivery);
    runRecord.deliveryStatus = delivered ? 'delivered' : 'failed';

    // 3. Save run history
    this.store.recordRun(runRecord);

    // 4. Update job lastRunAt and nextRunAt
    job.lastRunAt = runRecord.startedAt;
    job.nextRunAt = this.calculateNextRun(job.schedule, job.id, new Date());
    this.store.saveJob(job);

    return runRecord;
  }

  private async runStartupCatchup(): Promise<void> {
    const jobs = this.store.listJobs({ enabledOnly: true });
    const overdue = CatchupRecovery.evaluateAll(jobs);

    if (overdue.length > 0) {
      logger.info(`[SchedulerEngine] Found ${overdue.length} overdue jobs requiring restart catchup.`);
      for (const job of overdue) {
        await this.dispatchJob(job);
      }
    }
  }

  public recomputeNextRuns(): void {
    const now = new Date();
    const jobs = this.store.listJobs();
    for (const job of jobs) {
      if (job.enabled && !job.nextRunAt) {
        job.nextRunAt = this.calculateNextRun(job.schedule, job.id, now);
        this.store.saveJob(job);
      }
    }
  }

  public calculateNextRun(schedule: JobSchedule, jobId: string, fromDate: Date = new Date()): string {
    let nextDate: Date;

    switch (schedule.kind) {
      case 'every': {
        const intervalMs = this.parseHumanInterval(schedule.expr);
        nextDate = new Date(fromDate.getTime() + intervalMs);
        break;
      }

      case 'at': {
        nextDate = new Date(schedule.expr);
        break;
      }

      case 'cron':
      default: {
        // Standard interval approximation (e.g. daily, hourly, minutely)
        nextDate = this.parseSimpleCronNext(schedule.expr, fromDate);
        break;
      }
    }

    if (this.enableStagger) {
      nextDate = JobStagger.applyStagger(nextDate, jobId, 15_000);
    }

    return nextDate.toISOString();
  }

  private parseHumanInterval(expr: string): number {
    const trimmed = expr.trim().toLowerCase();
    if (trimmed.endsWith('h')) {
      const hours = parseFloat(trimmed.slice(0, -1)) || 1;
      return hours * 3600 * 1000;
    }
    if (trimmed.endsWith('m')) {
      const mins = parseFloat(trimmed.slice(0, -1)) || 1;
      return mins * 60 * 1000;
    }
    if (trimmed.endsWith('s')) {
      const secs = parseFloat(trimmed.slice(0, -1)) || 1;
      return secs * 1000;
    }
    return 60 * 60 * 1000; // Default 1h
  }

  private parseSimpleCronNext(cronExpr: string, fromDate: Date): Date {
    // Basic resilient parser for standard intervals
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length >= 5 && parts[0].startsWith('*/')) {
      const step = parseInt(parts[0].replace('*/', ''), 10) || 5;
      return new Date(fromDate.getTime() + step * 60 * 1000);
    }
    // Default hourly advance
    return new Date(fromDate.getTime() + 60 * 60 * 1000);
  }

  public getMetrics(): SchedulerMetrics {
    const allJobs = this.store.listJobs();
    const activeJobs = allJobs.filter((j) => j.enabled).length;
    const runs = this.store.listRuns(undefined, 1000);
    const successfulRuns = runs.filter((r) => r.status === 'success').length;
    const failedRuns = runs.filter((r) => r.status === 'failed' || r.status === 'timed_out').length;

    return {
      totalJobs: allJobs.length,
      activeJobs,
      totalRuns: runs.length,
      successfulRuns,
      failedRuns,
      lastTickAt: this.lastTickAt,
    };
  }

  public getStore(): PersistentJobStore {
    return this.store;
  }
}
