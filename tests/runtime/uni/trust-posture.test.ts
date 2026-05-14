import { UniversalIntentEvaluationHarness } from '../../../src/runtime/uni/index.js';

describe('C10 trust posture', () => {
  const harness = new UniversalIntentEvaluationHarness({
    now: () => new Date('2026-05-03T20:10:00.000Z'),
  });

  it('keeps protected and overlord decisions centrally enforced and auditable', () => {
    const snapshot = harness.runSuite('trust-posture');

    expect(snapshot.status).toBe('passed');
    expect(snapshot.summary).toEqual({ total: 2, passed: 2, failed: 0 });
    for (const evaluation of snapshot.evaluations) {
      expect(evaluation.decision?.trustSlider.enforcement).toEqual(expect.objectContaining({
        source: 'TrustSliderPolicyService',
        centralEnforcement: true,
      }));
    }
    expect(snapshot.evaluations.find((entry) => entry.id === 'trust-overlord-requires-kill-switch')?.decision?.trustSlider)
      .toEqual(expect.objectContaining({
        killSwitchRequired: true,
        auditTrailRequired: true,
      }));
  });
});
