import { UniversalIntentEvaluationHarness } from '../../../src/runtime/uni/index.js';

describe('C10 clarification policy', () => {
  const harness = new UniversalIntentEvaluationHarness({
    now: () => new Date('2026-05-03T20:10:00.000Z'),
  });

  it('asks before assuming ambiguous or sensitive targets', () => {
    const snapshot = harness.runSuite('clarification-policy');

    expect(snapshot.status).toBe('passed');
    expect(snapshot.summary).toEqual({ total: 2, passed: 2, failed: 0 });
    for (const evaluation of snapshot.evaluations) {
      expect(evaluation.decision).toEqual(expect.objectContaining({
        intent: 'clarification',
        requiresClarification: true,
        nextSafeAction: 'ask_clarification',
      }));
      expect(evaluation.decision?.permissionRequest).toBeNull();
    }
  });
});
