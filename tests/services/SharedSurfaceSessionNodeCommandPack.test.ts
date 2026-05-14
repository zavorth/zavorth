import { SharedSurfaceSessionNodeCommandPack } from '../../src/domain/surface/application/shared-surface/SharedSurfaceSessionNodeCommandPack';

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
            operatorSummary: 'Handoff pronto para continuar.',
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
      rawText: '/sessionsend web:session-2 -- continue o plano',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    const handled = await pack.maybeHandle(ctx as any, '/sessionsend', 'web:session-2 -- continue o plano');

    expect(handled).toBe(true);
    expect(sessionPlaneService.sendToSession).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'web',
      chatId: 'web:session-2',
      sessionId: 'session-2',
      text: 'continue o plano',
    }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Mensagem despachada para a sessao.'));
  });

  it('renders /nodes queue using the extracted pack', async () => {
    const pack = new SharedSurfaceSessionNodeCommandPack({
      sessionPlaneService: null,
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          narrative: {
            headline: 'Node Mesh ativo',
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
              headline: 'Fila com uma invocacao.',
              operatorSummary: 'Uma invocacao aguardando claim.',
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
                resultSummary: 'aguardando agente',
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
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Fila do Node Mesh'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('system.run (pending) :: aguardando agente'));
  });
});
