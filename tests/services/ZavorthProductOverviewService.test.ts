import { ZavorthProductOverviewService } from '../../src/services/ZavorthProductOverviewService.js';

describe('ZavorthProductOverviewService', () => {
  it('aggregates hub, ecosystem, evals and rollout into a product overview', async () => {
    const service = new ZavorthProductOverviewService({
      now: () => new Date('2026-04-16T20:00:00.000Z'),
      workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      hubControlPlaneService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            posture: 'healthy',
            integrations: 12,
            platformEntries: 24,
            recommendedActions: 1,
          },
          actions: [
            {
              id: 'hub-sync',
              label: 'Sincronizar hub',
              severity: 'info',
              rationale: 'O catalogo pode ser refrescado para consolidar novas entradas.',
              command: 'npm run ops:hub',
            },
          ],
          narrative: {
            nextAction: 'Revisar integrations e MCP.',
          },
        })),
      },
      ecosystemControlPlaneService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            posture: 'attention',
            registryEntries: 24,
            sdkFilesReady: 6,
            sdkFilesExpected: 8,
            publishArtifacts: 2,
          },
          actions: [
            {
              id: 'ecosystem-sdk',
              label: 'Close SDKs oficiais',
              severity: 'warn',
              reason: 'Ainda faltam files-chave do SDK.',
              command: 'npm run release:skills',
            },
          ],
          narrative: {
            nextAction: 'Close SDKs e recipes pendentes.',
          },
        })),
      },
      evalControlPlaneService: {
        buildSnapshot: jest.fn(async () => ({
          summary: {
            posture: 'critical',
            scorecards: 4,
            regressions: 1,
            operatorCostState: 'high',
          },
          regressions: [
            {
              id: 'reg-1',
              label: 'Web executor regression',
              severity: 'critical',
              recommendedAction: 'Fix regression before the next rollout.',
            },
          ],
        })),
      },
      rolloutReadinessControlPlaneService: {
        buildSnapshot: jest.fn(async () => ({
          summary: {
            posture: 'attention',
            releaseReady: false,
            gateStatus: 'warning',
            publishEntries: 3,
          },
          actions: [
            {
              id: 'rollout-gate',
              label: 'Close gate de rollout',
              severity: 'warn',
              reason: 'QA e maintenance ainda needsm de renovaction.',
              command: 'npm run qa:phases:7-10',
            },
          ],
          narrative: {
            nextAction: 'Renovar QA e keepalive antes de promover.',
          },
        })),
      },
    });

    const snapshot = await service.buildSnapshot({
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      profile: 'prod',
      rolloutScope: 'production',
    });

    expect(snapshot.generatedAt).toBe('2026-04-16T20:00:00.000Z');
    expect(snapshot.summary.posture).toBe('critical');
    expect(snapshot.summary.integrations).toBe(12);
    expect(snapshot.summary.platformEntries).toBe(24);
    expect(snapshot.summary.sdkFilesReady).toBe(6);
    expect(snapshot.summary.scorecards).toBe(4);
    expect(snapshot.summary.regressions).toBe(1);
    expect(snapshot.summary.releaseReady).toBe(false);
    expect(snapshot.actions.map((entry) => entry.source)).toEqual(expect.arrayContaining([
      'evals',
      'ecosystem',
      'rollout',
      'hub',
    ]));
    await expect(service.renderReport()).resolves.toContain('Product Overview');
  });
});
