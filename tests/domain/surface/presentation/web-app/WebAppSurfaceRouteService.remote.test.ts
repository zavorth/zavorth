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

  it('exposes the MCP runtime control plane on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const deps = createDeps({
      writeJson,
      mcpCapabilityControlPlane: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-11T03:00:00.000Z',
          summary: {
            total: 2,
            enabled: 2,
            connected: 1,
            failed: 1,
            disabled: 0,
            stopped: 0,
            toolCount: 4,
            capabilityCount: 2,
          },
          entries: [
            {
              id: 'filesystem',
              capability: 'filesystem',
              enabled: true,
              status: 'connected',
              toolCount: 2,
            },
          ],
          recommendations: ['MCP connected com uma failure residual.'],
        })),
      } as any,
      mcpRuntime: {
        readSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-11T03:00:00.000Z',
          entries: [
            {
              id: 'filesystem',
              status: 'connected',
              toolCount: 2,
              toolNames: ['mcp_filesystem_read', 'mcp_filesystem_write'],
            },
          ],
        })),
        reloadServer: jest.fn(),
        stopServer: jest.fn(),
      } as any,
    });
    const url = new URL('http://localhost/api/web/mcp/runtime');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/mcp/runtime',
      deps,
    );

    expect(handled).toBe(true);
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        mcp: expect.objectContaining({
          summary: expect.objectContaining({
            connected: 1,
          }),
        }),
        runtime: expect.objectContaining({
          entries: expect.any(Array),
        }),
      }),
      200,
    );
  });

  it('runs the MCP browser doctor on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const deps = createDeps({
      writeJson,
      mcpBrowserDoctor: {
        run: jest.fn(async () => ({
          checkedAt: '2026-04-11T03:30:00.000Z',
          ok: true,
          moduleName: 'playwright-core',
          moduleAvailable: true,
          launchable: true,
          error: null,
          recommendations: ['Stack ready.'],
        })),
      } as any,
    });
    const url = new URL('http://localhost/api/web/mcp/browser/doctor');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/mcp/browser/doctor',
      deps,
    );

    expect(handled).toBe(true);
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        doctor: expect.objectContaining({
          moduleName: 'playwright-core',
          launchable: true,
        }),
      }),
      200,
    );
  });

  it('routes MCP runtime actions through the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'POST' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const reloadServer = jest.fn(async () => ({
      ok: true,
      toolCount: 2,
      toolNames: ['mcp_filesystem_read', 'mcp_filesystem_write'],
      error: null,
    }));
    const deps = createDeps({
      writeJson,
      readJsonBody: jest.fn(async () => ({
        actionId: 'reload-server',
        serverId: 'filesystem',
      })),
      mcpCapabilityControlPlane: {
        buildSnapshot: jest.fn(() => ({
          entries: [
            {
              id: 'filesystem',
              status: 'connected',
            },
          ],
        })),
      } as any,
      mcpRuntime: {
        readSnapshot: jest.fn(() => ({
          entries: [
            {
              id: 'filesystem',
              status: 'connected',
              toolCount: 2,
            },
          ],
        })),
        reloadServer,
        stopServer: jest.fn(),
      } as any,
    });
    const url = new URL('http://localhost/api/web/mcp/runtime/actions');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/mcp/runtime/actions',
      deps,
    );

    expect(handled).toBe(true);
    expect(reloadServer).toHaveBeenCalledWith('filesystem');
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        action: expect.objectContaining({
          actionId: 'reload-server',
          serverId: 'filesystem',
        }),
        runtime: expect.objectContaining({
          entries: expect.any(Array),
        }),
      }),
      200,
    );
  });

  it('returns MCP runtime server detail on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const deps = createDeps({
      writeJson,
      mcpCapabilityControlPlane: {
        buildSnapshot: jest.fn(() => ({
          entries: [
            {
              id: 'filesystem',
              capability: 'filesystem',
              status: 'connected',
              toolCount: 2,
            },
          ],
        })),
      } as any,
      mcpRuntime: {
        readSnapshot: jest.fn(() => ({
          entries: [
            {
              id: 'filesystem',
              status: 'connected',
              toolNames: ['mcp_filesystem_read', 'mcp_filesystem_write'],
            },
          ],
        })),
        reloadServer: jest.fn(),
        stopServer: jest.fn(),
      } as any,
    });
    const url = new URL('http://localhost/api/web/mcp/runtime/servers/filesystem');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/mcp/runtime/servers/filesystem',
      deps,
    );

    expect(handled).toBe(true);
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        server: expect.objectContaining({
          id: 'filesystem',
        }),
        runtimeEntry: expect.objectContaining({
          toolNames: expect.arrayContaining(['mcp_filesystem_read']),
        }),
      }),
      200,
    );
  });

  it('executes Codex Remote actions on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'POST' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const execute = jest.fn(async () => ({
      action: {
        status: 'completed',
        actionId: 'select-profile',
        label: 'Selecionar profile',
        note: 'Perfil alterado.',
        targetPanel: 'codex-remote',
        selectedProfileId: 'paid-alt',
      },
      codexRemote: {
        activeProfile: {
          id: 'paid-alt',
        },
      },
      profile: {
        id: 'paid-alt',
      },
      spawnedSession: null,
    }));
    const deps = createDeps({
      writeJson,
      readJsonBody: jest.fn(async () => ({
        actionId: 'select-profile',
        profileId: 'paid-alt',
      })),
      codexRemoteActions: {
        execute,
      } as any,
    });
    const url = new URL('http://localhost/api/web/codex-remote/actions');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/codex-remote/actions',
      deps,
    );

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'select-profile',
        profileId: 'paid-alt',
        runtimeUserId: 'web-user',
        sessionSpawner: deps.gatewayChannelRouter,
      }),
    );
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        action: expect.objectContaining({
          actionId: 'select-profile',
          selectedProfileId: 'paid-alt',
        }),
      }),
      200,
    );
  });

  it('lists Codex Remote sessions on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const deps = createDeps({
      writeJson,
      codexRemote: {
        buildSnapshot: jest.fn(async () => ({
          sessionBroker: {
            summary: { totalSessions: 1 },
            sessions: [
              {
                sessionId: 'codex-1',
                title: 'Session 1',
                status: 'running',
              },
            ],
          },
        })),
      } as any,
    });
    const url = new URL('http://localhost/api/web/codex-remote/sessions');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/codex-remote/sessions',
      deps,
    );

    expect(handled).toBe(true);
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        sessions: [expect.objectContaining({ sessionId: 'codex-1' })],
      }),
      200,
    );
  });

  it('returns Codex Remote session detail on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const deps = createDeps({
      writeJson,
      codexRemote: {
        buildSnapshot: jest.fn(async () => ({
          sessionBroker: {
            selected: {
              record: {
                sessionId: 'codex-1',
                title: 'Session 1',
              },
            },
          },
        })),
      } as any,
    });
    const url = new URL('http://localhost/api/web/codex-remote/sessions/codex-1');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/codex-remote/sessions/codex-1',
      deps,
    );

    expect(handled).toBe(true);
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        session: expect.objectContaining({
          record: expect.objectContaining({
            sessionId: 'codex-1',
          }),
        }),
      }),
      200,
    );
  });

  it('returns the Codex Remote control plane snapshot', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const buildSnapshot = jest.fn(async () => ({
      summary: {
        cliReady: true,
        activeProfileId: 'default',
      },
      handoff: {
        webSessionReady: true,
      },
    }));
    const deps = createDeps({
      writeJson,
      codexRemote: {
        buildSnapshot,
      },
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
    expect(buildSnapshot).toHaveBeenCalledWith({
      runtimeUserId: 'web-user',
    });
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        codexRemote: expect.objectContaining({
          summary: expect.objectContaining({
            cliReady: true,
          }),
        }),
      }),
      200,
    );
  });

  it('executes Hub + MCP canonical actions on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'POST' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const execute = jest.fn(async () => ({
      generatedAt: '2026-04-12T20:00:00.000Z',
      actionId: 'platform-sync',
      status: 'completed',
      ok: true,
      summary: 'Remote registry sincronizado pelo Hub.',
      details: ['Sync ok.'],
      action: {
        id: 'platform-sync',
        label: 'Sincronizar registry remoto',
        surface: 'platform',
        kind: 'sync',
        rationale: 'Sync ok.',
        command: '/hub run platform-sync',
      },
      hub: {
        generatedAt: '2026-04-12T20:00:01.000Z',
        summary: {
          posture: 'healthy',
          recommendedActions: 1,
        },
        narrative: {
          nextAction: 'Abrir um conector ready.',
        },
      },
      result: { ok: true },
    }));
    const deps = createDeps({
      writeJson,
      readJsonBody: jest.fn(async () => ({
        actionId: 'platform-sync',
      })),
      hubControlPlane: {
        buildSnapshot: jest.fn(() => ({
          summary: { posture: 'healthy' },
        })),
      } as any,
      hubActions: {
        execute,
      } as any,
    });
    const url = new URL('http://localhost/api/web/hub/actions');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/hub/actions',
      deps,
    );

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledWith({
      actionId: 'platform-sync',
      requestedBy: 'web-user',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      selectedId: null,
      query: null,
      recommendFor: null,
    });
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        action: expect.objectContaining({
          actionId: 'platform-sync',
          summary: 'Remote registry sincronizado pelo Hub.',
        }),
        hub: expect.objectContaining({
          narrative: expect.objectContaining({
            nextAction: 'Abrir um conector ready.',
          }),
        }),
      }),
      200,
    );
  });

  it('routes Codex Remote actions through the action service', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'POST' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const execute = jest.fn(async () => ({
      action: {
        actionId: 'select-profile',
        status: 'completed',
      },
      codexRemote: {
        summary: {
          activeProfileId: 'work',
        },
      },
      profile: {
        id: 'work',
        label: 'Work Codex',
      },
      spawnedSession: null,
    }));
    const deps = createDeps({
      writeJson,
      readJsonBody: jest.fn(async () => ({
        actionId: 'select-profile',
        profileId: 'work',
      })),
      codexRemoteActions: {
        execute,
      },
    });
    const url = new URL('http://localhost/api/web/codex-remote/actions');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/codex-remote/actions',
      deps,
    );

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'select-profile',
        profileId: 'work',
        runtimeUserId: 'web-user',
      }),
    );
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        action: expect.objectContaining({
          actionId: 'select-profile',
        }),
      }),
      200,
    );
  });

  it('passes Codex Remote profile management payloads through the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'POST' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const execute = jest.fn(async () => ({
      action: {
        status: 'pending-approval',
        actionId: 'create-profile',
        permissionId: 'perm-1',
      },
    }));
    const deps = createDeps({
      writeJson,
      readJsonBody: jest.fn(async () => ({
        actionId: 'create-profile',
        profileId: 'work',
        profileLabel: 'Work Codex',
        codexHome: 'C:\\Users\\ermys\\.codex-work',
        workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      })),
      codexRemoteActions: {
        execute,
      } as any,
    });
    const url = new URL('http://localhost/api/web/codex-remote/actions');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/codex-remote/actions',
      deps,
    );

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'create-profile',
        profileId: 'work',
        profileLabel: 'Work Codex',
        codexHome: 'C:\\Users\\ermys\\.codex-work',
        workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
        requireApproval: true,
      }),
    );
  });

});
