import { ZavorthOperationalOverviewService } from '../../src/services/ZavorthOperationalOverviewService.js';

describe('ZavorthOperationalOverviewService', () => {
  it('aggregates distributed runtime, stability and replay into one overview', async () => {
    const service = new ZavorthOperationalOverviewService({
      now: () => new Date('2026-04-16T18:00:00.000Z'),
      workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      distributedRuntimeControlPlaneService: {
        buildSnapshot: jest.fn(async () => ({
          summary: {
            posture: 'attention',
            readyChannels: 3,
            onlineNodes: 2,
            readyTransports: 1,
          },
          actions: [
            {
              id: 'distributed-sync',
              label: 'Sincronizar runtime distribuido',
              severity: 'warn',
              reason: 'Ainda existem channels e transports parcialmente readys.',
              command: 'npm run ops:distributed',
            },
          ],
          narrative: {
            nextAction: 'Revisar channels, nodes e transports.',
          },
        })),
      },
      runtimeStabilityControlPlaneService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            posture: 'critical',
            keepaliveActive: false,
            recoverableIssues: 2,
            onlineNodes: 2,
            readyTransports: 1,
          },
          gate: {
            status: 'failed',
          },
          actions: [
            {
              id: 'stability-keepalive',
              label: 'Restaurar keepalive',
              severity: 'critical',
              reason: 'Keepalive expirou e o gate falhou.',
              command: 'npm run nodes:doctor',
            },
          ],
          narrative: {
            nextAction: 'Restaurar keepalive e rerodar o doctor.',
          },
        })),
      },
      replayLearningControlPlaneService: {
        buildSnapshot: jest.fn(async () => ({
          summary: {
            posture: 'healthy',
            lifecycleEvents: 7,
            lifecycleAttention: 2,
            reusableArtifacts: 3,
            pendingLearning: 1,
          },
          actions: [
            {
              id: 'replay-review',
              label: 'Revisar replay recente',
              severity: 'info',
              reason: 'Ha artifacts reutilizaveis e um candidate pendente.',
              command: 'npm run ops:replay-learning',
            },
          ],
          narrative: {
            nextAction: 'Validar replay e promover learning candidate.',
          },
        })),
      },
    });

    const snapshot = await service.buildSnapshot({
      sessionId: 'session-1',
      userId: 'user-1',
      platform: 'web',
      chatId: 'chat-1',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    });

    expect(snapshot.generatedAt).toBe('2026-04-16T18:00:00.000Z');
    expect(snapshot.summary.posture).toBe('critical');
    expect(snapshot.summary.readyChannels).toBe(3);
    expect(snapshot.summary.onlineNodes).toBe(2);
    expect(snapshot.summary.readyTransports).toBe(1);
    expect(snapshot.summary.lifecycleEvents).toBe(7);
    expect(snapshot.summary.recommendedActions).toBe(3);
    expect(snapshot.cards.map((entry) => entry.id)).toEqual([
      'distributed-runtime',
      'runtime-stability',
      'replay-learning',
    ]);
    expect(snapshot.actions.map((entry) => entry.source)).toEqual([
      'runtime-stability',
      'distributed-runtime',
      'replay-learning',
    ]);
    await expect(service.renderReport()).resolves.toContain('Operational Overview');
  });
});
