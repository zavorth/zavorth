import path from 'node:path';

import type { TaskPlaneItem, TaskPlaneStatus } from '../contracts/TaskPlaneContract.js';
import { GoalLoopWorkerService, type GoalLoopWorkerDrainSnapshot } from './GoalLoopWorkerService.js';
import type { TaskPlaneService } from './TaskPlaneService.js';
import { ZavorthOperationalStateDbService, type ZavorthOperationalReceipt } from './ZavorthOperationalStateDbService.js';

export type GoalLoopDaemonStatus = 'idle' | 'running' | 'stopped';

export type GoalLoopDaemonSnapshot = {
  contractVersion: 'goal-loop-daemon/1';
  generatedAt: string;
  daemonId: string;
  status: GoalLoopDaemonStatus;
  intervalMs: number;
  leaseMs: number;
  staleAfterMs: number;
  backoffMs: number;
  maxBackoffMs: number;
  lastHeartbeatAt: string | null;
  lastRunAt: string | null;
  nextRunAfter: string | null;
  consecutiveFailures: number;
  pendingContinuations: number;
  runningContinuations: number;
  staleRecovered: number;
  lastDrain: GoalLoopWorkerDrainSnapshot | null;
  receipt: ZavorthOperationalReceipt | null;
  safety: {
    heartbeatRecorded: boolean;
    backoffEnabled: true;
    staleClaimRecovery: true;
    workerOwnsExecution: true;
  };
};

type GoalLoopDaemonOptions = {
  taskPlane: TaskPlaneService;
  worker: GoalLoopWorkerService;
  stateDb?: ZavorthOperationalStateDbService | null;
  stateDbPath?: string | null;
  now?: () => Date;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
};

type GoalLoopDaemonRunInput = {
  daemonId?: string | null;
  intervalMs?: number | null;
  leaseMs?: number | null;
  staleAfterMs?: number | null;
  maxItems?: number | null;
  maxTicks?: number | null;
  stopWhenIdle?: boolean | null;
  dryRun?: boolean | null;
};

type GoalLoopDaemonRuntimeState = {
  status: GoalLoopDaemonStatus;
  lastHeartbeatAt: string | null;
  lastRunAt: string | null;
  nextRunAfter: string | null;
  consecutiveFailures: number;
  backoffMs: number;
  staleRecovered: number;
  lastDrain: GoalLoopWorkerDrainSnapshot | null;
};

const DEFAULT_INTERVAL_MS = 15_000;
const DEFAULT_LEASE_MS = 5 * 60_000;
const DEFAULT_STALE_AFTER_MS = 10 * 60_000;
const DEFAULT_MAX_BACKOFF_MS = 5 * 60_000;

export class GoalLoopDaemonService {
  private readonly taskPlane: TaskPlaneService;
  private readonly worker: GoalLoopWorkerService;
  private readonly stateDb: ZavorthOperationalStateDbService | null;
  private readonly stateDbPath: string | null;
  private readonly now: () => Date;
  private readonly setTimeoutFn: typeof setTimeout;
  private readonly clearTimeoutFn: typeof clearTimeout;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private state: GoalLoopDaemonRuntimeState = {
    status: 'idle',
    lastHeartbeatAt: null,
    lastRunAt: null,
    nextRunAfter: null,
    consecutiveFailures: 0,
    backoffMs: 0,
    staleRecovered: 0,
    lastDrain: null,
  };

  constructor(options: GoalLoopDaemonOptions) {
    this.taskPlane = options.taskPlane;
    this.worker = options.worker;
    this.stateDb = options.stateDb || null;
    this.stateDbPath = options.stateDbPath ? path.resolve(options.stateDbPath) : null;
    this.now = options.now || (() => new Date());
    this.setTimeoutFn = options.setTimeoutFn || setTimeout;
    this.clearTimeoutFn = options.clearTimeoutFn || clearTimeout;
  }

