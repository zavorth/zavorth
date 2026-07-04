import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZavorthSubagentBoardService } from '../../src/services/ZavorthSubagentBoardService.js';

describe('ZavorthSubagentBoardService', () => {
  let root: string;
  let dbPath: string;
  let nowMs: number;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-subagent-board-'));
    dbPath = path.join(root, 'subagents.sqlite');
    nowMs = Date.parse('2026-06-04T12:00:00.000Z');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('persists sessions, tasks, claims and receipts across restarts', () => {
    const first = new ZavorthSubagentBoardService({
      dbPath,
      now: () => new Date(nowMs),
    });
    const session = first.createSession({
      objective: 'Audit long running work',
      sourceSurface: 'cli',
      maxDepth: 2,
      maxChildren: 4,
      costCapUsd: 0.5,
    });
    const task = first.enqueueTask({
      sessionId: session.sessionId,
      title: 'Inspect read-only evidence',
      risk: 'read-only',
      depth: 0,
    });
    const claim = first.claimNextTask({ workerId: 'worker-a', heartbeatTtlMs: 30_000 });
    first.recordHeartbeat({ workerId: 'worker-a', taskId: task.taskId });
    first.completeTask({
      taskId: task.taskId,
      workerId: 'worker-a',
      status: 'done',
      evidenceRefs: ['receipt:worker-a'],
      summary: 'Read-only evidence collected.',
    });
    first.close();

    const restarted = new ZavorthSubagentBoardService({
      dbPath,
      now: () => new Date(nowMs + 1000),
    });
    const snapshot = restarted.snapshot();
    restarted.close();

    expect(claim?.taskId).toBe(task.taskId);
    expect(snapshot.sessions).toHaveLength(1);
    expect(snapshot.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ taskId: task.taskId, status: 'done' }),
    ]));
    expect(snapshot.workers).toEqual(expect.arrayContaining([
      expect.objectContaining({ workerId: 'worker-a', status: 'idle' }),
    ]));
    expect(snapshot.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'task.completed', taskId: task.taskId }),
    ]));
  });

  it('prevents duplicate concurrent claims and retries expired heartbeats once', () => {
    const board = new ZavorthSubagentBoardService({
      dbPath,
      now: () => new Date(nowMs),
    });
    const session = board.createSession({
      objective: 'Coordinate workers',
      sourceSurface: 'cli',
      maxDepth: 2,
      maxChildren: 4,
      costCapUsd: 0.5,
    });
    const task = board.enqueueTask({
      sessionId: session.sessionId,
      title: 'Only one worker can own this',
      risk: 'read-only',
      depth: 0,
      maxRetries: 1,
    });

    const firstClaim = board.claimNextTask({ workerId: 'worker-a', heartbeatTtlMs: 100 });
    const secondClaim = board.claimNextTask({ workerId: 'worker-b', heartbeatTtlMs: 100 });
    nowMs += 1000;
    const retry = board.requeueExpiredHeartbeats();
    const retryClaim = board.claimNextTask({ workerId: 'worker-b', heartbeatTtlMs: 100 });
    nowMs += 1000;
    const blocked = board.requeueExpiredHeartbeats();
    const snapshot = board.snapshot();
    board.close();

    expect(firstClaim?.taskId).toBe(task.taskId);
    expect(secondClaim).toBeNull();
    expect(retry.requeued).toBe(1);
    expect(retryClaim?.taskId).toBe(task.taskId);
    expect(blocked.blocked).toBe(1);
    expect(snapshot.retryState).toEqual(expect.arrayContaining([
      expect.objectContaining({ taskId: task.taskId, attempts: 2, maxRetries: 1, status: 'blocked' }),
    ]));
  });

  it('keeps claimed work distinct from running work and projects dispatcher details', () => {
    const board = new ZavorthSubagentBoardService({
      dbPath,
      now: () => new Date(nowMs),
    });
    const session = board.createSession({
      objective: 'Dispatch shared work',
      sourceSurface: 'desktop',
      maxDepth: 2,
      maxChildren: 4,
      costCapUsd: 0.5,
    });
    const task = board.enqueueTask({
      sessionId: session.sessionId,
      title: 'Render runtime board task',
      risk: 'read-only',
      depth: 0,
      maxRetries: 2,
    });

    const claimed = board.claimNextTask({ workerId: 'desktop-worker', heartbeatTtlMs: 30_000 });
    const claimedSnapshot = board.snapshot();

    nowMs += 1000;
    board.recordHeartbeat({ workerId: 'desktop-worker', taskId: task.taskId });
    const runningSnapshot = board.snapshot();

    board.completeTask({
      taskId: task.taskId,
      workerId: 'desktop-worker',
      status: 'completed',
      artifactRefs: ['artifact:runtime-board'],
      comment: 'Runtime task rendered on the shared board.',
      summary: 'Runtime board rendered.',
    });
    const completedSnapshot = board.snapshot();
    board.close();

    expect(claimed?.status).toBe('claimed');
    expect(claimedSnapshot.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        taskId: task.taskId,
        status: 'claimed',
        attempts: 1,
        maxRetries: 2,
        claimedBy: 'desktop-worker',
      }),
    ]));
    expect(runningSnapshot.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ taskId: task.taskId, status: 'running' }),
    ]));
    expect(completedSnapshot.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        taskId: task.taskId,
        status: 'completed',
        artifactRefs: ['artifact:runtime-board'],
        comments: expect.arrayContaining([
          expect.objectContaining({ author: 'desktop-worker', body: 'Runtime task rendered on the shared board.' }),
        ]),
      }),
    ]));
  });

  it('blocks mutating or runaway child tasks before enqueueing them', () => {
    const board = new ZavorthSubagentBoardService({
      dbPath,
      now: () => new Date(nowMs),
    });
    const session = board.createSession({
      objective: 'No runaway spawn',
      sourceSurface: 'cli',
      maxDepth: 1,
      maxChildren: 1,
      costCapUsd: 0.5,
    });
    const parent = board.enqueueTask({
      sessionId: session.sessionId,
      title: 'Parent',
      risk: 'read-only',
      depth: 0,
    });
    const allowedChild = board.enqueueTask({
      sessionId: session.sessionId,
      parentTaskId: parent.taskId,
      title: 'Allowed child',
      risk: 'read-only',
      depth: 1,
    });
    const depthBlocked = board.enqueueTask({
      sessionId: session.sessionId,
      parentTaskId: allowedChild.taskId,
      title: 'Too deep',
      risk: 'read-only',
      depth: 2,
    });
    const mutationBlocked = board.enqueueTask({
      sessionId: session.sessionId,
      title: 'Edit workspace',
      risk: 'mutation',
      depth: 0,
    });
    const snapshot = board.snapshot();
    board.close();

    expect(depthBlocked.status).toBe('blocked');
    expect(mutationBlocked.status).toBe('approval-required');
    expect(snapshot.blockedReasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ taskId: depthBlocked.taskId, reason: 'max-depth-exceeded' }),
      expect.objectContaining({ taskId: mutationBlocked.taskId, reason: 'approval-required' }),
    ]));
  });
});
