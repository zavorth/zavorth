import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { GoalLoopService } from '../../src/services/GoalLoopService.js';
import { GoalPlaneService } from '../../src/services/GoalPlaneService.js';
import { TaskPlaneService } from '../../src/services/TaskPlaneService.js';
import { ZavorthOperationalStateDbService } from '../../src/services/ZavorthOperationalStateDbService.js';

describe('GoalLoopService', () => {
  let root: string;
  let stateDb: ZavorthOperationalStateDbService;
  const now = () => new Date('2026-06-01T12:00:00.000Z');

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-goal-loop-'));
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

  function services(llmRuntime?: ConstructorParameters<typeof GoalLoopService>[0]['llmRuntime']) {
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
      llmRuntime,
      now,
    });
    return { taskPlane, goalPlane, loop };
  }

  it('uses an optional LLM judge and queues a continuation task instead of executing silently', async () => {
    const llmRuntime = {
      chatDetailed: jest.fn(async () => ({
        providerName: 'fake-provider',
        modelName: 'judge-model',
        response: {
          content: JSON.stringify({
            status: 'continue',
            confidence: 0.91,
            reason: 'More validation remains.',
            nextPrompt: 'Run the next validation slice.',
            evidence: ['tests-pending'],
          }),
        },
      })),
    };
    const { goalPlane, taskPlane, loop } = services(llmRuntime);
    const goal = goalPlane.createGoal({ objective: 'Finish release validation.', maxTurns: 3 });

    const snapshot = await loop.evaluate({
      goalId: goal.id,
      turnSummary: 'Implementation is done, but validation still remains.',
      sourceSurface: 'test',
    });

    expect(snapshot.verdict.judge).toBe('llm');
    expect(snapshot.verdict.status).toBe('continue');
    expect(snapshot.verdict.providerName).toBe('fake-provider');
    expect(snapshot.continuationTask?.status).toBe('queued');
    expect(snapshot.continuationTask?.payload.kind).toBe('goal-loop-continuation');
    expect(snapshot.continuationTask?.payload.nextPrompt).toBe('Run the next validation slice.');
    expect(snapshot.safety.noSilentExecution).toBe(true);
    expect(taskPlane.listTasks().filter((task) => task.source === 'goal-loop')).toHaveLength(1);
    expect(stateDb.listEvents({ stream: 'goal-loop' }).map((event) => event.type)).toEqual(expect.arrayContaining([
      'goal.loop.evaluated',
      'goal.loop.continuation.queued',
    ]));
    expect(stateDb.listReceipts(10).some((receipt) => receipt.actionId === 'goals.loop.step')).toBe(true);
  });

  it('marks a goal done when the judge returns done', async () => {
    const llmRuntime = {
      chatDetailed: jest.fn(async () => ({
        response: {
          content: JSON.stringify({
            status: 'done',
            confidence: 0.95,
            reason: 'All success criteria passed.',
            evidence: ['qa-passed'],
          }),
        },
      })),
    };
    const { goalPlane, taskPlane, loop } = services(llmRuntime);
    const goal = goalPlane.createGoal({ objective: 'Ship the feature.', maxTurns: 3 });

    const snapshot = await loop.evaluate({ goalId: goal.id });

    expect(snapshot.verdict.status).toBe('done');
    expect(snapshot.continuationTask).toBeNull();
    expect(goalPlane.snapshot().goals.find((entry) => entry.id === goal.id)?.status).toBe('done');
    expect(taskPlane.listTasks().filter((task) => task.source === 'goal-loop')).toHaveLength(0);
  });

  it('falls back deterministically when the LLM judge cannot produce JSON', async () => {
    const llmRuntime = {
      chatDetailed: jest.fn(async () => ({
        response: { content: 'not json at all' },
      })),
    };
    const { goalPlane, loop } = services(llmRuntime);
    const goal = goalPlane.createGoal({ objective: 'Resolve a blocked rollout.', maxTurns: 3 });

    const snapshot = await loop.evaluate({
      goalId: goal.id,
      turnSummary: 'Blocked waiting approval from operator.',
    });

    expect(snapshot.verdict.judge).toBe('heuristic');
    expect(snapshot.verdict.status).toBe('pause');
    expect(snapshot.continuationTask).toBeNull();
    expect(goalPlane.snapshot().goals.find((entry) => entry.id === goal.id)?.status).toBe('paused');
    expect(stateDb.listEvents({ stream: 'goal-loop' }).map((event) => event.type)).toContain('goal.loop.judge.parse_failed');
  });

  it('pauses at the max turn budget and does not create another continuation', async () => {
    const { goalPlane, taskPlane, loop } = services();
    const goal = goalPlane.createGoal({ objective: 'Run a tiny goal.', maxTurns: 1 });

    const snapshot = await loop.evaluate({ goalId: goal.id, turnSummary: 'Continue one more step.' });

    expect(snapshot.verdict.status).toBe('pause');
    expect(snapshot.continuationTask).toBeNull();
    expect(goalPlane.snapshot().goals.find((entry) => entry.id === goal.id)?.status).toBe('paused');
    expect(taskPlane.listTasks().filter((task) => task.source === 'goal-loop')).toHaveLength(0);
  });
});
