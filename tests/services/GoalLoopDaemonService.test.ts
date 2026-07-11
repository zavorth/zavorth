import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { GoalLoopDaemonService } from '../../src/services/GoalLoopDaemonService.js';
import { GoalLoopService } from '../../src/services/GoalLoopService.js';
import { GoalLoopWorkerService, type GoalLoopAgentRunner } from '../../src/services/GoalLoopWorkerService.js';
import { GoalPlaneService } from '../../src/services/GoalPlaneService.js';
import { TaskPlaneService } from '../../src/services/TaskPlaneService.js';
import { ZavorthOperationalStateDbService } from '../../src/services/ZavorthOperationalStateDbService.js';
import type { UniversalAgentRequest, UniversalAgentRunResult } from '../../src/runtime/agent/UniversalAgentRuntimeTypes.js';

describe('GoalLoopDaemonService', () => {
  let root: string;
  let stateDb: ZavorthOperationalStateDbService;
  let currentTime = Date.parse('2026-06-01T12:00:00.000Z');
  const now = () => new Date(currentTime);

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-goal-loop-daemon-'));
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

  function makeServices(reply = 'completed all validation and tests passed') {
    const agentRunner: GoalLoopAgentRunner = {
      run: jest.fn(async (request) => runResult(request, reply)),
    };
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
    const loop = new GoalLoopService({
      goalPlane,
      taskPlane,
      stateDb,
      now,
    });
    const worker = new GoalLoopWorkerService({
      goalPlane,
      taskPlane,
      loop,
      agentRunner,
      stateDb,
      now,
    });
    const daemon = new GoalLoopDaemonService({
      taskPlane,
      worker,
      stateDb,
      now,
    });
    return { agentRunner, taskPlane, goalPlane, loop, worker, daemon };
  }

  it('records heartbeat and drains queued Goal Loop continuations', async () => {
    const { agentRunner, taskPlane, goalPlane, loop, daemon } = makeServices();
    const goal = goalPlane.createGoal({ objective: 'Finish release validation.', maxTurns: 3 });
    await loop.evaluate({ goalId: goal.id, turnSummary: 'Need one separated worker step.' });

    const result = await daemon.tick({ daemonId: 'daemon-a', maxItems: 2, intervalMs: 1000 });

    expect(agentRunner.run).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('idle');
    expect(result.safety.heartbeatRecorded).toBe(true);
    expect(result.pendingContinuations).toBe(0);
    expect(result.lastDrain?.processed).toBe(1);
    expect(result.receipt?.actionId).toBe('goals.loop.daemon');
    expect(taskPlane.listTasks().filter((task) => task.source === 'goal-loop' && task.status === 'done')).toHaveLength(1);
    expect(stateDb.listEvents({ stream: 'goal-loop' }).map((event) => event.type)).toEqual(expect.arrayContaining([
      'tick.started',
      'tick.completed',
      'goal.loop.worker.completed',
    ]));
  });

  it('recovers stale claimed continuations before running the worker', async () => {
    const { taskPlane, goalPlane, loop, daemon } = makeServices();
    const goal = goalPlane.createGoal({ objective: 'Continue a stale run.', maxTurns: 3 });
    const queued = await loop.evaluate({ goalId: goal.id, turnSummary: 'Need one separated worker step.' });
    const taskId = queued.continuationTask?.id as string;
    expect(taskPlane.claimTask(taskId, 'old-worker', 1000)?.status).toBe('claimed');
    expect(taskPlane.updateStatus(taskId, 'running', 'old-worker', 'started then disappeared')?.status).toBe('running');
    currentTime += 20 * 60 * 1000;

    const result = await daemon.tick({
      daemonId: 'daemon-b',
      staleAfterMs: 1000,
      leaseMs: 5000,
      intervalMs: 1000,
    });

    expect(result.staleRecovered).toBe(1);
    expect(result.runningContinuations).toBe(0);
    expect(result.lastDrain?.processed).toBe(1);
    expect(taskPlane.listTasks().find((task) => task.id === taskId)?.status).toBe('done');
    expect(stateDb.listEvents({ stream: 'goal-loop' }).map((event) => event.type)).toContain('goal.loop.daemon.stale_recovered');
  });

  it('calls schedulePlane.processDue during tick when schedule plane is wired', async () => {
    const { agentRunner, taskPlane, goalPlane, loop, worker } = makeServices();
    const processDue = jest.fn(() => ({
      ok: true,
      summary: 'Processed 1 due routine(s).',
      processed: 1,
      materialized: [{ routineId: 'routine-a', taskId: 'task-a', nextRunAt: null }],
      receipt: null,
      continuity: null,
    }));
    const daemon = new GoalLoopDaemonService({
      taskPlane,
      worker,
      schedulePlane: { processDue },
      stateDb,
      now,
    });
    const goal = goalPlane.createGoal({ objective: 'Process schedule due work.', maxTurns: 2 });
    await loop.evaluate({ goalId: goal.id, turnSummary: 'Need one separated worker step.' });

    const result = await daemon.tick({ daemonId: 'daemon-schedule', maxItems: 2, intervalMs: 1000 });

    expect(processDue).toHaveBeenCalledTimes(1);
    expect(processDue).toHaveBeenCalledWith(expect.objectContaining({
      actor: 'daemon-schedule:schedule',
      maxItems: 2,
    }));
    expect(result.safety.schedulePlaneWired).toBe(true);
    expect(result.receipt?.data).toEqual(expect.objectContaining({
      scheduleDueProcessed: 1,
      scheduleDueOk: true,
    }));
    expect(result.scheduleDue?.processed).toBe(1);
    expect(agentRunner.run).toHaveBeenCalled();
  });
});

function runResult(request: UniversalAgentRequest, reply: string): UniversalAgentRunResult {
  return {
    ok: true,
    run: {
      id: `run-${request.requestId}`,
      traceId: request.traceId || `trace-${request.requestId}`,
      requestId: request.requestId || 'request',
      sessionId: request.sessionId || 'session',
      userId: request.userId,
      channel: request.channel,
      title: 'Goal Loop daemon run',
      input: request.text,
      workspace: request.workspace || null,
      status: 'completed',
      createdAt: '2026-06-01T12:00:00.000Z',
      updatedAt: '2026-06-01T12:00:01.000Z',
      summary: reply,
      events: [],
      toolExposure: { mode: 'safe', summary: 'safe', tools: [] },
      replyPorts: [],
      modelProfile: {
        providerLabel: 'fake',
        modelLabel: 'fake',
        routingPolicy: 'direct',
      },
      approvals: [],
      artifacts: [],
      memorySignals: [],
      metadata: {},
    },
    replies: [{
      id: `reply-${request.requestId}`,
      runId: `run-${request.requestId}`,
      port: request.replyPort || {
        id: 'memory',
        label: 'memory',
        kind: 'cli',
        status: 'available',
      },
      text: reply,
      createdAt: '2026-06-01T12:00:01.000Z',
    }],
  };
}
