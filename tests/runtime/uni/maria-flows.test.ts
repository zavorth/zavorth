import { UniversalIntentEvaluationHarness } from '../../../src/runtime/uni/index.js';

describe('C10 Maria/common user flows', () => {
  const harness = new UniversalIntentEvaluationHarness({
    now: () => new Date('2026-05-03T20:10:00.000Z'),
  });

  it('covers ordinary document, receipt and file summary requests without bypassing security', () => {
    const snapshot = harness.runSuite('maria');

    expect(snapshot.status).toBe('passed');
    expect(snapshot.summary).toEqual({ total: 3, passed: 3, failed: 0 });
    expect(snapshot.evaluations.map((entry) => entry.id)).toEqual([
      'maria-organize-documents',
      'maria-search-invoices-receipts',
      'maria-summarize-file-scoped',
    ]);
    expect(snapshot.evaluations.find((entry) => entry.id === 'maria-organize-documents')?.decision)
      .toEqual(expect.objectContaining({
        nextSafeAction: 'preview_then_request_permission',
        requiresPermission: true,
      }));
    expect(snapshot.evaluations.find((entry) => entry.id === 'maria-summarize-file-scoped')?.decision)
      .toEqual(expect.objectContaining({
        nextSafeAction: 'execute_governed',
        requiresPermission: false,
      }));
  });
});
