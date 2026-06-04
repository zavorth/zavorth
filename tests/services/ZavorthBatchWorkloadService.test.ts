import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZavorthBatchWorkloadService } from '../../src/services/ZavorthBatchWorkloadService.js';

describe('ZavorthBatchWorkloadService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-batch-workload-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('previews governed batch work without executing items', async () => {
    const worker = jest.fn();
    const service = new ZavorthBatchWorkloadService({ projectRoot: root, worker });

    const snapshot = await service.buildSnapshot({
      objective: 'Audit docs; summarize receipts',
      items: ['Audit docs', 'Summarize receipts'],
    });

    expect(snapshot.status).toBe('preview');
    expect(snapshot.plan.willExecute).toBe(false);
    expect(snapshot.summary.items).toBe(2);
    expect(snapshot.items.every((item) => item.status === 'queued')).toBe(true);
    expect(worker).not.toHaveBeenCalled();
  });

  it('requires approval before live batch execution', async () => {
    const worker = jest.fn();
    const service = new ZavorthBatchWorkloadService({ projectRoot: root, worker });

    const snapshot = await service.buildSnapshot({
      items: ['Run one'],
      live: true,
    });

    expect(snapshot.status).toBe('approval-required');
    expect(snapshot.plan.approvalRequired).toBe(true);
    expect(worker).not.toHaveBeenCalled();
  });

  it('runs approved in-process batch items and writes redacted output', async () => {
    const service = new ZavorthBatchWorkloadService({
      projectRoot: root,
      now: () => new Date('2026-06-02T12:00:00.000Z'),
      worker: (prompt) => `done ${prompt} token=secret-value`,
    });

    const snapshot = await service.buildSnapshot({
      items: ['Run one'],
      live: true,
      approvalId: 'approval-1',
      outputPath: path.join('.zavorth', 'batches', 'run.json'),
    });

    expect(snapshot.status).toBe('completed');
    expect(snapshot.summary.completed).toBe(1);
    expect(snapshot.items[0]?.output).not.toContain('secret-value');
    const written = fs.readFileSync(path.join(root, '.zavorth', 'batches', 'run.json'), 'utf8');
    expect(written).not.toContain('secret-value');
  });

  it('blocks output paths outside the project root', async () => {
    const service = new ZavorthBatchWorkloadService({ projectRoot: root });

    await expect(service.buildSnapshot({
      items: ['Run one'],
      live: true,
      approvalId: 'approval-1',
      outputPath: '..\\outside.json',
    })).rejects.toThrow(/project root/i);
  });
});