  public snapshot(input: GoalLoopDaemonRunInput = {}): GoalLoopDaemonSnapshot {
    const daemonId = normalize(input.daemonId, 'goal-loop-daemon');
    return this.buildSnapshot(daemonId, this.resolveConfig(input), null);
  }

  public async tick(input: GoalLoopDaemonRunInput = {}): Promise<GoalLoopDaemonSnapshot> {
    const daemonId = normalize(input.daemonId, 'goal-loop-daemon');
    const config = this.resolveConfig(input);
    if (!this.acquireDaemonLock(daemonId, config)) {
      const receipt = this.recordReceipt(daemonId, 'blocked', 'Goal Loop daemon is already held by another worker.', {
        lock: 'busy',
      });
      return this.buildSnapshot(daemonId, config, receipt);
    }

    this.state.status = 'running';
    this.heartbeat(daemonId, config, 'tick.started');
    try {
      const staleRecovered = input.dryRun ? 0 : this.recoverStaleContinuations(daemonId, config);
      const drain = await this.worker.drain({
        workerId: `${daemonId}:worker`,
        leaseMs: config.leaseMs,
        maxItems: config.maxItems,
        dryRun: input.dryRun,
      });
      this.state.lastRunAt = this.timestamp();
      this.state.lastDrain = drain;
      this.state.staleRecovered += staleRecovered;
      this.state.consecutiveFailures = 0;
      this.state.backoffMs = 0;
      const pending = this.continuationTasks().filter((task) => task.status === 'queued').length;
      this.state.nextRunAfter = new Date(this.now().getTime() + config.intervalMs).toISOString();
      const receipt = this.recordReceipt(daemonId, 'ok', `Goal Loop daemon processed ${drain.processed} continuation task(s).`, {
        processed: drain.processed,
        staleRecovered,
        pending,
        dryRun: Boolean(input.dryRun),
      });
      this.heartbeat(daemonId, config, 'tick.completed');
      this.state.status = this.timer ? 'running' : 'idle';
      return this.buildSnapshot(daemonId, config, receipt);
    } catch (error: any) {
      this.state.consecutiveFailures += 1;
      this.state.backoffMs = Math.min(
        config.maxBackoffMs,
        Math.max(config.intervalMs, config.intervalMs * (2 ** Math.min(this.state.consecutiveFailures - 1, 8))),
      );
      this.state.nextRunAfter = new Date(this.now().getTime() + this.state.backoffMs).toISOString();
      const receipt = this.recordReceipt(daemonId, 'failed', 'Goal Loop daemon tick failed.', {
        error: error instanceof Error ? error.message : String(error),
        backoffMs: this.state.backoffMs,
      });
      this.recordEvent('goal.loop.daemon.failed', daemonId, {
        error: error instanceof Error ? error.message : String(error),
        backoffMs: this.state.backoffMs,
      });
      this.state.status = this.timer ? 'running' : 'idle';
      return this.buildSnapshot(daemonId, config, receipt);
    } finally {
      this.state.status = this.timer ? 'running' : 'idle';
      this.releaseDaemonLock(daemonId);
    }
  }

  public async run(input: GoalLoopDaemonRunInput = {}): Promise<GoalLoopDaemonSnapshot> {
    const daemonId = normalize(input.daemonId, 'goal-loop-daemon');
    const config = this.resolveConfig(input);
    const maxTicks = clampInt(Number(input.maxTicks || 1), 1, 10_000);
    let last = this.snapshot(input);
    for (let index = 0; index < maxTicks; index += 1) {
      last = await this.tick(input);
      if (input.stopWhenIdle && last.pendingContinuations === 0 && last.runningContinuations === 0) {
        break;
      }
      if (index < maxTicks - 1 && !input.dryRun) {
        await sleep(Math.min(config.intervalMs, 100));
      }
    }
    return last;
  }

