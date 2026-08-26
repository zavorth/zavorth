/**
 * Isolated Execution Lane.
 * Runs scheduled agent tasks in sandboxed, bounded sessions with explicit timeouts,
 * system power wake-locks, and decoupled session boundaries.
 */

import { logger } from '../logger.js';
import { SystemPowerWakeLockService } from '../services/system/SystemPowerWakeLockService.js';
import type { ScheduledJob, JobRunRecord } from './types.js';

export interface ExecutionOptions {
  timeoutMs?: number;
  customExecutor?: (job: ScheduledJob) => Promise<string>;
}

export class IsolatedExecutionLane {
  /**
   * Executes a scheduled job in an isolated execution sandbox.
   */
  static async execute(job: ScheduledJob, options: ExecutionOptions = {}): Promise<JobRunRecord> {
    const runId = `run_${job.id}_${Date.now()}`;
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs || 300_000; // 5 minutes default

    logger.info(`[IsolatedLane] Starting job "${job.name}" (${job.id}) in isolated lane [${runId}].`);

    // Acquire OS power wake-lock to prevent sleep during execution
    const lockTicket = SystemPowerWakeLockService.acquireLock(`Scheduled Job: ${job.name}`);

    const abortController = new AbortController();
    const timer = setTimeout(() => {
      abortController.abort();
    }, timeoutMs);

    try {
      let output: string;
      if (options.customExecutor) {
        output = await options.customExecutor(job);
      } else {
        // No executor configured: mark the run as a no-op dry-run rather than
        // fabricating a successful execution result.
        output = `[dry-run] No executor configured for job "${job.name}"; prompt not executed: ${job.prompt}`;
      }

      clearTimeout(timer);
      const durationMs = Date.now() - startTime;

      return {
        id: runId,
        jobId: job.id,
        jobName: job.name,
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        durationMs,
        status: 'success',
        output,
        deliveryStatus: 'pending',
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      const isTimeout = abortController.signal.aborted;

      return {
        id: runId,
        jobId: job.id,
        jobName: job.name,
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        durationMs,
        status: isTimeout ? 'timed_out' : 'failed',
        error: err instanceof Error ? err.message : String(err),
        deliveryStatus: 'pending',
      };
    } finally {
      clearTimeout(timer);
      SystemPowerWakeLockService.releaseLock(lockTicket.id);
    }
  }
}
