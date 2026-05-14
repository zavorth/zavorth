import { GatewaySessionStoreService } from '../../src/services/GatewaySessionStoreService.js';

describe('GatewaySessionStoreService', () => {
  it('resolves canonical web targets from session context', () => {
    const service = new GatewaySessionStoreService();

    const target = service.resolveTarget({
      userId: 'telegram-admin',
      platform: 'web',
      sessionId: 'session-web-1',
    });

    expect(target).toEqual(
      expect.objectContaining({
        platform: 'web',
        sessionId: 'session-web-1',
        chatId: 'web:session-web-1',
        runtimeUserId: 'telegram-admin',
        sourceUserId: 'session-web-1',
      }),
    );
  });

  it('creates canonical web sessions when a web factory exists', () => {
    const service = new GatewaySessionStoreService({
      createWebSession: () => 'session-web-2',
    });

    const spawned = service.createSession({
      userId: 'telegram-admin',
      platform: 'web',
    });

    expect(spawned).toEqual(
      expect.objectContaining({
        ok: true,
        platform: 'web',
        sessionId: 'session-web-2',
        chatId: 'web:session-web-2',
        sourceUserId: 'session-web-2',
        runtimeUserId: 'telegram-admin',
      }),
    );
  });
});
