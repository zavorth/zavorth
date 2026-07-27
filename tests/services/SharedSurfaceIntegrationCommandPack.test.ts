import { SharedSurfaceIntegrationCommandPack } from '../../src/domain/surface/presentation/shared-surface/SharedSurfaceIntegrationCommandPack';

describe('SharedSurfaceIntegrationCommandPack', () => {
  it('routes /plugins actions through the extracted pack', async () => {
    const pluginActionService = {
      execute: jest.fn(async () => ({
        summary: 'OpenRouter marcado como trusted.',
        details: ['No segredo foi alterado.'],
        snapshot: {
          narrative: {
            operatorSummary: '1 registrado e 1 trusted.',
          },
        },
      })),
    };
    const pack = new SharedSurfaceIntegrationCommandPack({
      channelActionService: { execute: jest.fn() } as any,
      channelMeshService: { renderReport: jest.fn() } as any,
      pluginActionService: pluginActionService as any,
      pluginRegistryService: { renderCatalogReport: jest.fn() } as any,
      remoteTransportActionService: { execute: jest.fn() } as any,
      remoteTransportService: { buildSnapshot: jest.fn() } as any,
    });
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/plugins trust openrouter',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    const handled = await pack.maybeHandle(ctx as any, '/plugins', 'trust openrouter');

    expect(handled).toBe(true);
    expect(pluginActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: 'openrouter',
        actionId: 'trust',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('OpenRouter marcado como trusted.'));
  });

  it('uses the late-bound channel action service after rebind', async () => {
    const initialChannelActionService = {
      execute: jest.fn(async () => ({
        summary: 'old',
        details: [],
        snapshot: { narrative: { operatorSummary: 'old summary' } },
      })),
    };
    const reboundChannelActionService = {
      execute: jest.fn(async () => ({
        summary: 'Teste de broadcast sent para Discord.',
        details: ['Recipientes previstos: 1.'],
        snapshot: {
          narrative: {
            operatorSummary: '1 channel ready.',
          },
        },
      })),
    };
    const pack = new SharedSurfaceIntegrationCommandPack({
      channelActionService: initialChannelActionService as any,
      channelMeshService: { renderReport: jest.fn() } as any,
      pluginActionService: { execute: jest.fn() } as any,
      pluginRegistryService: { renderCatalogReport: jest.fn() } as any,
      remoteTransportActionService: { execute: jest.fn() } as any,
      remoteTransportService: { buildSnapshot: jest.fn() } as any,
    });
    pack.setChannelActionService(reboundChannelActionService as any);
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/channels broadcast-test discord',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    const handled = await pack.maybeHandle(ctx as any, '/channels', 'broadcast-test discord');

    expect(handled).toBe(true);
    expect(initialChannelActionService.execute).not.toHaveBeenCalled();
    expect(reboundChannelActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'discord',
        actionId: 'broadcast-test',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Teste de broadcast sent para Discord.'));
  });

  it('routes /channels policy-reload through the existing channel action service', async () => {
    const channelActionService = {
      execute: jest.fn(async () => ({
        summary: 'Policy de Telegram recarregada without restarting active gateways.',
        details: ['Canais alterados: telegram.'],
        snapshot: {
          narrative: {
            operatorSummary: '1 channel ready.',
          },
        },
      })),
    };
    const pack = new SharedSurfaceIntegrationCommandPack({
      channelActionService: channelActionService as any,
      channelMeshService: { renderReport: jest.fn() } as any,
      pluginActionService: { execute: jest.fn() } as any,
      pluginRegistryService: { renderCatalogReport: jest.fn() } as any,
      remoteTransportActionService: { execute: jest.fn() } as any,
      remoteTransportService: { buildSnapshot: jest.fn() } as any,
    });
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/channels policy-reload telegram',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    const handled = await pack.maybeHandle(ctx as any, '/channels', 'policy-reload telegram');

    expect(handled).toBe(true);
    expect(channelActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'telegram',
        actionId: 'policy-reload',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('without restarting active gateways'));
  });

  it('renders the transport report through the extracted pack', async () => {
    const remoteTransportService = {
      buildSnapshot: jest.fn(() => ({
        summary: {
          total: 4,
          ready: 2,
          partial: 1,
          disabled: 0,
          live: 2,
          reachable: 1,
          attentionRequired: 1,
          pendingWork: 2,
        },
        selected: {
          id: 'node-host',
          label: 'Node host transport',
          kind: 'node-host',
          transport: 'node-mesh-heartbeat',
          readiness: 'partial',
          endpoint: null,
          operatorSummary: 'Node pareado waiting for heartbeat.',
          telemetry: {
            updatedAt: '2026-04-02T11:59:00.000Z',
            pendingWork: 2,
            lastError: null,
            statusLine: 'Node offline waiting for heartbeat.',
          },
          details: ['Pareados: 1.'],
        },
        suggestedActions: [
          {
            label: 'Prepare node host',
            command: '/nodepair headless',
          },
        ],
        narrative: {
          headline: 'Zavorth exposes 4 remote transport(s) on the current plane.',
          operatorSummary: '2 ready(s), 1 em preparo e 0 desativado(s).',
        },
      })),
    };
    const pack = new SharedSurfaceIntegrationCommandPack({
      channelActionService: { execute: jest.fn() } as any,
      channelMeshService: { renderReport: jest.fn() } as any,
      pluginActionService: { execute: jest.fn() } as any,
      pluginRegistryService: { renderCatalogReport: jest.fn() } as any,
      remoteTransportActionService: { execute: jest.fn() } as any,
      remoteTransportService: remoteTransportService as any,
    });
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/transports node-host',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    const handled = await pack.maybeHandle(ctx as any, '/transports', 'node-host');

    expect(handled).toBe(true);
    expect(remoteTransportService.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedId: 'node-host',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Zavorth Remote Transport Plane'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Node host transport'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/nodepair headless'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Telemetry:'));
  });
});
