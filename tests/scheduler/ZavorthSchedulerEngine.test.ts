import * as path from 'node:path';
import { ZavorthSchedulerEngine } from '../../src/scheduler/engine.js';
import { PersistentJobStore } from '../../src/scheduler/store.js';
import type { ScheduledJob } from '../../src/scheduler/types.js';

describe('ZavorthSchedulerEngine', () => {
  const testStorageDir = path.join(process.cwd(), '.zavorth', 'test_scheduler_engine');
  let store: PersistentJobStore;
  let engine: ZavorthSchedulerEngine;

  beforeEach(() => {
    store = new PersistentJobStore({ storageDir: testStorageDir });
    engine = new ZavorthSchedulerEngine({
      store,
      tickIntervalMs: 50,
      enableCatchupOnStart: false,
      enableStagger: false,
    });
  });

  afterEach(() => {
    engine.stop();
    store.clearAll();
  });

  it('should calculate next run dates and parse intervals', () => {
    const next1h = engine.calculateNextRun({ kind: 'every', expr: '1h' }, 'job_1', new Date('2026-08-17T10:00:00.000Z'));
    expect(next1h).toBe('2026-08-17T11:00:00.000Z');

    const next30m = engine.calculateNextRun({ kind: 'every', expr: '30m' }, 'job_2', new Date('2026-08-17T10:00:00.000Z'));
    expect(next30m).toBe('2026-08-17T10:30:00.000Z');
  });

  it('should dispatch job and record run in isolated lane', async () => {
    const job: ScheduledJob = {
      id: 'job_dispatch_1',
      name: 'System Health Check',
      prompt: 'Check CPU and Disk telemetry',
      schedule: { kind: 'every', expr: '10m' },
      sessionTarget: 'isolated',
      delivery: [{ channel: 'cli' }],
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.saveJob(job);
    const run = await engine.dispatchJob(job);

    expect(run.status).toBe('success');
    expect(run.jobId).toBe('job_dispatch_1');
    expect(run.deliveryStatus).toBe('delivered');

    const metrics = engine.getMetrics();
    expect(metrics.totalRuns).toBe(1);
    expect(metrics.successfulRuns).toBe(1);
  });
});
