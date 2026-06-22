import { SharedSurfaceCommandService } from '../../../src/services/SharedSurfaceCommandService';
import { DiscordSurfacePolicyService } from '../../../src/services/DiscordSurfacePolicyService';
import { ZavorthSmartCommandSurfaceService } from '../../../src/services/ZavorthSmartCommandSurfaceService';
import { config } from '../../../src/config/index';

describe('SharedSurfaceCommandService', () => {
  const originalProvider = config.llmProvider;
  const originalGeminiKeys = [...config.geminiApiKeys];
  const originalOpenAiKey = config.openaiApiKey;
  const originalOpenRouterKey = config.openRouterApiKey;
  const originalTelegramUserRoles = config.telegramUserRoles;
  const originalSelfmodPolicy = config.zavorthSelfmodPolicy;

  let smartCommandSurfaceSpy: jest.SpyInstance;

  beforeEach(() => {
    smartCommandSurfaceSpy = jest.spyOn(ZavorthSmartCommandSurfaceService.prototype, 'canHandle').mockReturnValue(false);
  });

  afterEach(() => {
    smartCommandSurfaceSpy.mockRestore();
    (config as any).llmProvider = originalProvider;
    (config as any).geminiApiKeys = [...originalGeminiKeys];
    (config as any).openaiApiKey = originalOpenAiKey;
    (config as any).openRouterApiKey = originalOpenRouterKey;
    (config as any).telegramUserRoles = originalTelegramUserRoles;
    (config as any).zavorthSelfmodPolicy = originalSelfmodPolicy;
  });

  it('renders the Runtime & Security Mesh through /runtime', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/runtime',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const securityMeshService = {
      buildSnapshot: jest.fn(() => ({
        posture: {
          label: 'Guarded',
          summary: 'Container forte pronto; microVM ainda em preparo.',
        },
        summary: {
          coreReady: 2,
          extensionsReady: 0,
          gvisorActive: true,
          firecrackerReady: false,
          neverDowngrade: true,
        },
        suggestedActions: [
          {
            label: 'Validar microVM',
            command: 'npm run sandbox:firecracker:smoke',
          },
        ],
        narrative: {
          operatorSummary: 'Container forte pronto; microVM ainda em preparo.',
          trustBoundary: 'Alto risco nao rebaixa.',
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      securityMeshService: securityMeshService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(securityMeshService.buildSnapshot).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Runtime & Security Mesh'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Trust Plane'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Validar microVM'));
  });

  it('executes trust-plane profile changes through /trust', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/trust mcp trusted',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const trustPlaneActionService = {
      execute: jest.fn(() => ({
        summary: 'Perfil MCP alterado para trusted.',
        details: ['Allowlist MCP atual: 0 tool(s) explicita(s).'],
        snapshot: {
          summary: {
            posture: 'attention',
            mcpProfile: 'trusted',
            skillDefaultPolicy: 'deny',
            trustedPlugins: 1,
            installedPlugins: 2,
          },
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      trustPlaneService: {
        buildSnapshot: jest.fn(() => ({
          summary: { mcpProfile: 'trusted' },
        })),
        renderReport: jest.fn(() => 'Trust Plane do Zavorth'),
      } as any,
      trustPlaneActionService: trustPlaneActionService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(trustPlaneActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'set-mcp-profile',
        profile: 'trusted',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Perfil MCP alterado para trusted.'));
  });

  it('renders the remote transport plane through /transports', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/transports node-host',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const remoteTransportService = {
      buildSnapshot: jest.fn(() => ({
        summary: {
          total: 4,
          ready: 2,
          partial: 1,
          planned: 1,
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
          operatorSummary: 'Node pareado aguardando heartbeat.',
          telemetry: {
            updatedAt: '2026-04-02T11:59:00.000Z',
            pendingWork: 2,
            lastError: null,
            statusLine: 'Node offline aguardando heartbeat.',
          },
          details: ['Pareados: 1.'],
        },
        suggestedActions: [
          {
            label: 'Preparar node host',
            command: '/nodepair headless',
          },
        ],
        narrative: {
          headline: 'Zavorth expoe 4 transporte(s) remoto(s) no plano atual.',
          operatorSummary: '2 pronto(s), 1 em preparo e 0 desativado(s).',
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      remoteTransportService: remoteTransportService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(remoteTransportService.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedId: 'node-host',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Remote Transport Plane do Zavorth'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Node host transport'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/nodepair headless'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Telemetria:'));
  });

  it('executes remote transport actions through /transports subcommands', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/transports repair discord-transport',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const remoteTransportActionService = {
      execute: jest.fn(async () => ({
        summary: 'Discord transport recebeu um roteiro de repair.',
        details: ['Discord pronto.'],
        snapshot: {
          narrative: {
            operatorSummary: '2 transportes remotos prontos.',
          },
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      remoteTransportActionService: remoteTransportActionService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(remoteTransportActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        transportId: 'discord-transport',
        actionId: 'repair',
        requestedBy: 'telegram-user',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Discord transport recebeu um roteiro de repair.'));
  });

  it('renders the channel mesh through the shared command surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/channels discord',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const channelMeshService = {
      renderReport: jest.fn(() => 'Channel Mesh do Zavorth\n\nDiscord [partial]'),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      channelMeshService: channelMeshService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(channelMeshService.renderReport).toHaveBeenCalledWith({ selectedId: 'discord' });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Channel Mesh do Zavorth'));
  });

  it('executes channel mesh actions through /channels subcommands', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/channels broadcast-test telegram',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const channelActionService = {
      execute: jest.fn(async () => ({
        summary: 'Teste de broadcast enviado para Telegram.',
        details: ['Recipientes previstos: 2.'],
        snapshot: {
          narrative: {
            operatorSummary: '2 canais prontos.',
          },
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      channelActionService: channelActionService as any,
      channelMeshService: { renderReport: jest.fn() } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(channelActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'telegram',
        actionId: 'broadcast-test',
        requestedBy: 'telegram-user',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Teste de broadcast enviado para Telegram.'));
  });

  it('renders channel mesh actions as rich Telegram controls when the channel exposes actions', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/channels status whatsapp',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const channelActionService = {
      execute: jest.fn(async () => ({
        generatedAt: '2026-04-02T12:00:00.000Z',
        channelId: 'whatsapp',
        actionId: 'status',
        status: 'applied',
        ok: true,
        summary: 'Status do WhatsApp pronto.',
        details: ['Bridge local ativo.'],
        selected: {
          id: 'whatsapp',
          label: 'WhatsApp',
          readiness: 'ready',
          transport: 'local',
          implementationState: 'live',
          configured: true,
          notes: [],
          features: {
            inbound: true,
            outbound: true,
            sessionList: false,
            sessionHistory: false,
            sessionSend: true,
            sessionSpawn: false,
            attachments: true,
            threads: false,
            groupPolicy: true,
            identityHints: true,
            qrLogin: true,
          },
          source: 'runtime',
          summary: 'Canal pronto.',
          operatorSummary: 'WhatsApp pareado.',
          actionHint: 'Use /channels login-qr whatsapp quando precisar parear.',
          tags: [],
          statusRows: [
            { label: 'Conexao', value: 'connected', tone: 'success' },
          ],
          actions: [
            {
              id: 'whatsapp:status',
              label: 'Status',
              kind: 'status',
              command: '/channels status whatsapp',
            },
            {
              id: 'whatsapp:login-qr',
              label: 'QR de login',
              kind: 'login-qr',
              command: '/channels login-qr whatsapp',
            },
          ],
        },
        snapshot: {
          narrative: {
            operatorSummary: '1 canal pronto.',
          },
          selected: null,
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      channelActionService: channelActionService as any,
      channelMeshService: { renderReport: jest.fn() } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Status do WhatsApp pronto.'),
      expect.objectContaining({
        reply_markup: expect.objectContaining({
          inline_keyboard: expect.arrayContaining([
            expect.arrayContaining([
              expect.objectContaining({ text: 'Status' }),
              expect.objectContaining({ text: 'QR de login' }),
            ]),
          ]),
        }),
      }),
    );
  });

  it('renders channel mesh actions as Discord components through the same response contract', async () => {
    const ctx = {
      platform: 'discord',
      userId: 'discord-user',
      chatId: 'discord:dm-1',
      isGroup: false,
      rawText: '/channels status discord',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const channelActionService = {
      execute: jest.fn(async () => ({
        generatedAt: '2026-04-02T12:00:00.000Z',
        channelId: 'discord',
        actionId: 'status',
        status: 'applied',
        ok: true,
        summary: 'Status do Discord pronto.',
        details: ['Gateway nativo ativo.'],
        selected: {
          id: 'discord',
          label: 'Discord',
          readiness: 'ready',
          transport: 'native',
          implementationState: 'live',
          configured: true,
          notes: [],
          features: {
            inbound: true,
            outbound: true,
            sessionList: false,
            sessionHistory: false,
            sessionSend: true,
            sessionSpawn: false,
            attachments: true,
            threads: true,
            groupPolicy: true,
            identityHints: true,
          },
          source: 'runtime',
          summary: 'Canal pronto.',
          operatorSummary: 'Discord pronto.',
          actionHint: 'Use slash commands.',
          tags: [],
          actions: [
            {
              id: 'discord:status',
              label: 'Status',
              kind: 'status',
              command: '/channels status discord',
            },
          ],
        },
        snapshot: {
          narrative: {
            operatorSummary: '1 canal pronto.',
          },
          selected: null,
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      discordSurfacePolicyService: new DiscordSurfacePolicyService({
        commandExposure: 'operator',
        ownerUserIds: ['discord-user'],
        publicServerMode: true,
      }),
      channelActionService: channelActionService as any,
      channelMeshService: { renderReport: jest.fn() } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Status do Discord pronto.'),
      expect.objectContaining({
        allowedMentions: { parse: [] },
        components: expect.arrayContaining([
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({ label: 'Status' }),
            ]),
          }),
        ]),
      }),
    );
  });

  it('renders channel experience consistency as a rich shared surface report', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/channels consistency whatsapp',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const channelMeshService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-05-10T12:00:00.000Z',
        summary: {
          total: 1,
          ready: 1,
          partial: 0,
          planned: 0,
          disabled: 0,
          configured: 1,
          sessionSendReady: 1,
          attachments: 1,
          groupPolicy: 1,
        },
        entries: [
          {
            id: 'whatsapp',
            label: 'WhatsApp',
            readiness: 'ready',
            implementationState: 'full',
            configured: true,
            transport: 'local',
            notes: [],
            features: {
              inbound: true,
              outbound: true,
              sessionList: true,
              sessionHistory: true,
              sessionSend: true,
              sessionSpawn: false,
              attachments: true,
              threads: false,
              groupPolicy: true,
              identityHints: true,
              approvals: true,
              rateLimit: true,
              webhook: false,
              localBridge: true,
              doctor: true,
              interactiveControls: true,
              slashCommands: false,
              richReplies: true,
              qrLogin: true,
            },
            source: 'runtime',
            summary: 'WhatsApp pronto.',
            operatorSummary: 'WhatsApp com QR pronto.',
            actionHint: 'Use /channels login-qr whatsapp.',
            tags: [],
            actions: [],
            interactiveSurface: {
              statusCard: true,
              inlineButtons: false,
              slashCommands: false,
              richReplies: true,
              modelMenus: false,
              qrLogin: true,
            },
            loginQr: {
              supported: true,
              state: 'ready',
              source: 'session-dir',
              dataUrl: 'data:image/png;base64,abc123',
              expiresAt: null,
              updatedAt: '2026-05-10T12:00:00.000Z',
              nextStep: 'Escaneie o QR.',
            },
          },
        ],
        selected: null,
        featuredIds: ['whatsapp'],
        narrative: {
          headline: 'Channel Mesh',
          operatorSummary: '1 canal pronto.',
        },
      })),
      renderReport: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      channelMeshService: channelMeshService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(ctx.reply.mock.calls[0][0]).toContain('Paridade de experiencia por canal do Zavorth');
    expect(ctx.reply.mock.calls[0][0]).toContain('WhatsApp');
    expect(ctx.reply.mock.calls[0][1]).toEqual(expect.objectContaining({
      reply_markup: expect.objectContaining({
        inline_keyboard: expect.any(Array),
      }),
    }));
  });

  it('executes WhatsApp QR actions through /channels subcommands', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/channels login-qr whatsapp',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const channelActionService = {
      execute: jest.fn(async () => ({
        summary: 'QR de login do WhatsApp pronto para exibicao no operador.',
        details: ['Mostre a imagem para o usuario autorizado escanear no WhatsApp.'],
        loginQr: {
          supported: true,
          state: 'ready',
          dataUrl: 'data:image/png;base64,abc123',
          expiresAt: null,
          updatedAt: '2026-04-02T12:00:00.000Z',
          nextStep: 'Escaneie o QR.',
        },
        snapshot: {
          narrative: {
            operatorSummary: '2 canais prontos.',
          },
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      channelActionService: channelActionService as any,
      channelMeshService: { renderReport: jest.fn() } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(channelActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'whatsapp',
        actionId: 'login-qr',
        requestedBy: 'telegram-user',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('QR de login do WhatsApp pronto'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('QR pronto'));
  });

  it('can late-bind Discord broadcast gateways for /channels broadcast-test discord', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/channels broadcast-test discord',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const broadcast = jest.fn(async () => undefined);
    const resolveBroadcastRecipients = jest.fn(() => ['discord:owner']);
    const channelMeshService = {
      renderReport: jest.fn(),
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => ({
        generatedAt: '2026-04-02T12:00:00.000Z',
        summary: {
          total: 2,
          ready: 2,
          partial: 0,
          planned: 0,
          disabled: 0,
          configured: 2,
          sessionSendReady: 2,
          attachments: 0,
          groupPolicy: 2,
        },
        entries: [],
        selected: {
          id: selectedId || 'discord',
          label: 'Discord',
          readiness: 'ready',
          transport: 'native',
          defaultRouteAllowed: true,
          summary: 'Canal pronto.',
          operatorSummary: 'Outbound pronto.',
          actionHint: 'Use slash commands.',
          notes: [],
          features: {
            inbound: true,
            outbound: true,
            sessionList: true,
            sessionHistory: true,
            sessionSend: true,
            sessionSpawn: false,
            attachments: true,
            threads: true,
            groupPolicy: true,
            identityHints: true,
          },
          actions: [
            {
              id: 'discord:broadcast-test',
              label: 'Testar broadcast',
              kind: 'broadcast-test',
              command: '/channels broadcast-test discord',
            },
          ],
        },
        featuredIds: ['discord'],
        narrative: {
          headline: 'Channel Mesh do Zavorth',
          operatorSummary: '2 canais prontos.',
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      channelMeshService: channelMeshService as any,
    });

    service.attachChannelBroadcastGateways({
      discord: {
        supportsRoleAwareBroadcast: true,
        resolveBroadcastRecipients,
        broadcast,
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(resolveBroadcastRecipients).toHaveBeenCalledWith(['admin', 'operator']);
    expect(broadcast).toHaveBeenCalledWith(expect.stringContaining('Teste do Channel Mesh em Discord'), ['admin', 'operator']);
    expect(ctx.reply.mock.calls[0][0]).toContain('Teste de broadcast enviado para Discord.');
  });

  it('can late-bind WhatsApp broadcast gateways for /channels broadcast-test whatsapp', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/channels broadcast-test whatsapp',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const broadcast = jest.fn(async () => undefined);
    const resolveBroadcastRecipients = jest.fn(() => ['whatsapp:chat-1']);
    const channelMeshService = {
      renderReport: jest.fn(),
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => ({
        generatedAt: '2026-04-02T12:00:00.000Z',
        summary: {
          total: 2,
          ready: 2,
          partial: 0,
          planned: 0,
          disabled: 0,
          configured: 2,
          sessionSendReady: 1,
          attachments: 1,
          groupPolicy: 2,
        },
        entries: [],
        selected: {
          id: selectedId || 'whatsapp',
          label: 'WhatsApp',
          readiness: 'ready',
          transport: 'local',
          defaultRouteAllowed: true,
          summary: 'Canal pronto.',
          operatorSummary: 'Outbound pronto.',
          actionHint: 'Use o outbox local.',
          notes: [],
          features: {
            inbound: true,
            outbound: true,
            sessionList: true,
            sessionHistory: true,
            sessionSend: false,
            sessionSpawn: false,
            attachments: true,
            threads: false,
            groupPolicy: true,
            identityHints: true,
          },
          actions: [
            {
              id: 'whatsapp:broadcast-test',
              label: 'Testar broadcast',
              kind: 'broadcast-test',
              command: '/channels broadcast-test whatsapp',
            },
          ],
        },
        featuredIds: ['whatsapp'],
        narrative: {
          headline: 'Channel Mesh do Zavorth',
          operatorSummary: '2 canais prontos.',
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      channelMeshService: channelMeshService as any,
    });

    service.attachChannelBroadcastGateways({
      whatsapp: {
        supportsRoleAwareBroadcast: false,
        resolveBroadcastRecipients,
        broadcast,
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(resolveBroadcastRecipients).toHaveBeenCalledWith([]);
    expect(broadcast).toHaveBeenCalledWith(expect.stringContaining('Teste do Channel Mesh em WhatsApp'), []);
    expect(ctx.reply.mock.calls[0][0]).toContain('Teste de broadcast enviado para WhatsApp.');
  });

  it('can late-bind Slack broadcast gateways for /channels broadcast-test slack', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/channels broadcast-test slack',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const broadcast = jest.fn(async () => undefined);
    const resolveBroadcastRecipients = jest.fn(() => ['slack:ops']);
    const channelMeshService = {
      renderReport: jest.fn(),
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => ({
        generatedAt: '2026-04-02T12:00:00.000Z',
        summary: {
          total: 2,
          ready: 1,
          partial: 1,
          planned: 0,
          disabled: 0,
          configured: 2,
          sessionSendReady: 1,
          attachments: 1,
          groupPolicy: 2,
        },
        entries: [],
        selected: {
          id: selectedId || 'slack',
          label: 'Slack',
          readiness: 'partial',
          transport: 'local',
          defaultRouteAllowed: true,
          summary: 'Canal parcial, mas com outbox local pronto para teste.',
          operatorSummary: 'Outbound pronto.',
          actionHint: 'Prepare onboarding e valide o outbox local.',
          notes: [],
          features: {
            inbound: true,
            outbound: true,
            sessionList: true,
            sessionHistory: true,
            sessionSend: false,
            sessionSpawn: false,
            attachments: true,
            threads: true,
            groupPolicy: true,
            identityHints: true,
          },
          actions: [
            {
              id: 'slack:broadcast-test',
              label: 'Testar broadcast',
              kind: 'broadcast-test',
              command: '/channels broadcast-test slack',
            },
          ],
        },
        featuredIds: ['slack'],
        narrative: {
          headline: 'Channel Mesh do Zavorth',
          operatorSummary: '1 canal pronto e 1 parcial.',
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      channelMeshService: channelMeshService as any,
    });

    service.attachChannelBroadcastGateways({
      slack: {
        supportsRoleAwareBroadcast: false,
        resolveBroadcastRecipients,
        broadcast,
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(resolveBroadcastRecipients).toHaveBeenCalledWith([]);
    expect(broadcast).toHaveBeenCalledWith(expect.stringContaining('Teste do Channel Mesh em Slack'), []);
    expect(ctx.reply.mock.calls[0][0]).toContain('Teste de broadcast enviado para Slack.');
  });

  it('executes prepare actions through /channels subcommands for planned channels', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/channels prepare slack',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const channelActionService = {
      execute: jest.fn(async () => ({
        summary: 'Slack preparado para o proximo passo do Channel Mesh.',
        details: ['Proximo passo oficial: planejar o adapter de Slack.'],
        snapshot: {
          narrative: {
            operatorSummary: '4 canais ativos e 1 planejado.',
          },
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      channelActionService: channelActionService as any,
      channelMeshService: { renderReport: jest.fn() } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(channelActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'slack',
        actionId: 'prepare',
        requestedBy: 'telegram-user',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Slack preparado para o proximo passo do Channel Mesh.'));
  });

  it('executes plugin plane actions through /plugins subcommands', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/plugins trust openrouter',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const pluginActionService = {
      execute: jest.fn(() => ({
        summary: 'OpenRouter marcado como trusted.',
        details: ['Nenhum segredo foi alterado.'],
        snapshot: {
          narrative: {
            operatorSummary: '1 registrado e 1 trusted.',
          },
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      pluginActionService: pluginActionService as any,
      pluginRegistryService: { renderCatalogReport: jest.fn() } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(pluginActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: 'openrouter',
        actionId: 'trust',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('OpenRouter marcado como trusted.'));
  });

  it('executes doctor actions through /plugins subcommands', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/plugins doctor openrouter',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const pluginActionService = {
      execute: jest.fn(() => ({
        summary: 'Doctor de OpenRouter pronto.',
        details: ['Readiness: ready', 'Trust: trusted'],
        snapshot: {
          narrative: {
            operatorSummary: '1 registrado e 1 trusted.',
          },
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      pluginActionService: pluginActionService as any,
      pluginRegistryService: { renderCatalogReport: jest.fn() } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(pluginActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: 'openrouter',
        actionId: 'doctor',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Doctor de OpenRouter pronto.'));
  });

  it('executes next/open actions through /plugins subcommands', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/plugins next openrouter',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const pluginActionService = {
      execute: jest.fn(() => ({
        summary: 'OpenRouter: proximo passo pronto.',
        details: ['Atalho recomendado: /integrations openrouter'],
        snapshot: {
          narrative: {
            operatorSummary: '1 registrado e 1 trusted.',
          },
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      pluginActionService: pluginActionService as any,
      pluginRegistryService: { renderCatalogReport: jest.fn() } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(pluginActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: 'openrouter',
        actionId: 'next',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('OpenRouter: proximo passo pronto.'));
  });

  it('renders the unified platform plane through /platform', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/platform skill:zavorthBridge',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const platformRegistryService = {
      renderCatalogReport: jest.fn(() => 'Platform plane do Zavorth\n\nzavorthBridge'),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      platformRegistryService: platformRegistryService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(platformRegistryService.renderCatalogReport).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedId: 'skill:zavorthBridge',
        query: 'skill:zavorthBridge',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Platform plane do Zavorth'));
  });

  it('syncs the remote platform registry through /platform sync', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/platform sync',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const sync = jest.fn(async () => ({
      ok: true,
      status: 'ready',
      summary: 'Registry remoto pronto com 3 item(ns), 1 colecao(oes) e 1 recipe(s).',
      entryCount: 3,
      collectionCount: 1,
      recipeCount: 1,
      cacheFile: 'C:/tmp/platform-cache.json',
      error: null,
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      platformCatalogSyncService: {
        sync,
      } as any,
      platformRegistryService: {
        renderCatalogReport: jest.fn(() => 'Platform plane do Zavorth'),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(sync).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Platform registry sync'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Registry remoto pronto'));
  });

  it('executes platform lifecycle actions through /platform subcommands', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/platform install recipe:ui-debug-onboarding',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const execute = jest.fn(async () => ({
      summary: 'UI Debug Onboarding aplicada no platform plane.',
      details: ['Alvos avaliados: 1 | aplicados: 1 | noop: 0 | bloqueados: 0.'],
      selected: null,
      selectedCollection: null,
      selectedRecipe: {
        id: 'recipe:ui-debug-onboarding',
        label: 'UI Debug Onboarding',
      },
      snapshot: {},
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      platformActionService: {
        execute,
      } as any,
      platformRegistryService: {
        renderCatalogReport: jest.fn(() => 'Platform plane do Zavorth\n\nUI Debug Onboarding'),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        entryId: 'recipe:ui-debug-onboarding',
        actionId: 'install',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('UI Debug Onboarding aplicada no platform plane.'));
  });

  it('executes platform publish through /platform publish', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/platform publish C:/tmp/sql-analyzer',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const publishDetailed = jest.fn(async () => ({
      ok: true,
      releaseId: '@example/sql-analyzer@1.2.3',
      packageId: '@example/sql-analyzer',
      version: '1.2.3',
      signature: 'sha256:abc123',
      packageSha256: 'abc123',
      fileCount: 2,
      outputFile: 'C:/repo/data/runtime/platform-publish/example.json',
      uploadStatus: 'prepared',
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      platformPublisherService: {
        publishDetailed,
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(publishDetailed).toHaveBeenCalledWith(
      expect.objectContaining({
        packagePath: 'C:/tmp/sql-analyzer',
        signLocal: true,
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Platform publish'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('@example/sql-analyzer@1.2.3'));
  });

  it('enqueues a node invocation through the shared command surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/nodeinvoke oracle-node system.run run {\"command\":\"echo\",\"args\":[\"ok\"]}',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const nodeInvokeService = {
      invoke: jest.fn(() => ({
        ok: true,
        status: 'queued',
        nodeId: 'oracle-node',
        capabilityId: 'system.run',
        action: 'run',
        reason: 'Invocacao colocada na fila.',
        invocationId: 'invoke-1',
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      nodeInvokeService: nodeInvokeService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(nodeInvokeService.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'oracle-node',
        capabilityId: 'system.run',
        action: 'run',
        payload: {
          command: 'echo',
          args: ['ok'],
        },
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Invocacao do Node Mesh enfileirada.'));
  });

  it('renders the provider doctor and profile summary through /models', async () => {
    (config as any).llmProvider = 'gemini';
    (config as any).geminiApiKeys = ['gemini-key'];
    (config as any).openaiApiKey = '';
    (config as any).openRouterApiKey = '';
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/models',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      zavorthBridgePreferenceStore: {
        getPreferredModel: jest.fn(async () => 'gemini-2.5-pro'),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(ctx.reply.mock.calls[0][0]).toContain('Providers prontos agora');
    expect(ctx.reply.mock.calls[0][0]).toContain('Perfil recomendado para esta etapa');
    expect(ctx.reply.mock.calls[0][0]).toContain('Targets aceitos em /model');
    expect(ctx.reply.mock.calls[0][1]).toEqual(expect.objectContaining({
      reply_markup: expect.any(Object),
    }));
  });

  it('renders the shared command catalog as a rich command deck', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/commands channel',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(ctx.reply.mock.calls[0][0]).toContain('Catalogo de comandos do Zavorth');
    expect(ctx.reply.mock.calls[0][0]).toContain('/channels');
    expect(ctx.reply.mock.calls[0][1]).toEqual(expect.objectContaining({
      reply_markup: expect.objectContaining({
        inline_keyboard: expect.any(Array),
      }),
    }));
  });

  it('renders the team catalog through /teams with surface availability', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/teams',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      teamCatalogService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-03T18:00:00.000Z',
          summary: {
            total: 1,
            active: 0,
            resumable: 1,
            completedRecently: 0,
            executors: ['codex', 'external_executor'],
          },
          teams: [
            {
              id: 'sdd',
              label: 'SDD Loop Team',
              summary: 'Fluxo guiado por spec.',
              whenToUse: 'Use para uma feature com spec.',
              entryCommand: '/workflow sdd <feature-id>',
              status: 'resumable',
              members: [],
              runStats: {
                total: 1,
                active: 0,
                resumable: 1,
                completedRecently: 0,
              },
              surfaces: [
                {
                  surfaceId: 'telegram',
                  label: 'Telegram',
                  status: 'available',
                  summary: 'Disponivel no gateway principal por /workflow.',
                  actionHint: '/workflow sdd <feature-id>',
                },
                {
                  surfaceId: 'discord_dm',
                  label: 'Discord owner DM',
                  status: 'owner_only',
                  summary: 'No Discord publico, workflows compostos ficam restritos a DM owner-only.',
                  actionHint: 'Use DM com o bot.',
                },
              ],
              latestRun: null,
              operatorSummary: 'Fluxo pronto para retomar.',
            },
          ],
          narrative: {
            headline: 'Zavorth expoe 1 team composto.',
            operatorSummary: '1 team com retomada pronta.',
          },
        })),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Teams e workflows compostos do Zavorth'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Telegram: available'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Discord owner DM: owner_only'));
  });

  it('renders the Governance governance control plane through /governance', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/governance limit 12',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const renderReport = jest.fn(() => 'Governance: Tenancy, governance e policy\nPostura: healthy.');
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      governanceControlPlaneService: {
        buildSnapshot: jest.fn(() => ({})),
        renderReport,
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(renderReport).toHaveBeenCalledWith({ limit: 12 });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Governance: Tenancy, governance e policy'));
  });

  it('renders the Replay learning replay learning control plane through /replayloop', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/replayloop limit 12',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const renderReport = jest.fn(async () => 'Replay learning: Replay, artifacts e learning loop\nPostura: healthy.');
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      replayLearningControlPlaneService: {
        buildSnapshot: jest.fn(async () => ({})),
        renderReport,
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(renderReport).toHaveBeenCalledWith({
      userId: 'telegram-user',
      platform: 'telegram',
      chatId: 'telegram:chat-1',
      limit: 12,
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Replay learning: Replay, artifacts e learning loop'));
  });

  it('renders the Eval observability eval control plane through /evals', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/evals surface telegram',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const buildSnapshot = jest.fn(async () => ({
      summary: {
        posture: 'attention',
        scorecards: 4,
        datasets: 3,
        regressions: 1,
      },
      narrative: {
        operatorSummary: 'Maior pressao atual no setup de canais.',
      },
      regressions: [
        {
          label: 'watch-mode via telegram',
          severity: 'high',
        },
      ],
      telemetry: {
        status: 'active',
        totalEvents: 12,
        traceCount: 3,
        failureEvents: 1,
        traces: [
          {
            source: 'telegram',
            status: 'blocked',
            eventCount: 4,
            lastEventType: 'execution.blocked',
          },
        ],
        recommendation: 'Cruzar traces com scorecards.',
      },
      history: {
        entries: 2,
        delta: {
          regressions: 1,
          traceCount: 1,
        },
        trend: [
          {
            posture: 'attention',
            generatedAt: '2026-04-12T12:00:00.000Z',
          },
        ],
        recommendation: 'Revisar regressions antes do rollout.',
      },
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      evalControlPlaneService: {
        buildSnapshot,
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(buildSnapshot).toHaveBeenCalledWith({
      workspace: null,
      sourceSurface: 'telegram',
      executor: null,
      workflow: null,
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Eval observability: Eval + Observability'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Telemetry: active'));
  });

});
