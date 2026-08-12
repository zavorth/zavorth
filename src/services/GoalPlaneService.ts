import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { TaskPlaneService } from './TaskPlaneService.js';
import { ZavorthOperationalStateDbService } from './ZavorthOperationalStateDbService.js';
import { logger } from '../logger.js';

export type GoalPlaneStatus = 'active' | 'paused' | 'done' | 'cancelled';

export type GoalPlaneItem = {
  contractVersion: 'goal-plane-item/1';
  id: string;
  objective: string;
  status: GoalPlaneStatus;
  createdAt: string;
  updatedAt: string;
  sessionId: string | null;
  profileId: string | null;
  maxTurns: number;
  turnsUsed: number;
  taskPlaneItemId: string | null;
  history: Array<{
    at: string;
    event: string;
    actor: string;
    detail?: string;
  }>;
};

export type GoalPlaneSnapshot = {
  contractVersion: 'goal-plane/1';
  generatedAt: string;
  storePath: string;
  summary: Record<GoalPlaneStatus, number> & { total: number };
  goals: GoalPlaneItem[];
  safety: {
    noSilentMutation: true;
    taskPlaneBacked: boolean;
    explicitStateTransitions: true;
  };
};

type GoalPlaneOptions = {
  storePath: string;
  taskPlane?: TaskPlaneService | null;
  stateDb?: ZavorthOperationalStateDbService | null;
  stateDbPath?: string | null;
  now?: () => Date;
};

type CreateGoalInput = {
  objective: string;
  sessionId?: string | null;
  profileId?: string | null;
  maxTurns?: number | null;
  actor?: string | null;
};

export class GoalPlaneService {
  private readonly storePath: string;
  private readonly taskPlane: TaskPlaneService | null;
  private readonly stateDb: ZavorthOperationalStateDbService | null;
  private readonly stateDbPath: string | null;
  private readonly now: () => Date;
  private legacySeeded = false;

  constructor(options: GoalPlaneOptions) {
    this.storePath = path.resolve(options.storePath);
    this.taskPlane = options.taskPlane || null;
    this.stateDb = options.stateDb || null;
    this.stateDbPath = options.stateDbPath ? path.resolve(options.stateDbPath) : null;
    this.now = options.now || (() => new Date());
  }

  public createGoal(input: CreateGoalInput): GoalPlaneItem {
    const objective = String(input.objective || '').trim();
    if (!objective) {
      throw new Error('Goal objective is required.');
    }
    const store = this.readStore();
    const timestamp = this.timestamp();
    const actor = String(input.actor || 'operator').trim() || 'operator';
    const task = this.taskPlane?.createTask({
      title: `Goal: ${this.title(objective)}`,
      source: 'goal-plane',
      payload: {
        kind: 'goal-plane-run',
        objective,
        sessionId: input.sessionId || null,
        profileId: input.profileId || null,
      },
    }) || null;
    if (this.hasStateDb()) {
      return this.withStateDb((stateDb) => stateDb.createGoal({
        objective,
        sessionId: input.sessionId || null,
        profileId: input.profileId || null,
        maxTurns: input.maxTurns || 12,
        actor,
        taskPlaneItemId: task?.id || null,
      }));
    }
    const goal: GoalPlaneItem = {
      contractVersion: 'goal-plane-item/1',
      id: `goal-${randomUUID()}`,
      objective,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
      sessionId: input.sessionId || null,
      profileId: input.profileId || null,
      maxTurns: clamp(Number(input.maxTurns || 12), 1, 200),
      turnsUsed: 0,
      taskPlaneItemId: task?.id || null,
      history: [{ at: timestamp, event: 'goal.created', actor }],
    };
    store.goals.push(goal);
    this.writeStore(store);
    return clone(goal);
  }

  public snapshot(): GoalPlaneSnapshot {
    const goals = this.hasStateDb() ? this.withStateDb((stateDb) => stateDb.listGoals()) : this.readStore().goals.map(clone);
    const summary = {
      total: goals.length,
      active: goals.filter((goal) => goal.status === 'active').length,
      paused: goals.filter((goal) => goal.status === 'paused').length,
      done: goals.filter((goal) => goal.status === 'done').length,
      cancelled: goals.filter((goal) => goal.status === 'cancelled').length,
    };
    return {
      contractVersion: 'goal-plane/1',
      generatedAt: this.timestamp(),
      storePath: this.stateDb?.path || this.stateDbPath || this.storePath,
      summary,
      goals,
      safety: {
        noSilentMutation: true,
        taskPlaneBacked: Boolean(this.taskPlane),
        explicitStateTransitions: true,
      },
    };
  }

