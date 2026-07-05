import path from 'node:path';

import type { TaskPlaneItem } from '../contracts/TaskPlaneContract.js';
import type { GoalPlaneItem } from './GoalPlaneService.js';
import { GoalPlaneService } from './GoalPlaneService.js';
import { TaskPlaneService } from './TaskPlaneService.js';
import { logger } from '../logger.js';
import {
ZavorthOperationalStateDbService,
  type ZavorthOperationalEvent,
  type ZavorthOperationalReceipt,
} from './ZavorthOperationalStateDbService.js';

export type GoalLoopStatusProjection = {
  contractVersion: 'goal-loop-status/1';
  generatedAt: string;
  daemon: {
    daemonId: string;
    status: 'active' | 'idle' | 'disabled' | 'unknown';
    enabled: boolean;
    heartbeatAt: string | null;
    nextRunAfter: string | null;
    intervalMs: number | null;
    leaseMs: number | null;
    staleAfterMs: number | null;
    backoffMs: number;
    consecutiveFailures: number;
  };
  goals: {
    active: number;
    paused: number;
    done: number;
    cancelled: number;
    total: number;
    current: GoalPlaneItem | null;
  };
  continuations: {
    queued: number;
    running: number;
    blocked: number;
    failed: number;
    done: number;
    currentTask: TaskPlaneItem | null;
  };
  latest: {
    event: ZavorthOperationalEvent | null;
    receipt: ZavorthOperationalReceipt | null;
  };
  lines: string[];
  safety: {
    readOnly: true;
    stateDbBacked: boolean;
    noSilentExecution: true;
  };
};

type GoalLoopStatusProjectionOptions = {
  taskPlane?: Pick<TaskPlaneService, 'listTasks'> | null;
  goalPlane?: Pick<GoalPlaneService, 'snapshot'> | null;
  taskStorePath?: string | null;
  goalStorePath?: string | null;
  stateDb?: ZavorthOperationalStateDbService | null;
  stateDbPath?: string | null;
  daemonId?: string | null;
  daemonEnabled?: boolean | null;
  intervalMs?: number | null;
  leaseMs?: number | null;
  staleAfterMs?: number | null;
  now?: () => Date;
};

type StoredHeartbeat = {
  daemonId?: string;
  status?: string;
  heartbeatAt?: string;
  intervalMs?: number;
  leaseMs?: number;
  staleAfterMs?: number;
  backoffMs?: number;
  consecutiveFailures?: number;
};

export class GoalLoopStatusProjectionService {
  private readonly taskPlane: Pick<TaskPlaneService, 'listTasks'> | null;
  private readonly goalPlane: Pick<GoalPlaneService, 'snapshot'> | null;
  private readonly taskStorePath: string | null;
  private readonly goalStorePath: string | null;
  private readonly stateDb: ZavorthOperationalStateDbService | null;
  private readonly stateDbPath: string | null;
  private readonly daemonId: string;
  private readonly daemonEnabled: boolean;
  private readonly intervalMs: number | null;
  private readonly leaseMs: number | null;
  private readonly staleAfterMs: number | null;
  private readonly now: () => Date;

