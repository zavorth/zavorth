import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import DatabaseLib, { type Database as SQLiteDatabase } from 'better-sqlite3';
import { logger } from '../logger.js';

export type ZavorthSubagentBoardTaskRisk =
  | 'read-only'
  | 'mutation'
  | 'shell'
  | 'network-sensitive'
  | 'external-io';

export type ZavorthSubagentBoardTaskStatus =
  | 'queued'
  | 'claimed'
  | 'running'
  | 'completed'
  | 'done'
  | 'failed'
  | 'cancelled'
  | 'blocked'
  | 'approval-required';

export type ZavorthSubagentBoardSession = {
  sessionId: string;
  objective: string;
  sourceSurface: string;
  status: string;
  maxDepth: number;
  maxChildren: number;
  costCapUsd: number;
  createdAt: string;
  updatedAt: string;
};

export type ZavorthSubagentBoardTask = {
  taskId: string;
  sessionId: string;
  parentTaskId: string | null;
  title: string;
  risk: ZavorthSubagentBoardTaskRisk;
  status: ZavorthSubagentBoardTaskStatus;
  depth: number;
  attempts: number;
  maxRetries: number;
  claimedBy: string | null;
  claimedAt: string | null;
  heartbeatAt: string | null;
  heartbeatDeadlineAt: string | null;
  blockedReason: string | null;
  evidenceRefs: string[];
  artifactRefs: string[];
  comments: ZavorthSubagentBoardTaskComment[];
  summary: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ZavorthSubagentBoardTaskComment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};

export type ZavorthSubagentBoardWorker = {
  workerId: string;
  status: 'busy' | 'idle' | 'expired';
  currentTaskId: string | null;
  lastHeartbeatAt: string | null;
  updatedAt: string;
};

export type ZavorthSubagentBoardReceipt = {
  receiptId: string;
  action: string;
  sessionId: string | null;
  taskId: string | null;
  workerId: string | null;
  status: string;
  createdAt: string;
  summary: string;
  evidenceRefs: string[];
};

export type ZavorthSubagentBoardSnapshot = {
  contractVersion: 'zavorth-subagent-board/1';
  generatedAt: string;
  sessions: ZavorthSubagentBoardSession[];
  tasks: ZavorthSubagentBoardTask[];
  workers: ZavorthSubagentBoardWorker[];
  heartbeats: Array<{
    workerId: string;
    taskId: string | null;
    lastHeartbeatAt: string | null;
    heartbeatDeadlineAt: string | null;
  }>;
  retryState: Array<{
    taskId: string;
    attempts: number;
    maxRetries: number;
    status: ZavorthSubagentBoardTaskStatus;
  }>;
  depth: Array<{
    sessionId: string;
    maxDepth: number;
    maxChildren: number;
    deepestTaskDepth: number;
  }>;
  receipts: ZavorthSubagentBoardReceipt[];
  blockedReasons: Array<{
    taskId: string;
    reason: string;
  }>;
  safety: {
    sqliteDurable: true;
    mutationRequiresApproval: true;
    shellRequiresApproval: true;
    externalIoRequiresApproval: true;
    retryBounded: true;
    spawnDepthBounded: true;
  };
};

type ServiceOptions = {
  dbPath: string;
  now?: () => Date;
};

type CreateSessionInput = {
  objective: string;
  sourceSurface?: string | null;
  maxDepth?: number | null;
  maxChildren?: number | null;
  costCapUsd?: number | null;
};

type EnqueueTaskInput = {
  sessionId: string;
  title: string;
  parentTaskId?: string | null;
  risk?: ZavorthSubagentBoardTaskRisk | null;
  depth?: number | null;
  maxRetries?: number | null;
  approvalId?: string | null;
};

type ClaimInput = {
  workerId: string;
  heartbeatTtlMs?: number | null;
};

type CompleteTaskInput = {
  taskId: string;
  workerId: string;
  status: 'completed' | 'done' | 'failed' | 'cancelled' | 'blocked';
  evidenceRefs?: string[];
  artifactRefs?: string[];
  comment?: string | null;
  summary?: string | null;
};