  public transition(id: string, status: GoalPlaneStatus, actor = 'operator', detail?: string): GoalPlaneItem | null {
    if (this.hasStateDb()) {
      return this.withStateDb((stateDb) => stateDb.transitionGoal(id, status, actor, detail));
    }
    const store = this.readStore();
    const goal = store.goals.find((entry) => entry.id === id);
    if (!goal) return null;
    const timestamp = this.timestamp();
    goal.status = status;
    goal.updatedAt = timestamp;
    goal.history.push({ at: timestamp, event: `goal.${status}`, actor, ...(detail ? { detail } : {}) });
    this.writeStore(store);
    return clone(goal);
  }

  public recordTurn(id: string, actor = 'agent', detail?: string): GoalPlaneItem | null {
    if (this.hasStateDb()) {
      return this.withStateDb((stateDb) => stateDb.recordGoalTurn(id, actor, detail));
    }
    const store = this.readStore();
    const goal = store.goals.find((entry) => entry.id === id);
    if (!goal || goal.status !== 'active') return null;
    const timestamp = this.timestamp();
    goal.turnsUsed += 1;
    goal.updatedAt = timestamp;
    goal.history.push({ at: timestamp, event: 'goal.turn', actor, ...(detail ? { detail } : {}) });
    if (goal.turnsUsed >= goal.maxTurns) {
      goal.status = 'paused';
      goal.history.push({ at: timestamp, event: 'goal.paused', actor: 'goal-plane', detail: 'max-turns-reached' });
    }
    this.writeStore(store);
    return clone(goal);
  }

  private readStore(): { goals: GoalPlaneItem[] } {
    try {
      if (!fs.existsSync(this.storePath)) return { goals: [] };
      const parsed = JSON.parse(fs.readFileSync(this.storePath, 'utf8')) as { goals?: unknown[] };
      return {
        goals: Array.isArray(parsed.goals)
          ? parsed.goals.map(normalizeGoal).filter((entry): entry is GoalPlaneItem => Boolean(entry))
          : [],
      };
    } catch (error: unknown) {logger.warn('[Goal Plane] JSON parse failed', error);
    return { goals: [] };
  }
  }

  private writeStore(store: { goals: GoalPlaneItem[] }): void {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    const tempPath = `${this.storePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    fs.renameSync(tempPath, this.storePath);
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private title(objective: string): string {
    const text = objective.replace(/\s+/gu, ' ').trim();
    return text.length <= 72 ? text : `${text.slice(0, 69)}...`;
  }

  private hasStateDb(): boolean {
    return Boolean(this.stateDb || this.stateDbPath);
  }

  private withStateDb<T>(fn: (stateDb: ZavorthOperationalStateDbService) => T): T {
    if (this.stateDb) {
      this.seedStateDb(this.stateDb);
      return fn(this.stateDb);
    }
    const stateDb = new ZavorthOperationalStateDbService({
      dbPath: this.stateDbPath as string,
      now: this.now,
    });
    try {
      this.seedStateDb(stateDb);
      return fn(stateDb);
    } finally {
      stateDb.close();
    }
  }

  private seedStateDb(stateDb: ZavorthOperationalStateDbService): void {
    if (this.legacySeeded) return;
    const legacy = this.readStore().goals;
    if (legacy.length > 0) {
      stateDb.importGoalPlaneItems(legacy);
    }
    this.legacySeeded = true;
  }
}

function normalizeGoal(value: unknown): GoalPlaneItem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<GoalPlaneItem>;
  if (!item.id || !item.objective) return null;
  const status = ['active', 'paused', 'done', 'cancelled'].includes(String(item.status))
    ? item.status as GoalPlaneStatus
    : 'active';
  return {
    contractVersion: 'goal-plane-item/1',
    id: String(item.id),
    objective: String(item.objective),
    status,
    createdAt: String(item.createdAt || new Date(0).toISOString()),
    updatedAt: String(item.updatedAt || item.createdAt || new Date(0).toISOString()),
    sessionId: item.sessionId || null,
    profileId: item.profileId || null,
    maxTurns: clamp(Number(item.maxTurns || 12), 1, 200),
    turnsUsed: clamp(Number(item.turnsUsed || 0), 0, 10_000),
    taskPlaneItemId: item.taskPlaneItemId || null,
    history: Array.isArray(item.history)
      ? item.history.map((entry) => ({
        at: String(entry.at || new Date(0).toISOString()),
        event: String(entry.event || 'goal.event'),
        actor: String(entry.actor || 'system'),
        ...(entry.detail ? { detail: String(entry.detail) } : {}),
      }))
      : [],
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
