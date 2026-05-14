import * as http from 'http';
import { CHANNEL_MESH_ROUTE_PATHS } from '../../src/contracts/ChannelMeshContract.js';
import {
  WebAppSurfaceRouteService,
  type WebAppSurfaceRouteDeps,
} from '../../src/services/WebAppSurfaceRouteService.js';

describe('Channel adapter parity', () => {
  const entries = [
    {
      id: 'web',
      label: 'Web',
      readiness: 'ready',
      configured: true,
      transport: 'virtual',
      notes: [],
      features: {
        sessionList: true,
        sessionHistory: true,
        sessionSend: true,
        sessionSpawn: true,
      },
    },
    {
      id: 'telegram',
      label: 'Telegram',
      readiness: 'ready',
      configured: true,
      transport: 'native',
      notes: [],
      features: {
        sessionList: true,
        sessionHistory: true,
        sessionSend: true,
        sessionSpawn: false,
      },
    },
    {
      id: 'discord',
      label: 'Discord',
      readiness: 'partial',
      configured: true,
      transport: 'native',
      notes: [],
      features: {
        sessionList: true,
        sessionHistory: true,
        sessionSend: true,
        sessionSpawn: false,
      },
    },
    {
      id: 'slack',
      label: 'Slack',
      readiness: 'partial',
      configured: true,
      transport: 'local',
      notes: [],
      features: {
        sessionList: true,
        sessionHistory: true,
        sessionSend: true,
        sessionSpawn: false,
      },
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      readiness: 'partial',
      configured: true,
      transport: 'webhook',
      notes: [],
      features: {
        sessionList: true,
        sessionHistory: true,
        sessionSend: true,
        sessionSpawn: false,
      },
    },
    {
      id: 'instagram',
      label: 'Instagram',
      readiness: 'partial',
      configured: true,
      transport: 'webhook',
      notes: [],
      features: {
        sessionList: true,
        sessionHistory: true,
        sessionSend: true,
        sessionSpawn: false,
      },
    },
    {
      id: 'signal',
      label: 'Signal',
      readiness: 'partial',
      configured: true,
      transport: 'bridge',
      notes: [],
      features: {
        sessionList: true,
        sessionHistory: true,
        sessionSend: true,
        sessionSpawn: false,
      },
    },
    {
      id: 'imessage',
      label: 'iMessage',
      readiness: 'partial',
      configured: true,
      transport: 'bridge',
      notes: [],
      features: {
        sessionList: true,
        sessionHistory: true,
        sessionSend: true,
        sessionSpawn: false,
      },
    },
    {
      id: 'teams',
      label: 'Microsoft Teams',
      readiness: 'partial',
      configured: true,
      transport: 'webhook',
      notes: [],
      features: {
        sessionList: true,
        sessionHistory: true,
        sessionSend: true,
        sessionSpawn: false,
      },
    },
    {
      id: 'email',
      label: 'Email',
      readiness: 'partial',
      configured: true,
      transport: 'native',
      notes: [],
      features: {
        sessionList: true,
        sessionHistory: true,
        sessionSend: true,
        sessionSpawn: false,
      },
    },
  ];

  const buildSnapshot = (selectedId: string | null = null) => ({
    generatedAt: '2026-04-09T18:00:00.000Z',
    summary: {
      total: entries.length,
      ready: 2,
      partial: 8,
      planned: 0,
      disabled: 0,
      configured: entries.length,
      sessionSendReady: entries.length,
      attachments: 0,
      groupPolicy: 0,
    },
    entries,
    selected: entries.find((entry) => entry.id === selectedId) || null,
    featuredIds: ['web', 'telegram'],
    narrative: {
      headline: 'Channel Mesh pronta.',
      operatorSummary: 'Todos os adapters canonicos foram carregados.',
    },
  });

  const createDeps = (): WebAppSurfaceRouteDeps => ({
    operatorBrief: null,
    productObservability: null,
    capabilityCatalog: null,
    runtimeGateway: null,
    gateway: null,
    gatewayChannelRegistry: {
      getChannel: jest.fn((id: string) => entries.find((entry) => entry.id === id) || null),
      listChannels: jest.fn(() => entries),
    },
    gatewayChannelRouter: {
      getChannel: jest.fn((id: string) => entries.find((entry) => entry.id === id) || null),
      sendToSession: jest.fn(async (input: any) => ({
        ok: true,
        taskId: `task-${input.platform}-1`,
        chatId: input.chatId || `${input.platform}:room-1`,
        sessionId: `session-${input.platform}-1`,
        platform: input.platform,
        snapshot: { sessionId: `session-${input.platform}-1` },
      })),
      spawnSession: jest.fn((input: any) => ({
        ok: true,
        platform: input.platform,
        sessionId: `session-${input.platform}-1`,
        chatId: `${input.platform}:session-1`,
        sourceUserId: `session-${input.platform}-1`,
        runtimeUserId: 'web-user',
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
        buildSnapshot(selectedId || null),
      ),
    },
    channelActions: null,
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
    teamCatalog: null,
    tenantGovernance: null,
    writeJson: jest.fn(),
    readJsonBody: jest.fn(async () => ({
      message: 'continuar',
      chatId: 'room-1',
      sourceUserId: 'room-1',
    })),
    codexRemoteProfiles: null,
    codexRemoteActionExecutor: null,
  });

  it.each(entries.map((entry) => entry.id))(
    'supports canonical send for %s when sessionSend is enabled',
    async (channelId) => {
      const routeService = new WebAppSurfaceRouteService();
      const res = {} as http.ServerResponse;
      const req = { method: 'POST' } as http.IncomingMessage;
      const deps = createDeps();
      const writeJson = deps.writeJson as jest.Mock;

      const handled = await routeService.handleRequest(
        req,
        res,
        new URL(`http://localhost/api/web/channels/${channelId}/send`),
        `${CHANNEL_MESH_ROUTE_PATHS.collection}/${channelId}/send`,
        deps,
      );

      expect(handled).toBe(true);
      expect((deps.gatewayChannelRouter as any).sendToSession).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: channelId,
          userId: 'web-user',
        }),
      );
      expect(writeJson).toHaveBeenCalledWith(
        res,
        expect.objectContaining({
          ok: true,
          channel: expect.objectContaining({ id: channelId }),
        }),
        200,
      );
    },
  );

  it.each(entries.map((entry) => [entry.id, Boolean(entry.features.sessionSpawn)]))(
    'applies canonical spawn contract for %s',
    async (channelId, canSpawn) => {
      const routeService = new WebAppSurfaceRouteService();
      const res = {} as http.ServerResponse;
      const req = { method: 'POST' } as http.IncomingMessage;
      const deps = createDeps();
      const writeJson = deps.writeJson as jest.Mock;

      const handled = await routeService.handleRequest(
        req,
        res,
        new URL(`http://localhost/api/web/channels/${channelId}/spawn`),
        `${CHANNEL_MESH_ROUTE_PATHS.collection}/${channelId}/spawn`,
        deps,
      );

      expect(handled).toBe(true);
      if (canSpawn) {
        expect((deps.gatewayChannelRouter as any).spawnSession).toHaveBeenCalledWith({
          userId: 'web-user',
          platform: channelId,
        });
        expect(writeJson).toHaveBeenCalledWith(
          res,
          expect.objectContaining({
            ok: true,
            channel: expect.objectContaining({ id: channelId }),
          }),
          200,
        );
      } else {
        expect((deps.gatewayChannelRouter as any).spawnSession).not.toHaveBeenCalled();
        expect(writeJson).toHaveBeenCalledWith(
          res,
          expect.objectContaining({
            ok: false,
            error: expect.stringContaining('sessions_spawn'),
          }),
          400,
        );
      }
    },
  );
});
