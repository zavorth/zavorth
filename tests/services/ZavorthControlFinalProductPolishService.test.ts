import { ZavorthControlFinalProductPolishService } from '../../src/services/ZavorthControlFinalProductPolishService.js';

describe('ZavorthControlFinalProductPolishService Intent model1', () => {
  it('certifies the /control Zavorth Control as simple, traceable and display-only', () => {
    const snapshot = new ZavorthControlFinalProductPolishService({
      now: () => new Date('2026-05-14T15:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-14.checkpoint-11-zavorthControl-final-product-polish');
    expect(snapshot.status).toBe('passed');
    expect(snapshot.summary.zavorthControlPath).toBe('/control');
    expect(snapshot.summary.chatFirstHome).toBe(true);
    expect(snapshot.summary.nextActionsReady).toBe(true);
    expect(snapshot.summary.readinessSummaryReady).toBe(true);
    expect(snapshot.summary.approvalsInboxReady).toBe(true);
    expect(snapshot.summary.receiptsViewerReady).toBe(true);
    expect(snapshot.summary.missionTimelineReady).toBe(true);
    expect(snapshot.summary.advancedModeCollapsed).toBe(true);
    expect(snapshot.summary.mobileResponsive).toBe(true);
    expect(snapshot.summary.noControlSurfaceByDefault).toBe(true);
    expect(snapshot.summary.zavorthControlCanExecute).toBe(false);
    expect(snapshot.summary.rawSecretsSerialized).toBe(false);
    expect(snapshot.safety.zavorthControlIsDisplayOnly).toBe(true);
    expect(snapshot.safety.mutableExecutionStaysInRuntime).toBe(true);
    expect(snapshot.safety.approvalsRemainPolicyBrokerBound).toBe(true);
    expect(snapshot.entries.map((entry) => entry.label)).toEqual(expect.arrayContaining([
      'Chat-first Zavorth Control home',
      'Simple next actions',
      'Approvals inbox',
      'Receipts viewer',
      'Mission timeline',
      'Advanced details stay optional',
      'Mobile responsive layout',
    ]));
  });
});
