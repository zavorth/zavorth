import { ZavorthControlService } from '../../src/services/ZavorthControlService.js';
import {
  createTestLogRepo,
  fetchZavorthControlJson,
} from '../helpers/controlWebTestUtils.js';

describe('ZavorthControl session plane endpoint', () => {
  const logRepo = createTestLogRepo();

  it('serves the official session plane through operations endpoint', async () => {
    const sessionPlaneService = {
      buildSnapshot: jest.fn(async () => ({
        generatedAt: '2026-04-02T12:00:00.000Z',
        summary: {
          commands: 4,
          tools: 4,
          sessions: 2,
          historyItems: 3,
          pendingPermissions: 1,
          linkedSurfaces: 2,
          sendReady: false,
          spawnReady: false,
        },
        store: {
          target: null,
          channel: null,
          sendReady: false,
          spawnReady: false,
        },
        commands: [
          {
            id: 'sessions',
            command: '/sessions',
            usage: '[sessionId|chatId]',
            description: 'Lista sessoes.',
            readiness: 'ready',
            operatorSummary: 'ok',
          },
        ],
        tools: [],
        current: {
          sessionTools: null,
          history: null,
        },
        sessions: {
          generatedAt: '2026-04-02T12:00:00.000Z',
          runtimeUserId: '1',
          total: 2,
          entries: [],
        },
        narrative: {
          headline: 'Session plane pronto.',
          operatorSummary: 'Snapshot oficial de sessao.',
        },
      })),
    };
    const service = new ZavorthControlService(logRepo, {
      sessionPlaneService: sessionPlaneService as any,
    });

    await service.start();
    const { status, payload } = await fetchZavorthControlJson(
      service.getUrl(),
      '/api/operations/sessions',
    );

    await service.stopAsync();

    expect(status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        narrative: expect.objectContaining({
          headline: 'Session plane pronto.',
          operatorSummary: 'Snapshot oficial de sessao.',
        }),
        summary: expect.objectContaining({
          commands: 4,
          sessions: 2,
        }),
      }),
    );
  });
});
