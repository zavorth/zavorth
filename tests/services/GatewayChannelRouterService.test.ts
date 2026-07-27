import { GatewayChannelRegistryService } from '../../src/services/GatewayChannelRegistryService.js';
import { GatewayChannelRouterService } from '../../src/services/GatewayChannelRouterService.js';
import { GatewaySessionReadModelService } from '../../src/services/GatewaySessionReadModelService.js';
import { GatewaySessionService } from '../../src/services/GatewaySessionService.js';
import { GatewaySessionStoreService } from '../../src/services/GatewaySessionStoreService.js';

describe('GatewayChannelRouterService', () => {
  it('routes session sends through the shared dispatcher and reads the updated session from the read model', async () => {
    const dispatcher = {
      dispatchTaskMessage: jest.fn(async () => ({
        task: { task_id: 'task-web-1' },
      })),
    };
    const store = new GatewaySessionStoreService({
      createWebSession: () => 'session-web-1',
    });
    const readModel = {
      listSessions: jest.fn(),
      buildSnapshot: jest.fn(async () => ({
        chatId: 'web:session-web-1',
        sessionId: 'session-web-1',
        runtimeUserId: 'telegram-admin',
      })),
    } as unknown as GatewaySessionReadModelService;
    const registry = new GatewayChannelRegistryService({
      hasDispatcher: true,
      canSpawnWeb: true,
      platformCapabilityService: {
        getCapabilities: () => [],
      },
    });

    const router = new GatewayChannelRouterService({
      sessionStoreService: store,
      sessionReadModelService: readModel,
      channelRegistryService: registry,
      surfaceTaskDispatcher: dispatcher as any,
    });

    const result = await router.sendToSession({
      userId: 'telegram-admin',
      platform: 'web',
      sessionId: 'session-web-1',
      text: 'continue through the gateway route',
    });

    expect(dispatcher.dispatchTaskMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'web',
        chatId: 'web:session-web-1',
        sessionId: 'session-web-1',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        taskId: 'task-web-1',
        chatId: 'web:session-web-1',
        sessionId: 'session-web-1',
        platform: 'web',
      }),
    );
    expect((readModel.buildSnapshot as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        userId: 'telegram-admin',
        chatId: 'web:session-web-1',
        sessionId: 'session-web-1',
      }),
    );
  });

  it('spawns web sessions canonicaly through the session store', () => {
    const router = new GatewayChannelRouterService({
      sessionStoreService: new GatewaySessionStoreService({
        createWebSession: () => 'session-web-2',
      }),
      sessionReadModelService: new GatewaySessionReadModelService(new GatewaySessionService()),
      channelRegistryService: new GatewayChannelRegistryService({
        canSpawnWeb: true,
        platformCapabilityService: {
          getCapabilities: () => [],
        },
      }),
      surfaceTaskDispatcher: null,
    });

    const result = router.spawnSession({
      userId: 'telegram-admin',
      platform: 'web',
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        platform: 'web',
        sessionId: 'session-web-2',
        chatId: 'web:session-web-2',
      }),
    );
  });

  it('fails session sends when the shared dispatcher is unavailable', async () => {
    const router = new GatewayChannelRouterService({
      sessionStoreService: new GatewaySessionStoreService({
        createWebSession: () => 'session-web-3',
      }),
      sessionReadModelService: new GatewaySessionReadModelService(new GatewaySessionService()),
      channelRegistryService: new GatewayChannelRegistryService({
        hasDispatcher: false,
        canSpawnWeb: true,
        platformCapabilityService: {
          getCapabilities: () => [],
        },
      }),
      surfaceTaskDispatcher: null,
    });

    await expect(
      router.sendToSession({
        userId: 'telegram-admin',
        platform: 'web',
        sessionId: 'session-web-3',
        text: 'continue',
      }),
    ).rejects.toThrow('Gateway session send requer um dispatcher shared active.');
  });

  it('fails session sends when the target session cannot be resolved', async () => {
    const router = new GatewayChannelRouterService({
      sessionStoreService: new GatewaySessionStoreService(),
      sessionReadModelService: new GatewaySessionReadModelService(new GatewaySessionService()),
      channelRegistryService: new GatewayChannelRegistryService({
        hasDispatcher: true,
        canSpawnWeb: false,
        platformCapabilityService: {
          getCapabilities: () => [],
        },
      }),
      surfaceTaskDispatcher: {
        dispatchTaskMessage: jest.fn(),
      } as any,
    });

    await expect(
      router.sendToSession({
        userId: 'telegram-admin',
        platform: '' as any,
        text: 'continue',
      }),
    ).rejects.toThrow('Invalid target session for sessions_send.');
  });

  it('fails session sends when the selected channel does not expose sessionSend', async () => {
    const dispatcher = {
      dispatchTaskMessage: jest.fn(),
    };
    const router = new GatewayChannelRouterService({
      sessionStoreService: new GatewaySessionStoreService({
        createWebSession: () => 'session-web-4',
      }),
      sessionReadModelService: new GatewaySessionReadModelService(new GatewaySessionService()),
      channelRegistryService: new GatewayChannelRegistryService({
        hasDispatcher: false,
        canSpawnWeb: true,
        platformCapabilityService: {
          getCapabilities: () => [],
        },
      }),
      surfaceTaskDispatcher: dispatcher as any,
    });

    await expect(
      router.sendToSession({
        userId: 'telegram-admin',
        platform: 'web',
        sessionId: 'session-web-4',
        text: 'continue',
      }),
    ).rejects.toThrow('Canal web ainda not aceita sessions_send.');
    expect(dispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
  });
});
