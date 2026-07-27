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
        summary: 'Channel web ready.',
        operatorSummary: 'Sessions ready.',
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
        summary: 'Channel Telegram ready.',
        operatorSummary: 'Gateway active.',
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
        notes: ['Bridge in rollout.'],
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
        summary: 'Channel Discord parcial.',
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
        summary: 'Channel Slack parcial.',
        operatorSummary: 'Workspace connected.',
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
        notes: ['Cloud API in rollout.'],
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
        summary: 'Channel WhatsApp parcial.',
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
        headline: 'Channel Mesh ready.',
        operatorSummary: 'Operational channels available.',
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
      buildSnapshot: jest.fn(({ selectedId }: { selectedId-: string | null } = {}) =>
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
            summary: 'Telegram ready for bot token and allowlist.',
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
            summary: 'WhatsApp can be promoted to Cloud API.',
            webhookPath: '/api/webhooks/whatsapp',
            localWebhookUrl: 'http://127.0.0.1:33333/api/webhooks/whatsapp',
            publicWebhookUrl: null,
            requiredEnvKeys: ['WHATSAPP_ACCESS_TOKEN'],
            missingEnvKeys: ['WHATSAPP_ACCESS_TOKEN'],
            scaffoldEntries: [],
            notes: ['Promote to cloud-api when credentials are available.'],
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

  it('exposes the natural setup control plane on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const buildSnapshot = jest.fn(async (input: any = {}) => ({
      generatedAt: '2026-04-12T20:40:00.000Z',
      selectedChannelId: input.channelId || 'discord',
      intentText: input.intentText || 'Quero conectar ao Discord',
      summary: {
        posture: 'attention',
        status: 'needs_scaffold',
        selectedReady: false,
        missingEnvKeys: 2,
        promotionReady: false,
        optionCount: 3,
      },
      narrative: {
        headline: 'Natural setup: Natural Setup Agent',
        operatorSummary: 'Two keys are missing to complete Discord.',
        nextAction: 'Preencher o token e rodar o doctor.',
      },
      actions: [],
      examples: [],
    }));
    const deps = createDeps({
      writeJson,
      naturalSetupControlPlane: {
        buildSnapshot,
      } as any,
    });

    const handled = await routeService.handleRequest(
      req,
      res,
      new URL('http://localhost/api/web/operations/natural-setup-channelId=discord&text=Quero%20conectar%20ao%20Discord&apply=true&doctor=true&test=true&localOnly=true'),
      '/api/web/operations/natural-setup',
      deps,
    );

    expect(handled).toBe(true);
    expect(buildSnapshot).toHaveBeenCalledWith({
      channelId: 'discord',
      mode: null,
      intentText: 'Quero conectar ao Discord',
      autoApply: true,
      autoDoctor: true,
      autoTest: true,
      localOnly: true,
    });
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        naturalSetup: expect.objectContaining({
          selectedChannelId: 'discord',
          summary: expect.objectContaining({
            posture: 'attention',
            missingEnvKeys: 2,
          }),
          narrative: expect.objectContaining({
            headline: 'Natural setup: Natural Setup Agent',
          }),
        }),
      }),
      200,
    );
  });

  it('exposes the automation control plane on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const buildSnapshot = jest.fn(async ({ query, limit }: { query-: string | null; limit-: number } = {}) => ({
      generatedAt: '2026-04-12T20:44:00.000Z',
      summary: {
        posture: 'attention',
        totalTasks: 2,
        activeTasks: 1,
        pausedTasks: 1,
        maintenanceEnabled: true,
        deliveries: 3,
      },
      narrative: {
        headline: 'Scheduled runs: Automations e scheduled runs',
        operatorSummary: 'Uma automaction segue ativa e uma pausa needs de review.',
        nextAction: 'Review the daily routine before the next send.',
      },
      tasks: [],
      deliveries: [],
      actions: [],
      query,
      limit,
    }));
    const deps = createDeps({
      writeJson,
      automationControlPlane: {
        buildSnapshot,
      } as any,
    });

    const handled = await routeService.handleRequest(
      req,
      res,
      new URL('http://localhost/api/web/operations/automations-q=discord&limit=6'),
      '/api/web/operations/automations',
      deps,
    );

    expect(handled).toBe(true);
    expect(buildSnapshot).toHaveBeenCalledWith({
      query: 'discord',
      limit: 6,
    });
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        automations: expect.objectContaining({
          summary: expect.objectContaining({
            posture: 'attention',
            totalTasks: 2,
          }),
          narrative: expect.objectContaining({
            headline: 'Scheduled runs: Automations e scheduled runs',
          }),
        }),
      }),
      200,
    );
  });

  it('routes automation actions through the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'POST' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const execute = jest.fn(async () => ({
      ok: true,
      actionId: 'create',
      summary: 'Automation created with in-app delivery.',
      details: ['Daily routine registered.'],
      snapshot: {
        summary: {
          posture: 'healthy',
          totalTasks: 1,
        },
        narrative: {
          operatorSummary: 'One automation ready to continue.',
          nextAction: 'Wait for the first run.',
        },
      },
    }));
    const deps = createDeps({
      writeJson,
      readJsonBody: jest.fn(async () => ({
        actionId: 'create',
        intentText: 'check my channels in the app at the requested cadence',
      })),
      automationControlPlane: {
        buildSnapshot: jest.fn(async () => ({
          summary: { posture: 'healthy' },
        })),
      } as any,
      automationActions: {
        execute,
      } as any,
    });

    const handled = await routeService.handleRequest(
      req,
      res,
      new URL('http://localhost/api/web/automations/actions'),
      '/api/web/automations/actions',
      deps,
    );

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledWith({
      actionId: 'create',
      intentText: 'check my channels in the app at the requested cadence',
      taskId: null,
      requestedBy: 'web-user',
      sourceSurface: 'app',
    });
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        action: expect.objectContaining({
          actionId: 'create',
          summary: 'Automation created with in-app delivery.',
        }),
        automations: expect.objectContaining({
          summary: expect.objectContaining({
            posture: 'healthy',
          }),
        }),
      }),
      200,
    );
  });

  it('exposes the watch mode control plane on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const buildSnapshot = jest.fn(({ limit }: { limit-: number } = {}) => ({
      generatedAt: '2026-04-12T20:45:00.000Z',
      summary: {
        posture: 'attention',
        totalRuns: 1,
        activeStatus: 'waiting_approval',
        pendingApprovals: 1,
        strictApprovalDefault: true,
        allowedApps: 1,
        allowedSites: 1,
      },
      narrative: {
        headline: 'Watch mode: Watch Mode supervisionado',
        operatorSummary: 'Chrome waiting for approval.',
        nextAction: 'Decidir o handoff visual.',
      },
      cards: [],
      actions: [],
      watchMode: {
        summary: {
          totalRuns: 1,
          pendingApprovals: 1,
          lastStatus: 'waiting_approval',
        },
      },
      limit,
    }));
    const deps = createDeps({
      writeJson,
      watchModeControlPlane: {
        buildSnapshot,
      } as any,
    });

    const handled = await routeService.handleRequest(
      req,
      res,
      new URL('http://localhost/api/web/operations/watch-mode-limit=9'),
      '/api/web/operations/watch-mode',
      deps,
    );

    expect(handled).toBe(true);
    expect(buildSnapshot).toHaveBeenCalledWith({ limit: 9 });
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        watchMode: expect.objectContaining({
          summary: expect.objectContaining({
            posture: 'attention',
            pendingApprovals: 1,
          }),
          narrative: expect.objectContaining({
            headline: 'Watch mode: Watch Mode supervisionado',
          }),
        }),
      }),
      200,
    );
  });

  it('exposes the QA control plane on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const deps = createDeps({
      writeJson,
      qaControlPlane: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-12T16:00:00.000Z',
          profile: 'alpha',
          summary: {
            posture: 'healthy',
            checks: 5,
            healthy: 5,
            attention: 0,
            critical: 0,
            missing: 0,
            stale: 0,
            releaseReady: true,
          },
          narrative: {
            headline: 'QA release ready',
            operatorSummary: 'Todos os gates principais ficaram verdes.',
            nextAction: 'Rodar release alpha.',
          },
        })),
      } as any,
    });
    const url = new URL('http://localhost/api/web/operations/qa-profile=beta');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/operations/qa',
      deps,
    );

    expect(handled).toBe(true);
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        qa: expect.objectContaining({
          profile: 'alpha',
          summary: expect.objectContaining({
            posture: 'healthy',
            releaseReady: true,
          }),
          narrative: expect.objectContaining({
            headline: 'QA release ready',
          }),
        }),
      }),
      200,
    );
  });

  it('exposes the governance control plane on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const buildSnapshot = jest.fn(({ limit }: { limit-: number | null } = {}) => ({
      generatedAt: '2026-04-12T17:00:00.000Z',
      summary: {
        posture: 'attention',
        tenants: 2,
        sharedTenants: 1,
        personalTenants: 1,
        pendingOnboarding: 1,
        restrictedShared: 0,
        publicServers: 1,
        decisions: 1,
        limit,
      },
      narrative: {
        headline: 'Governance ready',
        operatorSummary: 'Governance consolidada.',
        nextAction: 'Revisar onboarding pendente.',
      },
    }));
    const deps = createDeps({
      writeJson,
      governanceControlPlane: {
        buildSnapshot,
      } as any,
    });
    const url = new URL('http://localhost/api/web/operations/governance-limit=12');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/operations/governance',
      deps,
    );

    expect(handled).toBe(true);
    expect(buildSnapshot).toHaveBeenCalledWith({ limit: 12 });
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        governance: expect.objectContaining({
          generatedAt: '2026-04-12T17:00:00.000Z',
          summary: expect.objectContaining({
            posture: 'attention',
            tenants: 2,
          }),
          narrative: expect.objectContaining({
            headline: 'Governance ready',
          }),
        }),
      }),
      200,
    );
  });

  it('exposes the replay learning control plane on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const buildSnapshot = jest.fn(async () => ({
      generatedAt: '2026-04-12T18:00:00.000Z',
      summary: {
        posture: 'healthy',
        timelineEvents: 3,
        recentArtifacts: 2,
        reusableArtifacts: 1,
        pendingLearning: 0,
      },
      narrative: {
        headline: 'Replay learning ready',
        operatorSummary: 'Replay e learning consolidados.',
        nextAction: 'Comparar runs recentes.',
      },
    }));
    const deps = createDeps({
      writeJson,
      realtime: { getChatId: jest.fn(() => 'web:session-web-1') } as any,
      replayLearningControlPlane: {
        buildSnapshot,
      } as any,
    });
    const url = new URL('http://localhost/api/web/operations/replay-learning-limit=12');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/operations/replay-learning',
      deps,
    );

    expect(handled).toBe(true);
    expect(buildSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-web-1',
      userId: 'web-user',
      platform: 'web',
      chatId: 'web:session-web-1',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      limit: 12,
    }));
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        replayLearning: expect.objectContaining({
          generatedAt: '2026-04-12T18:00:00.000Z',
          summary: expect.objectContaining({
            posture: 'healthy',
            timelineEvents: 3,
          }),
          narrative: expect.objectContaining({
            headline: 'Replay learning ready',
          }),
        }),
      }),
      200,
    );
  });

  it('applies a channel scaffold through the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'POST' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const channelInstall = {
      buildReport: jest.fn(() => ({ channels: [] })),
      applyScaffold: jest.fn((input: any) => ({
        generatedAt: '2026-04-09T12:01:00.000Z',
        channelId: input.channelId,
        mode: input.mode,
        env: {
          filePath: 'C:\\TESTES DEV\\zavorth-core\\Zavorth\\.env',
          writtenKeys: ['SLACK_TRANSPORT'],
          preservedKeys: [],
        },
        directoriesCreated: [],
        report: { channels: [] },
        nextSteps: ['Rode npm run test:channels:smoke.'],
      })),
    };
    const deps = createDeps({
      writeJson,
      channelInstall: channelInstall as any,
      readJsonBody: jest.fn(async () => ({
        channelId: 'slack',
        mode: 'native',
      })),
    });
    const url = new URL('http://localhost/api/web/channels/install/apply');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/channels/install/apply',
      deps,
    );

    expect(handled).toBe(true);
    expect(channelInstall.applyScaffold).toHaveBeenCalledWith({
      channelId: 'slack',
      mode: 'native',
      extraEntries: [],
    });
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        applyReport: expect.objectContaining({
          channelId: 'slack',
          mode: 'native',
        }),
        channels: expect.objectContaining({
          selected: expect.objectContaining({
            id: 'slack',
          }),
        }),
      }),
      200,
    );
  });

  it('runs the channel doctor through the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'POST' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const channelProviderDoctor = {
      run: jest.fn(async () => ({
        checkedAt: '2026-04-09T12:02:00.000Z',
        status: 'passed',
        summary: 'Doctor dos canais validou o runtime atual.',
        command: 'npm run test:channels:smoke',
        items: [],
      })),
    };
    const deps = createDeps({
      writeJson,
      channelProviderDoctor: channelProviderDoctor as any,
      readJsonBody: jest.fn(async () => ({
        selectedId: 'telegram',
      })),
    });
    const url = new URL('http://localhost/api/web/channels/doctor');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/channels/doctor',
      deps,
    );

    expect(handled).toBe(true);
    expect(channelProviderDoctor.run).toHaveBeenCalledWith({
      localOnly: false,
    });
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        doctor: expect.objectContaining({
          status: 'passed',
        }),
        channels: expect.objectContaining({
          selected: expect.objectContaining({
            id: 'telegram',
          }),
        }),
      }),
      200,
    );
  });

  it('exposes Codex Remote on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const deps = createDeps({
      writeJson,
      codexRemote: {
        buildSnapshot: jest.fn(async () => ({
          generatedAt: '2026-04-07T13:30:00.000Z',
          summary: {
            cliReady: true,
            activeProfileId: 'default',
            profiles: 2,
            enabledProfiles: 2,
            readyRemotePaths: 1,
            partialRemotePaths: 1,
            webSpawnReady: true,
          },
          activeProfile: {
            id: 'default',
            label: 'Default Codex',
          },
          handoff: {
            recommendedSurface: 'web',
            webSessionReady: true,
          },
          sessionBroker: {
            sessions: [],
            summary: {
              totalSessions: 0,
            },
          },
        })),
      } as any,
    });
    const url = new URL('http://localhost/api/web/codex-remote');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/codex-remote',
      deps,
    );

    expect(handled).toBe(true);
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        codexRemote: expect.objectContaining({
          summary: expect.objectContaining({
            cliReady: true,
            profiles: 2,
          }),
          activeProfile: expect.objectContaining({
            id: 'default',
          }),
        }),
      }),
      200,
    );
  });

});
