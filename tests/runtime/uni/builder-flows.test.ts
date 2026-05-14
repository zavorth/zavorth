import { UniversalIntentEvaluationHarness } from '../../../src/runtime/uni/index.js';

describe('C10 builder flows', () => {
  const harness = new UniversalIntentEvaluationHarness({
    now: () => new Date('2026-05-03T20:10:00.000Z'),
  });

  it('keeps code edits and test execution behind preview, permission and audit posture', () => {
    const snapshot = harness.runSuite('builder');

    expect(snapshot.status).toBe('passed');
    expect(snapshot.summary).toEqual({ total: 2, passed: 2, failed: 0 });
    expect(snapshot.evaluations.find((entry) => entry.id === 'builder-edit-code-diff')?.decision)
      .toEqual(expect.objectContaining({
        intent: 'workspace_mutation',
        nextSafeAction: 'preview_then_request_permission',
      }));
    expect(snapshot.evaluations.find((entry) => entry.id === 'builder-run-tests-sandbox')?.decision)
      .toEqual(expect.objectContaining({
        intent: 'command_execution',
        nextSafeAction: 'preview_then_request_permission',
      }));
  });
});
