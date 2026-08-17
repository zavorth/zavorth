/**
 * Scheduler Catchup Recovery Engine.
 * Detects jobs missed during system downtime, crashes, or sleep states.
 * Enforces "at-most-one" execution policy to prevent infinite execution storms on reboot.
 */

import { logger } from '../logger.js';
import type { ScheduledJob } from './types.js';

export interface CatchupEvaluation {
  job: ScheduledJob;
  missedRunsCount: number;
  shouldCatchup: boolean;
  reason: string;
}

export class CatchupRecovery {
  /**
   * Evaluates a job to determine if it missed runs during system downtime.
   */
  static evaluate(job: ScheduledJob, now: Date = new Date()): CatchupEvaluation {
    if (!job.enabled) {
      return {
        job,
        missedRunsCount: 0,
        shouldCatchup: false,
        reason: 'Job is disabled',
      };
    }

    if (!job.nextRunAt) {
      return {
        job,
        missedRunsCount: 0,
        shouldCatchup: false,
        reason: 'No previous schedule timestamp set',
      };
    }

    const scheduledTime = new Date(job.nextRunAt).getTime();
    const currentTime = now.getTime();

    // If scheduled time is in the future, it's not overdue
    if (scheduledTime > currentTime) {
      return {
        job,
        missedRunsCount: 0,
        shouldCatchup: false,
        reason: 'Job is scheduled in the future',
      };
    }

    // Overdue! Calculate approximate missed intervals
    const overdueDurationMs = currentTime - scheduledTime;
    logger.info(`[Catchup] Job "${job.name}" (${job.id}) is overdue by ${Math.round(overdueDurationMs / 1000)}s.`);

    return {
      job,
      missedRunsCount: 1, // Enforce at-most-one catchup run
      shouldCatchup: true,
      reason: `Missed run scheduled for ${job.nextRunAt} (overdue by ${Math.round(overdueDurationMs / 1000)}s).`,
    };
  }

  /**
   * Evaluates all enabled jobs and returns the list of jobs requiring immediate catchup.
   */
  static evaluateAll(jobs: ScheduledJob[], now: Date = new Date()): ScheduledJob[] {
    const overdue: ScheduledJob[] = [];
    for (const job of jobs) {
      const evaluation = this.evaluate(job, now);
      if (evaluation.shouldCatchup) {
        overdue.push(job);
      }
    }
    return overdue;
  }
}
