import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZavorthFriendlyWorkCommandService } from '../../src/services/ZavorthFriendlyWorkCommandService.js';

describe('ZavorthFriendlyWorkCommandService', () => {
  let root: string;
  let home: string;
  let nowMs: number;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-friendly-work-'));
    home = path.join(root, 'home');
    nowMs = Date.parse('2026-05-31T12:00:00.000Z');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('creates a simple todo and marks it done with friendly commands', () => {
    const service = friendly();

    const created = service.run('todo', ['Review providers']);
    const done = service.run('done', [created.task?.id || 'missing']);
    const work = service.run('work', []);

    expect(created.ok).toBe(true);
    expect(created.task?.title).toBe('Review providers');
    expect(done.ok).toBe(true);
    expect(done.task?.status).toBe('done');
    expect(work.tasks.summary.done).toBe(1);
    expect(work.lines.join('\n')).toContain('Review providers');
  });

  it('schedules later work and materializes due items into the Task Plane', () => {
    const service = friendly();
    const dueAt = new Date(nowMs - 1000).toISOString();

    const scheduled = service.run('later', ['Nightly review', '--at', dueAt]);
    const work = service.run('work', []);

    expect(scheduled.ok).toBe(true);
    expect(scheduled.scheduled[0]?.status).toBe('scheduled');
    expect(work.materialized).toEqual([
      expect.objectContaining({
        cronId: scheduled.scheduled[0]?.id,
        created: true,
      }),
    ]);
    expect(work.tasks.items[0]).toEqual(expect.objectContaining({
      title: 'Nightly review',
      source: `later:${scheduled.scheduled[0]?.id}`,
      status: 'queued',
    }));
    expect(work.scheduled[0]?.status).toBe('completed');
  });

  it('cancels scheduled later items when no Task Plane item matches the id', () => {
    const service = friendly();
    const scheduled = service.run('later', ['Send summary tomorrow 9h']);
    const cancelled = service.run('cancel', [scheduled.scheduled[0]?.id || 'missing']);

    expect(cancelled.ok).toBe(true);
    expect(cancelled.scheduled[0]?.status).toBe('cancelled');
  });

  it('retries failed tasks through the friendly retry command', () => {
    const service = friendly();
    const created = service.run('todo', ['Repair channel']);
    const taskId = created.task?.id || 'missing';
    service.run('cancel', [taskId]);
    const retried = service.run('retry', [taskId]);

    expect(retried.ok).toBe(true);
    expect(retried.task?.status).toBe('queued');
  });

  it('parses natural tomorrow timing for later commands', () => {
    const service = friendly();
    const result = service.run('later', ['Review workspace tomorrow 9am']);
    const dueAt = new Date(result.scheduled[0]?.nextRunAt || 0);

    expect(dueAt.getDate()).toBe(new Date(nowMs + 24 * 60 * 60 * 1000).getDate());
    expect(dueAt.getHours()).toBe(9);
    expect(dueAt.getMinutes()).toBe(0);
  });

  function friendly() {
    return new ZavorthFriendlyWorkCommandService({
      projectRoot: root,
      explicitHome: home,
      env: {},
      now: () => new Date(nowMs),
    });
  }
});
