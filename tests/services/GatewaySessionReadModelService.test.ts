import { GatewaySessionReadModelService } from '../../src/services/GatewaySessionReadModelService.js';

describe('GatewaySessionReadModelService', () => {
  it('resolves canonical targets through the shared session store before reading history', async () => {
    const buildSessionSnapshot = jest.fn(async () => ({
      chatId: 'web:session-web-1',
      sessionId: 'session-web-1',
      runtimeUserId: 'telegram-admin',
    }));
    const service = new GatewaySessionReadModelService(
      {
        buildSessionSnapshot,
      } as any,
      {
        sessionStoreService: {
          resolveTarget: jest.fn(() => ({
            platform: 'web',
            chatId: 'web:session-web-1',
            sessionId: 'session-web-1',
            runtimeUserId: 'telegram-admin',
            sourceUserId: 'session-web-1',
            label: 'web:session-web-1',
          })),
        } as any,
      },
    );

    const snapshot = await service.buildSnapshot({
      userId: 'telegram-admin',
      platform: 'web',
      sessionId: 'session-web-1',
    });

    expect(buildSessionSnapshot).toHaveBeenCalledWith({
      userId: 'telegram-admin',
      chatId: 'web:session-web-1',
      sessionId: 'session-web-1',
      platform: 'web',
      sourceUserId: 'session-web-1',
    });
    expect(snapshot).toEqual(
      expect.objectContaining({
        chatId: 'web:session-web-1',
        sessionId: 'session-web-1',
      }),
    );
  });

  it('uses the fast snapshot path and returns null when no canonical target exists', () => {
    const buildSessionSnapshotFast = jest.fn(() => ({
      chatId: 'web:session-web-1',
      sessionId: 'session-web-1',
      runtimeUserId: 'telegram-admin',
    }));
    const sessionStore = {
      resolveTarget: jest
        .fn()
        .mockReturnValueOnce({
          platform: 'web',
          chatId: 'web:session-web-1',
          sessionId: 'session-web-1',
          runtimeUserId: 'telegram-admin',
          sourceUserId: 'session-web-1',
          label: 'web:session-web-1',
        })
        .mockReturnValueOnce(null),
    };
    const service = new GatewaySessionReadModelService(
      {
        buildSessionSnapshotFast,
      } as any,
      {
        sessionStoreService: sessionStore as any,
      },
    );

    const snapshot = service.buildSnapshotFast({
      userId: 'telegram-admin',
      platform: 'web',
      sessionId: 'session-web-1',
    });
    const missing = service.buildSnapshotFast({
      userId: 'telegram-admin',
      platform: 'web',
      sessionId: 'missing-session',
    });

    expect(buildSessionSnapshotFast).toHaveBeenCalledWith({
      userId: 'telegram-admin',
      chatId: 'web:session-web-1',
      sessionId: 'session-web-1',
      platform: 'web',
      sourceUserId: 'session-web-1',
    });
    expect(snapshot).toEqual(
      expect.objectContaining({
        chatId: 'web:session-web-1',
        sessionId: 'session-web-1',
      }),
    );
    expect(missing).toBeNull();
  });

  it('passes explicit telegram platform metadata through for raw chat ids', async () => {
    const buildSessionSnapshot = jest.fn(async () => ({
      chatId: 'chat-1',
      sessionId: null,
      platform: 'telegram',
      runtimeUserId: 'user-1',
      sourceUserId: 'user-1',
    }));
    const service = new GatewaySessionReadModelService(
      {
        buildSessionSnapshot,
      } as any,
      {
        sessionStoreService: {
          resolveTarget: jest.fn(() => ({
            platform: 'telegram',
            chatId: 'chat-1',
            sessionId: null,
            runtimeUserId: 'user-1',
            sourceUserId: 'user-1',
            label: 'telegram:chat-1',
          })),
        } as any,
      },
    );

    await service.buildSnapshot({
      userId: 'user-1',
      platform: 'telegram',
      chatId: 'chat-1',
      sourceUserId: 'user-1',
    });

    expect(buildSessionSnapshot).toHaveBeenCalledWith({
      userId: 'user-1',
      chatId: 'chat-1',
      sessionId: null,
      platform: 'telegram',
      sourceUserId: 'user-1',
    });
  });

  it('forwards metadata patch requests through the canonical session store target', () => {
    const patchSessionMetadata = jest.fn(() => ({
      label: 'Gateway',
      workspaceHint: 'C:/repo',
      pinned: true,
      modelProfile: 'gpt-5.4',
      updatedAt: '2026-04-13T10:00:00.000Z',
    }));
    const service = new GatewaySessionReadModelService(
      {
        patchSessionMetadata,
      } as any,
      {
        sessionStoreService: {
          resolveTarget: jest.fn(() => ({
            platform: 'web',
            chatId: 'web:session-web-1',
            sessionId: 'session-web-1',
            runtimeUserId: 'telegram-admin',
            sourceUserId: 'session-web-1',
            label: 'web:session-web-1',
          })),
        } as any,
      },
    );

    const metadata = service.patchSessionMetadata({
      userId: 'telegram-admin',
      platform: 'web',
      sessionId: 'session-web-1',
      label: 'Gateway',
      workspaceHint: 'C:/repo',
      pinned: true,
      modelProfile: 'gpt-5.4',
    });

    expect(patchSessionMetadata).toHaveBeenCalledWith({
      userId: 'telegram-admin',
      chatId: 'web:session-web-1',
      sessionId: 'session-web-1',
      platform: 'web',
      sourceUserId: 'session-web-1',
      label: 'Gateway',
      workspaceHint: 'C:/repo',
      pinned: true,
      modelProfile: 'gpt-5.4',
    });
    expect(metadata).toEqual(expect.objectContaining({
      label: 'Gateway',
      pinned: true,
      modelProfile: 'gpt-5.4',
    }));
  });
});
