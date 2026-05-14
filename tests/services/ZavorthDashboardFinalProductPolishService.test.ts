import { ZavorthDashboardFinalProductPolishService } from '../../src/services/ZavorthDashboardFinalProductPolishService.js';

describe('ZavorthDashboardFinalProductPolishService Phase 11', () => {
  it('certifies the /dashboard daily-use surface as simple, traceable and display-only', () => {
    const snapshot = new ZavorthDashboardFinalProductPolishService({
      now: () => new Date('2026-05-14T15:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-14.phase-11-dashboard-final-product-polish');
    expect(snapshot.status).toBe('passed');
    expect(snapshot.summary.dashboardPath).toBe('/dashboard');
    expect(snapshot.summary.chatFirstHome).toBe(true);
    expect(snapshot.summary.nextActionsReady).toBe(true);
    expect(snapshot.summary.readinessSummaryReady).toBe(true);
    expect(snapshot.summary.approvalsInboxReady).toBe(true);
    expect(snapshot.summary.receiptsViewerReady).toBe(true);
    expect(snapshot.summary.missionTimelineReady).toBe(true);
    expect(snapshot.summary.advancedModeCollapsed).toBe(true);
    expect(snapshot.summary.mobileResponsive).toBe(true);
    expect(snapshot.summary.noControlSurfaceByDefault).toBe(true);
    expect(snapshot.summary.dashboardCanExecute).toBe(false);
    expect(snapshot.summary.rawSecretsSerialized).toBe(false);
    expect(snapshot.safety.commandCenterIsDisplayOnly).toBe(true);
    expect(snapshot.safety.mutableExecutionStaysInRuntime).toBe(true);
    expect(snapshot.safety.approvalsRemainPolicyBrokerBound).toBe(true);
    expect(snapshot.entries.map((entry) => entry.label)).toEqual(expect.arrayContaining([
      'Chat-first dashboard home',
      'Simple next actions',
      'Approvals inbox',
      'Receipts viewer',
      'Mission timeline',
      'Advanced details stay optional',
      'Mobile responsive layout',
    ]));
  });
});
