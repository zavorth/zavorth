import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type { TaskPlaneItem, TaskPlaneStatus } from '../contracts/TaskPlaneContract.js';
import { TaskPlaneService } from './TaskPlaneService.js';
import { ZavorthOperationalStateDbService } from './ZavorthOperationalStateDbService.js';

export type TaskBoardLane = 'backlog' | 'ready' | 'running' | 'review' | 'done' | 'blocked';

export type TaskBoard = {
  contractVersion: 'task-board/1';
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  taskIds: string[];
  blackboard: Array<{
    at: string;
    actor: string;
    text: string;
  }>;
};

export type TaskBoardSnapshot = {
  contractVersion: 'task-board-plane/1';
  generatedAt: string;
  storePath: string;
  boards: TaskBoard[];
  lanes: Record<TaskBoardLane, TaskPlaneItem[]>;
  summary: Record<TaskBoardLane, number> & { boards: number; tasks: number };
  safety: {
    taskPlaneBacked: true;
    claimsRemainAtomic: true;
    mutationsReturnToTaskPlane: true;
  };
};

type ServiceOptions = {
  storePath: string;
  taskPlane: TaskPlaneService;
  stateDb?: ZavorthOperationalStateDbService | null;
  stateDbPath?: string | null;
  now?: () => Date;
};

export class TaskBoardPlaneService {
  private readonly storePath: string;
  private readonly taskPlane: TaskPlaneService;
  private readonly stateDb: ZavorthOperationalStateDbService | null;
  private readonly stateDbPath: string | null;
  private readonly now: () => Date;
  private legacySeeded = false;

  constructor(options: ServiceOptions) {
    this.storePath = path.resolve(options.storePath);
    this.taskPlane = options.taskPlane;
    this.stateDb = options.stateDb || null;
    this.stateDbPath = options.stateDbPath ? path.resolve(options.stateDbPath) : null;
    this.now = options.now || (() => new Date());
  }

  public createBoard(title: string): TaskBoard {
    if (this.hasStateDb()) {
      return this.withStateDb((stateDb) => stateDb.createBoard(title));
    }
    const store = this.readStore();
    const timestamp = this.timestamp();
    const board: TaskBoard = {
      contractVersion: 'task-board/1',
      id: `board-${randomUUID()}`,
      title: String(title || 'Daily work').trim() || 'Daily work',
      createdAt: timestamp,
      updatedAt: timestamp,
      taskIds: [],
      blackboard: [],
    };
    store.boards.push(board);
    this.writeStore(store);
    return clone(board);
  }

  public triage(input: { boardId?: string | null; title: string; body?: string | null; actor?: string | null }): TaskPlaneItem {
    const board = this.ensureBoard(input.boardId || null);
    const task = this.taskPlane.createTask({
      title: String(input.title || 'Board task').trim() || 'Board task',
      source: `task-board:${board.id}`,
      payload: {
        kind: 'task-board-card',
        boardId: board.id,
        lane: 'backlog',
        body: input.body || null,
        actor: input.actor || 'operator',
      },
    });
    this.addTaskToBoard(board.id, task.id);
    return task;
  }

  public decompose(input: {
    boardId?: string | null;
    parentTaskId?: string | null;
    objective: string;
    parts?: string[] | null;
    includeReview?: boolean | null;
    actor?: string | null;
  }): TaskPlaneItem[] {
    const board = this.ensureBoard(input.boardId || null);
    const parts = Array.isArray(input.parts) && input.parts.length > 0
      ? input.parts
      : this.defaultParts(input.objective, Boolean(input.includeReview));
    const tasks = parts.map((part, index) => this.taskPlane.createTask({
      title: part,
      source: `task-board:${board.id}`,
      payload: {
        kind: 'task-board-card',
        boardId: board.id,
        lane: index === 0 ? 'ready' : 'backlog',
        parentTaskId: input.parentTaskId || null,
        objective: input.objective,
        role: this.roleFor(index, parts.length),
        actor: input.actor || 'operator',
      },
    }));
    for (const task of tasks) {
      this.addTaskToBoard(board.id, task.id);
    }
    return tasks;
  }

  public addBlackboardNote(input: { boardId?: string | null; text: string; actor?: string | null }): TaskBoard {
    const board = this.ensureBoard(input.boardId || null);
    if (this.hasStateDb()) {
      return this.withStateDb((stateDb) => stateDb.addBoardNote(board.id, input.text, input.actor || 'operator')) || board;
    }
    const store = this.readStore();
    const target = store.boards.find((entry) => entry.id === board.id);
    if (!target) throw new Error(`Board not found: ${board.id}`);
    target.blackboard.push({
      at: this.timestamp(),
      actor: String(input.actor || 'operator'),
      text: String(input.text || '').slice(0, 2000),
    });
    target.updatedAt = this.timestamp();
    this.writeStore(store);
    return clone(target);
  }

