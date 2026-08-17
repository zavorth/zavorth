/**
 * Scheduler Subsystem Types.
 * Production-grade job scheduling, delivery, and execution contracts.
 * Strictly typed (Zero any) and EN-First.
 */

export type JobScheduleKind = 'cron' | 'every' | 'at';

export interface JobSchedule {
  kind: JobScheduleKind;
  /** Standard cron expression (e.g. "0 9 * * 1-5") or human interval (e.g. "2h", "30m") or ISO timestamp. */
  expr: string;
  /** Optional timezone (e.g. "UTC", "America/Sao_Paulo"). Defaults to local system timezone. */
  timezone?: string;
}

export type JobSessionTarget = 'isolated' | 'main';

export interface JobDeliveryTarget {
  channel: 'desktop' | 'telegram' | 'discord' | 'slack' | 'webhook' | 'cli';
  recipientId?: string;
  webhookUrl?: string;
}

export interface JobRetryPolicy {
  maxRetries: number;
  backoffMs: number;
  exponential: boolean;
}

export interface ScheduledJob {
  id: string;
  name: string;
  description?: string;
  prompt: string;
  schedule: JobSchedule;
  sessionTarget: JobSessionTarget;
  delivery: JobDeliveryTarget[];
  retryPolicy?: JobRetryPolicy;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  nextRunAt?: string;
  tags?: string[];
}

export type JobRunStatus = 'running' | 'success' | 'failed' | 'cancelled' | 'timed_out';

export interface JobRunRecord {
  id: string;
  jobId: string;
  jobName: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  status: JobRunStatus;
  output?: string;
  error?: string;
  deliveryStatus: 'pending' | 'delivered' | 'failed' | 'skipped';
  retryAttempt?: number;
}

export interface SchedulerMetrics {
  totalJobs: number;
  activeJobs: number;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  lastTickAt?: string;
}
