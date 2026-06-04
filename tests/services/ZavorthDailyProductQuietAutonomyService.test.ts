import { ZavorthDailyProductQuietAutonomyService } from '../../src/services/ZavorthDailyProductQuietAutonomyService.js';

describe('ZavorthDailyProductQuietAutonomyService', () => {
  const now = () => new Date('2026-06-02T12:00:00.000Z');

  it('makes chat the daily product center and keeps technical surfaces collapsed', () => {
    const snapshot = new ZavorthDailyProductQuietAutonomyService({ now }).buildSnapshot({
      profileId: 'personal',
    });

    expect(snapshot.surface).toBe('daily-product-quiet-autonomy');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.dailyProduct.primarySurface).toBe('chat');
    expect(snapshot.dailyProduct.visibleTabs.map((tab) => tab.id)).toEqual([
      'chat',
      'work',
      'channels',
      'approvals',
      'history',
      'tools',
      'memory',
      'models',
      'settings',
    ]);
    expect(snapshot.dailyProduct.collapsedTechnicalSurfaces).toEqual(expect.arrayContaining([
      'raw event stream',
      'provider manifests',
      'debug receipts',
    ]));
  });

  it('lets personal profile run reversible low-risk improvement quietly but never external sends or secrets', () => {
    const snapshot = new ZavorthDailyProductQuietAutonomyService({ now }).buildSnapshot({
      profileId: 'personal',
    });
    const active = snapshot.quietAutonomy.activePolicy;

    expect(active.profileId).toBe('personal');
    expect(active.mode).toBe('quiet-curation');
    expect(active.silentLanes.map((lane) => lane.lane)).toEqual(expect.arrayContaining([
      'telemetry',
      'ranking',
      'metadata',
      'candidate',
      'draft_skill',
      'staging_diff',
      'sandbox_validation',
      'low_risk_archive',
    ]));
    expect(active.approvalLanes.map((lane) => lane.lane)).toEqual(expect.arrayContaining([
      'apply',
      'policy',
      'provider',
      'channel',
      'secret',
      'external_send',
      'host_mutation',
    ]));
    expect(active.silentLanes.every((lane) => lane.reversible && lane.receipt)).toBe(true);
    expect(snapshot.quietAutonomy.backgroundReceipts).toEqual(expect.objectContaining({
      enabled: true,
      rollbackRequired: true,
      rawSecretsSerialized: false,
    }));
    expect(snapshot.quietAutonomy.llmGuidance).toContain('do not interrupt');
  });

  it('keeps developer profile quieter than strict approval spam but apply remains approval-bound', () => {
    const snapshot = new ZavorthDailyProductQuietAutonomyService({ now }).buildSnapshot({
      profileId: 'developer',
    });
    const active = snapshot.quietAutonomy.activePolicy;

    expect(active.profileId).toBe('developer');
    expect(active.mode).toBe('quiet-staging');
    expect(active.silentLanes.map((lane) => lane.lane)).toEqual(expect.arrayContaining([
      'telemetry',
      'ranking',
      'metadata',
      'candidate',
      'staging_diff',
      'sandbox_validation',
    ]));
    expect(active.digestLanes.map((lane) => lane.lane)).toContain('low_risk_archive');
    expect(active.approvalLanes.map((lane) => lane.lane)).toContain('apply');
    expect(active.approvalLanes.map((lane) => lane.lane)).toContain('host_mutation');
  });

  it('renders a concise operator report', () => {
    const service = new ZavorthDailyProductQuietAutonomyService({ now });
    const report = service.renderText(service.buildSnapshot({ profileId: 'personal' }));

    expect(report).toContain('Zavorth Daily Product + Quiet Autonomy');
    expect(report).toContain('activeProfile=personal');
    expect(report).toContain('QA: npm run qa:zavorth-daily-product-quiet-autonomy --silent');
  });
});
