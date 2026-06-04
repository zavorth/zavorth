import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { GoalPlaneService } from '../../src/services/GoalPlaneService.js';
import { TaskBoardPlaneService } from '../../src/services/TaskBoardPlaneService.js';
import { TaskPlaneService } from '../../src/services/TaskPlaneService.js';
import { ZavorthOperationalStateDbService } from '../../src/services/ZavorthOperationalStateDbService.js';
import { ZavorthSessionRecallService } from '../../src/services/ZavorthSessionRecallService.js';

describe('ZavorthOperationalStateDbService', () => {
  let root: string;
  let db: ZavorthOperationalStateDbService;
  const now = () => new Date('2026-06-01T12:00:00.000Z');

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-state-db-'));
    db = new ZavorthOperationalStateDbService({
      dbPath: path.join(root, 'data', 'zavorth.db'),
      now,
    });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('initializes a local durable state database with counts and safety metadata', () => {
    const snapshot = db.snapshot();

    expect(snapshot.contractVersion).toBe('zavorth-operational-state-db/1');
    expect(snapshot.dbPath).toContain('zavorth.db');
    expect(snapshot.safety.sqliteWalWithFallback).toBe(true);
    expect(snapshot.counts.sessions).toBe(0);
  });

  it('stores session messages and recalls them through the unified FTS-aware path', () => {
    const recall = new ZavorthSessionRecallService({
      storePath: path.join(root, 'runtime', 'mnemos-session-recall.json'),
      stateDb: db,
      now,
    });

    const session = recall.appendMessage({
      sessionId: 'session-a',
      title: 'Provider mesh',
      role: 'user',
      content: 'Repair native xAI search and provider readiness.',
    });
    recall.appendMessage({
      sessionId: session.id,
      role: 'assistant',
      content: 'Native search now has operational StateDB recall.',
    });

    const hit = recall.recall({ query: 'native search', limit: 5 });
    const browse = recall.recall({ limit: 5 });
    const state = db.snapshot();

    expect(hit.returned).toBeGreaterThan(0);
    expect(hit.hits[0]?.sessionId).toBe('session-a');
    expect(browse.mode).toBe('browse');
    expect(state.counts.sessions).toBe(1);
    expect(state.counts.messages).toBe(2);
  });

  it('keeps tasks, goals and board cards in one evented ledger', () => {
    const taskPlane = new TaskPlaneService({
      storePath: path.join(root, 'runtime', 'task-plane.json'),
      stateDb: db,
      now,
    });
    const goalPlane = new GoalPlaneService({
      storePath: path.join(root, 'runtime', 'goal-plane.json'),
      taskPlane,
      stateDb: db,
      now,
    });
    const boardPlane = new TaskBoardPlaneService({
      storePath: path.join(root, 'runtime', 'task-board.json'),
      taskPlane,
      stateDb: db,
      now,
    });

    const task = taskPlane.createTask({ title: 'Audit memory', source: 'test' });
    const claimed = taskPlane.claimTask(task.id, 'worker-a', 30_000);
    const goal = goalPlane.createGoal({ objective: 'Finish operational state', maxTurns: 2 });
    const ticked = goalPlane.recordTurn(goal.id);
    const board = boardPlane.createBoard('Daily');
    const card = boardPlane.triage({ boardId: board.id, title: 'Review StateDB' });
    const snapshot = boardPlane.snapshot();

    expect(claimed?.status).toBe('claimed');
    expect(goal.taskPlaneItemId).toBeTruthy();
    expect(ticked?.turnsUsed).toBe(1);
    expect(card.payload.boardId).toBe(board.id);
    expect(snapshot.summary.tasks).toBe(1);
    expect(db.snapshot().counts.events).toBeGreaterThanOrEqual(6);
  });

  it('records receipts, event cursors and explicit locks', () => {
    const receipt = db.recordReceipt({
      actionId: 'state.test',
      status: 'applied',
      sourceSurface: 'jest',
      summary: 'StateDB receipt test.',
      data: { token: 'redacted-by-caller' },
    });
    const acquired = db.acquireLock('compression:session-a', 'worker-a', 10_000);
    const blocked = db.acquireLock('compression:session-a', 'worker-b', 10_000);
    const released = db.releaseLock('compression:session-a', 'worker-a');
    const events = db.listEvents({ limit: 20 });

    expect(receipt.id).toContain('receipt-');
    expect(db.listReceipts()).toHaveLength(1);
    expect(acquired).toBe(true);
    expect(blocked).toBe(false);
    expect(released).toBe(true);
    expect(events.map((event) => event.type)).toContain('receipt.recorded');
  });

  it('imports legacy JSON stores into StateDB without losing ids', () => {
    const taskJson = path.join(root, 'runtime', 'task-plane.json');
    const recallJson = path.join(root, 'runtime', 'mnemos-session-recall.json');
    const legacyTaskPlane = new TaskPlaneService({ storePath: taskJson, now });
    const legacyRecall = new ZavorthSessionRecallService({ storePath: recallJson, now });
    const legacyTask = legacyTaskPlane.createTask({ title: 'Legacy task', source: 'legacy-test' });
    const legacySession = legacyRecall.appendMessage({
      sessionId: 'legacy-session',
      title: 'Legacy session',
      role: 'user',
      content: 'Old JSON recall should move into the operational state.',
    });

    const stateBackedTasks = new TaskPlaneService({
      storePath: taskJson,
      stateDbPath: db.path,
      now,
    });
    const stateBackedRecall = new ZavorthSessionRecallService({
      storePath: recallJson,
      stateDbPath: db.path,
      now,
    });

    expect(stateBackedTasks.listTasks().map((task) => task.id)).toContain(legacyTask.id);
    expect(stateBackedRecall.recall({ query: 'operational state' }).hits[0]?.sessionId).toBe(legacySession.id);
    expect(db.listEvents({ stream: 'tasks' }).map((event) => event.type)).toContain('task.legacy_json.imported');
  });
});