  public start(input: GoalLoopDaemonRunInput = {}): GoalLoopDaemonSnapshot {
    const daemonId = normalize(input.daemonId, 'goal-loop-daemon');
    const config = this.resolveConfig(input);
    if (this.timer) {
      return this.buildSnapshot(daemonId, config, null);
    }
    this.running = true;
    const schedule = (delayMs: number): void => {
      this.state.nextRunAfter = new Date(this.now().getTime() + delayMs).toISOString();
      this.timer = this.setTimeoutFn(async () => {
        if (!this.running) return;
        const result = await this.tick(input);
        if (!this.running) return;
        const nextDelay = result.backoffMs > 0 ? result.backoffMs : config.intervalMs;
        schedule(nextDelay);
      }, Math.max(1, delayMs));
      this.timer.unref?.();
    };
    this.state.status = 'running';
    this.heartbeat(daemonId, config, 'daemon.started');
    schedule(1);
    return this.buildSnapshot(daemonId, config, null);
  }

  public stop(input: GoalLoopDaemonRunInput = {}): GoalLoopDaemonSnapshot {
    const daemonId = normalize(input.daemonId, 'goal-loop-daemon');
    const config = this.resolveConfig(input);
    this.running = false;
    if (this.timer) {
      this.clearTimeoutFn(this.timer);
      this.timer = null;
    }
    this.state.status = 'stopped';
    this.state.nextRunAfter = null;
    this.heartbeat(daemonId, config, 'daemon.stopped');
    return this.buildSnapshot(daemonId, config, null);
  }

  private recoverStaleContinuations(daemonId: string, config: ReturnType<GoalLoopDaemonService['resolveConfig']>): number {
    const cutoff = this.now().getTime() - config.staleAfterMs;
    let recovered = 0;
    for (const task of this.continuationTasks()) {
      if (!['claimed', 'running'].includes(task.status)) continue;
      const leaseAt = task.claim?.leaseUntil ? Date.parse(task.claim.leaseUntil) : NaN;
      const updatedAt = Date.parse(task.updatedAt);
      const stale = Number.isFinite(leaseAt)
        ? leaseAt <= this.now().getTime()
        : Number.isFinite(updatedAt) && updatedAt <= cutoff;
      if (!stale) continue;
      const nextStatus: TaskPlaneStatus = task.attempts >= 3 ? 'blocked' : 'queued';
      const updated = this.taskPlane.updateStatus(
        task.id,
        nextStatus,
        daemonId,
        nextStatus === 'blocked' ? 'goal-loop-daemon-stale-max-attempts' : 'goal-loop-daemon-stale-recovery',
      );
      if (updated) {
        recovered += 1;
        this.recordEvent('goal.loop.daemon.stale_recovered', task.id, {
          daemonId,
          previousStatus: task.status,
          nextStatus,
          owner: task.claim?.owner || null,
          leaseUntil: task.claim?.leaseUntil || null,
        });
      }
    }
    return recovered;
  }

  private continuationTasks(): TaskPlaneItem[] {
    return this.taskPlane.listTasks()
      .filter((task) => task.source === 'goal-loop')
      .filter((task) => normalize(task.payload.kind) === 'goal-loop-continuation');
  }

  private buildSnapshot(
    daemonId: string,
    config: ReturnType<GoalLoopDaemonService['resolveConfig']>,
    receipt: ZavorthOperationalReceipt | null,
  ): GoalLoopDaemonSnapshot {
    const tasks = this.continuationTasks();
    return {
      contractVersion: 'goal-loop-daemon/1',
      generatedAt: this.timestamp(),
      daemonId,
      status: this.state.status,
      intervalMs: config.intervalMs,
      leaseMs: config.leaseMs,
      staleAfterMs: config.staleAfterMs,
      backoffMs: this.state.backoffMs,
      maxBackoffMs: config.maxBackoffMs,
      lastHeartbeatAt: this.state.lastHeartbeatAt,
      lastRunAt: this.state.lastRunAt,
      nextRunAfter: this.state.nextRunAfter,
      consecutiveFailures: this.state.consecutiveFailures,
      pendingContinuations: tasks.filter((task) => task.status === 'queued').length,
      runningContinuations: tasks.filter((task) => task.status === 'claimed' || task.status === 'running').length,
      staleRecovered: this.state.staleRecovered,
      lastDrain: this.state.lastDrain,
      receipt,
      safety: {
        heartbeatRecorded: Boolean(this.state.lastHeartbeatAt),
        backoffEnabled: true,
        staleClaimRecovery: true,
        workerOwnsExecution: true,
      },
    };
  }

