import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { GoalLoopService } from '../../src/services/GoalLoopService.js';
import { GoalLoopWorkerService, type GoalLoopAgentRunner } from '../../src/services/GoalLoopWorkerService.js';
import { GoalPlaneService } from '../../src/services/GoalPlaneService.js';
import { TaskPlaneService } from '../../src/services/TaskPlaneService.js';
import { ZavorthOperationalStateDbService } from '../../src/services/ZavorthOperationalStateDbService.js';
import type { UniversalAgentRequest, UniversalAgentRunResult } from '../../src/runtime/agent/UniversalAgentRuntimeTypes.js';

describe('GoalLoopWorkerService', () => {
  let root: string;
  let stateDb: ZavorthOperationalStateDbService;
  const now = () => new Date('2026-06-01T12:00:00.000Z');

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-goal-loop-worker-'));
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

  function makeServices(agentRunner: GoalLoopAgentRunner) {
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
    return { taskPlane, goalPlane, loop, worker };
  }

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
        title: 'Goal Loop run',
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

  it('claims a continuation task, runs AgentRun and marks the goal done after re-judgement', async () => {
    const agentRunner: GoalLoopAgentRunner = {
      run: jest.fn(async (request) => runResult(request, 'completed all validation and tests passed')),
    };
    const { taskPlane, goalPlane, loop, worker } = makeServices(agentRunner);
    const goal = goalPlane.createGoal({ objective: 'Finish release validation.', maxTurns: 3, profileId: 'developer' });
    const queued = await loop.evaluate({ goalId: goal.id, turnSummary: 'Need one worker step.' });

    const result = await worker.runNext({ workerId: 'worker-a' });

    expect(queued.continuationTask?.status).toBe('queued');
    expect(agentRunner.run).toHaveBeenCalledTimes(1);
    expect((agentRunner.run as jest.Mock).mock.calls[0][0]).toEqual(expect.objectContaining({
      channel: 'cli',
      sessionId: `goal-loop:${goal.id}`,
      metadata: expect.objectContaining({
        profileId: 'developer',
        goalLoop: expect.objectContaining({ goalId: goal.id, taskId: queued.continuationTask?.id }),
        goalLoopBudget: expect.objectContaining({ maxToolRounds: 4 }),
      }),
    }));
    expect(result.task?.status).toBe('done');
    expect(result.agentRun?.status).toBe('completed');
    expect(result.loop?.verdict.status).toBe('done');
    expect(goalPlane.snapshot().goals.find((entry) => entry.id === goal.id)?.status).toBe('done');
    expect(taskPlane.listTasks().filter((task) => task.source === 'goal-loop' && task.status === 'queued')).toHaveLength(0);
    expect(stateDb.listEvents({ stream: 'goal-loop' }).map((event) => event.type)).toEqual(expect.arrayContaining([
      'goal.loop.worker.started',
      'goal.loop.worker.completed',
    ]));
  });

  it('can re-judge a completed worker run into another queued continuation', async () => {
    const agentRunner: GoalLoopAgentRunner = {
      run: jest.fn(async (request) => runResult(request, 'one slice processed; continue with another audit slice')),
    };
    const { taskPlane, goalPlane, loop, worker } = makeServices(agentRunner);
    const goal = goalPlane.createGoal({ objective: 'Audit several packages.', maxTurns: 4 });
    await loop.evaluate({ goalId: goal.id, turnSummary: 'Start audit.' });

    const result = await worker.runNext({ workerId: 'worker-b' });

    expect(result.task?.status).toBe('done');
    expect(result.loop?.verdict.status).toBe('continue');
    expect(result.loop?.continuationTask?.status).toBe('queued');
    expect(taskPlane.listTasks().filter((task) => task.source === 'goal-loop' && task.status === 'queued')).toHaveLength(1);
    expect(goalPlane.snapshot().goals.find((entry) => entry.id === goal.id)?.status).toBe('active');
  });
});
