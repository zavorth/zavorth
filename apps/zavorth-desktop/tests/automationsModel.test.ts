import { describe, expect, it } from 'vitest';
import {
  buildRuntimeAutomationJobs,
  filterAutomationJobs,
  mapScheduledTasks,
  mergeAutomationJobs,
  selectAutomationJob,
} from '../src/views/panels/automationsModel';

describe('automationsModel', () => {
  it('maps scheduled tasks', () => {
    const jobs = mapScheduledTasks([
      { id: '1', name: 'Morning brief', prompt: 'Summarize inbox', intervalMinutes: 60, enabled: true },
      { id: '2', name: 'Paused', enabled: false, intervalMinutes: 30 },
    ]);
    expect(jobs).toHaveLength(2);
    expect(jobs[0].kind).toBe('schedule');
    expect(jobs[0].tone).toBe('ready');
    expect(jobs[1].status).toBe('paused');
  });

  it('builds runtime jobs with attention tone', () => {
    const jobs = buildRuntimeAutomationJobs({
      jobsStatus: 'attention',
      jobsSummary: '1 orphaned job',
      streamResumable: true,
      resumeToken: 'tok-abc-123456',
      streamStatus: 'paused',
    });
    expect(jobs[0].tone).toBe('warning');
    expect(jobs[1].tone).toBe('ready');
    expect(jobs[1].description).toMatch(/Resume token/);
  });

  it('merges and filters jobs', () => {
    const scheduled = mapScheduledTasks([{ id: 's', name: 'Daily' }]);
    const runtime = buildRuntimeAutomationJobs({});
    const all = mergeAutomationJobs(scheduled, runtime);
    expect(all.length).toBeGreaterThan(2);
    expect(filterAutomationJobs(all, 'daily')).toHaveLength(1);
    expect(filterAutomationJobs(all, 'stream')).toHaveLength(1);
  });

  it('selects job by id or falls back to first', () => {
    const jobs = mapScheduledTasks([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);
    expect(selectAutomationJob(jobs, 'b')?.id).toBe('b');
    expect(selectAutomationJob(jobs, 'missing')?.id).toBe('a');
    expect(selectAutomationJob([], null)).toBeNull();
  });
});
