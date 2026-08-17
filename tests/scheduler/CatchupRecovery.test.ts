import { CatchupRecovery } from '../../src/scheduler/catchup.js';
import type { ScheduledJob } from '../../src/scheduler/types.js';

describe('CatchupRecovery', () => {
  it('should detect overdue jobs when nextRunAt is in the past', () => {
    const job: ScheduledJob = {
      id: 'job_overdue_1',
      name: 'Security Audit',
      prompt: 'Run automated audit',
      schedule: { kind: 'every', expr: '1h' },
      sessionTarget: 'isolated',
      delivery: [{ channel: 'cli' }],
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nextRunAt: new Date(Date.now() - 3600_000).toISOString(), // 1 hour in the past
    };

    const evalResult = CatchupRecovery.evaluate(job);
    expect(evalResult.shouldCatchup).toBe(true);
    expect(evalResult.missedRunsCount).toBe(1);
  });

  it('should not trigger catchup for future scheduled jobs', () => {
    const job: ScheduledJob = {
      id: 'job_future_1',
      name: 'Future Task',
      prompt: 'Run tomorrow',
      schedule: { kind: 'every', expr: '24h' },
      sessionTarget: 'isolated',
      delivery: [{ channel: 'cli' }],
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nextRunAt: new Date(Date.now() + 3600_000).toISOString(), // 1 hour in future
    };

    const evalResult = CatchupRecovery.evaluate(job);
    expect(evalResult.shouldCatchup).toBe(false);
  });

  it('should not trigger catchup for disabled jobs', () => {
    const job: ScheduledJob = {
      id: 'job_disabled_1',
      name: 'Disabled Task',
      prompt: 'Never run',
      schedule: { kind: 'every', expr: '1h' },
      sessionTarget: 'isolated',
      delivery: [{ channel: 'cli' }],
      enabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nextRunAt: new Date(Date.now() - 3600_000).toISOString(),
    };

    const evalResult = CatchupRecovery.evaluate(job);
    expect(evalResult.shouldCatchup).toBe(false);
  });
});