type HeartbeatInput = {
  workerId: string;
  taskId?: string | null;
  heartbeatTtlMs?: number | null;
};

type SessionRow = {
  session_id: string;
  objective: string;
  source_surface: string;
  status: string;
  max_depth: number;
  max_children: number;
  cost_cap_usd: number;
  created_at: string;
  updated_at: string;
};

type TaskRow = {
  task_id: string;
  session_id: string;
  parent_task_id: string | null;
  title: string;
  risk: ZavorthSubagentBoardTaskRisk;
  status: ZavorthSubagentBoardTaskStatus;
  depth: number;
  attempts: number;
  max_retries: number;
  claimed_by: string | null;
  claimed_at: string | null;
  heartbeat_at: string | null;
  heartbeat_deadline_at: string | null;
  blocked_reason: string | null;
  evidence_refs_json: string;
  artifact_refs_json?: string;
  comments_json?: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

type WorkerRow = {
  worker_id: string;
  status: 'busy' | 'idle' | 'expired';
  current_task_id: string | null;
  last_heartbeat_at: string | null;
  updated_at: string;
};

type ReceiptRow = {
  receipt_id: string;
  action: string;
  session_id: string | null;
  task_id: string | null;
  worker_id: string | null;
  status: string;
  created_at: string;
  summary: string;
  evidence_refs_json: string;
};

export class ZavorthSubagentBoardService {
  private readonly db: SQLiteDatabase;
  private readonly now: () => Date;

  public constructor(options: ServiceOptions) {
    this.now = options.now || (() => new Date());
    fs.mkdirSync(path.dirname(options.dbPath), { recursive: true });
    this.db = new DatabaseLib(options.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.createTables();
  }

  public close(): void {
    this.db.close();
  }

  public createSession(input: CreateSessionInput): ZavorthSubagentBoardSession {
    const now = this.nowIso();
    const sessionId = `subagent-session:${randomUUID()}`;
    this.db.prepare(`
      INSERT INTO subagent_board_sessions (
        session_id, objective, source_surface, status, max_depth, max_children, cost_cap_usd, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      normalizeText(input.objective, 'Subagent mission'),
      normalizeText(input.sourceSurface, 'cli'),
      'running',
      clampInteger(input.maxDepth, 0, 8, 2),
      clampInteger(input.maxChildren, 0, 64, 8),
      clampNumber(input.costCapUsd, 0, 1000, 0.25),
      now,
      now,
    );
    this.recordReceipt({
      action: 'session.created',
      sessionId,
      taskId: null,
      workerId: null,
      status: 'running',
      summary: 'Subagent board session created.',
      evidenceRefs: [],
    });
    return this.getSession(sessionId);
  }

  public enqueueTask(input: EnqueueTaskInput): ZavorthSubagentBoardTask {
    const session = this.getSession(input.sessionId);
    const now = this.nowIso();
    const taskId = `subagent-task:${randomUUID()}`;
    const risk = input.risk || 'read-only';
    const depth = clampInteger(input.depth, 0, 99, 0);
    const maxRetries = clampInteger(input.maxRetries, 0, 12, 2);
    const parentTaskId = normalizeNullable(input.parentTaskId);
    const blockedReason = this.resolveBlockedReason({
      session,
      parentTaskId,
      risk,
      depth,
      approvalId: input.approvalId,
    });
    const status: ZavorthSubagentBoardTaskStatus = blockedReason === 'approval-required'
      ? 'approval-required'
      : blockedReason
        ? 'blocked'
        : 'queued';
    this.db.prepare(`
      INSERT INTO subagent_board_tasks (
        task_id, session_id, parent_task_id, title, risk, status, depth, attempts, max_retries,
        claimed_by, claimed_at, heartbeat_at, heartbeat_deadline_at, blocked_reason,
        evidence_refs_json, artifact_refs_json, comments_json, summary, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, NULL, NULL, NULL, ?, ?, ?, ?, NULL, ?, ?)
    `).run(
      taskId,
      session.sessionId,
      parentTaskId,
      normalizeText(input.title, 'Subagent task'),
      risk,
      status,
      depth,
      maxRetries,
      blockedReason,
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      now,
      now,
    );
    this.recordReceipt({
      action: status === 'queued' ? 'task.queued' : 'task.blocked',
      sessionId: session.sessionId,
      taskId,
      workerId: null,
      status,
      summary: blockedReason ? `Task blocked: ${blockedReason}.` : 'Task queued.',
      evidenceRefs: blockedReason ? [blockedReason] : [],
    });
    return this.getTask(taskId);
  }

  public claimNextTask(input: ClaimInput): ZavorthSubagentBoardTask | null {
    const ttlMs = clampInteger(input.heartbeatTtlMs, 100, 24 * 60 * 60 * 1000, 30_000);
    const workerId = normalizeText(input.workerId, 'worker');
    const task = this.db.transaction(() => {
      const row = this.db.prepare(`
        SELECT * FROM subagent_board_tasks
        WHERE status = 'queued'
        ORDER BY created_at ASC, task_id ASC
        LIMIT 1
      `).get() as TaskRow | undefined;
      if (!row) return null;
      const now = this.nowIso();
      const deadline = new Date(this.now().getTime() + ttlMs).toISOString();
      this.db.prepare(`
        UPDATE subagent_board_tasks
        SET status = 'claimed',
            claimed_by = ?,
            claimed_at = ?,
            heartbeat_at = ?,
            heartbeat_deadline_at = ?,
            attempts = attempts + 1,
            updated_at = ?
        WHERE task_id = ? AND status = 'queued'
      `).run(workerId, now, now, deadline, now, row.task_id);
      this.upsertWorker(workerId, 'busy', row.task_id, now);
      this.recordReceipt({
        action: 'task.claimed',
        sessionId: row.session_id,
        taskId: row.task_id,
        workerId,
        status: 'claimed',
        summary: 'Task claimed by worker.',
        evidenceRefs: [`heartbeat-deadline:${deadline}`],
      });
      return this.getTask(row.task_id);
    })();
    return task;
  }

  public recordHeartbeat(input: HeartbeatInput): void {
    const workerId = normalizeText(input.workerId, 'worker');
    const taskId = normalizeNullable(input.taskId);
    const ttlMs = clampInteger(input.heartbeatTtlMs, 100, 24 * 60 * 60 * 1000, 30_000);
    const now = this.nowIso();
    const deadline = new Date(this.now().getTime() + ttlMs).toISOString();
    this.upsertWorker(workerId, taskId ? 'busy' : 'idle', taskId, now);
    if (taskId) {
      this.db.prepare(`
        UPDATE subagent_board_tasks
        SET status = 'running',
            heartbeat_at = ?,
            heartbeat_deadline_at = ?,
            updated_at = ?
        WHERE task_id = ? AND claimed_by = ?
      `).run(now, deadline, now, taskId, workerId);
    }
  }

  public completeTask(input: CompleteTaskInput): ZavorthSubagentBoardTask {
    const now = this.nowIso();
    const evidenceRefs = input.evidenceRefs || [];
    const artifactRefs = input.artifactRefs || evidenceRefs;
    const status = input.status === 'done' ? 'completed' : input.status;
    const current = this.getTask(input.taskId);
    const comments = [...current.comments];
    const comment = normalizeNullable(input.comment);
    if (comment) {
      comments.push({
        id: `comment:${randomUUID()}`,
        author: normalizeText(input.workerId, 'worker'),
        body: comment,
        createdAt: now,
      });
    }
    this.db.prepare(`
      UPDATE subagent_board_tasks
      SET status = ?,
          evidence_refs_json = ?,
          artifact_refs_json = ?,
          comments_json = ?,
          summary = ?,
          updated_at = ?,
          claimed_by = NULL, heartbeat_at = NULL, heartbeat_deadline_at = NULL
      WHERE task_id = ? AND (claimed_by = ? OR claimed_by IS NULL)
    `).run(status, JSON.stringify(evidenceRefs), JSON.stringify(artifactRefs), JSON.stringify(comments), input.summary || null, now, input.taskId, input.workerId);
    this.upsertWorker(input.workerId, 'idle', null, now);
    const task = this.getTask(input.taskId);
    this.recordReceipt({
      action: status === 'blocked' ? 'task.blocked' : 'task.completed',
      sessionId: task.sessionId,
      taskId: task.taskId,
      workerId: input.workerId,
      status,
      summary: input.summary || `Task ${status}.`,
      evidenceRefs: artifactRefs,
    });
    return task;
  }

  public requeueExpiredHeartbeats(): { expired: number; requeued: number; blocked: number } {
    const now = this.nowIso();
    const expiredRows = this.db.prepare(`
      SELECT * FROM subagent_board_tasks
      WHERE status IN ('claimed', 'running')
        AND heartbeat_deadline_at IS NOT NULL
        AND heartbeat_deadline_at < ?
      ORDER BY heartbeat_deadline_at ASC
    `).all(now) as TaskRow[];
    let requeued = 0;
    let blocked = 0;
    for (const row of expiredRows) {
      if (row.attempts <= row.max_retries) {
        this.db.prepare(`
          UPDATE subagent_board_tasks
          SET status = 'queued',
              claimed_by = NULL,
              claimed_at = NULL,
              heartbeat_at = NULL,
              heartbeat_deadline_at = NULL,
              updated_at = ?
          WHERE task_id = ?
        `).run(now, row.task_id);
        if (row.claimed_by) this.upsertWorker(row.claimed_by, 'expired', null, now);
        requeued += 1;
        this.recordReceipt({
          action: 'task.retry-requeued',
          sessionId: row.session_id,
          taskId: row.task_id,
          workerId: row.claimed_by,
          status: 'queued',
          summary: 'Expired heartbeat requeued task.',
          evidenceRefs: [`attempts:${row.attempts}`, `maxRetries:${row.max_retries}`],
        });
      } else {
        this.db.prepare(`
          UPDATE subagent_board_tasks
          SET status = 'blocked',
              blocked_reason = 'retry-limit-exceeded',
              claimed_by = NULL,
              heartbeat_at = NULL,
              heartbeat_deadline_at = NULL,
              updated_at = ?
          WHERE task_id = ?
        `).run(now, row.task_id);
        if (row.claimed_by) this.upsertWorker(row.claimed_by, 'expired', null, now);
        blocked += 1;
        this.recordReceipt({
          action: 'task.retry-blocked',
          sessionId: row.session_id,
          taskId: row.task_id,
          workerId: row.claimed_by,
          status: 'blocked',
          summary: 'Retry limit exceeded.',
          evidenceRefs: [`attempts:${row.attempts}`, `maxRetries:${row.max_retries}`],
        });
      }
    }
    return { expired: expiredRows.length, requeued, blocked };
  }

  public snapshot(): ZavorthSubagentBoardSnapshot {
    const sessions = (this.db.prepare('SELECT * FROM subagent_board_sessions ORDER BY created_at ASC').all() as SessionRow[])
      .map(mapSessionRow);
    const tasks = (this.db.prepare('SELECT * FROM subagent_board_tasks ORDER BY created_at ASC, task_id ASC').all() as TaskRow[])
      .map(mapTaskRow);
    const workers = (this.db.prepare('SELECT * FROM subagent_board_workers ORDER BY worker_id ASC').all() as WorkerRow[])
      .map(mapWorkerRow);
    const receipts = (this.db.prepare('SELECT * FROM subagent_board_receipts ORDER BY created_at ASC, receipt_id ASC').all() as ReceiptRow[])
      .map(mapReceiptRow);
    return {
      contractVersion: 'zavorth-subagent-board/1',
      generatedAt: this.nowIso(),
      sessions,
      tasks,
      workers,
      heartbeats: tasks
        .filter((task) => task.status === 'running' || task.heartbeatAt || task.heartbeatDeadlineAt)
        .map((task) => ({
          workerId: task.claimedBy || '',
          taskId: task.taskId,
          lastHeartbeatAt: task.heartbeatAt,
          heartbeatDeadlineAt: task.heartbeatDeadlineAt,
        })),
      retryState: tasks.map((task) => ({
        taskId: task.taskId,
        attempts: task.attempts,
        maxRetries: task.maxRetries,
        status: task.status,
      })),
      depth: sessions.map((session) => ({
        sessionId: session.sessionId,
        maxDepth: session.maxDepth,
        maxChildren: session.maxChildren,
        deepestTaskDepth: Math.max(0, ...tasks
          .filter((task) => task.sessionId === session.sessionId)
          .map((task) => task.depth)),
      })),
      receipts,
      blockedReasons: tasks
        .filter((task) => task.blockedReason)
        .map((task) => ({ taskId: task.taskId, reason: task.blockedReason || 'blocked' })),
      safety: {
        sqliteDurable: true,
        mutationRequiresApproval: true,
        shellRequiresApproval: true,
        externalIoRequiresApproval: true,
        retryBounded: true,
        spawnDepthBounded: true,
      },
    };
  }

  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS subagent_board_sessions (
        session_id TEXT PRIMARY KEY,
        objective TEXT NOT NULL,
        source_surface TEXT NOT NULL,
        status TEXT NOT NULL,
        max_depth INTEGER NOT NULL,
        max_children INTEGER NOT NULL,
        cost_cap_usd REAL NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS subagent_board_tasks (
        task_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        parent_task_id TEXT,
        title TEXT NOT NULL,
        risk TEXT NOT NULL,
        status TEXT NOT NULL,
        depth INTEGER NOT NULL,
        attempts INTEGER NOT NULL,
        max_retries INTEGER NOT NULL,
        claimed_by TEXT,
        claimed_at TEXT,
        heartbeat_at TEXT,
        heartbeat_deadline_at TEXT,
        blocked_reason TEXT,
        evidence_refs_json TEXT NOT NULL,
        summary TEXT,
        artifact_refs_json TEXT NOT NULL DEFAULT '[]',
        comments_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_subagent_board_tasks_status
        ON subagent_board_tasks(status, created_at);
      CREATE INDEX IF NOT EXISTS idx_subagent_board_tasks_parent
        ON subagent_board_tasks(parent_task_id);

      CREATE TABLE IF NOT EXISTS subagent_board_workers (
        worker_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        current_task_id TEXT,
        last_heartbeat_at TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS subagent_board_receipts (
        receipt_id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        session_id TEXT,
        task_id TEXT,
        worker_id TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        summary TEXT NOT NULL,
        evidence_refs_json TEXT NOT NULL
      );
    `);
    this.ensureColumn('subagent_board_tasks', 'artifact_refs_json', "TEXT NOT NULL DEFAULT '[]'");
    this.ensureColumn('subagent_board_tasks', 'comments_json', "TEXT NOT NULL DEFAULT '[]'");
  }

  private ensureColumn(tableName: string, columnName: string, definition: string): void {
    const rows = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    if (!rows.some((row) => row.name === columnName)) {
      this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
  }

  private getSession(sessionId: string): ZavorthSubagentBoardSession {
    const row = this.db.prepare('SELECT * FROM subagent_board_sessions WHERE session_id = ?').get(sessionId) as SessionRow | undefined;
    if (!row) throw new Error(`Subagent board session not found: ${sessionId}`);
    return mapSessionRow(row);
  }

  private getTask(taskId: string): ZavorthSubagentBoardTask {
    const row = this.db.prepare('SELECT * FROM subagent_board_tasks WHERE task_id = ?').get(taskId) as TaskRow | undefined;
    if (!row) throw new Error(`Subagent board task not found: ${taskId}`);
    return mapTaskRow(row);
  }

  private resolveBlockedReason(input: {
    session: ZavorthSubagentBoardSession;
    parentTaskId: string | null;
    risk: ZavorthSubagentBoardTaskRisk;
    depth: number;
    approvalId?: string | null;
  }): string | null {
    if (input.depth > input.session.maxDepth) return 'max-depth-exceeded';
    if (input.parentTaskId) {
      const children = this.db.prepare('SELECT COUNT(*) AS count FROM subagent_board_tasks WHERE parent_task_id = ?')
        .get(input.parentTaskId) as { count: number };
      if (children.count >= input.session.maxChildren) return 'max-children-exceeded';
    }
    if (input.risk !== 'read-only' && !normalizeNullable(input.approvalId)) return 'approval-required';
    return null;
  }

  private upsertWorker(
    workerId: string,
    status: ZavorthSubagentBoardWorker['status'],
    currentTaskId: string | null,
    timestamp: string,
  ): void {
    this.db.prepare(`
      INSERT INTO subagent_board_workers (worker_id, status, current_task_id, last_heartbeat_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(worker_id) DO UPDATE SET
        status = excluded.status,
        current_task_id = excluded.current_task_id,
        last_heartbeat_at = excluded.last_heartbeat_at,
        updated_at = excluded.updated_at
    `).run(workerId, status, currentTaskId, timestamp, timestamp);
  }

  private recordReceipt(input: Omit<ZavorthSubagentBoardReceipt, 'receiptId' | 'createdAt'>): void {
    this.db.prepare(`
      INSERT INTO subagent_board_receipts (
        receipt_id, action, session_id, task_id, worker_id, status, created_at, summary, evidence_refs_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `receipt:${randomUUID()}`,
      input.action,
      input.sessionId,
      input.taskId,
      input.workerId,
      input.status,
      this.nowIso(),
      input.summary,
      JSON.stringify(input.evidenceRefs),
    );
  }

  private nowIso(): string {
    return this.now().toISOString();
  }
}

function mapSessionRow(row: SessionRow): ZavorthSubagentBoardSession {
  return {
    sessionId: row.session_id,
    objective: row.objective,
    sourceSurface: row.source_surface,
    status: row.status,
    maxDepth: row.max_depth,
    maxChildren: row.max_children,
    costCapUsd: row.cost_cap_usd,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTaskRow(row: TaskRow): ZavorthSubagentBoardTask {
  return {
    taskId: row.task_id,
    sessionId: row.session_id,
    parentTaskId: row.parent_task_id,
    title: row.title,
    risk: row.risk,
    status: row.status,
    depth: row.depth,
    attempts: row.attempts,
    maxRetries: row.max_retries,
    claimedBy: row.claimed_by,
    claimedAt: row.claimed_at,
    heartbeatAt: row.heartbeat_at,
    heartbeatDeadlineAt: row.heartbeat_deadline_at,
    blockedReason: row.blocked_reason,
    evidenceRefs: parseStringArray(row.evidence_refs_json),
    artifactRefs: parseStringArray(row.artifact_refs_json || row.evidence_refs_json),
    comments: parseComments(row.comments_json || '[]'),
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWorkerRow(row: WorkerRow): ZavorthSubagentBoardWorker {
  return {
    workerId: row.worker_id,
    status: row.status,
    currentTaskId: row.current_task_id,
    lastHeartbeatAt: row.last_heartbeat_at,
    updatedAt: row.updated_at,
  };
}

function mapReceiptRow(row: ReceiptRow): ZavorthSubagentBoardReceipt {
  return {
    receiptId: row.receipt_id,
    action: row.action,
    sessionId: row.session_id,
    taskId: row.task_id,
    workerId: row.worker_id,
    status: row.status,
    createdAt: row.created_at,
    summary: row.summary,
    evidenceRefs: parseStringArray(row.evidence_refs_json),
  };
}

function normalizeText(value: unknown, fallback: string): string {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeNullable(value: unknown): string | null {
  const text = String(value || '').trim();
  return text || null;
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
  } catch (error) { logger.warn('[Zavorth Subagent Board] JSON parse failed', error); return []; }
}

function parseComments(value: string): ZavorthSubagentBoardTaskComment[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        const raw = entry && typeof entry === 'object'
          ? entry as Partial<ZavorthSubagentBoardTaskComment>
          : {};
        return {
          id: normalizeText(raw.id, `comment:${randomUUID()}`),
          author: normalizeText(raw.author, 'worker'),
          body: normalizeText(raw.body, ''),
          createdAt: normalizeText(raw.createdAt, new Date(0).toISOString()),
        };
      })
      .filter((entry) => entry.body);
  } catch (error) { logger.warn('[Zavorth Subagent Board] creation failed', error); return []; }
}
