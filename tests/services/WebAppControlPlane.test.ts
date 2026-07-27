import { config } from '../../src/config/index.js';
import { DashboardService } from '../../src/services/DashboardService.js';
import {
  createTestLogRepo,
  fetchDashboardJson,
} from '../helpers/dashboardWebTestUtils.js';

describe('WebApp control plane endpoint', () => {
  const logRepo = createTestLogRepo();
  const originalWebAuthToken = config.zavorthWebAuthToken;

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
  });

  it('serves the canonical control plane through the protected web api', async () => {
    config.zavorthWebAuthToken = 'control-plane-secret';
    const snapshot = {
      generatedAt: '2026-04-02T12:00:00.000Z',
      summary: {
        channelsReady: 2,
        channelsTotal: 3,
      },
      controlPlane: {
        generatedAt: '2026-04-02T12:00:00.000Z',
        summary: {
          hooksRegistered: 3,
          hooksCovered: 2,
          runtimeModesReady: 4,
          runtimeModesPartial: 1,
          securityLevel: 'strong',
          remoteTransportsReady: 2,
          remoteAttention: 1,
          remotePendingWork: 0,
          toolFamilies: 5,
        },
        hookPlane: { summary: { registeredHooks: 3 } },
        runtimeModes: { summary: { ready: 4 } },
        securityMesh: { posture: { level: 'strong' } },
        remoteTransports: { summary: { ready: 2 } },
        toolSurface: { summary: { families: 5 } },
        suggestedActions: [
          {
            id: 'transport-repair',
            label: 'Reparar transporte',
            command: '/transports repair node-host',
            severity: 'warn',
            reason: 'Node host waiting for heartbeat.',
          },
        ],
        narrative: {
          headline: 'Gateway / Hooks / Runtime / Transports',
          operatorSummary: '4 runtimes e 3 hooks registrados.',
        },
      },
      narrative: {
        headline: 'Gateway ready.',
        operatorSummary: 'Snapshot unificado.',
      },
    };
    const gatewayService = {
      buildSnapshot: jest.fn(() => snapshot),
      buildHydratedSnapshot: jest.fn(async () => snapshot),
    };
    const service = new DashboardService(logRepo, {
      gatewayService: gatewayService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/control-plane-sessionId=session-web-1',
      { token: 'control-plane-secret' },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(gatewayService.buildHydratedSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-web-1',
        chatId: 'web:session-web-1',
      }),
    );
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        controlPlane: expect.objectContaining({
          summary: expect.objectContaining({
            hooksRegistered: 3,
            remoteTransportsReady: 2,
          }),
          narrative: expect.objectContaining({
            headline: 'Gateway / Hooks / Runtime / Transports',
          }),
        }),
        gateway: expect.objectContaining({
          controlPlane: expect.objectContaining({
            summary: expect.objectContaining({
              toolFamilies: 5,
            }),
          }),
        }),
      }),
    );
  }, 15000);
});