  private heartbeat(daemonId: string, config: ReturnType<GoalLoopDaemonService['resolveConfig']>, eventType: string): void {
    const timestamp = this.timestamp();
    this.state.lastHeartbeatAt = timestamp;
    this.withStateDb((stateDb) => {
      stateDb.setMeta(`goal-loop-daemon:${daemonId}`, {
        daemonId,
        status: this.state.status,
        heartbeatAt: timestamp,
        intervalMs: config.intervalMs,
        leaseMs: config.leaseMs,
        staleAfterMs: config.staleAfterMs,
        backoffMs: this.state.backoffMs,
        consecutiveFailures: this.state.consecutiveFailures,
      });
      stateDb.recordEvent('goal-loop', eventType, daemonId, {
        daemonId,
        heartbeatAt: timestamp,
        pendingContinuations: this.continuationTasks().filter((task) => task.status === 'queued').length,
      });
      return null;
    }, null);
  }

  private acquireDaemonLock(daemonId: string, config: ReturnType<GoalLoopDaemonService['resolveConfig']>): boolean {
    return this.withStateDb((stateDb) => stateDb.acquireLock('goal-loop-daemon', daemonId, config.leaseMs, {
      daemonId,
      purpose: 'goal-loop-continuation-drain',
    }), true);
  }

  private releaseDaemonLock(daemonId: string): void {
    this.withStateDb((stateDb) => {
      stateDb.releaseLock('goal-loop-daemon', daemonId);
      return null;
    }, null);
  }

  private recordReceipt(
    daemonId: string,
    status: string,
    summary: string,
    data: Record<string, unknown>,
  ): ZavorthOperationalReceipt | null {
    return this.withStateDb((stateDb) => stateDb.recordReceipt({
      actionId: 'goals.loop.daemon',
      status,
      sourceSurface: 'goal-loop-daemon',
      summary,
      data: {
        daemonId,
        ...data,
      },
    }), null);
  }

  private recordEvent(type: string, subjectId: string | null, payload: Record<string, unknown>): void {
    this.withStateDb((stateDb) => {
      stateDb.recordEvent('goal-loop', type, subjectId, payload);
      return null;
    }, null);
  }

  private resolveConfig(input: GoalLoopDaemonRunInput) {
    return {
      intervalMs: clampInt(Number(input.intervalMs || DEFAULT_INTERVAL_MS), 100, 24 * 60 * 60 * 1000),
      leaseMs: clampInt(Number(input.leaseMs || DEFAULT_LEASE_MS), 1_000, 24 * 60 * 60 * 1000),
      staleAfterMs: clampInt(Number(input.staleAfterMs || DEFAULT_STALE_AFTER_MS), 1_000, 24 * 60 * 60 * 1000),
      maxBackoffMs: DEFAULT_MAX_BACKOFF_MS,
      maxItems: clampInt(Number(input.maxItems || 5), 1, 50),
    };
  }

  private withStateDb<T>(fn: (stateDb: ZavorthOperationalStateDbService) => T, fallback: T): T {
    if (this.stateDb) return fn(this.stateDb);
    if (!this.stateDbPath) return fallback;
    const stateDb = new ZavorthOperationalStateDbService({ dbPath: this.stateDbPath, now: this.now });
    try {
      return fn(stateDb);
    } finally {
      stateDb.close();
    }
  }

  private timestamp(): string {
    return this.now().toISOString();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
