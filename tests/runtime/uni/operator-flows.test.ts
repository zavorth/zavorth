import { UniversalIntentEvaluationHarness } from '../../../src/runtime/uni/index.js';

describe('C10 operator flows', () => {
  const harness = new UniversalIntentEvaluationHarness({
    now: () => new Date('2026-05-03T20:10:00.000Z'),
  });

  it('blocks host/computer-use scope, keeps selfmod preview-first and quarantines external MCP', () => {
    const snapshot = harness.runSuite('operator');

    expect(snapshot.status).toBe('passed');
    expect(snapshot.summary).toEqual({ total: 4, passed: 4, failed: 0 });
    expect(snapshot.evaluations.find((entry) => entry.id === 'operator-host-access-block')?.decision?.nextSafeAction)
      .toBe('block');
    expect(snapshot.evaluations.find((entry) => entry.id === 'operator-computer-use-insufficient-permission')?.decision?.nextSafeAction)
      .toBe('block');
    expect(snapshot.evaluations.find((entry) => entry.id === 'operator-selfmod-preview-first')?.decision)
      .toEqual(expect.objectContaining({
        nextSafeAction: 'preview_then_request_permission',
        requiresPermission: true,
      }));
    expect(snapshot.evaluations.find((entry) => entry.id === 'operator-external-mcp-quarantine')?.decision)
      .toEqual(expect.objectContaining({
        nextSafeAction: 'preview_then_request_permission',
        requiresPermission: true,
      }));
  });
});