  public snapshot(): TaskBoardSnapshot {
    if (this.hasStateDb()) {
      return this.withStateDb((stateDb) => stateDb.boardSnapshot(this.taskPlane.listTasks(), stateDb.path));
    }
    const boards = this.readStore().boards.map(clone);
    const boardIds = new Set(boards.map((board) => board.id));
    const items = this.taskPlane.listTasks().filter((item) => {
      const boardId = String(item.payload.boardId || '');
      return item.source.startsWith('task-board:') || boardIds.has(boardId);
    });
    const lanes: Record<TaskBoardLane, TaskPlaneItem[]> = {
      backlog: [],
      ready: [],
      running: [],
      review: [],
      done: [],
      blocked: [],
    };
    for (const item of items) {
      lanes[this.resolveLane(item)].push(item);
    }
    return {
      contractVersion: 'task-board-plane/1',
      generatedAt: this.timestamp(),
      storePath: this.storePath,
      boards,
      lanes,
      summary: {
        boards: boards.length,
        tasks: items.length,
        backlog: lanes.backlog.length,
        ready: lanes.ready.length,
        running: lanes.running.length,
        review: lanes.review.length,
        done: lanes.done.length,
        blocked: lanes.blocked.length,
      },
      safety: {
        taskPlaneBacked: true,
        claimsRemainAtomic: true,
        mutationsReturnToTaskPlane: true,
      },
    };
  }

  private ensureBoard(boardId: string | null): TaskBoard {
    if (this.hasStateDb()) {
      const boards = this.withStateDb((stateDb) => stateDb.listBoards());
      const existing = boardId ? boards.find((board) => board.id === boardId) : boards[0];
      return existing ? clone(existing) : this.createBoard('Daily work');
    }
    const store = this.readStore();
    const existing = boardId ? store.boards.find((board) => board.id === boardId) : store.boards[0];
    if (existing) return clone(existing);
    return this.createBoard('Daily work');
  }

  private addTaskToBoard(boardId: string, taskId: string): void {
    if (this.hasStateDb()) {
      this.withStateDb((stateDb) => stateDb.addTaskToBoard(boardId, taskId));
      return;
    }
    const store = this.readStore();
    const board = store.boards.find((entry) => entry.id === boardId);
    if (!board) return;
    if (!board.taskIds.includes(taskId)) board.taskIds.push(taskId);
    board.updatedAt = this.timestamp();
    this.writeStore(store);
  }

  private resolveLane(item: TaskPlaneItem): TaskBoardLane {
    const explicit = String(item.payload.lane || '') as TaskBoardLane;
    if (['backlog', 'ready', 'running', 'review', 'done', 'blocked'].includes(explicit)) {
      if (item.status === 'done') return 'done';
      if (item.status === 'blocked' || item.status === 'failed') return 'blocked';
      if (item.status === 'running' || item.status === 'claimed') return 'running';
      return explicit;
    }
    const map: Record<TaskPlaneStatus, TaskBoardLane> = {
      queued: 'ready',
      claimed: 'running',
      running: 'running',
      waiting_approval: 'review',
      blocked: 'blocked',
      done: 'done',
      failed: 'blocked',
      cancelled: 'blocked',
    };
    return map[item.status] || 'backlog';
  }

  private defaultParts(objective: string, includeReview: boolean): string[] {
    const title = String(objective || 'Task').replace(/\s+/gu, ' ').trim() || 'Task';
    const parts = [
      `Plan: ${title}`,
      `Implement: ${title}`,
      `Verify: ${title}`,
    ];
    if (includeReview) {
      parts.push(`Review and synthesize: ${title}`);
    }
    return parts;
  }

  private roleFor(index: number, total: number): string {
    if (index === 0) return 'planner';
    if (index === total - 1) return 'verifier';
    return 'worker';
  }

  private readStore(): { boards: TaskBoard[] } {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.storePath, 'utf8')) as { boards?: unknown[] };
      return {
        boards: Array.isArray(parsed.boards)
          ? parsed.boards.map(normalizeBoard).filter((entry): entry is TaskBoard => Boolean(entry))
          : [],
      };
    } catch {
      return { boards: [] };
    }
  }

  private writeStore(store: { boards: TaskBoard[] }): void {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    const tempPath = `${this.storePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    fs.renameSync(tempPath, this.storePath);
  }

  private timestamp(): string {
    return this.now().toISOString();
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
    const legacy = this.readStore().boards;
    if (legacy.length > 0) {
      stateDb.importTaskBoards(legacy);
    }
    this.legacySeeded = true;
  }
}

function normalizeBoard(value: unknown): TaskBoard | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<TaskBoard>;
  if (!item.id) return null;
  return {
    contractVersion: 'task-board/1',
    id: String(item.id),
    title: String(item.title || item.id),
    createdAt: String(item.createdAt || new Date(0).toISOString()),
    updatedAt: String(item.updatedAt || item.createdAt || new Date(0).toISOString()),
    taskIds: Array.isArray(item.taskIds) ? item.taskIds.map(String) : [],
    blackboard: Array.isArray(item.blackboard)
      ? item.blackboard.map((entry) => ({
        at: String(entry.at || new Date(0).toISOString()),
        actor: String(entry.actor || 'operator'),
        text: String(entry.text || ''),
      }))
      : [],
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
