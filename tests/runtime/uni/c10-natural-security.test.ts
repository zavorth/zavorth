import { UniversalIntentEvaluationHarness } from '../../../src/runtime/uni/index.js';

describe('C10 natural language and security acceptance', () => {
  it('passes the full C10 evaluation matrix', () => {
    const snapshot = new UniversalIntentEvaluationHarness({
      now: () => new Date('2026-05-03T20:10:00.000Z'),
    }).runAll();

    expect(snapshot).toEqual(expect.objectContaining({
      schemaVersion: 1,
      phase: 'C10',
      status: 'passed',
    }));
    expect(snapshot.summary).toEqual({
      suites: 6,
      evaluations: 15,
      passed: 15,
      failed: 0,
    });
    expect(snapshot.acceptance).toEqual({
      naturalLanguageDoesNotBypassSecurity: true,
      securityNarrativeIsNotOpaque: true,
      everyBlockHasSafeNextStep: true,
    });
    expect(snapshot.blockers).toEqual([]);
  });
});
