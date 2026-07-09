import { logger } from '../logger.js';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import DatabaseLib, { type Database as SQLiteDatabase } from 'better-sqlite3';

import type { TaskPlaneItem, TaskPlaneStatus } from '../contracts/TaskPlaneContract.js';
import type { GoalPlaneItem, GoalPlaneStatus } from './GoalPlaneService.js';
import type {
  TaskBoard,
  TaskBoardLane,
  TaskBoardSnapshot,
} from './TaskBoardPlaneService.js';

import type {
ZavorthSessionRecallHit,
  ZavorthSessionRecallSession,
  ZavorthSessionRecallSnapshot,
} from './ZavorthSessionRecallService.js';

type StateDbOptions = {
  dbPath: string;
  now?: () => Date;
  busyTimeoutMs?: number;
};

type AppendSessionMessageInput = {
  sessionId?: string | null;
  title?: string | null;
  role: string;
  content: string;
  messageId?: string | null;
  createdAt?: string | null;
  metadata?: Record<string, unknown>;
  profileId?: string | null;
  parentSessionId?: string | null;
  source?: string | null;
};

type RecallInput = {
  query?: string | null;
  sessionId?: string | null;
  currentSessionId?: string | null;
  aroundMessageId?: string | null;
  limit?: number | null;
  window?: number | null;
};

type CreateTaskInput = {
  title: string;
  source?: string;
  payload?: Record<string, unknown>;
  approvalId?: string | null;
  receiptId?: string | null;
};

type CreateGoalInput = {
  objective: string;
  sessionId?: string | null;
  profileId?: string | null;
  maxTurns?: number | null;
  actor?: string | null;
  taskPlaneItemId?: string | null;
};

export type ZavorthOperationalStateSnapshot = {
  contractVersion: 'zavorth-operational-state-db/1';
  generatedAt: string;
  dbPath: string;
  journalMode: string;
  ftsAvailable: boolean;
  schemaVersion: number;
  counts: {
    sessions: number;
    messages: number;
    events: number;
    receipts: number;
    tasks: number;
    goals: number;
    boards: number;
    locks: number;
  };
  safety: {
    localOnly: true;
    sqliteWalWithFallback: true;
    ftsFallsBackToLikeSearch: true;
    explicitLocks: true;
    jsonCompatibilityFallback: true;
  };
};

export type ZavorthOperationalEvent = {
  id: string;
  cursor: number;
  stream: string;
  type: string;
  subjectId: string | null;
  createdAt: string;
  payload: Record<string, unknown>;
};

export type ZavorthOperationalReceipt = {
  id: string;
  actionId: string | null;
  status: string;
  createdAt: string;
  sourceSurface: string | null;
  summary: string;
  data: Record<string, unknown>;
};

const TASK_STATUSES: TaskPlaneStatus[] = [
  'queued',
  'claimed',
  'running',
  'waiting_approval',
  'blocked',
  'done',
  'failed',
  'cancelled',
];

export class ZavorthOperationalStateDbService {
  private readonly dbPath: string;
  private readonly now: () => Date;
  private readonly db: SQLiteDatabase;
  private journalMode = 'unknown';
  private ftsAvailable = false;

  constructor(options: StateDbOptions) {
    this.dbPath = path.resolve(options.dbPath);
    this.now = options.now || (() => new Date());
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    this.db = new DatabaseLib(this.dbPath);
    this.configure(options.busyTimeoutMs || 5000);
    this.migrate();
  }

  public get path(): string {
    return this.dbPath;
  }

  public close(): void {
    this.db.close();
  }

  public snapshot(): ZavorthOperationalStateSnapshot {
    return {
      contractVersion: 'zavorth-operational-state-db/1',
      generatedAt: this.timestamp(),
      dbPath: this.dbPath,
      journalMode: this.journalMode,
      ftsAvailable: this.ftsAvailable,
      schemaVersion: this.getMeta<number>('schema.version') || 1,
      counts: {
        sessions: this.count('zavorth_sessions'),
        messages: this.count('zavorth_messages'),
        events: this.count('zavorth_events'),
        receipts: this.count('zavorth_receipts'),
        tasks: this.count('zavorth_tasks'),
        goals: this.count('zavorth_goals'),
        boards: this.count('zavorth_boards'),
        locks: this.count('zavorth_locks'),
      },
      safety: {
        localOnly: true,
        sqliteWalWithFallback: true,
        ftsFallsBackToLikeSearch: true,
        explicitLocks: true,
        jsonCompatibilityFallback: true,
      },
    };
  }

  public setMeta(key: string, value: unknown): void {
    this.db.prepare(`
      INSERT INTO zavorth_state_meta (key, value_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
    `).run(key, JSON.stringify(value), this.timestamp());
  }

  public getMeta<T = unknown>(key: string): T | null {
    const row = this.db.prepare('SELECT value_json FROM zavorth_state_meta WHERE key = ?').get(key) as { value_json: string } | undefined;
    return row ? parseJson(row.value_json, null) as T : null;
  }

