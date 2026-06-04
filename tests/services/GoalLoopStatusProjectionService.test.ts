import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { GoalLoopStatusProjectionService } from '../../src/services/GoalLoopStatusProjectionService.js';
import { GoalPlaneService } from '../../src/services/GoalPlaneService.js';
import { TaskPlaneService } from '../../src/services/TaskPlaneService.js';
import { ZavorthOperationalStateDbService } from '../../src/services/ZavorthOperationalStateDbService.js';

describe('GoalLoopStatusProjectionService', () => {
  let root: string;
  let stateDb: ZavorthOperationalStateDbService;
  const now = () => new Date('2026-06-01T12:00:00.000Z');

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-goal-loop-status-'));
    fs.mkdirSync(path.join(root, 'runtime'), { recursive: true });
    stateDb = new ZavorthOperationalStateDbService({
      dbPath: path.join(root, 'runtime', 'state.sqlite'),
      now,
    });
  });

  afterEach(() => {
    stateDb.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('projects daemon heartbeat, active goal and queued continuation for dashboard and TUI', () => {
    const taskPlane = new TaskPlaneService({
      storePath: path.join(root, 'runtime', 'task-plane.json'),
      stateDb,
      now,
    });
    const goalPlane = new GoalPlaneService({
      storePath: path.join(root, 'runtime', 'goal-plane.json'),
      taskPlane,
      stateDb,
      now,
    });
    const goal = goalPlane.createGoal({ objective: 'Finish release readiness.', maxTurns: 5 });
    const task = taskPlane.createTask({
      title: 'Continue goal',
      source: 'goal-loop',
      payload: {
        kind: 'goal-loop-continuation',
        goalId: goal.id,
      },
    });
    stateDb.setMeta('goal-loop-daemon:bootstrap-goal-loop-daemon', {
      daemonId: 'bootstrap-goal-loop-daemon',
      status: 'running',
      heartbeatAt: '2026-06-01T11:59:50.000Z',
      intervalMs: 15000,
      leaseMs: 300000,
      staleAfterMs: 600000,
      backoffMs: 0,
      consecutiveFailures: 0,
    });
    stateDb.recordEvent('goal-loop', 'goal.loop.continuation.queued', goal.id, {
      taskId: task.id,
    });
    stateDb.recordReceipt({
      actionId: 'goals.loop.step',
      status: 'queued',
      sourceSurface: 'test',
      summary: 'Goal Loop queued continuation.',
    });

    const snapshot = new GoalLoopStatusProjectionService({
      taskPlane,
      goalPlane,
      stateDb,
      now,
      intervalMs: 15000,
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('goal-loop-status/1');
    expect(snapshot.daemon.status).toBe('active');
    expect(snapshot.daemon.nextRunAfter).toBe('2026-06-01T12:00:05.000Z');
    expect(snapshot.goals.current?.id).toBe(goal.id);
    expect(snapshot.continuations.queued).toBe(1);
    expect(snapshot.continuations.currentTask?.id).toBe(task.id);
    expect(snapshot.latest.receipt?.actionId).toBe('goals.loop.step');
    expect(snapshot.lines[0]).toContain('Continuing goal');
    expect(snapshot.safety.readOnly).toBe(true);
  });
});
