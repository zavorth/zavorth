import { ZavorthControlPlaneCatalogService } from '../../src/domain/observability/infrastructure/control-plane/ZavorthControlPlaneCatalogService.js';

describe('ZavorthControlPlaneCatalogService', () => {
  it('aggregates operational, trust and product overviews into one platform catalog', async () => {
    const service = new ZavorthControlPlaneCatalogService({
      now: () => new Date('2026-04-17T12:00:00.000Z'),
      workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      operationalOverviewService: {
        buildSnapshot: jest.fn(async () => buildOverview({
          generatedAt: '2026-04-17T11:00:00.000Z',
          posture: 'healthy',
          actionId: 'runtime-check',
          actionLabel: 'Revisar runtime',
          sourceKey: 'runtimeStability',
        })),
      },
      trustOverviewService: {
        buildSnapshot: jest.fn(() => buildOverview({
          generatedAt: '2026-04-17T11:01:00.000Z',
          posture: 'attention',
          actionId: 'trust-review',
          actionLabel: 'Revisar trust boundary',
          sourceKey: 'trust',
        })),
      },
      productOverviewService: {
        buildSnapshot: jest.fn(async () => buildOverview({
          generatedAt: '2026-04-17T11:02:00.000Z',
          posture: 'critical',
          actionId: 'rollout-gate',
          actionLabel: 'Close rollout',
          sourceKey: 'rollout',
        })),
      },
    });

    const snapshot = await service.buildSnapshot({
      sessionId: 'session-1',
      userId: 'user-1',
      platform: 'web',
      chatId: 'chat-1',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      profile: 'prod',
      rolloutScope: 'production',
    });

    expect(snapshot.generatedAt).toBe('2026-04-17T12:00:00.000Z');
    expect(snapshot.summary.posture).toBe('critical');
    expect(snapshot.summary.families).toBe(3);
    expect(snapshot.summary.healthyFamilies).toBe(1);
    expect(snapshot.summary.attentionFamilies).toBe(1);
    expect(snapshot.summary.criticalFamilies).toBe(1);
    expect(snapshot.summary.recommendedActions).toBe(3);
    expect(snapshot.families.map((entry) => entry.overviewId)).toEqual(['operational', 'trust', 'product']);
    expect(snapshot.cards).toBe(snapshot.families);
    expect(snapshot.actions.map((entry) => entry.source)).toEqual([
      'product-overview',
      'trust-overview',
      'operational-overview',
    ]);
    await expect(service.renderReport()).resolves.toContain('Control Plane Catalog');
  });
});

function buildOverview(input: {
  generatedAt: string;
  posture: 'healthy' | 'attention' | 'critical';
  actionId: string;
  actionLabel: string;
  sourceKey: string;
}): any {
  return {
    generatedAt: input.generatedAt,
    workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    summary: {
      posture: input.posture,
      healthyPlanes: input.posture === 'healthy' ? 1 : 0,
      attentionPlanes: input.posture === 'attention' ? 1 : 0,
      criticalPlanes: input.posture === 'critical' ? 1 : 0,
      recommendedActions: 1,
    },
    cards: [
      {
        id: `${input.sourceKey}-plane`,
        label: `${input.sourceKey} plane`,
        posture: input.posture,
        summary: 'Plane de teste.',
        nextAction: input.actionLabel,
        command: null,
        source: input.sourceKey,
      },
    ],
    actions: [
      {
        id: input.actionId,
        label: input.actionLabel,
        severity: input.posture === 'critical' ? 'critical' : input.posture === 'attention' ? 'warn' : 'info',
        reason: 'Overview test action.',
        command: null,
      },
    ],
    sourceSnapshots: {
      [input.sourceKey]: {
        ready: true,
      },
    },
    narrative: {
      headline: `${input.sourceKey} overview`,
      operatorSummary: `${input.sourceKey} em postura ${input.posture}.`,
      nextAction: input.actionLabel,
    },
  };
}
