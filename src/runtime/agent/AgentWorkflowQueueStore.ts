import * as fs from 'fs';
import * as path from 'path';
import type { UniversalAgentWorkflowJob } from './UniversalAgentRuntimeTypes.js';

export type AgentWorkflowQueueAdapterKind =
  | 'memory'
  | 'json-local'
  | 'postgres'
  | 'redis'
  | 'vercel-queues'
  | 'custom';

export type AgentWorkflowQueueStoreCapabilities = {
  durable: boolean;
  localOnly: boolean;
  multiHostSafe: boolean;
  atomicClaim: boolean;
  lease: boolean;
  heartbeat: boolean;
  backoff: boolean;
  retry: boolean;
};

export type AgentWorkflowQueueStoreDescriptor = {
  kind: AgentWorkflowQueueAdapterKind;
  label: string;
  version: 'agent-workflow-queue-store/v1';
  capabilities: AgentWorkflowQueueStoreCapabilities;
  location?: string;
  notes?: string[];
};

export type AgentWorkflowQueueListOptions = {
  limit?: number;
};

export type AgentWorkflowQueueClaimOptions = {
  workerId: string;
  now: string;
  leaseMs: number;
  limit: number;
};

export type AgentWorkflowQueueHeartbeatOptions = {
  jobId: string;
  workerId: string;
  now: string;
  leaseMs: number;
};

export type AgentWorkflowQueueReleaseExpiredOptions = {
  now: string;
};

export type AgentWorkflowQueueUpsertOptions = {
  expectedLeaseOwner?: string | null;
};

export type AgentWorkflowQueueStore = {
  describe: () => AgentWorkflowQueueStoreDescriptor;
  listJobs: (options?: AgentWorkflowQueueListOptions) => UniversalAgentWorkflowJob[];
  upsertJob: (job: UniversalAgentWorkflowJob, options?: AgentWorkflowQueueUpsertOptions) => UniversalAgentWorkflowJob | null;
  claimQueuedJobs: (options: AgentWorkflowQueueClaimOptions) => UniversalAgentWorkflowJob[];
  heartbeatJob: (options: AgentWorkflowQueueHeartbeatOptions) => UniversalAgentWorkflowJob | null;
  releaseExpiredLeases: (options: AgentWorkflowQueueReleaseExpiredOptions) => UniversalAgentWorkflowJob[];
  replaceJobs?: (jobs: UniversalAgentWorkflowJob[]) => void;
  loadJobs?: () => UniversalAgentWorkflowJob[];
  saveJobs?: (jobs: UniversalAgentWorkflowJob[]) => void;
};

function parseTime(value: unknown): number {
  const time = new Date(String(value || '')).getTime();
  return Number.isFinite(time) ? time : 0;
}

function addMs(value: string, ms: number): string {
  return new Date(parseTime(value) + Math.max(1, ms)).toISOString();
}

function isLeaseExpired(job: UniversalAgentWorkflowJob, now: string): boolean {
  return Boolean(job.leaseOwner) && parseTime(job.leaseExpiresAt) <= parseTime(now);
}

function isEligibleForClaim(job: UniversalAgentWorkflowJob, now: string): boolean {
  if (job.status !== 'queued') {
    return false;
  }
  if (job.nextRunAt && parseTime(job.nextRunAt) > parseTime(now)) {
    return false;
  }
  if (job.leaseOwner && !isLeaseExpired(job, now)) {
    return false;
  }
  return job.attempts < job.maxAttempts;
}

function releaseExpiredLease(job: UniversalAgentWorkflowJob, now: string): UniversalAgentWorkflowJob {
  if (!isLeaseExpired(job, now)) {
    return job;
  }
  return {
    ...job,
    status: job.status === 'running' ? 'queued' : job.status,
    leaseOwner: null,
    leaseExpiresAt: null,
    lockedAt: null,
    heartbeatAt: null,
    updatedAt: now,
    metadata: {
      ...(job.metadata || {}),
      leaseRecoveredAt: now,
    },
  };
}

