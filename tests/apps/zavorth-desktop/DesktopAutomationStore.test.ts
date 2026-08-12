import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const {
  createDesktopAutomationStore,
} = require('../../../apps/zavorth-desktop/electron/desktop-automations.cjs');

describe('desktop automation durable store', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'zvd-automation-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('persists tasks outside renderer localStorage and reloads them after process restart', () => {
    const filePath = join(dir, 'desktop-automations.json');
    const now = Date.parse('2026-06-29T12:00:00.000Z');
    const store = createDesktopAutomationStore({
      filePath,
      now: () => now,
      idFactory: () => 'task_fixed',
    });

    const created = store.createTask({
      name: 'Daily project review',
      project: 'Local',
      prompt: 'Summarize what changed today.',
      intervalMinutes: 60,
      workspace: { id: 'local', label: 'Local', path: 'C:/repo' },
      model: 'openai:gpt-5',
      profile: 'developer',
      effort: 'high',
    });

    expect(created).toMatchObject({
      id: 'task_fixed',
      enabled: true,
      status: 'idle',
      nextRun: now + 60 * 60000,
      history: [],
    });

    const persisted = JSON.parse(readFileSync(filePath, 'utf8'));
    expect(persisted.tasks).toHaveLength(1);
    expect(persisted.tasks[0].id).toBe('task_fixed');

    const reloaded = createDesktopAutomationStore({ filePath, now: () => now });
    expect(reloaded.listTasks()).toEqual([created]);
  });

  it('finds due tasks, records running state, completion receipts, and next durable run', () => {
    const filePath = join(dir, 'desktop-automations.json');
    let clock = Date.parse('2026-06-29T12:00:00.000Z');
    const store = createDesktopAutomationStore({
      filePath,
      now: () => clock,
      idFactory: () => 'task_due',
    });

    store.createTask({
      name: 'Hourly check',
      project: 'Local',
      prompt: 'Check the workspace.',
      intervalMinutes: 15,
    });

    expect(store.getDueTasks()).toEqual([]);

    clock += 15 * 60000;
    expect(store.getDueTasks().map((task: any) => task.id)).toEqual(['task_due']);

    store.markRunning('task_due', 'cron_task_due_1');
    expect(store.listTasks()[0]).toMatchObject({
      status: 'running',
      lastSessionId: 'cron_task_due_1',
      lastRun: clock,
    });

    clock += 30_000;
    store.markCompleted('task_due', {
      ok: true,
      sessionId: 'cron_task_due_1',
      message: 'Done',
    });

    const updated = store.listTasks()[0];
    expect(updated).toMatchObject({
      status: 'success',
      lastSessionId: 'cron_task_due_1',
      nextRun: clock + 15 * 60000,
    });
    expect(updated.history).toEqual([
      expect.objectContaining({
        ok: true,
        sessionId: 'cron_task_due_1',
        message: 'Done',
      }),
    ]);
  });

  it('does not return disabled or already running tasks as due', () => {
    const filePath = join(dir, 'desktop-automations.json');
    const now = Date.parse('2026-06-29T12:00:00.000Z');
    const store = createDesktopAutomationStore({
      filePath,
      now: () => now,
      idFactory: () => 'task_toggle',
    });

    store.createTask({
      name: 'Check',
      project: 'Local',
      prompt: 'Run check.',
      intervalMinutes: 1,
    });

    store.toggleTask('task_toggle', false);
    expect(store.getDueTasks()).toEqual([]);

    store.toggleTask('task_toggle', true);
    store.markRunning('task_toggle', 'cron_task_toggle_1');
    expect(store.getDueTasks()).toEqual([]);
  });
});