  public appendSessionMessage(input: AppendSessionMessageInput): ZavorthSessionRecallSession {
    const timestamp = input.createdAt || this.timestamp();
    const sessionId = normalize(input.sessionId) || `session-${randomUUID()}`;
    const title = normalize(input.title) || this.deriveTitle(input.content);
    const messageId = normalize(input.messageId) || `msg-${randomUUID()}`;
    const role = normalize(input.role) || 'user';
    const content = String(input.content || '');

    const tx = this.db.transaction(() => {
      const existing = this.db.prepare('SELECT id, title FROM zavorth_sessions WHERE id = ?').get(sessionId) as { id: string; title: string } | undefined;
      if (existing) {
        this.db.prepare(`
          UPDATE zavorth_sessions
          SET title = ?, updated_at = ?, metadata_json = ?
          WHERE id = ?
        `).run(normalize(input.title) || existing.title || title, timestamp, JSON.stringify(input.metadata || {}), sessionId);
      } else {
        this.db.prepare(`
          INSERT INTO zavorth_sessions (id, title, created_at, updated_at, parent_session_id, profile_id, source, metadata_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          sessionId,
          title,
          timestamp,
          timestamp,
          normalize(input.parentSessionId) || null,
          normalize(input.profileId) || null,
          normalize(input.source) || 'operator',
          JSON.stringify(input.metadata || {}),
        );
      }

      const ordinal = this.nextMessageOrdinal(sessionId);
      this.db.prepare(`
        INSERT INTO zavorth_messages (id, session_id, role, content, created_at, ordinal, metadata_json, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).run(messageId, sessionId, role, content, timestamp, ordinal, JSON.stringify(input.metadata || {}));
      this.indexMessage(messageId, sessionId, normalize(input.title) || title, content);
      this.recordEventSync('sessions', 'session.message.appended', sessionId, {
        sessionId,
        messageId,
        role,
      });
    });
    tx();
    return this.getSession(sessionId) as ZavorthSessionRecallSession;
  }

  public importSessionRecallSessions(sessions: ZavorthSessionRecallSession[]): void {
    const tx = this.db.transaction(() => {
      for (const session of sessions) {
        this.db.prepare(`
          INSERT OR IGNORE INTO zavorth_sessions (id, title, created_at, updated_at, parent_session_id, profile_id, source, metadata_json)
          VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)
        `).run(session.id, session.title, session.createdAt, session.updatedAt, 'legacy-json', JSON.stringify(session.metadata || {}));
        for (const [index, message] of session.messages.entries()) {
          const inserted = this.db.prepare(`
            INSERT OR IGNORE INTO zavorth_messages (id, session_id, role, content, created_at, ordinal, metadata_json, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
          `).run(message.id, session.id, message.role, message.content, message.createdAt, index, JSON.stringify({ importedFrom: 'legacy-json' }));
          if (inserted.changes > 0) {
            this.indexMessage(message.id, session.id, session.title, message.content);
          }
        }
      }
      if (sessions.length > 0) {
        this.recordEventSync('sessions', 'session.legacy_json.imported', null, { sessions: sessions.length });
      }
    });
    tx();
  }

  public recallSessions(input: RecallInput = {}): ZavorthSessionRecallSnapshot {
    const query = normalize(input.query);
    const limit = clamp(Number(input.limit || 8), 1, 50);
    const windowSize = clamp(Number(input.window || 2), 0, 8);
    const mode = input.sessionId && input.aroundMessageId ? 'scroll' : query ? 'discovery' : 'browse';
    const sessions = this.listSessions();
    const hits = mode === 'browse'
      ? this.browseSessionHits(sessions, input.currentSessionId, limit, windowSize)
      : this.searchSessionHits(query, input, limit, windowSize);

    return {
      contractVersion: 'mnemos-session-recall/1',
      generatedAt: this.timestamp(),
      mode,
      query,
      storePath: this.dbPath,
      sessionCount: sessions.length,
      returned: hits.length,
      hits,
      safety: {
        llmUsed: false,
        rawProviderLogsRequired: false,
        localOnly: true,
      },
    };
  }

  public createTask(input: CreateTaskInput): TaskPlaneItem {
    const now = this.timestamp();
    const id = `task-${randomUUID()}`;
    const status: TaskPlaneStatus = input.approvalId ? 'waiting_approval' : 'queued';
    const item: TaskPlaneItem = {
      contractVersion: 'task-plane-item/1',
      id,
      title: normalize(input.title, 'Untitled task'),
      status,
      source: normalize(input.source, 'operator'),
      createdAt: now,
      updatedAt: now,
      claim: null,
      approvalId: input.approvalId || null,
      receiptId: input.receiptId || null,
      payload: clone(input.payload || {}),
      attempts: 0,
      history: [{ at: now, event: 'task.created', status, actor: normalize(input.source, 'operator') }],
    };
    const tx = this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO zavorth_tasks
          (id, title, status, source, created_at, updated_at, claim_owner, claim_until, approval_id, receipt_id, attempts, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)
      `).run(item.id, item.title, item.status, item.source, item.createdAt, item.updatedAt, item.approvalId, item.receiptId, item.attempts, JSON.stringify(item.payload));
      this.insertTaskEvent(item.id, 'task.created', status, item.source, null, now);
      this.recordEventSync('tasks', 'task.created', item.id, { title: item.title, status });
    });
    tx();
    return item;
  }

  public importTaskPlaneItems(items: TaskPlaneItem[]): void {
    const tx = this.db.transaction(() => {
      for (const item of items) {
        const inserted = this.db.prepare(`
          INSERT OR IGNORE INTO zavorth_tasks
            (id, title, status, source, created_at, updated_at, claim_owner, claim_until, approval_id, receipt_id, attempts, payload_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          item.id,
          item.title,
          item.status,
          item.source,
          item.createdAt,
          item.updatedAt,
          item.claim?.owner || null,
          item.claim?.leaseUntil || null,
          item.approvalId || null,
          item.receiptId || null,
          item.attempts || 0,
          JSON.stringify(item.payload || {}),
        );
        if (inserted.changes > 0) {
          for (const entry of item.history || []) {
            this.insertTaskEvent(item.id, entry.event, entry.status, entry.actor, entry.detail || null, entry.at);
          }
        }
      }
      if (items.length > 0) {
        this.recordEventSync('tasks', 'task.legacy_json.imported', null, { tasks: items.length });
      }
    });
    tx();
  }

  public listTasks(): TaskPlaneItem[] {
    const rows = this.db.prepare(`
      SELECT * FROM zavorth_tasks ORDER BY datetime(created_at) ASC, id ASC
    `).all() as TaskRow[];
    return rows.map((row) => this.taskFromRow(row));
  }

  public claimTask(id: string, owner: string, leaseMs?: number | null): TaskPlaneItem | null {
    const item = this.getTask(id);
    if (!item || !this.canClaim(item)) return null;
    const now = this.timestamp();
    const claimOwner = normalize(owner, 'unknown');
    const leaseUntil = leaseMs ? new Date(this.now().getTime() + Math.max(1, leaseMs)).toISOString() : null;
    const tx = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE zavorth_tasks
        SET status = 'claimed', updated_at = ?, claim_owner = ?, claim_until = ?
        WHERE id = ?
      `).run(now, claimOwner, leaseUntil, id);
      this.insertTaskEvent(id, 'task.claimed', 'claimed', claimOwner, null, now);
      this.recordEventSync('tasks', 'task.claimed', id, { owner: claimOwner, leaseUntil });
    });
    tx();
    return this.getTask(id);
  }

  public updateTaskStatus(id: string, status: TaskPlaneStatus, actor = 'system', detail?: string): TaskPlaneItem | null {
    if (!TASK_STATUSES.includes(status)) return null;
    const existing = this.getTask(id);
    if (!existing) return null;
    const now = this.timestamp();
    const attempts = status === 'running' ? existing.attempts + 1 : existing.attempts;
    const tx = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE zavorth_tasks
        SET status = ?, updated_at = ?, attempts = ?
        WHERE id = ?
      `).run(status, now, attempts, id);
      this.insertTaskEvent(id, `task.${status}`, status, actor, detail || null, now);
      this.recordEventSync('tasks', `task.${status}`, id, { actor, detail: detail || null });
    });
    tx();
    return this.getTask(id);
  }

  public retryTask(id: string, actor = 'operator'): TaskPlaneItem | null {
    const existing = this.getTask(id);
    if (!existing || !['failed', 'blocked', 'cancelled'].includes(existing.status)) return null;
    const now = this.timestamp();
    const tx = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE zavorth_tasks
        SET status = 'queued', updated_at = ?, claim_owner = NULL, claim_until = NULL
        WHERE id = ?
      `).run(now, id);
      this.insertTaskEvent(id, 'task.retry', 'queued', actor, null, now);
      this.recordEventSync('tasks', 'task.retry', id, { actor });
    });
    tx();
    return this.getTask(id);
  }

  public createGoal(input: CreateGoalInput): GoalPlaneItem {
    const objective = normalize(input.objective);
    if (!objective) throw new Error('Goal objective is required.');
    const now = this.timestamp();
    const id = `goal-${randomUUID()}`;
    const actor = normalize(input.actor, 'operator');
    const goal: GoalPlaneItem = {
      contractVersion: 'goal-plane-item/1',
      id,
      objective,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      sessionId: input.sessionId || null,
      profileId: input.profileId || null,
      maxTurns: clamp(Number(input.maxTurns || 12), 1, 200),
      turnsUsed: 0,
      taskPlaneItemId: input.taskPlaneItemId || null,
      history: [{ at: now, event: 'goal.created', actor }],
    };
    const tx = this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO zavorth_goals
          (id, objective, status, created_at, updated_at, session_id, profile_id, max_turns, turns_used, task_plane_item_id, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        goal.id,
        goal.objective,
        goal.status,
        goal.createdAt,
        goal.updatedAt,
        goal.sessionId,
        goal.profileId,
        goal.maxTurns,
        goal.turnsUsed,
        goal.taskPlaneItemId,
        JSON.stringify({}),
      );
      this.insertGoalEvent(goal.id, 'goal.created', actor, null, now);
      this.recordEventSync('goals', 'goal.created', goal.id, { objective: goal.objective });
    });
    tx();
    return goal;
  }

  public importGoalPlaneItems(goals: GoalPlaneItem[]): void {
    const tx = this.db.transaction(() => {
      for (const goal of goals) {
        const inserted = this.db.prepare(`
          INSERT OR IGNORE INTO zavorth_goals
            (id, objective, status, created_at, updated_at, session_id, profile_id, max_turns, turns_used, task_plane_item_id, metadata_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          goal.id,
          goal.objective,
          goal.status,
          goal.createdAt,
          goal.updatedAt,
          goal.sessionId || null,
          goal.profileId || null,
          goal.maxTurns,
          goal.turnsUsed,
          goal.taskPlaneItemId || null,
          JSON.stringify({ importedFrom: 'legacy-json' }),
        );
        if (inserted.changes > 0) {
          for (const entry of goal.history || []) {
            this.insertGoalEvent(goal.id, entry.event, entry.actor, entry.detail || null, entry.at);
          }
        }
      }
      if (goals.length > 0) {
        this.recordEventSync('goals', 'goal.legacy_json.imported', null, { goals: goals.length });
      }
    });
    tx();
  }

  public listGoals(): GoalPlaneItem[] {
    const rows = this.db.prepare('SELECT * FROM zavorth_goals ORDER BY datetime(created_at) ASC, id ASC').all() as GoalRow[];
    return rows.map((row) => this.goalFromRow(row));
  }

  public transitionGoal(id: string, status: GoalPlaneStatus, actor = 'operator', detail?: string): GoalPlaneItem | null {
    const existing = this.getGoal(id);
    if (!existing) return null;
    const now = this.timestamp();
    const tx = this.db.transaction(() => {
      this.db.prepare('UPDATE zavorth_goals SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
      this.insertGoalEvent(id, `goal.${status}`, actor, detail || null, now);
      this.recordEventSync('goals', `goal.${status}`, id, { actor, detail: detail || null });
    });
    tx();
    return this.getGoal(id);
  }

  public recordGoalTurn(id: string, actor = 'agent', detail?: string): GoalPlaneItem | null {
    const existing = this.getGoal(id);
    if (!existing || existing.status !== 'active') return null;
    const now = this.timestamp();
    const turnsUsed = existing.turnsUsed + 1;
    const nextStatus: GoalPlaneStatus = turnsUsed >= existing.maxTurns ? 'paused' : 'active';
    const tx = this.db.transaction(() => {
      this.db.prepare('UPDATE zavorth_goals SET turns_used = ?, status = ?, updated_at = ? WHERE id = ?').run(turnsUsed, nextStatus, now, id);
      this.insertGoalEvent(id, 'goal.turn', actor, detail || null, now);
      if (nextStatus === 'paused') {
        this.insertGoalEvent(id, 'goal.paused', 'goal-plane', 'max-turns-reached', now);
      }
      this.recordEventSync('goals', 'goal.turn', id, { actor, turnsUsed, status: nextStatus });
    });
    tx();
    return this.getGoal(id);
  }

  public createBoard(title: string): TaskBoard {
    const now = this.timestamp();
    const board: TaskBoard = {
      contractVersion: 'task-board/1',
      id: `board-${randomUUID()}`,
      title: normalize(title, 'Daily work'),
      createdAt: now,
      updatedAt: now,
      taskIds: [],
      blackboard: [],
    };
    const tx = this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO zavorth_boards (id, title, created_at, updated_at, metadata_json)
        VALUES (?, ?, ?, ?, ?)
      `).run(board.id, board.title, board.createdAt, board.updatedAt, JSON.stringify({}));
      this.recordEventSync('boards', 'board.created', board.id, { title: board.title });
    });
    tx();
    return board;
  }

  public importTaskBoards(boards: TaskBoard[]): void {
    const tx = this.db.transaction(() => {
      for (const board of boards) {
        this.db.prepare(`
          INSERT OR IGNORE INTO zavorth_boards (id, title, created_at, updated_at, metadata_json)
          VALUES (?, ?, ?, ?, ?)
        `).run(board.id, board.title, board.createdAt, board.updatedAt, JSON.stringify({ importedFrom: 'legacy-json' }));
        for (const [index, taskId] of board.taskIds.entries()) {
          this.db.prepare(`
            INSERT OR IGNORE INTO zavorth_board_tasks (board_id, task_id, position, created_at)
            VALUES (?, ?, ?, ?)
          `).run(board.id, taskId, index, board.updatedAt);
        }
        for (const note of board.blackboard) {
          this.db.prepare(`
            INSERT OR IGNORE INTO zavorth_board_notes (id, board_id, created_at, actor, text)
            VALUES (?, ?, ?, ?, ?)
          `).run(`legacy-${board.id}-${note.at}-${note.actor}`, board.id, note.at, note.actor, note.text);
        }
      }
      if (boards.length > 0) {
        this.recordEventSync('boards', 'board.legacy_json.imported', null, { boards: boards.length });
      }
    });
    tx();
  }

  public listBoards(): TaskBoard[] {
    const rows = this.db.prepare('SELECT * FROM zavorth_boards ORDER BY datetime(created_at) ASC, id ASC').all() as BoardRow[];
    return rows.map((row) => this.boardFromRow(row));
  }

  public addTaskToBoard(boardId: string, taskId: string): void {
    const now = this.timestamp();
    const position = this.countBoardTasks(boardId);
    const tx = this.db.transaction(() => {
      this.db.prepare(`
        INSERT OR IGNORE INTO zavorth_board_tasks (board_id, task_id, position, created_at)
        VALUES (?, ?, ?, ?)
      `).run(boardId, taskId, position, now);
      this.db.prepare('UPDATE zavorth_boards SET updated_at = ? WHERE id = ?').run(now, boardId);
      this.recordEventSync('boards', 'board.task.added', boardId, { taskId });
    });
    tx();
  }

  public addBoardNote(boardId: string, text: string, actor = 'operator'): TaskBoard | null {
    const board = this.getBoard(boardId);
    if (!board) return null;
    const now = this.timestamp();
    const tx = this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO zavorth_board_notes (id, board_id, created_at, actor, text)
        VALUES (?, ?, ?, ?, ?)
      `).run(`note-${randomUUID()}`, boardId, now, normalize(actor, 'operator'), String(text || '').slice(0, 2000));
      this.db.prepare('UPDATE zavorth_boards SET updated_at = ? WHERE id = ?').run(now, boardId);
      this.recordEventSync('boards', 'board.note.added', boardId, { actor });
    });
    tx();
    return this.getBoard(boardId);
  }

  public boardSnapshot(taskItems: TaskPlaneItem[], storePath = this.dbPath): TaskBoardSnapshot {
    const boards = this.listBoards();
    const boardIds = new Set(boards.map((board) => board.id));
    const items = taskItems.filter((item) => {
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
      lanes[resolveLane(item)].push(item);
    }
    return {
      contractVersion: 'task-board-plane/1',
      generatedAt: this.timestamp(),
      storePath,
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

  public recordReceipt(input: {
    id?: string | null;
    actionId?: string | null;
    status: string;
    sourceSurface?: string | null;
    summary: string;
    data?: Record<string, unknown>;
  }): ZavorthOperationalReceipt {
    const receipt: ZavorthOperationalReceipt = {
      id: normalize(input.id) || `receipt-${randomUUID()}`,
      actionId: normalize(input.actionId) || null,
      status: normalize(input.status, 'ok'),
      createdAt: this.timestamp(),
      sourceSurface: normalize(input.sourceSurface) || null,
      summary: normalize(input.summary, 'Receipt recorded.'),
      data: clone(input.data || {}),
    };
    this.db.prepare(`
      INSERT INTO zavorth_receipts (id, action_id, status, created_at, source_surface, summary, data_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(receipt.id, receipt.actionId, receipt.status, receipt.createdAt, receipt.sourceSurface, receipt.summary, JSON.stringify(receipt.data));
    this.recordEventSync('receipts', 'receipt.recorded', receipt.id, { actionId: receipt.actionId, status: receipt.status });
    return receipt;
  }

  public listReceipts(limit = 50): ZavorthOperationalReceipt[] {
    const rows = this.db.prepare(`
      SELECT * FROM zavorth_receipts
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT ?
    `).all(clamp(Number(limit || 50), 1, 500)) as ReceiptRow[];
    return rows.map((row) => ({
      id: row.id,
      actionId: row.action_id,
      status: row.status,
      createdAt: row.created_at,
      sourceSurface: row.source_surface,
      summary: row.summary,
      data: parseJson(row.data_json, {}),
    }));
  }

  public recordEvent(stream: string, type: string, subjectId: string | null, payload: Record<string, unknown> = {}): ZavorthOperationalEvent {
    return this.recordEventSync(stream, type, subjectId, payload);
  }

  public listEvents(input: { afterCursor?: number | null; stream?: string | null; limit?: number | null } = {}): ZavorthOperationalEvent[] {
    const afterCursor = Number(input.afterCursor || 0);
    const stream = normalize(input.stream);
    const limit = clamp(Number(input.limit || 50), 1, 500);
    const rows = stream
      ? this.db.prepare(`
        SELECT * FROM zavorth_events
        WHERE cursor > ? AND stream = ?
        ORDER BY cursor ASC
        LIMIT ?
      `).all(afterCursor, stream, limit) as EventRow[]
      : this.db.prepare(`
        SELECT * FROM zavorth_events
        WHERE cursor > ?
        ORDER BY cursor ASC
        LIMIT ?
      `).all(afterCursor, limit) as EventRow[];
    return rows.map((row) => ({
      id: row.id,
      cursor: row.cursor,
      stream: row.stream,
      type: row.type,
      subjectId: row.subject_id,
      createdAt: row.created_at,
      payload: parseJson(row.payload_json, {}),
    }));
  }

  public acquireLock(name: string, holder: string, ttlMs: number, metadata: Record<string, unknown> = {}): boolean {
    const lockName = normalize(name);
    const lockHolder = normalize(holder, 'operator');
    if (!lockName) return false;
    const now = this.timestamp();
    const expiresAt = new Date(this.now().getTime() + Math.max(1, ttlMs)).toISOString();
    const existing = this.db.prepare('SELECT holder, expires_at FROM zavorth_locks WHERE name = ?').get(lockName) as { holder: string; expires_at: string } | undefined;
    if (existing && Date.parse(existing.expires_at) > this.now().getTime() && existing.holder !== lockHolder) {
      return false;
    }
    this.db.prepare(`
      INSERT INTO zavorth_locks (name, holder, acquired_at, expires_at, metadata_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        holder = excluded.holder,
        acquired_at = excluded.acquired_at,
        expires_at = excluded.expires_at,
        metadata_json = excluded.metadata_json
    `).run(lockName, lockHolder, now, expiresAt, JSON.stringify(metadata));
    this.recordEventSync('locks', 'lock.acquired', lockName, { holder: lockHolder, expiresAt });
    return true;
  }

  public releaseLock(name: string, holder?: string | null): boolean {
    const lockName = normalize(name);
    const existing = this.db.prepare('SELECT holder FROM zavorth_locks WHERE name = ?').get(lockName) as { holder: string } | undefined;
    if (!existing) return false;
    if (holder && existing.holder !== holder) return false;
    this.db.prepare('DELETE FROM zavorth_locks WHERE name = ?').run(lockName);
    this.recordEventSync('locks', 'lock.released', lockName, { holder: holder || existing.holder });
    return true;
  }

  private configure(busyTimeoutMs: number): void {
    this.db.pragma(`busy_timeout = ${Math.max(1, busyTimeoutMs)}`);
    try {
      const row = this.db.pragma('journal_mode = WAL', { simple: true });
      this.journalMode = String(row || 'wal').toLowerCase();
    } catch {
      try {
        const row = this.db.pragma('journal_mode = DELETE', { simple: true });
        this.journalMode = String(row || 'delete').toLowerCase();
      } catch {
        this.journalMode = 'unknown';
      }
    }
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('foreign_keys = ON');
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS zavorth_state_meta (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS zavorth_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        parent_session_id TEXT,
        profile_id TEXT,
        source TEXT,
        metadata_json TEXT DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS zavorth_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        ordinal INTEGER NOT NULL,
        metadata_json TEXT DEFAULT '{}',
        active INTEGER DEFAULT 1,
        FOREIGN KEY(session_id) REFERENCES zavorth_sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_zavorth_messages_session_ordinal
      ON zavorth_messages(session_id, ordinal);

      CREATE TABLE IF NOT EXISTS zavorth_events (
        cursor INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        stream TEXT NOT NULL,
        type TEXT NOT NULL,
        subject_id TEXT,
        created_at TEXT NOT NULL,
        payload_json TEXT DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_zavorth_events_stream_cursor
      ON zavorth_events(stream, cursor);

      CREATE TABLE IF NOT EXISTS zavorth_receipts (
        id TEXT PRIMARY KEY,
        action_id TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        source_surface TEXT,
        summary TEXT NOT NULL,
        data_json TEXT DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS zavorth_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        claim_owner TEXT,
        claim_until TEXT,
        approval_id TEXT,
        receipt_id TEXT,
        attempts INTEGER DEFAULT 0,
        payload_json TEXT DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_zavorth_tasks_status ON zavorth_tasks(status);

      CREATE TABLE IF NOT EXISTS zavorth_task_events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        event TEXT NOT NULL,
        status TEXT NOT NULL,
        actor TEXT NOT NULL,
        detail TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES zavorth_tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS zavorth_goals (
        id TEXT PRIMARY KEY,
        objective TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        session_id TEXT,
        profile_id TEXT,
        max_turns INTEGER NOT NULL,
        turns_used INTEGER DEFAULT 0,
        task_plane_item_id TEXT,
        metadata_json TEXT DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS zavorth_goal_events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        goal_id TEXT NOT NULL,
        event TEXT NOT NULL,
        actor TEXT NOT NULL,
        detail TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(goal_id) REFERENCES zavorth_goals(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS zavorth_boards (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        metadata_json TEXT DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS zavorth_board_tasks (
        board_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(board_id, task_id),
        FOREIGN KEY(board_id) REFERENCES zavorth_boards(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS zavorth_board_notes (
        id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        actor TEXT NOT NULL,
        text TEXT NOT NULL,
        FOREIGN KEY(board_id) REFERENCES zavorth_boards(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS zavorth_locks (
        name TEXT PRIMARY KEY,
        holder TEXT NOT NULL,
        acquired_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        metadata_json TEXT DEFAULT '{}'
      );
    `);
    this.ensureFts();
    this.setMeta('schema.version', 1);
  }

  private ensureFts(): void {
    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS zavorth_messages_fts
        USING fts5(message_id UNINDEXED, session_id UNINDEXED, title, content);
      `);
      this.ftsAvailable = true;
    } catch (error: unknown) {this.ftsAvailable = false;
    }
  }

  private indexMessage(messageId: string, sessionId: string, title: string, content: string): void {
    if (!this.ftsAvailable) return;
    this.db.prepare(`
      INSERT INTO zavorth_messages_fts (message_id, session_id, title, content)
      VALUES (?, ?, ?, ?)
    `).run(messageId, sessionId, title, content);
  }

  private listSessions(): ZavorthSessionRecallSession[] {
    const rows = this.db.prepare('SELECT * FROM zavorth_sessions ORDER BY datetime(updated_at) DESC, id ASC').all() as SessionRow[];
    return rows.map((row) => this.sessionFromRow(row));
  }

  private getSession(sessionId: string): ZavorthSessionRecallSession | null {
    const row = this.db.prepare('SELECT * FROM zavorth_sessions WHERE id = ?').get(sessionId) as SessionRow | undefined;
    return row ? this.sessionFromRow(row) : null;
  }

  private sessionFromRow(row: SessionRow): ZavorthSessionRecallSession {
    const messages = this.db.prepare(`
      SELECT id, role, content, created_at
      FROM zavorth_messages
      WHERE session_id = ? AND active = 1
      ORDER BY ordinal ASC
    `).all(row.id) as Array<{ id: string; role: string; content: string; created_at: string }>;
    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.created_at,
      })),
      metadata: parseJson(row.metadata_json, {}),
    };
  }

  private browseSessionHits(
    sessions: ZavorthSessionRecallSession[],
    currentSessionId: string | null | undefined,
    limit: number,
    windowSize: number,
  ): ZavorthSessionRecallHit[] {
    return sessions
      .filter((session) => !currentSessionId || session.id !== currentSessionId)
      .slice(0, limit)
      .map((session) => {
        const message = session.messages.at(-1) || null;
        const index = message ? session.messages.findIndex((entry) => entry.id === message.id) : -1;
        return this.sessionHitFrom(session, message, index, 1, windowSize);
      });
  }

  private searchSessionHits(
    query: string,
    input: RecallInput,
    limit: number,
    windowSize: number,
  ): ZavorthSessionRecallHit[] {
    if (input.sessionId && input.aroundMessageId) {
      const session = this.getSession(input.sessionId);
      if (!session) return [];
      const index = session.messages.findIndex((message) => message.id === input.aroundMessageId);
      return index >= 0 ? [this.sessionHitFrom(session, session.messages[index], index, 50, windowSize)] : [];
    }

    const rows = this.ftsAvailable && query
      ? this.searchFts(query, input.sessionId, limit)
      : this.searchLike(query, input.sessionId, limit);
    return rows.map((row) => {
      const session = this.getSession(row.session_id);
      if (!session) return null;
      const index = session.messages.findIndex((message) => message.id === row.message_id);
      const message = index >= 0 ? session.messages[index] : null;
      return this.sessionHitFrom(session, message, index, row.score, windowSize);
    }).filter((hit): hit is ZavorthSessionRecallHit => Boolean(hit));
  }

  private searchFts(query: string, sessionId: string | null | undefined, limit: number): Array<{ message_id: string; session_id: string; score: number }> {
    const ftsQuery = query.split(/\s+/u).filter(Boolean).map((term) => `${term.replace(/["*]/gu, '')}*`).join(' OR ');
    if (!ftsQuery) return [];
    const rows = sessionId
      ? this.db.prepare(`
        SELECT message_id, session_id, bm25(zavorth_messages_fts) * -1 AS score
        FROM zavorth_messages_fts
        WHERE zavorth_messages_fts MATCH ? AND session_id = ?
        ORDER BY bm25(zavorth_messages_fts)
        LIMIT ?
      `).all(ftsQuery, sessionId, limit)
      : this.db.prepare(`
        SELECT message_id, session_id, bm25(zavorth_messages_fts) * -1 AS score
        FROM zavorth_messages_fts
        WHERE zavorth_messages_fts MATCH ?
        ORDER BY bm25(zavorth_messages_fts)
        LIMIT ?
      `).all(ftsQuery, limit);
    return rows as Array<{ message_id: string; session_id: string; score: number }>;
  }

  private searchLike(query: string, sessionId: string | null | undefined, limit: number): Array<{ message_id: string; session_id: string; score: number }> {
    const like = `%${query}%`;
    const rows = sessionId
      ? this.db.prepare(`
        SELECT id AS message_id, session_id, 1 AS score
        FROM zavorth_messages
        WHERE session_id = ? AND content LIKE ?
        ORDER BY datetime(created_at) DESC
        LIMIT ?
      `).all(sessionId, like, limit)
      : this.db.prepare(`
        SELECT id AS message_id, session_id, 1 AS score
        FROM zavorth_messages
        WHERE content LIKE ?
        ORDER BY datetime(created_at) DESC
        LIMIT ?
      `).all(like, limit);
    return rows as Array<{ message_id: string; session_id: string; score: number }>;
  }

  private sessionHitFrom(
    session: ZavorthSessionRecallSession,
    message: ZavorthSessionRecallSession['messages'][number] | null,
    index: number,
    score: number,
    windowSize: number,
  ): ZavorthSessionRecallHit {
    const start = Math.max(0, index - windowSize);
    const end = Math.min(session.messages.length, index + windowSize + 1);
    return {
      sessionId: session.id,
      title: session.title,
      messageId: message?.id || null,
      role: message?.role || null,
      score,
      snippet: trim(message?.content || session.title, 500),
      createdAt: message?.createdAt || null,
      updatedAt: session.updatedAt,
      neighbors: index >= 0
        ? session.messages.slice(start, end).map((entry) => ({
          id: entry.id,
          role: entry.role,
          content: trim(entry.content, 360),
          createdAt: entry.createdAt,
        }))
        : [],
    };
  }

  private getTask(id: string): TaskPlaneItem | null {
    const row = this.db.prepare('SELECT * FROM zavorth_tasks WHERE id = ?').get(id) as TaskRow | undefined;
    return row ? this.taskFromRow(row) : null;
  }

  private taskFromRow(row: TaskRow): TaskPlaneItem {
    const history = this.db.prepare(`
      SELECT event, status, actor, detail, created_at
      FROM zavorth_task_events
      WHERE task_id = ?
      ORDER BY seq ASC
    `).all(row.id) as Array<{ event: string; status: TaskPlaneStatus; actor: string; detail: string | null; created_at: string }>;
    return {
      contractVersion: 'task-plane-item/1',
      id: row.id,
      title: row.title,
      status: row.status as TaskPlaneStatus,
      source: row.source,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      claim: row.claim_owner
        ? { owner: row.claim_owner, claimedAt: this.claimedAt(row.id), leaseUntil: row.claim_until || null }
        : null,
      approvalId: row.approval_id || null,
      receiptId: row.receipt_id || null,
      payload: parseJson(row.payload_json, {}),
      attempts: Number(row.attempts || 0),
      history: history.map((entry) => ({
        at: entry.created_at,
        event: entry.event,
        status: entry.status,
        actor: entry.actor,
        ...(entry.detail ? { detail: entry.detail } : {}),
      })),
    };
  }

  private claimedAt(taskId: string): string {
    const row = this.db.prepare(`
      SELECT created_at FROM zavorth_task_events
      WHERE task_id = ? AND event = 'task.claimed'
      ORDER BY seq DESC LIMIT 1
    `).get(taskId) as { created_at: string } | undefined;
    return row?.created_at || this.timestamp();
  }

  private canClaim(item: TaskPlaneItem): boolean {
    if (item.status === 'queued') return true;
    if (item.status !== 'claimed' || !item.claim?.leaseUntil) return false;
    return Date.parse(item.claim.leaseUntil) <= this.now().getTime();
  }

  private getGoal(id: string): GoalPlaneItem | null {
    const row = this.db.prepare('SELECT * FROM zavorth_goals WHERE id = ?').get(id) as GoalRow | undefined;
    return row ? this.goalFromRow(row) : null;
  }

  private goalFromRow(row: GoalRow): GoalPlaneItem {
    const events = this.db.prepare(`
      SELECT event, actor, detail, created_at
      FROM zavorth_goal_events
      WHERE goal_id = ?
      ORDER BY seq ASC
    `).all(row.id) as Array<{ event: string; actor: string; detail: string | null; created_at: string }>;
    return {
      contractVersion: 'goal-plane-item/1',
      id: row.id,
      objective: row.objective,
      status: row.status as GoalPlaneStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sessionId: row.session_id || null,
      profileId: row.profile_id || null,
      maxTurns: Number(row.max_turns || 12),
      turnsUsed: Number(row.turns_used || 0),
      taskPlaneItemId: row.task_plane_item_id || null,
      history: events.map((event) => ({
        at: event.created_at,
        event: event.event,
        actor: event.actor,
        ...(event.detail ? { detail: event.detail } : {}),
      })),
    };
  }

  private getBoard(boardId: string): TaskBoard | null {
    const row = this.db.prepare('SELECT * FROM zavorth_boards WHERE id = ?').get(boardId) as BoardRow | undefined;
    return row ? this.boardFromRow(row) : null;
  }

  private boardFromRow(row: BoardRow): TaskBoard {
    const taskRows = this.db.prepare(`
      SELECT task_id FROM zavorth_board_tasks
      WHERE board_id = ?
      ORDER BY position ASC
    `).all(row.id) as Array<{ task_id: string }>;
    const notes = this.db.prepare(`
      SELECT created_at, actor, text FROM zavorth_board_notes
      WHERE board_id = ?
      ORDER BY datetime(created_at) ASC, id ASC
    `).all(row.id) as Array<{ created_at: string; actor: string; text: string }>;
    return {
      contractVersion: 'task-board/1',
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      taskIds: taskRows.map((entry) => entry.task_id),
      blackboard: notes.map((entry) => ({
        at: entry.created_at,
        actor: entry.actor,
        text: entry.text,
      })),
    };
  }

  private insertTaskEvent(taskId: string, event: string, status: TaskPlaneStatus, actor: string, detail: string | null, createdAt: string): void {
    this.db.prepare(`
      INSERT INTO zavorth_task_events (task_id, event, status, actor, detail, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(taskId, event, status, actor, detail, createdAt);
  }

  private insertGoalEvent(goalId: string, event: string, actor: string, detail: string | null, createdAt: string): void {
    this.db.prepare(`
      INSERT INTO zavorth_goal_events (goal_id, event, actor, detail, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(goalId, event, actor, detail, createdAt);
  }

  private recordEventSync(stream: string, type: string, subjectId: string | null, payload: Record<string, unknown> = {}): ZavorthOperationalEvent {
    const id = `event-${randomUUID()}`;
    const createdAt = this.timestamp();
    const result = this.db.prepare(`
      INSERT INTO zavorth_events (id, stream, type, subject_id, created_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, normalize(stream, 'runtime'), normalize(type, 'event'), subjectId || null, createdAt, JSON.stringify(payload));
    return {
      id,
      cursor: Number(result.lastInsertRowid),
      stream: normalize(stream, 'runtime'),
      type: normalize(type, 'event'),
      subjectId: subjectId || null,
      createdAt,
      payload: clone(payload),
    };
  }

  private nextMessageOrdinal(sessionId: string): number {
    const row = this.db.prepare('SELECT COALESCE(MAX(ordinal), -1) + 1 AS next FROM zavorth_messages WHERE session_id = ?').get(sessionId) as { next: number } | undefined;
    return Number(row?.next || 0);
  }

  private count(tableName: string): number {
    const row = this.db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get() as { count: number };
    return Number(row.count || 0);
  }

  private countBoardTasks(boardId: string): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM zavorth_board_tasks WHERE board_id = ?').get(boardId) as { count: number };
    return Number(row.count || 0);
  }

  private deriveTitle(content: string): string {
    return trim(String(content || 'Session').replace(/\s+/gu, ' '), 72) || 'Session';
  }

  private timestamp(): string {
    return this.now().toISOString();
  }
}

type SessionRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  metadata_json: string;
};

type TaskRow = {
  id: string;
  title: string;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
  claim_owner: string | null;
  claim_until: string | null;
  approval_id: string | null;
  receipt_id: string | null;
  attempts: number;
  payload_json: string;
};

type GoalRow = {
  id: string;
  objective: string;
  status: string;
  created_at: string;
  updated_at: string;
  session_id: string | null;
  profile_id: string | null;
  max_turns: number;
  turns_used: number;
  task_plane_item_id: string | null;
};

type BoardRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type ReceiptRow = {
  id: string;
  action_id: string | null;
  status: string;
  created_at: string;
  source_surface: string | null;
  summary: string;
  data_json: string;
};

type EventRow = {
  id: string;
  cursor: number;
  stream: string;
  type: string;
  subject_id: string | null;
  created_at: string;
  payload_json: string;
};

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch (error: unknown) {logger.warn('[Zavorth Operational State Db] JSON parse failed', error); return fallback; }
}

function normalize(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function trim(value: string, maxLength: number): string {
  const text = String(value || '').trim();
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 1))}...`;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function resolveLane(item: TaskPlaneItem): TaskBoardLane {
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
