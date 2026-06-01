import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { TaskPlaneService } from '../../src/services/TaskPlaneService.js';

describe('TaskPlaneService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-tasks-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('creates tasks, claims atomically, and prevents duplicate claims', () => {
    const service = taskService();
    const task = service.createTask({ title: 'Run provider canary', source: 'test' });

    const claimed = service.claimTask(task.id, 'agent-a', 60_000);
    const duplicate = service.claimTask(task.id, 'agent-b', 60_000);

    expect(claimed?.claim?.owner).toBe('agent-a');
    expect(duplicate).toBeNull();
    expect(service.snapshot().summary.claimed).toBe(1);
  });

  it('retries and cancels through explicit audited transitions', () => {
    const service = taskService();
    const task = service.createTask({ title: 'Repair channel', source: 'test' });
    service.updateStatus(task.id, 'failed', 'agent-a', 'boom');
    const retried = service.retryTask(task.id, 'operator');
    const cancelled = service.cancelTask(task.id, 'operator', 'stop');

    expect(retried?.status).toBe('queued');
    expect(cancelled?.status).toBe('cancelled');
    expect(cancelled?.history.map((entry) => entry.event)).toEqual(expect.arrayContaining(['task.retry', 'task.cancelled']));
  });

  it('keeps approval-gated tasks waiting until a governed actor moves them', () => {
    const service = taskService();
    const task = service.createTask({ title: 'Apply diff', approvalId: 'approval-1' });

    expect(task.status).toBe('waiting_approval');
    expect(service.claimTask(task.id, 'agent-a')).toBeNull();
  });

  function taskService() {
    return new TaskPlaneService({
      storePath: path.join(root, 'runtime', 'task-plane.json'),
      now: () => new Date('2026-05-31T12:00:00.000Z'),
    });
  }
});
