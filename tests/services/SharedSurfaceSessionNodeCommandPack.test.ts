import { SharedSurfaceSessionNodeCommandPack } from '../../src/domain/surface/presentation/shared-surface/SharedSurfaceSessionNodeCommandPack';

describe('SharedSurfaceSessionNodeCommandPack', () => {
  it('routes /sessionsend through the extracted pack', async () => {
    const sessionPlaneService = {
      renderOverviewReport: jest.fn(),
      renderHistoryReport: jest.fn(),
      sendToSession: jest.fn(async () => ({
        platform: 'web',
        chatId: 'web:session-2',
        sessionId: 'session-2',
        taskId: 'task-123',
        snapshot: {
          handoff: {
            operatorSummary: 'Handoff ready to continue.',
          },
        },
      })),
      spawnSession: jest.fn(),
    };
    const pack = new SharedSurfaceSessionNodeCommandPack({
      sessionPlaneService: sessionPlaneService as any,
      nodeMeshService: { buildSnapshot: jest.fn() } as any,
      nodeDeviceProfiles: {
        listProfiles: jest.fn(),
        describeProfile: jest.fn(),
        resolveProfile: jest.fn(),
        normalizeProfileId: jest.fn(),
      } as any,
      nodeCapabilities: { listCatalog: jest.fn() } as any,
      nodePairingService: { createPairingDraft: jest.fn() } as any,
      nodeInvokeService: { invoke: jest.fn() } as any,
    });
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/sessionsend web:session-2 -- continue the plan',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    const handled = await pack.maybeHandle(ctx as any, '/sessionsend', 'web:session-2 -- continue the plan');

    expect(handled).toBe(true);
    expect(sessionPlaneService.sendToSession).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'web',
        chatId: 'web:session-2',
        sessionId: 'session-2',
        text: 'continue the plan',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Message dispatched to the session.'));
  });

  it('accepts natural sessionsend without -- separator', async () => {
    const sessionPlaneService = {
      renderOverviewReport: jest.fn(),
      renderHistoryReport: jest.fn(),
      sendToSession: jest.fn(async () => ({
        platform: 'web',
        chatId: 'web:session-2',
        sessionId: 'session-2',
        taskId: 'task-456',
        snapshot: null,
      })),
      spawnSession: jest.fn(),
    };
    const pack = new SharedSurfaceSessionNodeCommandPack({
      sessionPlaneService: sessionPlaneService as any,
      nodeMeshService: { buildSnapshot: jest.fn() } as any,
      nodeDeviceProfiles: {
        listProfiles: jest.fn(),
        describeProfile: jest.fn(),
        resolveProfile: jest.fn(),
        normalizeProfileId: jest.fn(),
      } as any,
      nodeCapabilities: { listCatalog: jest.fn() } as any,
      nodePairingService: { createPairingDraft: jest.fn() } as any,
      nodeInvokeService: { invoke: jest.fn() } as any,
    });
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/sessionsend web:session-2 continue the plan',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    await pack.maybeHandle(ctx as any, '/sessionsend', 'web:session-2 continue the plan');

    expect(sessionPlaneService.sendToSession).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'continue the plan',
        chatId: 'web:session-2',
      }),
    );
  });

  it('accepts free-text sessionsend without -- separator', async () => {
    const sessionPlaneService = {
      renderOverviewReport: jest.fn(),
      renderHistoryReport: jest.fn(),
      sendToSession: jest.fn(async () => ({
        platform: 'web',
        chatId: 'web:session-2',
        sessionId: 'session-2',
        taskId: 'task-123',
        snapshot: { handoff: { operatorSummary: 'ok' } },
      })),
      spawnSession: jest.fn(),
    };
    const pack = new SharedSurfaceSessionNodeCommandPack({
      sessionPlaneService: sessionPlaneService as any,
      nodeMeshService: { buildSnapshot: jest.fn() } as any,
      nodeDeviceProfiles: {
        listProfiles: jest.fn(),
        describeProfile: jest.fn(),
        resolveProfile: jest.fn(),
        normalizeProfileId: jest.fn(),
      } as any,
      nodeCapabilities: { listCatalog: jest.fn() } as any,
      nodePairingService: { createPairingDraft: jest.fn() } as any,
      nodeInvokeService: { invoke: jest.fn() } as any,
    });
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/sessionsend web:session-2 continue the plan',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    await pack.maybeHandle(ctx as any, '/sessionsend', 'web:session-2 continue the plan');

    expect(sessionPlaneService.sendToSession).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'continue the plan',
        chatId: 'web:session-2',
      }),
    );
  });

  it('spawns a session from free platform text', async () => {
    const spawnSession = jest.fn(async () => ({
      ok: true,
      platform: 'telegram',
      sessionId: 'spawn-1',
      chatId: 'telegram:spawn-1',
      runtimeUserId: 'telegram-user',
      handoffCommand: '/sessions telegram:spawn-1',
    }));
    const pack = new SharedSurfaceSessionNodeCommandPack({
      sessionPlaneService: {
        renderOverviewReport: jest.fn(),
        renderHistoryReport: jest.fn(),
        sendToSession: jest.fn(),
        spawnSession,
      } as any,
      nodeMeshService: { buildSnapshot: jest.fn() } as any,
      nodeDeviceProfiles: {
        listProfiles: jest.fn(),
        describeProfile: jest.fn(),
        resolveProfile: jest.fn(),
        normalizeProfileId: jest.fn(),
      } as any,
      nodeCapabilities: { listCatalog: jest.fn() } as any,
      nodePairingService: { createPairingDraft: jest.fn() } as any,
      nodeInvokeService: { invoke: jest.fn() } as any,
    });
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/sessionspawn telegram',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    await pack.maybeHandle(ctx as any, '/sessionspawn', 'telegram');

    expect(spawnSession).toHaveBeenCalledWith({ userId: 'telegram-user', platform: 'telegram' });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Derived session opened'));
  });

  it('renders /nodes queue using the extracted pack', async () => {
    const pack = new SharedSurfaceSessionNodeCommandPack({
      sessionPlaneService: null,
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          narrative: {
            headline: 'Node Mesh active',
            operatorSummary: 'Dois nodes pareados.',
          },
          summary: {
            total: 2,
            paired: 2,
            pending: 0,
            online: 1,
          },
          selected: {
            label: 'Oracle Node',
          },
          selectedActivity: {
            nodeId: 'oracle-node',
            narrative: {
              headline: 'Fila com uma invocation.',
              operatorSummary: 'Uma invocation waiting for claim.',
            },
            summary: {
              pending: 1,
              claimed: 0,
              recent: 0,
              completedRecently: 0,
            },
            activeInvocations: [
              {
                capabilityId: 'system.run',
                status: 'pending',
                resultSummary: 'waiting for agente',
              },
            ],
            recentInvocations: [],
          },
          suggestedActions: [],
        })),
      } as any,
      nodeDeviceProfiles: {
        listProfiles: jest.fn(),
        describeProfile: jest.fn(),
        resolveProfile: jest.fn(),
        normalizeProfileId: jest.fn(),
      } as any,
      nodeCapabilities: { listCatalog: jest.fn() } as any,
      nodePairingService: { createPairingDraft: jest.fn() } as any,
      nodeInvokeService: { invoke: jest.fn() } as any,
    });
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/nodes queue oracle-node',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    const handled = await pack.maybeHandle(ctx as any, '/nodes', 'queue oracle-node');

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Node Mesh queue'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('system.run (pending) :: waiting for agente'));
  });
});