  constructor(options: GoalLoopStatusProjectionOptions = {}) {
    this.taskPlane = options.taskPlane || null;
    this.goalPlane = options.goalPlane || null;
    this.taskStorePath = options.taskStorePath ? path.resolve(options.taskStorePath) : null;
    this.goalStorePath = options.goalStorePath ? path.resolve(options.goalStorePath) : null;
    this.stateDb = options.stateDb || null;
    this.stateDbPath = options.stateDbPath ? path.resolve(options.stateDbPath) : null;
    this.daemonId = normalize(options.daemonId, 'bootstrap-goal-loop-daemon');
    this.daemonEnabled = options.daemonEnabled !== false;
    this.intervalMs = finiteNumber(options.intervalMs);
    this.leaseMs = finiteNumber(options.leaseMs);
    this.staleAfterMs = finiteNumber(options.staleAfterMs);
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(): GoalLoopStatusProjection {
    const goals = this.readGoals();
    const tasks = this.readContinuationTasks();
    const heartbeat = this.readHeartbeat();
    const latestEvents = this.withStateDb((stateDb) => stateDb.listEvents({ stream: 'goal-loop', limit: 25 }), []);
    const latestReceipts = this.withStateDb((stateDb) => stateDb.listReceipts(25), [])
      .filter((receipt) => ['goals.loop.daemon', 'goals.loop.step'].includes(String(receipt.actionId || '')));
    const currentGoal = selectCurrentGoal(goals);
    const currentTask = selectCurrentTask(tasks);
    const heartbeatAt = heartbeat?.heartbeatAt || null;
    const intervalMs = finiteNumber(heartbeat?.intervalMs) || this.intervalMs;
    const backoffMs = finiteNumber(heartbeat?.backoffMs) || 0;
    const nextRunAfter = heartbeatAt && intervalMs
      ? new Date(Date.parse(heartbeatAt) + Math.max(intervalMs, backoffMs)).toISOString()
      : null;
    const daemonStatus = this.resolveDaemonStatus(heartbeatAt);

    const projection: GoalLoopStatusProjection = {
      contractVersion: 'goal-loop-status/1',
      generatedAt: this.now().toISOString(),
      daemon: {
        daemonId: normalize(heartbeat?.daemonId, this.daemonId),
        status: daemonStatus,
        enabled: this.daemonEnabled,
        heartbeatAt,
        nextRunAfter,
        intervalMs,
        leaseMs: finiteNumber(heartbeat?.leaseMs) || this.leaseMs,
        staleAfterMs: finiteNumber(heartbeat?.staleAfterMs) || this.staleAfterMs,
        backoffMs,
        consecutiveFailures: finiteNumber(heartbeat?.consecutiveFailures) || 0,
      },
      goals: {
        active: goals.filter((goal) => goal.status === 'active').length,
        paused: goals.filter((goal) => goal.status === 'paused').length,
        done: goals.filter((goal) => goal.status === 'done').length,
        cancelled: goals.filter((goal) => goal.status === 'cancelled').length,
        total: goals.length,
        current: currentGoal,
      },
      continuations: {
        queued: tasks.filter((task) => task.status === 'queued').length,
        running: tasks.filter((task) => task.status === 'claimed' || task.status === 'running').length,
        blocked: tasks.filter((task) => task.status === 'blocked').length,
        failed: tasks.filter((task) => task.status === 'failed').length,
        done: tasks.filter((task) => task.status === 'done').length,
        currentTask,
      },
      latest: {
        event: latestEvents[latestEvents.length - 1] || null,
        receipt: latestReceipts[0] || null,
      },
      lines: [],
      safety: {
        readOnly: true,
        stateDbBacked: Boolean(this.stateDb || this.stateDbPath),
        noSilentExecution: true,
      },
    };
    projection.lines = buildLines(projection);
    return projection;
  }

  private readGoals(): GoalPlaneItem[] {
    try {
      if (this.goalPlane) return this.goalPlane.snapshot().goals;
      if (!this.goalStorePath) return [];
      return new GoalPlaneService({
        storePath: this.goalStorePath,
        stateDbPath: this.stateDbPath,
        now: this.now,
      }).snapshot().goals;
    } catch (error) { logger.warn('[Goal Loop Status Projection] creation failed', error); return []; }
  }

  private readContinuationTasks(): TaskPlaneItem[] {
    try {
      const tasks = this.taskPlane
        ? this.taskPlane.listTasks()
        : this.taskStorePath
          ? new TaskPlaneService({
              storePath: this.taskStorePath,
              stateDbPath: this.stateDbPath,
              now: this.now,
            }).listTasks()
          : [];
      return tasks
        .filter((task) => task.source === 'goal-loop')
        .filter((task) => normalize((task.payload || {}).kind) === 'goal-loop-continuation');
    } catch (error) { logger.warn('[Goal Loop Status Projection] load operation failed', error); return []; }
  }

  private readHeartbeat(): StoredHeartbeat | null {
    return this.withStateDb(
      (stateDb) => (
        stateDb.getMeta<StoredHeartbeat>(`goal-loop-daemon:${this.daemonId}`)
        || stateDb.getMeta<StoredHeartbeat>('goal-loop-daemon:bootstrap-goal-loop-daemon')
        || stateDb.getMeta<StoredHeartbeat>('goal-loop-daemon:cli-goal-loop-daemon')
      ),
      null,
    );
  }

  private resolveDaemonStatus(heartbeatAt: string | null): GoalLoopStatusProjection['daemon']['status'] {
    if (!this.daemonEnabled) return 'disabled';
    if (!heartbeatAt) return 'idle';
    const heartbeatMs = Date.parse(heartbeatAt);
    const interval = this.intervalMs || 15_000;
    if (!Number.isFinite(heartbeatMs)) return 'unknown';
    return this.now().getTime() - heartbeatMs <= Math.max(interval * 3, 60_000) ? 'active' : 'idle';
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
}

function selectCurrentGoal(goals: GoalPlaneItem[]): GoalPlaneItem | null {
  return [...goals]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .find((goal) => goal.status === 'active')
    || [...goals].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0]
    || null;
}

function selectCurrentTask(tasks: TaskPlaneItem[]): TaskPlaneItem | null {
  return [...tasks]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .find((task) => ['claimed', 'running', 'queued'].includes(task.status))
    || [...tasks].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0]
    || null;
}

function buildLines(snapshot: GoalLoopStatusProjection): string[] {
  const goal = snapshot.goals.current;
  if (!goal) {
    return [
      snapshot.daemon.enabled ? 'Goal loop idle: no standing goal.' : 'Goal loop disabled.',
      `Daemon: ${snapshot.daemon.status}.`,
      `Continuations: ${snapshot.continuations.queued} queued, ${snapshot.continuations.running} running.`,
    ];
  }
  const progress = `${goal.turnsUsed}/${goal.maxTurns}`;
  if (goal.status === 'done') {
    return [
      `Goal achieved: ${goal.objective}`,
      `Turns used: ${progress}.`,
      `Daemon: ${snapshot.daemon.status}.`,
    ];
  }
  if (goal.status === 'paused') {
    return [
      `Goal paused: ${goal.objective}`,
      `Turns used: ${progress}.`,
      `Next continuation: ${snapshot.continuations.currentTask?.status || 'none'}.`,
    ];
  }
  return [
    `Continuing goal: ${goal.objective}`,
    `Progress: ${progress}.`,
    `Next tick: ${snapshot.daemon.nextRunAfter || 'waiting for heartbeat'}.`,
  ];
}

function normalize(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function finiteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
