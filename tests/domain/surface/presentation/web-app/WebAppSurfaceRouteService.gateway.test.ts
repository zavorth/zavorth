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
        summary: 'Canal web ready.',
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
        summary: 'Canal Telegram ready.',
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

  it('routes canonical channel sends through the gateway channel router', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'POST' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const sendToSession = jest.fn(async () => ({
      ok: true,
      taskId: 'task-discord-1',
      chatId: 'discord:room-1',
      sessionId: 'session-discord-1',
      platform: 'discord',
      snapshot: { sessionId: 'session-discord-1' },
    }));
    const deps = createDeps({
      writeJson,
      readJsonBody: jest.fn(async () => ({
        message: 'continue',
        chatId: 'discord:room-1',
        sourceUserId: 'room-1',
      })),
      gatewayChannelRouter: {
        ...(createDeps().gatewayChannelRouter as any),
        sendToSession,
      },
    });
    const url = new URL('http://localhost/api/web/channels/discord/send');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      `${CHANNEL_MESH_ROUTE_PATHS.collection}/discord/send`,
      deps,
    );

    expect(handled).toBe(true);
    expect(sendToSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'web-user',
        platform: 'discord',
        chatId: 'discord:room-1',
        sourceUserId: 'room-1',
        text: 'continue',
      }),
    );
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          taskId: 'task-discord-1',
        }),
        channel: expect.objectContaining({
          id: 'discord',
        }),
      }),
      200,
    );
  });

  it.each([
    ['telegram', 'telegram:room-1'],
    ['slack', 'slack:room-1'],
    ['whatsapp', 'whatsapp:room-1'],
  ])('routes canonical channel sends for %s through the gateway channel router', async (channelId, chatId) => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'POST' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const sendToSession = jest.fn(async (input: any) => ({
      ok: true,
      taskId: `task-${input.platform}-1`,
      chatId: input.chatId,
      sessionId: `session-${input.platform}-1`,
      platform: input.platform,
      snapshot: { sessionId: `session-${input.platform}-1` },
    }));
    const deps = createDeps({
      writeJson,
      readJsonBody: jest.fn(async () => ({
        message: 'continue',
        chatId,
        sourceUserId: 'room-1',
      })),
      gatewayChannelRouter: {
        ...(createDeps().gatewayChannelRouter as any),
        sendToSession,
      },
    });
    const url = new URL(`http://localhost/api/web/channels/${channelId}/send`);

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      `${CHANNEL_MESH_ROUTE_PATHS.collection}/${channelId}/send`,
      deps,
    );

    expect(handled).toBe(true);
    expect(sendToSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'web-user',
        platform: channelId,
        chatId,
        sourceUserId: 'room-1',
        text: 'continue',
      }),
    );
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          taskId: `task-${channelId}-1`,
        }),
        channel: expect.objectContaining({
          id: channelId,
        }),
      }),
      200,
    );
  });

  it('routes canonical channel spawns through the gateway channel router', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'POST' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const spawnSession = jest.fn(() => ({
      ok: true,
      platform: 'web',
      sessionId: 'session-web-2',
      chatId: 'web:session-web-2',
      sourceUserId: 'session-web-2',
      runtimeUserId: 'web-user',
      handoffCommand: '/open-session session-web-2',
    }));
    const deps = createDeps({
      writeJson,
      gatewayChannelRouter: {
        ...(createDeps().gatewayChannelRouter as any),
        spawnSession,
      },
    });
    const url = new URL('http://localhost/api/web/channels/web/spawn');

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      `${CHANNEL_MESH_ROUTE_PATHS.collection}/web/spawn`,
      deps,
    );

    expect(handled).toBe(true);
    expect(spawnSession).toHaveBeenCalledWith({
      userId: 'web-user',
      platform: 'web',
    });
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          sessionId: 'session-web-2',
        }),
        channel: expect.objectContaining({
          id: 'web',
        }),
      }),
      200,
    );
  });

  it.each(['telegram', 'discord', 'slack', 'whatsapp'])(
    'blocks canonical channel spawns when %s does not support sessions_spawn',
    async (channelId) => {
      const routeService = new WebAppSurfaceRouteService();
      const res = {} as http.ServerResponse;
      const req = { method: 'POST' } as http.IncomingMessage;
      const writeJson = jest.fn();
      const spawnSession = jest.fn();
      const deps = createDeps({
        writeJson,
        gatewayChannelRouter: {
          ...(createDeps().gatewayChannelRouter as any),
          spawnSession,
        },
      });
      const url = new URL(`http://localhost/api/web/channels/${channelId}/spawn`);

      const handled = await routeService.handleRequest(
        req,
        res,
        url,
        `${CHANNEL_MESH_ROUTE_PATHS.collection}/${channelId}/spawn`,
        deps,
      );

      expect(handled).toBe(true);
      expect(spawnSession).not.toHaveBeenCalled();
      expect(writeJson).toHaveBeenCalledWith(
        res,
        expect.objectContaining({
          ok: false,
          error: expect.stringContaining('sessions_spawn'),
        }),
        400,
      );
    },
  );
});
