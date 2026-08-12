import * as http from 'http';
import { CHANNEL_MESH_ROUTE_PATHS } from '../../../../../src/contracts/ChannelMeshContract.js';
import {
  WebAppSurfaceRouteService,
  type WebAppSurfaceRouteDeps,
} from '../../../../../src/services/WebAppSurfaceRouteService.js';

describe('WebAppSurfaceRouteService', () => {
  const makeChannelSnapshot = (selectedId: string | null = null) => {
    const entries = [
      {
        id: 'web',
        label: 'Web',
        readiness: 'ready',
        implementationState: 'complete',
        configured: true,
        transport: 'virtual',
        notes: [],
        features: {
          inbound: true,
          outbound: true,
          sessionList: true,
          sessionHistory: true,
          sessionSend: true,
          sessionSpawn: true,
          attachments: false,
          threads: false,
          groupPolicy: false,
          identityHints: true,
        },
        source: 'runtime',
        summary: 'Canal web pronto.',
        operatorSummary: 'Sessions prontas.',
        actionHint: 'Use o app.',
        tags: ['primary'],
        actions: [],
      },
      {
        id: 'telegram',
        label: 'Telegram',
        readiness: 'ready',
        implementationState: 'full',
        configured: true,
        transport: 'native',
        notes: ['Gateway anexado.'],
        features: {
          inbound: true,
          outbound: true,
          sessionList: true,
          sessionHistory: true,
          sessionSend: true,
          sessionSpawn: false,
          attachments: false,
          threads: false,
          groupPolicy: true,
          identityHints: true,
        },
        source: 'runtime',
        summary: 'Canal Telegram pronto.',
        operatorSummary: 'Gateway ativo.',
        actionHint: 'Use o bot.',
        tags: ['chat'],
        actions: [],
      },
      {
        id: 'discord',
        label: 'Discord',
        readiness: 'partial',
        implementationState: 'partial',
        configured: true,
        transport: 'native',
        notes: ['Bridge em rollout.'],
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
        source: 'runtime',
        summary: 'Canal Discord parcial.',
        operatorSummary: 'Bridge ativa.',
        actionHint: 'Use slash commands.',
        tags: ['chat'],
        actions: [],
      },
      {
        id: 'slack',
        label: 'Slack',
        readiness: 'partial',
        implementationState: 'partial',
        configured: true,
        transport: 'local',
        notes: ['Outbox supervisionado.'],
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
        source: 'runtime',
        summary: 'Canal Slack parcial.',
        operatorSummary: 'Workspace conectado.',
        actionHint: 'Use o gateway do workspace.',
        tags: ['chat'],
        actions: [],
      },
      {
        id: 'whatsapp',
        label: 'WhatsApp',
        readiness: 'partial',
        implementationState: 'partial',
        configured: true,
        transport: 'webhook',
        notes: ['Cloud API em rollout.'],
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
        },
        source: 'runtime',
        summary: 'Canal WhatsApp parcial.',
        operatorSummary: 'Cloud API conectada.',
        actionHint: 'Use a Cloud API da Meta.',
        tags: ['chat'],
        actions: [],
      },
    ];
    const id = selectedId || 'web';
    return {
      generatedAt: '2026-04-05T12:00:00.000Z',
      summary: {
        total: entries.length,
        ready: 2,
        partial: 3,
        planned: 0,
        disabled: 0,
        configured: entries.length,
        sessionSendReady: entries.length,
        attachments: 3,
        groupPolicy: 4,
      },
      entries,
      selected: entries.find((entry) => entry.id === id) || null,
      featuredIds: ['web', 'telegram'],
      narrative: {
        headline: 'Channel Mesh pronta.',
        operatorSummary: 'Canais operacionais disponiveis.',
      },
    };
  };

  const createDeps = (
    overrides: Partial<WebAppSurfaceRouteDeps> = {},
  ): WebAppSurfaceRouteDeps => ({
    operatorBrief: null,
    productObservability: null,
    evalControlPlane: null,
    qaControlPlane: null,
    governanceControlPlane: null,
    replayLearningControlPlane: null,
    ecosystemControlPlane: null,
    distributedRuntimeControlPlane: null,
    runtimeStabilityControlPlane: null,
    rolloutReadinessControlPlane: null,
    naturalSetupControlPlane: null,
    automationControlPlane: null,
    automationActions: null,
    watchModeControlPlane: null,
    hubControlPlane: null,
    hubActions: null,
    capabilityCatalog: null,
    runtimeGateway: null,
    gateway: null,
    gatewayChannelRegistry: {
      getChannel: jest.fn((id: string) => {
        const snapshot = makeChannelSnapshot(null);
        const channel = snapshot.entries.find((entry) => entry.id === id) || null;
        return channel
          ? {
              id: channel.id,
              label: channel.label,
              readiness: channel.readiness,
              configured: channel.configured,
              transport: channel.transport,
              notes: channel.notes,
              features: channel.features,
            }
          : null;
      }),
      listChannels: jest.fn(() => []),
    },
    gatewayChannelRouter: {
      getChannel: jest.fn((id: string) => {
        const snapshot = makeChannelSnapshot(null);
        const channel = snapshot.entries.find((entry) => entry.id === id) || null;
        return channel
          ? {
              id: channel.id,
              label: channel.label,
              readiness: channel.readiness,
              configured: channel.configured,
              transport: channel.transport,
              notes: channel.notes,
              features: channel.features,
            }
          : null;
      }),
      sendToSession: jest.fn(async (input: any) => ({
        ok: true,
        taskId: 'task-1',
        chatId: `${input?.platform || 'web'}:room-1`,
        sessionId: `session-${input?.platform || 'web'}-1`,
        platform: input?.platform || 'web',
        snapshot: {
          chatId: `${input?.platform || 'web'}:room-1`,
          sessionId: `session-${input?.platform || 'web'}-1`,
        },
      })),
      spawnSession: jest.fn(() => ({
        ok: true,
        platform: 'web',
        sessionId: 'session-web-1',
        chatId: 'web:session-web-1',
        sourceUserId: 'session-web-1',
        runtimeUserId: 'web-user',
        handoffCommand: '/open-session session-web-1',
      })),
    },
    runtime: {
      webUserId: 'web-user',
    } as any,
    realtime: null,
    buildMemoryPlaneSnapshot: jest.fn(async () => null),
    resolveSessionId: jest.fn(() => 'session-web-1'),
    channelMesh: {
      buildSnapshot: jest.fn(({ selectedId }: { selectedId?: string | null } = {}) =>
        makeChannelSnapshot(selectedId || null),
      ),
    },
    channelActions: null,
    channelInstall: {
      buildReport: jest.fn(() => ({
        generatedAt: '2026-04-09T12:00:00.000Z',
        envFilePath: 'C:\\TESTES DEV\\zavorth-core\\Zavorth\\.env',
        localBaseUrl: 'http://127.0.0.1:33333',
        publicBaseUrl: null,
        channels: [
          {
            channelId: 'telegram',
            label: 'Telegram',
            readiness: 'partial',
            configured: true,
            implementationState: 'full',
            transport: 'native',
            currentMode: 'native',
            modes: ['native'],
            recommendedMode: 'native',
            summary: 'Telegram pronto para bot token e allowlist.',
            webhookPath: null,
            localWebhookUrl: null,
            publicWebhookUrl: null,
            requiredEnvKeys: ['TELEGRAM_BOT_TOKEN'],
            missingEnvKeys: [],
            scaffoldEntries: [],
            notes: ['Rode npm run test:channels:smoke.'],
            commands: {
              inspect: 'npm run channels:install -- --json',
              apply: 'npm run channels:install -- --channel telegram --mode native --apply',
              doctor: 'npm run test:channels:smoke',
            },
          },
          {
            channelId: 'whatsapp',
            label: 'WhatsApp',
            readiness: 'partial',
            configured: true,
            implementationState: 'partial',
            transport: 'local',
            currentMode: 'stub',
            modes: ['stub', 'cloud-api', 'baileys'],
            recommendedMode: 'cloud-api',
            summary: 'WhatsApp pode ser promovido para Cloud API.',
            webhookPath: '/api/webhooks/whatsapp',
            localWebhookUrl: 'http://127.0.0.1:33333/api/webhooks/whatsapp',
            publicWebhookUrl: null,
            requiredEnvKeys: ['WHATSAPP_ACCESS_TOKEN'],
            missingEnvKeys: ['WHATSAPP_ACCESS_TOKEN'],
            scaffoldEntries: [],
            notes: ['Promova para cloud-api quando tiver as credenciais.'],
            commands: {
              inspect: 'npm run channels:install -- --json',
              apply: 'npm run channels:install -- --channel whatsapp --mode cloud-api --apply',
              doctor: 'npm run test:channels:smoke',
            },
          },
        ],
      })),
      applyScaffold: jest.fn((input: any) => ({
        generatedAt: '2026-04-09T12:01:00.000Z',
        channelId: input.channelId,
        mode: input.mode,
        env: {
          filePath: 'C:\\TESTES DEV\\zavorth-core\\Zavorth\\.env',
          writtenKeys: ['WHATSAPP_PROVIDER'],
          preservedKeys: [],
        },
        directoriesCreated: [],
        report: {
          generatedAt: '2026-04-09T12:01:00.000Z',
          envFilePath: 'C:\\TESTES DEV\\zavorth-core\\Zavorth\\.env',
          localBaseUrl: 'http://127.0.0.1:33333',
          publicBaseUrl: null,
          channels: [],
        },
        nextSteps: ['Rode npm run test:channels:smoke.'],
      })),
    },
    channelProviderDoctor: {
      run: jest.fn(async () => ({
        checkedAt: '2026-04-09T12:02:00.000Z',
        status: 'passed',
        summary: 'Doctor dos canais validou o runtime atual.',
        command: 'npm run test:channels:smoke',
        items: [
          {
            channelId: 'telegram',
            mode: 'native',
            enabled: true,
            configured: true,
            status: 'passed',
            summary: 'Telegram ok.',
            error: null,
            recommendedAction: null,
            details: [],
          },
        ],
      })),
    },
    naturalChannelSetupTurn: null,
    remoteTransports: null,
    remoteTransportActions: null,
    runtimeToolSurface: null,
    toolSurface: null,
    pluginRegistry: null,
    pluginActions: null,
    platformRegistry: null,
    platformActions: null,
    platformCatalogSync: null,
    platformPublisher: null,
    hookPlane: null,
    runtimeModes: null,
    securityMesh: null,
    trustPlane: null,
    trustPlaneActions: null,
    teamCatalog: null,
    tenantGovernance: null,
    tenantGovernanceActions: null,
    codexRemote: null,
    codexRemoteActions: null,
    operationsActions: null,
    zavorthBridgeMobileAccess: null,
    integrationHub: null,
    skillCatalogApi: null,
    skillMcpSidecar: null,
    mcpCapabilityControlPlane: null,
    mcpRuntime: null,
    mcpBrowserDoctor: null,
    providerControlPlane: null,
    agentOperatingSystem: null,
    agentOperatingSystemActions: null,
    writeJson: jest.fn(),
    readJsonBody: jest.fn(async () => ({})),
    workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    AIGatewayGateway: null,
    AIGatewayGatewayLauncher: null,
    AIGatewayCompatibilityDoctor: null,
    AIGatewayUpstreamSync: null,
    ...overrides,
  });

  it('returns the canonical channel detail with registry metadata', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const deps = createDeps({ writeJson });
    const url = new URL('http://localhost/api/web/channels/discord');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      `${CHANNEL_MESH_ROUTE_PATHS.collection}/discord`,
      deps,
    );

    expect(handled).toBe(true);
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        channel: expect.objectContaining({
          id: 'discord',
        }),
        channels: expect.objectContaining({
          selected: expect.objectContaining({
            id: 'discord',
          }),
        }),
        registry: expect.objectContaining({
          id: 'discord',
          features: expect.objectContaining({
            sessionHistory: true,
          }),
        }),
      }),
      200,
    );
  });

  it('returns the channel install report for the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const deps = createDeps({ writeJson });
    const url = new URL('http://localhost/api/web/channels/install?selectedId=whatsapp');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/channels/install',
      deps,
    );

    expect(handled).toBe(true);
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        report: expect.objectContaining({
          channels: expect.any(Array),
        }),
        selected: expect.objectContaining({
          channelId: 'whatsapp',
          recommendedMode: 'cloud-api',
        }),
      }),
      200,
    );
  });

  it('returns a mode-scoped channel install plan for the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const channelInstall = {
      buildReport: jest.fn(() => ({
        channels: [
          {
            channelId: 'slack',
            recommendedMode: 'stub',
          },
        ],
      })),
      buildPlanForChannel: jest.fn(() => ({
        channelId: 'slack',
        currentMode: 'stub',
        recommendedMode: 'native',
        modes: ['stub', 'native'],
        scaffoldEntries: [
          { key: 'SLACK_BOT_TOKEN', value: '' },
          { key: 'SLACK_SIGNING_SECRET', value: '' },
        ],
      })),
      applyScaffold: jest.fn(),
    };
    const deps = createDeps({
      writeJson,
      channelInstall: channelInstall as any,
    });
    const url = new URL('http://localhost/api/web/channels/install?selectedId=slack&mode=native');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/channels/install',
      deps,
    );

    expect(handled).toBe(true);
    expect(channelInstall.buildPlanForChannel).toHaveBeenCalledWith('slack', 'native');
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        selected: expect.objectContaining({
          channelId: 'slack',
          recommendedMode: 'native',
          scaffoldEntries: expect.any(Array),
        }),
      }),
      200,
    );
  });

  it('runs the natural channel setup turn through the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'POST' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const readJsonBody = jest.fn(async () => ({
      text: 'Quero conectar o Zavorth no Slack native. Aplique e valide.',
      autoApply: true,
      autoDoctor: true,
    }));
    const buildTurn = jest.fn(async () => ({
      generatedAt: '2026-04-11T12:00:00.000Z',
      channelId: 'slack',
      mode: 'native',
      assistant: {
        selected: { channelId: 'slack' },
        channels: null,
      },
      extractedEntries: [],
      remainingEnvKeys: [],
      applyResult: null,
      doctorResult: null,
      sendTest: null,
      promotionReady: true,
      naturalReply: 'Slack pronto.',
    }));
    const deps = createDeps({
      writeJson,
      readJsonBody,
      naturalChannelSetupTurn: { buildTurn } as any,
    });
    const url = new URL('http://localhost/api/web/channels/setup-assistant/turn');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/channels/setup-assistant/turn',
      deps,
    );

    expect(handled).toBe(true);
    expect(buildTurn).toHaveBeenCalledWith(expect.objectContaining({
      intentText: 'Quero conectar o Zavorth no Slack native. Aplique e valide.',
      autoApply: true,
      autoDoctor: true,
    }));
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        channelId: 'slack',
        naturalReply: 'Slack pronto.',
      }),
      200,
    );
  });

  it('exposes the trust plane on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const deps = createDeps({
      writeJson,
      trustPlane: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-11T13:00:00.000Z',
          summary: {
            posture: 'guarded',
            pendingApprovals: 1,
            highRiskCapabilities: 4,
          },
          narrative: {
            headline: 'Trust Plane do Zavorth',
            operatorSummary: 'Resumo unificado de trust.',
          },
        })),
      } as any,
    });
    const url = new URL('http://localhost/api/web/trust-plane');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/trust-plane',
      deps,
    );

    expect(handled).toBe(true);
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        trustPlane: expect.objectContaining({
          summary: expect.objectContaining({
            posture: 'guarded',
            pendingApprovals: 1,
          }),
          narrative: expect.objectContaining({
            headline: 'Trust Plane do Zavorth',
          }),
        }),
      }),
      200,
    );
  });

  it('executes trust-plane actions on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'POST' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const readJsonBody = jest.fn(async () => ({
      actionId: 'set-mcp-profile',
      profile: 'trusted',
    }));
    const trustPlaneActions = {
      execute: jest.fn(() => ({
        generatedAt: '2026-04-12T11:00:00.000Z',
        actionId: 'set-mcp-profile',
        status: 'applied',
        ok: true,
        summary: 'Perfil MCP alterado para trusted.',
        details: ['Allowlist MCP atual: 0 tool(s) explicita(s).'],
        snapshot: {
          summary: {
            posture: 'attention',
            mcpProfile: 'trusted',
          },
        },
      })),
    };
    const deps = createDeps({
      writeJson,
      readJsonBody,
      trustPlane: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            posture: 'attention',
            mcpProfile: 'trusted',
          },
        })),
      } as any,
      trustPlaneActions: trustPlaneActions as any,
    });
    const url = new URL('http://localhost/api/web/trust-plane/actions');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/trust-plane/actions',
      deps,
    );

    expect(handled).toBe(true);
    expect(trustPlaneActions.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'set-mcp-profile',
        profile: 'trusted',
      }),
    );
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        action: expect.objectContaining({
          summary: 'Perfil MCP alterado para trusted.',
        }),
        trustPlane: expect.objectContaining({
          summary: expect.objectContaining({
            mcpProfile: 'trusted',
          }),
        }),
      }),
      200,
    );
  });

  it('exposes operational evals on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const deps = createDeps({
      writeJson,
      evalControlPlane: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-12T12:00:00.000Z',
          summary: {
            posture: 'attention',
            scorecards: 4,
            datasets: 3,
            regressions: 1,
            telemetrySignals: 5,
            operatorCostState: 'moderate',
          },
          narrative: {
            headline: 'Channel mesh com pontos de atencao',
            operatorSummary: 'Maior pressao atual no setup de canais.',
          },
          telemetry: {
            status: 'active',
            traceCount: 3,
          },
          history: {
            entries: 2,
          },
        })),
      } as any,
    });
    const url = new URL('http://localhost/api/web/operations/evals');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/operations/evals',
      deps,
    );

    expect(handled).toBe(true);
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        evals: expect.objectContaining({
          summary: expect.objectContaining({
            posture: 'attention',
            scorecards: 4,
          }),
          narrative: expect.objectContaining({
            headline: 'Channel mesh com pontos de atencao',
          }),
          telemetry: expect.objectContaining({
            status: 'active',
            traceCount: 3,
          }),
          history: expect.objectContaining({
            entries: 2,
          }),
        }),
      }),
      200,
    );
  });

  it('exposes the hub control plane on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const deps = createDeps({
      writeJson,
      hubControlPlane: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-12T15:00:00.000Z',
          summary: {
            posture: 'attention',
            integrations: 4,
            plugins: 3,
            skillsVisible: 5,
            mcpServers: 2,
          },
          narrative: {
            headline: 'Hub + MCP consolidado',
            operatorSummary: 'Um proximo passo claro foi encontrado.',
            nextAction: 'Sincronizar registry remoto',
          },
        })),
      } as any,
    });
    const url = new URL('http://localhost/api/web/hub?q=openrouter');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/hub',
      deps,
    );

    expect(handled).toBe(true);
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        hub: expect.objectContaining({
          summary: expect.objectContaining({
            posture: 'attention',
            integrations: 4,
          }),
          narrative: expect.objectContaining({
            headline: 'Hub + MCP consolidado',
          }),
        }),
      }),
      200,
    );
  });

  it('exposes the ecosystem control plane on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const buildSnapshot = jest.fn(() => ({
      generatedAt: '2026-04-12T16:30:00.000Z',
      summary: {
        posture: 'healthy',
        sdkFilesReady: 8,
        sdkFilesExpected: 8,
        registryEntries: 3,
        collections: 1,
        recipes: 1,
      },
      narrative: {
        headline: 'Ecosystem pronta',
        operatorSummary: 'Ecossistema oficial consolidado.',
        nextAction: 'Revisar o catalogo publico.',
      },
      guides: [
        {
          id: 'client',
          label: 'Guia de client',
          exists: true,
        },
      ],
      publishArtifacts: [],
      actions: [],
    }));
    const deps = createDeps({
      writeJson,
      ecosystemControlPlane: {
        buildSnapshot,
      } as any,
    });
    const url = new URL('http://localhost/api/web/operations/ecosystem?q=openrouter');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/operations/ecosystem',
      deps,
    );

    expect(handled).toBe(true);
    expect(buildSnapshot).toHaveBeenCalledWith({
      selectedId: null,
      query: 'openrouter',
    });
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        ecosystem: expect.objectContaining({
          summary: expect.objectContaining({
            posture: 'healthy',
            registryEntries: 3,
          }),
          narrative: expect.objectContaining({
            headline: 'Ecosystem pronta',
          }),
        }),
      }),
      200,
    );
  });

  it('exposes the distributed runtime control plane on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const buildSnapshot = jest.fn(async () => ({
      generatedAt: '2026-04-12T19:10:00.000Z',
      summary: {
        posture: 'attention',
        readyChannels: 4,
        totalChannels: 8,
        onlineNodes: 2,
        totalNodes: 3,
        readyTransports: 2,
        totalTransports: 4,
        readySurfaces: 3,
        totalSurfaces: 5,
      },
      narrative: {
        headline: 'Distributed runtime pronta',
        operatorSummary: 'Runtime distribuido consolidado.',
        nextAction: 'Fechar o rollout remoto oficial.',
      },
      actions: [],
      advancedChannels: [],
      fleetCapabilities: [],
      surfaces: [],
    }));
    const deps = createDeps({
      writeJson,
      distributedRuntimeControlPlane: {
        buildSnapshot,
      } as any,
    });
    const url = new URL('http://localhost/api/web/operations/distributed-runtime?q=signal');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/operations/distributed-runtime',
      deps,
    );

    expect(handled).toBe(true);
    expect(buildSnapshot).toHaveBeenCalledWith({
      selectedId: null,
      query: 'signal',
    });
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        distributedRuntime: expect.objectContaining({
          summary: expect.objectContaining({
            posture: 'attention',
            readyChannels: 4,
          }),
          narrative: expect.objectContaining({
            headline: 'Distributed runtime pronta',
          }),
        }),
      }),
      200,
    );
  });

  it('exposes the runtime stability control plane on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const buildSnapshot = jest.fn(() => ({
      generatedAt: '2026-04-12T20:20:00.000Z',
      summary: {
        posture: 'attention',
        totalNodes: 2,
        onlineNodes: 1,
        pairedNodes: 2,
        queuedInvocations: 3,
        staleQueued: 1,
        totalTransports: 4,
        readyTransports: 2,
        transportAttention: 2,
        keepaliveActive: true,
        keepaliveStale: false,
        keepaliveReadyProcesses: 2,
        keepaliveTotalProcesses: 3,
        recoverableIssues: 1,
      },
      narrative: {
        headline: 'Fleet e transports supervisionados',
        operatorSummary: 'Runtime com uma pendencia recuperavel.',
        nextAction: 'Rodar keepalive e doctor.',
      },
      cards: [],
      actions: [],
    }));
    const deps = createDeps({
      writeJson,
      runtimeStabilityControlPlane: {
        buildSnapshot,
      } as any,
    });

    const handled = await routeService.handleRequest(
      req,
      res,
      new URL('http://localhost/api/web/operations/runtime-stability'),
      '/api/web/operations/runtime-stability',
      deps,
    );

    expect(handled).toBe(true);
    expect(buildSnapshot).toHaveBeenCalledTimes(1);
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        runtimeStability: expect.objectContaining({
          summary: expect.objectContaining({
            posture: 'attention',
            onlineNodes: 1,
            readyTransports: 2,
          }),
          narrative: expect.objectContaining({
            headline: 'Fleet e transports supervisionados',
          }),
        }),
      }),
      200,
    );
  });

  it('exposes the rollout readiness control plane on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const buildSnapshot = jest.fn(async ({ profile }: { profile?: string | null } = {}) => ({
      generatedAt: '2026-04-12T20:30:00.000Z',
      profile: profile || 'alpha',
      summary: {
        posture: 'healthy',
        releaseReady: true,
        qaPosture: 'healthy',
        distributedPosture: 'healthy',
        maintenanceFresh: true,
        keepaliveActive: true,
        publishEntries: 2,
        publishComparisons: 1,
      },
      narrative: {
        headline: 'Rollout e QA persistentes',
        operatorSummary: 'QA, runtime e maintenance estao verdes.',
        nextAction: 'Executar o rollout oficial.',
      },
      cards: [],
      actions: [],
    }));
    const deps = createDeps({
      writeJson,
      rolloutReadinessControlPlane: {
        buildSnapshot,
      } as any,
    });

    const handled = await routeService.handleRequest(
      req,
      res,
      new URL('http://localhost/api/web/operations/rollout-readiness?profile=beta'),
      '/api/web/operations/rollout-readiness',
      deps,
    );

    expect(handled).toBe(true);
    expect(buildSnapshot).toHaveBeenCalledWith({ profile: 'beta', includeSources: false, refresh: false, scope: null });
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        rolloutReadiness: expect.objectContaining({
          profile: 'beta',
          summary: expect.objectContaining({
            posture: 'healthy',
            releaseReady: true,
          }),
          narrative: expect.objectContaining({
            headline: 'Rollout e QA persistentes',
          }),
        }),
      }),
      200,
    );
  });

});
