import { ZavorthControlService } from '../../src/services/ZavorthControlService.js';
import {
  createTestLogRepo,
  fetchZavorthControlJson,
} from '../helpers/zavorthControlWebTestUtils.js';

describe('ZavorthControl Nexus agent gateway route', () => {
  const logRepo = createTestLogRepo();

  it('routes conversational Nexus execute requests through the injected agent gateway', async () => {
    const agentGateway = {
      attachWatchModeService: jest.fn(),
      handle: jest.fn(async (input: any) => ({
        ok: true,
        run: {
          id: 'run-zavorthControl-nexus',
          summary: 'Resumo Nexus via gateway.',
        },
        replies: [
          {
            id: 'reply-zavorthControl-nexus',
            runId: 'run-zavorthControl-nexus',
            port: input.replyPort,
            text: 'Resposta Nexus via ReplyPipeline.',
            createdAt: '2026-04-27T00:00:00.000Z',
          },
        ],
      })),
    };
    const service = new ZavorthControlService(logRepo, {
      agentGateway,
    });

    try {
      await service.start();
      const { status, payload } = await fetchZavorthControlJson(
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
              sessionId: 'zavorthControl-nexus-session',
              requestedBy: 'zavorthControl-nexus-agent',
              userId: 'zavorthControl-user',
            }),
          },
        },
      );

      expect(status).toBe(200);
      expect(agentGateway.handle).toHaveBeenCalledWith(expect.objectContaining({
        channel: 'api',
        text: 'abrir painel nexus',
        sessionId: 'zavorthControl-nexus-session',
        userId: 'zavorthControl-user',
        replyPort: expect.objectContaining({
          id: 'zavorthControl-nexus-session:nexus',
          label: 'Nexus',
        }),
        metadata: expect.objectContaining({
          source: 'nexus-surface',
          requestedBy: 'zavorthControl-nexus-agent',
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
