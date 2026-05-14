import { GatewaySessionToolsService } from '../../src/services/GatewaySessionToolsService.js';

describe('GatewaySessionToolsService', () => {
  it('blocks send when the before_send hook vetoes the operation', async () => {
    const sendToSession = jest.fn();
    const run = jest.fn(async ({ event }: any) => ({
      ok: event !== 'session.before_send' ? true : false,
      event,
      workspace: process.cwd(),
      listenerCount: 0,
      workspaceHookCount: 1,
    }));
    const service = new GatewaySessionToolsService({} as any, {
      channelRouterService: {
        canSendSessions: () => true,
        canSpawn: () => true,
        listSessions: jest.fn(),
        sendToSession,
        spawnSession: jest.fn(),
      } as any,
      sessionReadModelService: {
        buildSnapshot: jest.fn(),
      } as any,
      hookPipelineService: {
        run,
      } as any,
    });

    await expect(
      service.sendToSession({
        userId: 'user-1',
        platform: 'web',
        chatId: 'web:session-1',
        sessionId: 'session-1',
        text: 'continue',
      }),
    ).rejects.toThrow('Um hook bloqueou o envio para essa sessao.');

    expect(sendToSession).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs after_send with taskId from the router result', async () => {
    const run = jest.fn(async ({ event }: any) => ({
      ok: true,
      event,
      workspace: process.cwd(),
      listenerCount: 0,
      workspaceHookCount: 0,
    }));
    const service = new GatewaySessionToolsService({} as any, {
      channelRouterService: {
        canSendSessions: () => true,
        canSpawn: () => true,
        listSessions: jest.fn(),
        sendToSession: jest.fn(async () => ({
          ok: true,
          taskId: 'task-321',
          chatId: 'web:session-1',
          sessionId: 'session-1',
          platform: 'web',
          snapshot: null,
        })),
        spawnSession: jest.fn(),
      } as any,
      sessionReadModelService: {
        buildSnapshot: jest.fn(),
      } as any,
      hookPipelineService: {
        run,
      } as any,
    });

    const result = await service.sendToSession({
      userId: 'user-1',
      platform: 'web',
      chatId: 'web:session-1',
      sessionId: 'session-1',
      text: 'continue',
    });

    expect(result.taskId).toBe('task-321');
    expect(run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        event: 'session.before_send',
        context: expect.objectContaining({
          userId: 'user-1',
          sessionId: 'session-1',
          textLength: 8,
        }),
      }),
    );
    expect(run).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        event: 'session.after_send',
        context: expect.objectContaining({
          taskId: 'task-321',
          ok: true,
        }),
      }),
    );
  });

  it('runs before and after spawn without changing the router result', async () => {
    const spawnResult = {
      ok: false,
      platform: 'desktop',
      sessionId: null,
      chatId: null,
      sourceUserId: null,
      runtimeUserId: 'user-1',
      handoffCommand: '/task continuar sessao desktop',
    };
    const run = jest.fn(async ({ event }: any) => ({
      ok: true,
      event,
      workspace: process.cwd(),
      listenerCount: 0,
      workspaceHookCount: 0,
    }));
    const service = new GatewaySessionToolsService({} as any, {
      channelRouterService: {
        canSendSessions: () => true,
        canSpawn: () => true,
        listSessions: jest.fn(),
        sendToSession: jest.fn(),
        spawnSession: jest.fn(async () => spawnResult),
      } as any,
      sessionReadModelService: {
        buildSnapshot: jest.fn(),
      } as any,
      hookPipelineService: {
        run,
      } as any,
    });

    const result = await service.spawnSession({
      userId: 'user-1',
      platform: 'desktop',
    });

    expect(result).toEqual(spawnResult);
    expect(run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        event: 'session.before_spawn',
        context: expect.objectContaining({
          userId: 'user-1',
          platform: 'desktop',
        }),
      }),
    );
    expect(run).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        event: 'session.after_spawn',
        context: expect.objectContaining({
          platform: 'desktop',
          sessionId: null,
          ok: false,
        }),
      }),
    );
  });

  it('exposes listSessionsSummary and readHistoryFast through the canonical read model', () => {
    const listSessionsSummary = jest.fn(() => ({
      generatedAt: '2026-04-05T12:00:00.000Z',
      runtimeUserId: 'user-1',
      total: 3,
      visible: 2,
    }));
    const buildSnapshotFast = jest.fn(() => ({
      chatId: 'web:session-1',
      sessionId: 'session-1',
      runtimeUserId: 'user-1',
    }));
    const service = new GatewaySessionToolsService(
      {
        listSessionsSummary,
      } as any,
      {
        sessionReadModelService: {
          buildSnapshotFast,
        } as any,
        channelRouterService: {
          canSendSessions: () => true,
          canSpawn: () => true,
          listSessions: jest.fn(),
          sendToSession: jest.fn(),
          spawnSession: jest.fn(),
        } as any,
      },
    );

    const summary = service.listSessionsSummary({
      userId: 'user-1',
      limit: 5,
    });
    const history = service.readHistoryFast({
      userId: 'user-1',
      sessionId: 'session-1',
      chatId: 'web:session-1',
    });

    expect(listSessionsSummary).toHaveBeenCalledWith({
      userId: 'user-1',
      limit: 5,
    });
    expect(buildSnapshotFast).toHaveBeenCalledWith({
      userId: 'user-1',
      sessionId: 'session-1',
      chatId: 'web:session-1',
    });
    expect(summary).toEqual(
      expect.objectContaining({
        total: 3,
        visible: 2,
      }),
    );
    expect(history).toEqual(
      expect.objectContaining({
        sessionId: 'session-1',
      }),
    );
  });

  it('blocks spawn when the before_spawn hook vetoes the operation', async () => {
    const spawnSession = jest.fn();
    const run = jest.fn(async ({ event }: any) => ({
      ok: event !== 'session.before_spawn' ? true : false,
      event,
      workspace: process.cwd(),
      listenerCount: 0,
      workspaceHookCount: 1,
    }));
    const service = new GatewaySessionToolsService({} as any, {
      channelRouterService: {
        canSendSessions: () => true,
        canSpawn: () => true,
        listSessions: jest.fn(),
        sendToSession: jest.fn(),
        spawnSession,
      } as any,
      sessionReadModelService: {
        buildSnapshot: jest.fn(),
      } as any,
      hookPipelineService: {
        run,
      } as any,
    });

    await expect(
      service.spawnSession({
        userId: 'user-1',
        platform: 'web',
      }),
    ).rejects.toThrow('Um hook bloqueou a abertura da sessao derivada.');

    expect(spawnSession).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(1);
  });
});
