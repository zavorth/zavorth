import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { GoalPlaneService } from '../../src/services/GoalPlaneService.js';
import { TaskBoardPlaneService } from '../../src/services/TaskBoardPlaneService.js';
import { TaskPlaneService } from '../../src/services/TaskPlaneService.js';
import { ZavorthBackgroundTaskService } from '../../src/services/ZavorthBackgroundTaskService.js';
import { ZavorthSessionRecallService } from '../../src/services/ZavorthSessionRecallService.js';
import { ZavorthXaiRuntimeService } from '../../src/services/ZavorthXaiRuntimeService.js';

describe('Zavorth daily operations planes', () => {
  let root: string;
  const now = () => new Date('2026-06-01T12:00:00.000Z');

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-daily-ops-'));
    fs.mkdirSync(path.join(root, 'runtime'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('recalls sessions in browse, discovery and scroll modes without using an LLM', () => {
    const service = new ZavorthSessionRecallService({
      storePath: path.join(root, 'runtime', 'mnemos-session-recall.json'),
      now,
    });
    const session = service.appendMessage({
      sessionId: 'session-a',
      title: 'Provider work',
      role: 'user',
      content: 'Please repair the xAI provider doctor and native search path.',
    });
    const second = service.appendMessage({
      sessionId: session.id,
      role: 'assistant',
      content: 'The xAI doctor now checks credentials and native search readiness.',
    });

    expect(service.recall().mode).toBe('browse');
    const discovery = service.recall({ query: 'native search', limit: 3 });
    expect(discovery.mode).toBe('discovery');
    expect(discovery.hits[0]?.sessionId).toBe('session-a');
    const scroll = service.recall({
      sessionId: second.id,
      aroundMessageId: second.messages[1]?.id,
    });
    expect(scroll.mode).toBe('scroll');
    expect(scroll.safety.llmUsed).toBe(false);
  });

  it('creates background tasks as visible Task Plane work without starting execution', () => {
    const service = new ZavorthBackgroundTaskService({
      projectRoot: root,
      explicitHome: root,
      now,
    });

    const task = service.createBackgroundTask({
      prompt: 'Run the long documentation audit later.',
      sourceSurface: 'test',
    });
    const snapshot = service.snapshot();

    expect(task.status).toBe('queued');
    expect(task.payload.kind).toBe('background-agent-run');
    expect(snapshot.summary.total).toBe(1);
    expect(snapshot.safety.executionDirectlyStarted).toBe(false);
  });

  it('keeps goals persistent and backed by Task Plane', () => {
    const taskPlane = new TaskPlaneService({
      storePath: path.join(root, 'runtime', 'task-plane.json'),
      now,
    });
    const service = new GoalPlaneService({
      storePath: path.join(root, 'runtime', 'goal-plane.json'),
      taskPlane,
      now,
    });

    const goal = service.createGoal({ objective: 'Finish release readiness.', maxTurns: 2 });
    const ticked = service.recordTurn(goal.id);
    const paused = service.transition(goal.id, 'paused');

    expect(goal.taskPlaneItemId).toBeTruthy();
    expect(ticked?.turnsUsed).toBe(1);
    expect(paused?.status).toBe('paused');
    expect(service.snapshot().summary.paused).toBe(1);
  });

  it('projects a TaskBoard over Task Plane with triage and decomposition', () => {
    const taskPlane = new TaskPlaneService({
      storePath: path.join(root, 'runtime', 'task-plane.json'),
      now,
    });
    const service = new TaskBoardPlaneService({
      storePath: path.join(root, 'runtime', 'task-board.json'),
      taskPlane,
      now,
    });

    const board = service.createBoard('Daily board');
    const card = service.triage({ boardId: board.id, title: 'Review providers' });
    const children = service.decompose({ boardId: board.id, objective: 'Improve channels', includeReview: true });
    const snapshot = service.snapshot();

    expect(card.payload.boardId).toBe(board.id);
    expect(children).toHaveLength(4);
    expect(snapshot.summary.boards).toBe(1);
    expect(snapshot.summary.tasks).toBe(5);
  });

  it('doctors and previews xAI native search without serializing credentials', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ output_text: 'search result' }),
    })) as unknown as typeof fetch;
    const service = new ZavorthXaiRuntimeService({
      env: { XAI_API_KEY: 'secret-key', XAI_MODEL: 'grok-test' } as NodeJS.ProcessEnv,
      fetchImpl,
      now,
    });

    expect(service.doctor().configured).toBe(true);
    const preview = await service.search({ query: 'zavorth', live: false });
    const live = await service.search({ query: 'zavorth', live: true });

    expect(preview.status).toBe('preview');
    expect(live.status).toBe('ready');
    expect(JSON.stringify(live)).not.toContain('secret-key');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
