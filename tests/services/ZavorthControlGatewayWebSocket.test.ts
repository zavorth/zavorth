import { once } from 'events';
import { WebSocket } from 'ws';
import { config } from '../../src/config/index.js';
import { ZavorthControlService } from '../../src/services/ZavorthControlService.js';
import { createTestLogRepo } from '../helpers/testLogRepoUtils.js';

async function waitForZavorthControlSocketMessage(
  messages: Array<Record<string, any>>,
  matcher: (payload: Record<string, any>) => boolean,
  timeoutMs: number = 8_000,
): Promise<Record<string, any>> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const match = messages.find(matcher);
    if (match) {
      return match;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Mensagem esperada nao chegou a tempo na zavorthControl WebSocket.');
}

describe('ZavorthControlService gateway websocket', () => {
  const originalWebAuthToken = config.zavorthWebAuthToken;

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
  });

  it('upgrades the zavorthControl to the canonical gateway websocket control plane', async () => {
    config.zavorthWebAuthToken = 'zavorthControl-gateway-secret';
    const service = new ZavorthControlService(createTestLogRepo());
    const messages: Array<Record<string, any>> = [];
    let client: WebSocket | null = null;

    try {
      service.attachChatRuntime({
        permissionService: {
          listRequests: jest.fn().mockResolvedValue([]),
        } as any,
        taskManager: {
          getRecentTasks: jest.fn(() => []),
          getRecentTasksByChat: jest.fn(() => []),
          getTask: jest.fn(() => null),
        } as any,
        parser: {
          parse: jest.fn(),
        } as any,
        taskOrchestrationController: {
          handleTaskMessage: jest.fn(),
        } as any,
        permissionController: {
          resolvePermissionReference: jest.fn(),
          shortPermissionId: jest.fn(),
          handlePermissionCallback: jest.fn(),
          handleApproval: jest.fn(),
          handleRejection: jest.fn(),
          formatPermissionCreatedMessage: jest.fn(() => 'Permissao pendente'),
        } as any,
        hostIdentityService: {
          getStatus: jest.fn(() => ({
            authorized: true,
            firstRun: false,
            currentFingerprint: 'host-current',
            storedFingerprint: 'host-current',
          })),
        } as any,
        webUserId: 'zavorthControl-web-user',
      } as any);
      await service.start();
      const query = new URLSearchParams({
        token: 'zavorthControl-gateway-secret',
        sessionId: 'zavorthControl-ws-1',
        replay: 'state',
      });
      const websocketUrl = `${service.getUrl().replace(/^http/i, 'ws')}/api/web/gateway/ws?${query.toString()}`;
      client = new WebSocket(websocketUrl);
      client.on('message', (payload) => {
        messages.push(JSON.parse(payload.toString()));
      });

      await once(client, 'open');

      const ready = await waitForZavorthControlSocketMessage(messages, (payload) => payload.type === 'ready');
      const runtime = await waitForZavorthControlSocketMessage(messages, (payload) => payload.type === 'runtime');
      const hydrate = await waitForZavorthControlSocketMessage(messages, (payload) => payload.type === 'hydrate');

      expect(ready).toEqual(
        expect.objectContaining({
          sessionId: 'zavorthControl-ws-1',
          controlPlane: expect.objectContaining({
            preferredTransport: 'ws',
            websocketPath: '/api/web/gateway/ws',
          }),
        }),
      );
      expect(runtime).toEqual(
        expect.objectContaining({
          payload: expect.objectContaining({
            controlPlane: expect.objectContaining({
              preferredTransport: 'ws',
            }),
          }),
        }),
      );
      expect(hydrate).toEqual(
        expect.objectContaining({
          replayMode: 'state',
          state: expect.objectContaining({
            snapshot: expect.objectContaining({
              sessionId: 'zavorthControl-ws-1',
            }),
          }),
        }),
      );

      client.send(JSON.stringify({ id: 'state-1', method: 'session.state' }));
      const stateResponse = await waitForZavorthControlSocketMessage(
        messages,
        (payload) => payload.type === 'response' && payload.id === 'state-1',
      );
      expect(stateResponse).toEqual(
        expect.objectContaining({
          ok: true,
          result: expect.objectContaining({
            snapshot: expect.objectContaining({
              sessionId: 'zavorthControl-ws-1',
            }),
          }),
        }),
      );
    } finally {
      if (client) {
        const closePromise = client.readyState === WebSocket.CLOSED
          ? Promise.resolve()
          : once(client, 'close').then(() => undefined).catch(() => undefined);
        client.close();
        await closePromise;
      }
      await service.stopAsync();
    }
  }, 20000);
});
