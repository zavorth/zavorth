import { JobStagger } from '../../src/scheduler/stagger.js';

describe('JobStagger', () => {
  it('should calculate deterministic offset for a job ID', () => {
    const offset1 = JobStagger.calculateOffsetMs('job_abc_123', 30_000);
    const offset2 = JobStagger.calculateOffsetMs('job_abc_123', 30_000);

    expect(offset1).toBe(offset2);
    expect(offset1).toBeGreaterThanOrEqual(0);
    expect(offset1).toBeLessThan(30_000);
  });

  it('should produce different offsets for different jobs to avoid burst load', () => {
    const offsetA = JobStagger.calculateOffsetMs('job_alpha', 30_000);
    const offsetB = JobStagger.calculateOffsetMs('job_beta', 30_000);

    expect(offsetA).not.toBe(offsetB);
  });

  it('should apply stagger offset to target execution date', () => {
    const base = new Date('2026-08-17T09:00:00.000Z');
    const staggered = JobStagger.applyStagger(base, 'job_xyz', 20_000);

    expect(staggered.getTime()).toBeGreaterThanOrEqual(base.getTime());
    expect(staggered.getTime() - base.getTime()).toBeLessThan(20_000);
  });
});
