/**
 * Persistent Job Store.
 * Durable, atomic storage for scheduled jobs and historical execution records.
 * Uses atomic filesystem writes to guarantee zero database/JSON corruption upon abrupt shutdowns.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { logger } from '../logger.js';
import type { ScheduledJob, JobRunRecord } from './types.js';

export interface PersistentJobStoreConfig {
  storageDir?: string;
  maxHistoricalRuns?: number;
}

export class PersistentJobStore {
  private readonly storageDir: string;
  private readonly jobsFile: string;
  private readonly runsFile: string;
  private readonly maxHistoricalRuns: number;

  private jobs = new Map<string, ScheduledJob>();
  private runs: JobRunRecord[] = [];

  constructor(config: PersistentJobStoreConfig = {}) {
    const rootDir = process.cwd();
    this.storageDir = config.storageDir || path.join(rootDir, '.zavorth', 'scheduler');
    this.jobsFile = path.join(this.storageDir, 'jobs.json');
    this.runsFile = path.join(this.storageDir, 'runs.json');
    this.maxHistoricalRuns = config.maxHistoricalRuns || 500;

    this.ensureStorageDir();
    this.loadFromDisk();
  }

  private ensureStorageDir(): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
    } catch (err: unknown) {
      logger.error(`[JobStore] Failed to create scheduler directory: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private loadFromDisk(): void {
    // 1. Load jobs
    try {
      if (fs.existsSync(this.jobsFile)) {
        const raw = fs.readFileSync(this.jobsFile, 'utf-8');
        const parsed = JSON.parse(raw) as ScheduledJob[];
        this.jobs.clear();
        for (const job of parsed) {
          this.jobs.set(job.id, job);
        }
      }
    } catch (err: unknown) {
      logger.warn(`[JobStore] Failed to read jobs from disk: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 2. Load historical runs
    try {
      if (fs.existsSync(this.runsFile)) {
        const raw = fs.readFileSync(this.runsFile, 'utf-8');
        this.runs = JSON.parse(raw) as JobRunRecord[];
      }
    } catch (err: unknown) {
      logger.warn(`[JobStore] Failed to read runs from disk: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private persistJobsToDisk(): void {
    try {
      this.ensureStorageDir();
      const tmpFile = `${this.jobsFile}.${Date.now()}.tmp`;
      const data = JSON.stringify(Array.from(this.jobs.values()), null, 2);
      fs.writeFileSync(tmpFile, data, 'utf-8');
      fs.renameSync(tmpFile, this.jobsFile);
    } catch (err: unknown) {
      logger.error(`[JobStore] Failed to atomically save jobs: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private persistRunsToDisk(): void {
    try {
      this.ensureStorageDir();
      const tmpFile = `${this.runsFile}.${Date.now()}.tmp`;
      const data = JSON.stringify(this.runs.slice(-this.maxHistoricalRuns), null, 2);
      fs.writeFileSync(tmpFile, data, 'utf-8');
      fs.renameSync(tmpFile, this.runsFile);
    } catch (err: unknown) {
      logger.error(`[JobStore] Failed to atomically save runs: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  public saveJob(job: ScheduledJob): ScheduledJob {
    const updated: ScheduledJob = {
      ...job,
      updatedAt: new Date().toISOString(),
    };
    this.jobs.set(updated.id, updated);
    this.persistJobsToDisk();
    return updated;
  }

  public getJob(id: string): ScheduledJob | undefined {
    return this.jobs.get(id);
  }

  public listJobs(filter?: { enabledOnly?: boolean }): ScheduledJob[] {
    const all = Array.from(this.jobs.values());
    if (filter?.enabledOnly) {
      return all.filter((j) => j.enabled);
    }
    return all;
  }

  public deleteJob(id: string): boolean {
    const deleted = this.jobs.delete(id);
    if (deleted) {
      this.persistJobsToDisk();
    }
    return deleted;
  }

  public recordRun(record: JobRunRecord): void {
    this.runs.push(record);
    if (this.runs.length > this.maxHistoricalRuns) {
      this.runs = this.runs.slice(-this.maxHistoricalRuns);
    }
    this.persistRunsToDisk();
  }

  public listRuns(jobId?: string, limit = 50): JobRunRecord[] {
    const filtered = jobId ? this.runs.filter((r) => r.jobId === jobId) : this.runs;
    return filtered.slice(-limit).reverse();
  }

  public getLatestRun(jobId: string): JobRunRecord | undefined {
    for (let i = this.runs.length - 1; i >= 0; i--) {
      if (this.runs[i].jobId === jobId) {
        return this.runs[i];
      }
    }
    return undefined;
  }

  public clearAll(): void {
    this.jobs.clear();
    this.runs = [];
    try {
      if (fs.existsSync(this.jobsFile)) fs.unlinkSync(this.jobsFile);
      if (fs.existsSync(this.runsFile)) fs.unlinkSync(this.runsFile);
    } catch (err: unknown) {
      logger.debug(`[JobStore] Clear files failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
