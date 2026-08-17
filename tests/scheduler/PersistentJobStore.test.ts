import * as fs from 'node:fs';
import * as path from 'node:path';
import { PersistentJobStore } from '../../src/scheduler/store.js';
import type { ScheduledJob } from '../../src/scheduler/types.js';

describe('PersistentJobStore', () => {
  const testStorageDir = path.join(process.cwd(), '.zavorth', 'test_scheduler');
  let store: PersistentJobStore;

  beforeEach(() => {
    store = new PersistentJobStore({ storageDir: testStorageDir });
  });

  afterEach(() => {
    store.clearAll();
    if (fs.existsSync(testStorageDir)) {
      try {
        fs.rmdirSync(testStorageDir);
      } catch {
        // ignore
      }
    }
  });

  it('should save, retrieve, list, and delete scheduled jobs atomically', () => {
    const job: ScheduledJob = {
      id: 'job_test_1',
      name: 'Daily Git Backup',
      prompt: 'Execute full git push and clean workspace branches',
      schedule: { kind: 'cron', expr: '0 0 * * *' },
      sessionTarget: 'isolated',
      delivery: [{ channel: 'desktop' }],
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.saveJob(job);
    const retrieved = store.getJob('job_test_1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('Daily Git Backup');

    const allJobs = store.listJobs();
    expect(allJobs.length).toBe(1);

    const deleted = store.deleteJob('job_test_1');
    expect(deleted).toBe(true);
    expect(store.getJob('job_test_1')).toBeUndefined();
  });

  it('should record execution runs and retrieve historical telemetry', () => {
    store.recordRun({
      id: 'run_1',
      jobId: 'job_test_1',
      jobName: 'Daily Git Backup',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 420,
      status: 'success',
      output: 'Git backup complete',
      deliveryStatus: 'delivered',
    });

    const runs = store.listRuns('job_test_1');
    expect(runs.length).toBe(1);
    expect(runs[0].status).toBe('success');
    expect(runs[0].durationMs).toBe(420);

    const latest = store.getLatestRun('job_test_1');
    expect(latest?.id).toBe('run_1');
  });
});
