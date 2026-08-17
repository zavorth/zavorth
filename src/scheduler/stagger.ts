/**
 * Job Stagger & Jitter Engine.
 * Prevents CPU, memory, and network burst storms by deterministically spreading out
 * jobs that share identical schedules (e.g. top-of-hour ":00" cron triggers).
 */

import * as crypto from 'node:crypto';

export class JobStagger {
  /**
   * Calculates a deterministic offset in milliseconds (between 0 and maxWindowMs)
   * based on the unique jobId to evenly distribute execution load across workers.
   */
  static calculateOffsetMs(jobId: string, maxWindowMs = 30_000): number {
    if (!jobId || maxWindowMs <= 0) return 0;

    const hash = crypto.createHash('sha256').update(jobId).digest('hex');
    const hashInt = parseInt(hash.slice(0, 8), 16);
    return hashInt % maxWindowMs;
  }

  /**
   * Applies stagger offset to a computed target run date.
   */
  static applyStagger(targetDate: Date, jobId: string, maxWindowMs = 30_000): Date {
    const offsetMs = this.calculateOffsetMs(jobId, maxWindowMs);
    return new Date(targetDate.getTime() + offsetMs);
  }
}
