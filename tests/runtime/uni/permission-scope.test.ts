import { UniversalIntentEvaluationHarness } from '../../../src/runtime/uni/index.js';

describe('C10 permission scope lifecycle', () => {
  const harness = new UniversalIntentEvaluationHarness({
    now: () => new Date('2026-05-03T20:10:00.000Z'),
  });

  it('proves temporary permissions are consumed and session permissions do not leak', () => {
    const snapshot = harness.runSuite('permission-scope');

    expect(snapshot.status).toBe('passed');
    expect(snapshot.summary).toEqual({ total: 2, passed: 2, failed: 0 });
    expect(snapshot.evaluations.find((entry) => entry.id === 'permission-once-consumed')?.expectationIds)
      .toContain('permission-once-consumed');
    expect(snapshot.evaluations.find((entry) => entry.id === 'permission-session-boundary')?.expectationIds)
      .toContain('permission-session-boundary');
  });
});
