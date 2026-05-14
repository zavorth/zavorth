import { DashboardService } from '../../src/services/DashboardService.js';
import {
  createTestLogRepo,
  fetchDashboardJson,
} from '../helpers/dashboardWebTestUtils.js';

describe('Dashboard Nexus agent gateway route', () => {
  const logRepo = createTestLogRepo();

  it('routes conversational Nexus execute requests through the injected agent gateway', async () => {
    const agentGateway = {
      attachWatchModeService: jest.fn(),
      handle: jest.fn(async (input: any) => ({
        ok: true,
        run: {
          id: 'run-dashboard-nexus',
          summary: 'Resumo Nexus via gateway.',
        },
        replies: [
          {
            id: 'reply-dashboard-nexus',
            runId: 'run-dashboard-nexus',
            port: input.replyPort,
            text: 'Resposta Nexus via ReplyPipeline.',
            createdAt: '2026-04-27T00:00:00.000Z',
          },
        ],
      })),
    };
    const service = new DashboardService(logRepo, {
      agentGateway,
    });

    try {
      await service.start();
      const { status, payload } = await fetchDashboardJson(
        service.getUrl(),
        '/api/v2/nexus/execute',
        {
          init: {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt: 'abrir painel nexus',
              category: 'OS',
              sessionId: 'dashboard-nexus-session',
              requestedBy: 'dashboard-nexus-agent',
              userId: 'dashboard-user',
            }),
          },
        },
      );

      expect(status).toBe(200);
      expect(agentGateway.handle).toHaveBeenCalledWith(expect.objectContaining({
        channel: 'api',
        text: 'abrir painel nexus',
        sessionId: 'dashboard-nexus-session',
        userId: 'dashboard-user',
        replyPort: expect.objectContaining({
          id: 'dashboard-nexus-session:nexus',
          label: 'Nexus',
        }),
        metadata: expect.objectContaining({
          source: 'nexus-surface',
          requestedBy: 'dashboard-nexus-agent',
          surface: 'nexus',
          route: '/api/v2/nexus/execute',
        }),
      }));
      expect(payload).toEqual(expect.objectContaining({
        ok: true,
        source: 'ZavorthAgentGateway',
        response: 'Resposta Nexus via ReplyPipeline.',
        normalizedInboundMessage: expect.objectContaining({
          channel: 'api',
          text: 'abrir painel nexus',
        }),
      }));
    } finally {
      await service.stopAsync();
    }
  });
});