function claimJob(
  job: UniversalAgentWorkflowJob,
  options: AgentWorkflowQueueClaimOptions,
): UniversalAgentWorkflowJob {
  return {
    ...job,
    status: 'running',
    attempts: job.attempts + 1,
    leaseOwner: options.workerId,
    leaseExpiresAt: addMs(options.now, options.leaseMs),
    lockedAt: options.now,
    heartbeatAt: options.now,
    updatedAt: options.now,
    lastError: null,
    metadata: {
      ...(job.metadata || {}),
      claimedAt: options.now,
      claimedBy: options.workerId,
    },
  };
}

function sortJobs(jobs: UniversalAgentWorkflowJob[]): UniversalAgentWorkflowJob[] {
  return [...jobs].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

function updateJobInList(
  jobs: UniversalAgentWorkflowJob[],
  updatedJob: UniversalAgentWorkflowJob,
  options: AgentWorkflowQueueUpsertOptions = {},
): { jobs: UniversalAgentWorkflowJob[]; job: UniversalAgentWorkflowJob | null } {
  let replaced = false;
  const nextJobs = jobs.map((job) => {
    if (job.id !== updatedJob.id) {
      return job;
    }
    replaced = true;
    if (
      options.expectedLeaseOwner
      && job.leaseOwner
      && job.leaseOwner !== options.expectedLeaseOwner
    ) {
      return job;
    }
    return updatedJob;
  });

  if (!replaced) {
    nextJobs.push(updatedJob);
    return { jobs: nextJobs, job: updatedJob };
  }

  const finalJob = nextJobs.find((job) => job.id === updatedJob.id) || null;
  return { jobs: nextJobs, job: finalJob };
}

export class MemoryAgentWorkflowQueueStore implements AgentWorkflowQueueStore {
  private jobs: UniversalAgentWorkflowJob[] = [];

  public describe(): AgentWorkflowQueueStoreDescriptor {
    return {
      kind: 'memory',
      label: 'In-memory workflow queue',
      version: 'agent-workflow-queue-store/v1',
      capabilities: {
        durable: false,
        localOnly: true,
        multiHostSafe: false,
        atomicClaim: true,
        lease: true,
        heartbeat: true,
        backoff: true,
        retry: true,
      },
      notes: [
        'Usado para testes e execucoes efemeras.',
        'Nao sobrevive a restart.',
      ],
    };
  }

  public listJobs(options: AgentWorkflowQueueListOptions = {}): UniversalAgentWorkflowJob[] {
    const limit = Math.max(1, options.limit || this.jobs.length || 1);
    return [...this.jobs].slice(0, limit);
  }

  public loadJobs(): UniversalAgentWorkflowJob[] {
    return this.listJobs({ limit: this.jobs.length || 1 });
  }

  public replaceJobs(jobs: UniversalAgentWorkflowJob[]): void {
    this.jobs = [...jobs];
  }

  public saveJobs(jobs: UniversalAgentWorkflowJob[]): void {
    this.replaceJobs(jobs);
  }

  public upsertJob(
    job: UniversalAgentWorkflowJob,
    options: AgentWorkflowQueueUpsertOptions = {},
  ): UniversalAgentWorkflowJob | null {
    const result = updateJobInList(this.jobs, job, options);
    this.jobs = result.jobs;
    return result.job;
  }

  public claimQueuedJobs(options: AgentWorkflowQueueClaimOptions): UniversalAgentWorkflowJob[] {
    this.jobs = this.jobs.map((job) => releaseExpiredLease(job, options.now));
    const claimedIds = new Set(
      [...this.jobs]
        .filter((job) => isEligibleForClaim(job, options.now))
        .sort((a, b) =>
          String(a.nextRunAt || a.updatedAt || '').localeCompare(String(b.nextRunAt || b.updatedAt || '')),
        )
        .slice(0, Math.max(1, options.limit))
        .map((job) => job.id),
    );
    const claimed: UniversalAgentWorkflowJob[] = [];
    this.jobs = this.jobs.map((job) => {
      if (!claimedIds.has(job.id)) {
        return job;
      }
      const nextJob = claimJob(job, options);
      claimed.push(nextJob);
      return nextJob;
    });
    return claimed;
  }

  public heartbeatJob(options: AgentWorkflowQueueHeartbeatOptions): UniversalAgentWorkflowJob | null {
    const job = this.jobs.find((candidate) => candidate.id === options.jobId);
    if (!job || job.leaseOwner !== options.workerId || job.status !== 'running') {
      return null;
    }
    const updatedJob = {
      ...job,
      heartbeatAt: options.now,
      leaseExpiresAt: addMs(options.now, options.leaseMs),
      updatedAt: options.now,
    };
    this.upsertJob(updatedJob, { expectedLeaseOwner: options.workerId });
    return updatedJob;
  }

  public releaseExpiredLeases(options: AgentWorkflowQueueReleaseExpiredOptions): UniversalAgentWorkflowJob[] {
    const recovered: UniversalAgentWorkflowJob[] = [];
    this.jobs = this.jobs.map((job) => {
      const nextJob = releaseExpiredLease(job, options.now);
      if (nextJob !== job) {
        recovered.push(nextJob);
      }
      return nextJob;
    });
    return recovered;
  }
}

export type JsonAgentWorkflowQueueStoreOptions = {
  filePath?: string;
  maxJobs?: number;
  lockTimeoutMs?: number;
};

export class JsonAgentWorkflowQueueStore implements AgentWorkflowQueueStore {
  private readonly filePath: string;
  private readonly maxJobs: number;
  private readonly lockTimeoutMs: number;

  constructor(options: JsonAgentWorkflowQueueStoreOptions = {}) {
    this.filePath = options.filePath || path.resolve(process.cwd(), 'data', 'runtime', 'universal-agent-workflow-jobs.json');
    this.maxJobs = Math.max(1, options.maxJobs || 200);
    this.lockTimeoutMs = Math.max(50, options.lockTimeoutMs || 2000);
  }

  public describe(): AgentWorkflowQueueStoreDescriptor {
    return {
      kind: 'json-local',
      label: 'Local JSON workflow queue',
      version: 'agent-workflow-queue-store/v1',
      capabilities: {
        durable: true,
        localOnly: true,
        multiHostSafe: false,
        atomicClaim: true,
        lease: true,
        heartbeat: true,
        backoff: true,
        retry: true,
      },
      location: this.filePath,
      notes: [
        'Usa lock de arquivo para concorrencia local.',
        'Nao substitui um adapter distribuido para multi-host.',
      ],
    };
  }

  public listJobs(options: AgentWorkflowQueueListOptions = {}): UniversalAgentWorkflowJob[] {
    const limit = Math.max(1, options.limit || this.maxJobs);
    return this.readJobs().slice(0, limit);
  }

  public loadJobs(): UniversalAgentWorkflowJob[] {
    return this.listJobs({ limit: this.maxJobs });
  }

  public replaceJobs(jobs: UniversalAgentWorkflowJob[]): void {
    this.withLockedJobs((currentJobs) => {
      const nextJobs = sortJobs(jobs).slice(0, this.maxJobs);
      return {
        jobs: nextJobs,
        result: undefined,
        currentJobs,
      };
    });
  }

  public saveJobs(jobs: UniversalAgentWorkflowJob[]): void {
    this.replaceJobs(jobs);
  }

  public upsertJob(
    job: UniversalAgentWorkflowJob,
    options: AgentWorkflowQueueUpsertOptions = {},
  ): UniversalAgentWorkflowJob | null {
    return this.withLockedJobs((jobs) => {
      const result = updateJobInList(jobs, job, options);
      return {
        jobs: sortJobs(result.jobs).slice(0, this.maxJobs),
        result: result.job,
      };
    });
  }

  public claimQueuedJobs(options: AgentWorkflowQueueClaimOptions): UniversalAgentWorkflowJob[] {
    return this.withLockedJobs((jobs) => {
      const recoveredJobs = jobs.map((job) => releaseExpiredLease(job, options.now));
      const claimedIds = new Set(
        recoveredJobs
          .filter((job) => isEligibleForClaim(job, options.now))
          .sort((a, b) =>
            String(a.nextRunAt || a.updatedAt || '').localeCompare(String(b.nextRunAt || b.updatedAt || '')),
          )
          .slice(0, Math.max(1, options.limit))
          .map((job) => job.id),
      );
      const claimed: UniversalAgentWorkflowJob[] = [];
      const nextJobs = recoveredJobs.map((job) => {
        if (!claimedIds.has(job.id)) {
          return job;
        }
        const nextJob = claimJob(job, options);
        claimed.push(nextJob);
        return nextJob;
      });

      return {
        jobs: sortJobs(nextJobs).slice(0, this.maxJobs),
        result: claimed,
      };
    });
  }

  public heartbeatJob(options: AgentWorkflowQueueHeartbeatOptions): UniversalAgentWorkflowJob | null {
    return this.withLockedJobs((jobs) => {
      let updatedJob: UniversalAgentWorkflowJob | null = null;
      const nextJobs = jobs.map((job) => {
        if (job.id !== options.jobId || job.leaseOwner !== options.workerId || job.status !== 'running') {
          return job;
        }
        updatedJob = {
          ...job,
          heartbeatAt: options.now,
          leaseExpiresAt: addMs(options.now, options.leaseMs),
          updatedAt: options.now,
        };
        return updatedJob;
      });

      return {
        jobs: sortJobs(nextJobs).slice(0, this.maxJobs),
        result: updatedJob,
      };
    });
  }

  public releaseExpiredLeases(options: AgentWorkflowQueueReleaseExpiredOptions): UniversalAgentWorkflowJob[] {
    return this.withLockedJobs((jobs) => {
      const recovered: UniversalAgentWorkflowJob[] = [];
      const nextJobs = jobs.map((job) => {
        const nextJob = releaseExpiredLease(job, options.now);
        if (nextJob !== job) {
          recovered.push(nextJob);
        }
        return nextJob;
      });

      return {
        jobs: sortJobs(nextJobs).slice(0, this.maxJobs),
        result: recovered,
      };
    });
  }

  private readJobs(): UniversalAgentWorkflowJob[] {
    try {
      if (!fs.existsSync(this.filePath)) {
        return [];
      }
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const jobs = Array.isArray(parsed?.jobs) ? parsed.jobs : Array.isArray(parsed) ? parsed : [];
      return jobs
        .filter((job: unknown): job is UniversalAgentWorkflowJob => (
          Boolean(job)
          && typeof job === 'object'
          && typeof (job as { id?: unknown }).id === 'string'
        ))
        .slice(0, this.maxJobs);
    } catch {
      return [];
    }
  }

  private writeJobs(jobs: UniversalAgentWorkflowJob[]): void {
    const sortedJobs = sortJobs(jobs).slice(0, this.maxJobs);
    const payload = {
      version: 'zavorth-universal-agent-workflow-queue/1',
      savedAt: new Date().toISOString(),
      jobs: sortedJobs,
    };
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    fs.renameSync(tempPath, this.filePath);
  }

  private withLockedJobs<T>(
    operation: (jobs: UniversalAgentWorkflowJob[]) => { jobs: UniversalAgentWorkflowJob[]; result: T; currentJobs?: UniversalAgentWorkflowJob[] },
  ): T {
    const lockPath = `${this.filePath}.lock`;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const startedAt = Date.now();
    let lockFd: number | null = null;

    while (lockFd === null) {
      try {
        lockFd = fs.openSync(lockPath, 'wx');
      } catch {
        this.removeStaleLock(lockPath);
        if (Date.now() - startedAt > this.lockTimeoutMs) {
          throw new Error(`Nao consegui adquirir lock local da fila: ${lockPath}`);
        }
        this.sleepSync(10);
      }
    }

    try {
      const currentJobs = this.readJobs();
      const result = operation(currentJobs);
      this.writeJobs(result.jobs);
      return result.result;
    } finally {
      try {
        fs.closeSync(lockFd);
      } catch {
        // ignore close failure
      }
      try {
        fs.unlinkSync(lockPath);
      } catch {
        // ignore stale lock cleanup failure
      }
    }
  }

  private removeStaleLock(lockPath: string): void {
    try {
      const stat = fs.statSync(lockPath);
      if (Date.now() - stat.mtimeMs > this.lockTimeoutMs * 5) {
        fs.unlinkSync(lockPath);
      }
    } catch {
      // ignore missing/inaccessible lock
    }
  }

  private sleepSync(ms: number): void {
    const buffer = new SharedArrayBuffer(4);
    const view = new Int32Array(buffer);
    Atomics.wait(view, 0, 0, Math.max(1, ms));
  }
}

export function createDefaultAgentWorkflowQueueStore(): JsonAgentWorkflowQueueStore {
  return new JsonAgentWorkflowQueueStore();
}
