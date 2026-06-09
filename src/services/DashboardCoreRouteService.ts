import * as http from 'http';
import { NodeMeshTransportRouteService } from './NodeMeshTransportRouteService.js';
import { OperationalMaturityService } from '../domain/platform-ecosystem/application/OperationalMaturityService.js';
import {
  SalesPackMvpService,
} from '../domain/platform-ecosystem/application/sales-pack/index.js';
import { SalesPackBusinessModeService } from './SalesPackBusinessModeService.js';
import { SalesPackChannelIoService } from './SalesPackChannelIoService.js';
import type {
  DashboardAuthenticatedIdentity,
  DashboardAuthService,
} from './DashboardAuthService.js';
import type {
  SalesPackInboundMessageInput,
} from '../contracts/SalesPackContract.js';
import type { SalesPackChannelIoEnvelope } from '../contracts/SalesPackChannelIoContract.js';
import type { ExperienceCommand, ExperienceSurface } from './experience/ExperienceContracts.js';
import { ExperienceCoreService } from './experience/ExperienceCoreService.js';
import { globalLiveNodeRegistry } from './LiveNodeRegistryService.js';
import { ZavorthMemoryEncryptionStatusService, type ZavorthMemoryEncryptionMode } from './ZavorthMemoryEncryptionStatusService.js';
import { TrustedDeviceAccessService } from './TrustedDeviceAccessService.js';
import { TrustedDeviceAccessRouteService } from './TrustedDeviceAccessRouteService.js';

type WriteJson = (res: http.ServerResponse, body: unknown, statusCode?: number) => void;
type WriteText = (res: http.ServerResponse, body: string, statusCode?: number) => void;
type WriteRedirect = (res: http.ServerResponse, location: string, statusCode?: number) => void;
type ReadJsonBody = (req: http.IncomingMessage) => Promise<Record<string, any>>;
type ReadRawBody = (req: http.IncomingMessage) => Promise<string>;

type NodeMeshLike = {
  buildSnapshot: (input?: any) => any;
};

type NodeHeartbeatLike = {
  claimPairing: (input: any) => any;
  receiveHeartbeat: (input: any) => any;
};

export type SlackWebhookGatewayLike = {
  handleWebhookEvent: (input: {
    headers: http.IncomingHttpHeaders;
    rawBody: string;
    body: Record<string, unknown>;
  }) => Promise<{
    statusCode: number;
    body: unknown;
  }>;
};

export type TeamsWebhookGatewayLike = {
  handleWebhookEvent: (input: {
    headers: http.IncomingHttpHeaders;
    rawBody: string;
    body: Record<string, unknown>;
  }) => Promise<{
    statusCode: number;
    body: unknown;
  }>;
};

export type WhatsAppWebhookGatewayLike = {
  handleWebhookVerification: (url: URL) => {
    statusCode: number;
    textBody: string;
  };
  handleWebhookEvent: (input: {
    body: Record<string, unknown>;
  }) => Promise<{
    statusCode: number;
    body: unknown;
  }>;
};

export type InstagramWebhookGatewayLike = {
  handleWebhookVerification: (url: URL) => {
    statusCode: number;
    textBody: string;
  };
  handleWebhookEvent: (input: {
    body: Record<string, unknown>;
  }) => Promise<{
    statusCode: number;
    body: unknown;
  }>;
};

export type DashboardCoreRouteDeps = {
  nodeHeartbeat: NodeHeartbeatLike;
  nodeMesh: NodeMeshLike;
  readJsonBody: ReadJsonBody;
  readRawBody: ReadRawBody;
  writeJson: WriteJson;
  writeText: WriteText;
  writeRedirect: WriteRedirect;
  a2ui: any;
  proactivePermissions: any;
  experienceCore?: Pick<ExperienceCoreService, 'buildHome' | 'executeCommand' | 'buildTimelineForRun' | 'dispatchRuntimeStateAction'> | null;
  authService?: Pick<DashboardAuthService, 'validate' | 'resolveAuthenticatedIdentity'>;
  echo?: {
    getPendingPermissions: () => unknown[];
    resolvePermission: (id: string, approved: boolean, resolvedBy?: Record<string, unknown>) => Promise<any>;
  };
  slackIngressGateway?: SlackWebhookGatewayLike | null;
  teamsIngressGateway?: TeamsWebhookGatewayLike | null;
  whatsappIngressGateway?: WhatsAppWebhookGatewayLike | null;
  instagramIngressGateway?: InstagramWebhookGatewayLike | null;
};

export type DashboardCoreRouteServiceOptions = {
  operationalMaturity?: OperationalMaturityService;
  salesPack?: SalesPackMvpService;
  salesPackBusinessMode?: SalesPackBusinessModeService;
  salesPackChannelIo?: SalesPackChannelIoService;
  localAccess?: TrustedDeviceAccessService;
};

type SalesPackBusinessModeIdentity = {
  userId: string | null;
  profileId: string | null;
};

export class DashboardCoreRouteService {
  private readonly transportRoutes = new NodeMeshTransportRouteService();
  private readonly operationalMaturity: OperationalMaturityService;
  private readonly salesPack: SalesPackMvpService;
  private readonly salesPackBusinessMode: SalesPackBusinessModeService;
  private readonly salesPackChannelIo: SalesPackChannelIoService;
  private readonly localAccessRoutes: TrustedDeviceAccessRouteService;

  public constructor(options: DashboardCoreRouteServiceOptions = {}) {
    this.operationalMaturity = options.operationalMaturity || new OperationalMaturityService();
    this.salesPack = options.salesPack || new SalesPackMvpService();
    this.salesPackBusinessMode = options.salesPackBusinessMode || new SalesPackBusinessModeService();
    this.salesPackChannelIo = options.salesPackChannelIo || new SalesPackChannelIoService({
      salesPack: this.salesPack,
    });
    this.localAccessRoutes = new TrustedDeviceAccessRouteService(
      options.localAccess || new TrustedDeviceAccessService(),
      'dashboard-token',
    );
  }

  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    pathname: string,
    deps: DashboardCoreRouteDeps,
  ): Promise<boolean> {
    if (pathname === '/') {
      deps.writeRedirect(res, '/dashboard');
      return true;
    }

    if (pathname.startsWith('/api/v2/local-access')) {
      return this.localAccessRoutes.handleRequest(req, res, pathname, deps);
    }

    if (pathname.startsWith('/api/experience')) {
      return this.handleExperienceRequest(req, res, url, pathname, deps);
    }

    if (pathname === '/api/v2/maturity/snapshot' && req.method === 'GET') {
      deps.writeJson(res, {
        ok: true,
        data: this.operationalMaturity.buildSnapshot(),
      });
      return true;
    }

    if (pathname === '/api/v2/sales-pack/snapshot' && req.method === 'GET') {
      deps.writeJson(res, {
        ok: true,
        data: this.salesPack.buildSnapshot(),
      });
      return true;
    }

    if (pathname === '/api/v2/sales-pack/business-mode' && req.method === 'GET') {
      const identity = this.readBusinessModeIdentity(req, url, {}, deps);
      if (!identity.authorized) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      deps.writeJson(res, {
        ok: true,
        data: this.salesPackBusinessMode.readSnapshot(identity),
      });
      return true;
    }

    if (pathname === '/api/v2/sales-pack/business-mode' && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      const identity = this.readBusinessModeIdentity(req, url, body, deps);
      if (!identity.authorized) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      const enabled = this.parseBoolean(body.enabled);
      if (enabled === null) {
        deps.writeJson(res, {
          ok: false,
          error: 'Campo "enabled" precisa ser booleano.',
        }, 400);
        return true;
      }
      deps.writeJson(res, {
        ok: true,
        data: this.salesPackBusinessMode.setEnabled({
          userId: identity.userId,
          profileId: identity.profileId,
          enabled,
          updatedBy: this.readOptionalString(body.updatedBy) || 'dashboard',
        }),
      });
      return true;
    }

    if (pathname === '/api/v2/sales-pack/demo' && req.method === 'POST') {
      const result = this.salesPack.seedDemoScenario();
      deps.writeJson(res, {
        ok: true,
        data: result,
        snapshot: this.salesPack.buildSnapshot(),
      });
      return true;
    }

    if (pathname === '/api/v2/sales-pack/inbound' && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      const input = this.readSalesPackInboundMessage(body);
      if (!input) {
        deps.writeJson(res, {
          ok: false,
          error: 'Campos "text" e "customerId" precisam ser strings nao vazias.',
        }, 400);
        return true;
      }

      const result = this.salesPack.processInboundMessage(input);
      deps.writeJson(res, {
        ok: true,
        data: result,
        snapshot: this.salesPack.buildSnapshot(),
      });
      return true;
    }

    if (pathname === '/api/v2/sales-pack/channel-io/snapshot' && req.method === 'GET') {
      deps.writeJson(res, {
        ok: true,
        data: this.salesPackChannelIo.buildSnapshot(),
      });
      return true;
    }

    if (pathname === '/api/v2/sales-pack/channel-io/inbound' && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      const result = this.salesPackChannelIo.receiveInbound(this.readSalesPackChannelIoEnvelope(body, req.headers));
      deps.writeJson(res, {
        ok: result.ok,
        data: result,
        snapshot: this.salesPack.buildSnapshot(),
        channelIo: this.salesPackChannelIo.buildSnapshot(),
      }, result.status === 'rejected' ? 400 : 200);
      return true;
    }

    if (pathname === '/api/v2/sales-pack/channel-io/whatsapp-cloud' && req.method === 'POST') {
      const rawBody = await deps.readRawBody(req);
      let body: Record<string, unknown> = {};
      try {
        body = rawBody.trim() ? JSON.parse(rawBody) as Record<string, unknown> : {};
      } catch {
        deps.writeJson(res, { ok: false, error: 'Payload JSON invalido para WhatsApp Cloud API.' }, 400);
        return true;
      }
      const result = this.salesPackChannelIo.receiveInbound({
        provider: 'whatsapp-cloud-api',
        platform: 'whatsapp',
        headers: req.headers,
        rawBody,
        body,
      });
      deps.writeJson(res, {
        ok: result.ok,
        data: result,
        snapshot: this.salesPack.buildSnapshot(),
        channelIo: this.salesPackChannelIo.buildSnapshot(),
      }, result.status === 'rejected' ? 400 : 200);
      return true;
    }

    if (pathname === '/api/node-mesh/pairing/claim' && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      const result = this.transportRoutes.handleClaim(body, {
        nodeHeartbeat: deps.nodeHeartbeat,
        nodeMesh: deps.nodeMesh,
      });
      deps.writeJson(res, result.body, result.statusCode);
      return true;
    }

    if (pathname === '/api/node-mesh/heartbeat' && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      const result = this.transportRoutes.handleHeartbeat(body, {
        nodeHeartbeat: deps.nodeHeartbeat,
        nodeMesh: deps.nodeMesh,
      });
      deps.writeJson(res, result.body, result.statusCode);
      return true;
    }

    if (pathname === '/api/node-mesh/live/snapshot' && req.method === 'GET') {
      if (!this.isNodeMeshLiveAuthorized(req, url, deps)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      deps.writeJson(res, {
        ok: true,
        live: globalLiveNodeRegistry.buildSnapshot(),
        nodeMesh: deps.nodeMesh?.buildSnapshot({}) || null,
      });
      return true;
    }

    if (pathname === '/api/node-mesh/live/events' && req.method === 'GET') {
      if (!this.isNodeMeshLiveAuthorized(req, url, deps)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      this.handleNodeMeshLiveEvents(req, res);
      return true;
    }

    if (pathname === '/api/node-mesh/live/disconnect' && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      if (!this.isNodeMeshLiveAuthorized(req, url, deps, body)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      globalLiveNodeRegistry.markDisconnected(
        String(body.nodeId || '').trim(),
        String(body.reason || 'Disconnected through dashboard live endpoint.').trim(),
      );
      deps.writeJson(res, {
        ok: true,
        live: globalLiveNodeRegistry.buildSnapshot(),
      });
      return true;
    }

    if (pathname === '/api/webhooks/slack' && req.method === 'POST') {
      if (!deps.slackIngressGateway) {
        deps.writeJson(res, { ok: false, error: 'Slack webhook indisponivel.' }, 503);
        return true;
      }

      const rawBody = await deps.readRawBody(req);
      let body: Record<string, unknown> = {};
      try {
        body = rawBody.trim() ? JSON.parse(rawBody) as Record<string, unknown> : {};
      } catch {
        deps.writeJson(res, { ok: false, error: 'Payload JSON invalido para webhook do Slack.' }, 400);
        return true;
      }

      const result = await deps.slackIngressGateway.handleWebhookEvent({
        headers: req.headers,
        rawBody,
        body,
      });
      deps.writeJson(res, result.body, result.statusCode);
      return true;
    }

    if (pathname === '/api/webhooks/whatsapp' && req.method === 'GET') {
      if (!deps.whatsappIngressGateway) {
        deps.writeText(res, 'WhatsApp webhook indisponivel.', 503);
        return true;
      }

      const verification = deps.whatsappIngressGateway.handleWebhookVerification(url);
      deps.writeText(res, verification.textBody, verification.statusCode);
      return true;
    }

    if (pathname === '/api/webhooks/whatsapp' && req.method === 'POST') {
      if (!deps.whatsappIngressGateway) {
        deps.writeJson(res, { ok: false, error: 'WhatsApp webhook indisponivel.' }, 503);
        return true;
      }

      const body = await deps.readJsonBody(req);
      const result = await deps.whatsappIngressGateway.handleWebhookEvent({ body });
      deps.writeJson(res, result.body, result.statusCode);
      return true;
    }

    if (pathname === '/api/webhooks/instagram' && req.method === 'GET') {
      if (!deps.instagramIngressGateway) {
        deps.writeText(res, 'Instagram webhook indisponivel.', 503);
        return true;
      }

      const verification = deps.instagramIngressGateway.handleWebhookVerification(url);
      deps.writeText(res, verification.textBody, verification.statusCode);
      return true;
    }

    if (pathname === '/api/webhooks/instagram' && req.method === 'POST') {
      if (!deps.instagramIngressGateway) {
        deps.writeJson(res, { ok: false, error: 'Instagram webhook indisponivel.' }, 503);
        return true;
      }

      const body = await deps.readJsonBody(req);
      const result = await deps.instagramIngressGateway.handleWebhookEvent({ body });
      deps.writeJson(res, result.body, result.statusCode);
      return true;
    }

    if (pathname === '/api/webhooks/teams' && req.method === 'POST') {
      if (!deps.teamsIngressGateway) {
        deps.writeJson(res, { ok: false, error: 'Teams webhook indisponivel.' }, 503);
        return true;
      }

      const rawBody = await deps.readRawBody(req);
      let body: Record<string, unknown> = {};
      try {
        body = rawBody.trim() ? JSON.parse(rawBody) as Record<string, unknown> : {};
      } catch {
        deps.writeJson(res, { ok: false, error: 'Payload JSON invalido para webhook do Teams.' }, 400);
        return true;
      }
      const result = await deps.teamsIngressGateway.handleWebhookEvent({
        headers: req.headers,
        rawBody,
        body,
      });

      deps.writeJson(res, result.body, result.statusCode);
      return true;
    }


    // --- A2UI Endpoints ---
    if (pathname === '/api/v2/a2ui/snapshot' && req.method === 'GET') {
      const surfaceId = url.searchParams.get('surfaceId') || undefined;
      const snapshot = typeof deps.a2ui.readSnapshot === 'function'
        ? deps.a2ui.readSnapshot(surfaceId)
        : {
            generatedAt: new Date().toISOString(),
            protocolVersion: 'a2ui.v1',
            capabilities: ['snapshot'],
            allowedComponents: [],
            surfaceId: surfaceId || null,
            surfaces: typeof deps.a2ui.listSurfaces === 'function'
              ? deps.a2ui.listSurfaces()
              : [],
            commands: {
              snapshot: '/api/v2/a2ui/snapshot',
              action: '/api/v2/a2ui/action',
              events: '/api/v2/a2ui/events',
              stream: '/api/v2/a2ui/stream',
              assets: '/api/v2/a2ui/assets',
            },
          };
      deps.writeJson(res, { ok: true, data: snapshot });
      return true;
    }

    if (pathname === '/api/v2/a2ui/events' && req.method === 'GET') {
      const surfaceId = url.searchParams.get('surfaceId') || undefined;
      const limitRaw = url.searchParams.get('limit');
      const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 20;
      const events = typeof deps.a2ui.listEvents === 'function'
        ? deps.a2ui.listEvents(surfaceId, Number.isFinite(limit) ? limit : 20)
        : [];
      deps.writeJson(res, { ok: true, data: events });
      return true;
    }

    if (pathname === '/api/v2/a2ui/stream' && req.method === 'GET') {
      const surfaceId = url.searchParams.get('surfaceId') || undefined;
      const limitRaw = url.searchParams.get('limit');
      const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 20;
      const stream = typeof deps.a2ui.readStream === 'function'
        ? deps.a2ui.readStream(surfaceId, Number.isFinite(limit) ? limit : 20)
        : {
            generatedAt: new Date().toISOString(),
            protocolVersion: 'a2ui.v1',
            surfaceId: surfaceId || null,
            items: [],
            commands: {
              events: '/api/v2/a2ui/events',
              action: '/api/v2/a2ui/action',
            },
          };
      deps.writeJson(res, { ok: true, data: stream });
      return true;
    }

    if (pathname === '/api/v2/a2ui/assets' && req.method === 'GET') {
      const surfaceId = url.searchParams.get('surfaceId') || undefined;
      const assets = typeof deps.a2ui.listAssets === 'function'
        ? deps.a2ui.listAssets(surfaceId)
        : [];
      deps.writeJson(res, { ok: true, data: assets });
      return true;
    }

    if (pathname === '/api/v2/a2ui/action' && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      if (!body.surfaceId || typeof body.surfaceId !== 'string' || !body.actionId || typeof body.actionId !== 'string') {
        deps.writeJson(res, {
          ok: false,
          error: 'Campos "surfaceId" (string) e "actionId" (string) obrigatorios.',
        }, 400);
        return true;
      }

      if (typeof deps.a2ui.dispatchAction !== 'function') {
        deps.writeJson(res, {
          ok: false,
          error: 'A2UI action dispatch indisponivel nesta surface.',
        }, 503);
        return true;
      }

      const result = await deps.a2ui.dispatchAction({
        surfaceId: body.surfaceId,
        actionId: body.actionId,
        requestedBy: typeof body.requestedBy === 'string' ? body.requestedBy : 'dashboard',
        payload: body.payload && typeof body.payload === 'object' ? body.payload : {},
        correlation: body.correlation && typeof body.correlation === 'object' ? body.correlation : null,
      });
      deps.writeJson(res, result, result.ok ? 200 : result.status === 'not_found' ? 404 : 409);
      return true;
    }

    if (pathname === '/api/v2/a2ui/surfaces' && req.method === 'GET') {
      deps.writeJson(res, {
        ok: true,
        deprecated: true,
        canonical: '/api/v2/a2ui/snapshot',
        data: deps.a2ui.listSurfaces(),
      });
      return true;
    }

    if (pathname.startsWith('/api/v2/a2ui/surface/') && req.method === 'GET') {
      const surfaceId = pathname.split('/').pop() || '';
      const state = deps.a2ui.getSurfaceState(surfaceId);
      deps.writeJson(res, {
        ok: !!state,
        deprecated: true,
        canonical: `/api/v2/a2ui/snapshot?surfaceId=${encodeURIComponent(surfaceId)}`,
        data: state,
      });
      return true;
    }

    // --- Proactive Permissions Endpoints ---
    if (pathname === '/api/v2/permissions/pending' && req.method === 'GET') {
      const data = deps.echo
        ? deps.echo.getPendingPermissions()
        : deps.proactivePermissions.listPending?.() || [];
      deps.writeJson(res, {
        ok: true,
        deprecated: true,
        canonical: '/api/v2/echo/permissions',
        data,
      });
      return true;
    }

    if (pathname === '/api/v2/permissions/resolve' && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      if (deps.echo) {
        const approved = this.parseBoolean(body.approved);
        if (!body.id || typeof body.id !== 'string' || approved === null) {
          deps.writeJson(res, {
            ok: false,
            deprecated: true,
            canonical: '/api/v2/echo/permissions/resolve',
            error: 'Campos "id" (string) e "approved" (boolean) obrigatorios.',
          }, 400);
          return true;
        }

        const resolverContext = this.readResolverContext(body);
        const result = resolverContext
          ? await deps.echo.resolvePermission(body.id, approved, resolverContext)
          : await deps.echo.resolvePermission(body.id, approved);
        deps.writeJson(res, {
          deprecated: true,
          canonical: '/api/v2/echo/permissions/resolve',
          ...result,
        }, result.ok ? 200 : 404);
        return true;
      }

      const success = deps.proactivePermissions.resolve(body.id, body.approved);
      deps.writeJson(res, {
        ok: success,
        deprecated: true,
        canonical: '/api/v2/echo/permissions/resolve',
      });
      return true;
    }

    return false;
  }

  private handleNodeMeshLiveEvents(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const writeEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    writeEvent('snapshot', globalLiveNodeRegistry.buildSnapshot());
    const unsubscribe = globalLiveNodeRegistry.subscribe((event) => writeEvent(event.type, event));
    req.on('close', unsubscribe);
  }

  private isNodeMeshLiveAuthorized(
    req: http.IncomingMessage,
    url: URL,
    deps: DashboardCoreRouteDeps,
    body: Record<string, any> = {},
  ): boolean {
    const authService = deps.authService;
    if (!authService) {
      return false;
    }
    if (authService.resolveAuthenticatedIdentity(req)) {
      return true;
    }
    const eventSourceToken = String(url.searchParams.get('token') || body.token || '').trim();
    return authService.validate(eventSourceToken);
  }

  private async handleExperienceRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    pathname: string,
    deps: DashboardCoreRouteDeps,
  ): Promise<boolean> {
    if (pathname === '/api/experience/memory/encryption' && (req.method === 'GET' || req.method === 'POST')) {
      return this.handleMemoryEncryptionRequest(req, res, url, deps);
    }

    const service = deps.experienceCore;
    if (!service) {
      deps.writeJson(res, { ok: false, error: 'Experience Core is not attached to this runtime.' }, 503);
      return true;
    }

    const homeInput = {
      surface: this.readExperienceSurface(url.searchParams.get('surface')),
      sessionId: this.readOptionalString(url.searchParams.get('sessionId')),
      workspace: this.readOptionalString(url.searchParams.get('workspace')),
      activeRunId: this.readOptionalString(url.searchParams.get('activeRunId')),
      activeTraceId: this.readOptionalString(url.searchParams.get('activeTraceId')),
    };

    if (pathname === '/api/experience/home' && req.method === 'GET') {
      deps.writeJson(res, service.buildHome(homeInput));
      return true;
    }

    if (pathname === '/api/experience/runtime-state/action' && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      const trustedDesktopBridge = req.headers['x-zavorth-desktop-bridge'] === '1';
      const result = service.dispatchRuntimeStateAction({
        type: this.readOptionalString(body.type) as any,
        surface: this.readOptionalString(body.surface) || homeInput.surface,
        userId: this.readOptionalString(body.userId) || 'web-user',
        sessionId: this.readOptionalString(body.sessionId) || homeInput.sessionId,
        source: trustedDesktopBridge ? 'zavorth-desktop-bridge' : this.readOptionalString(body.source) || 'runtime-api',
        approved: trustedDesktopBridge || this.parseBoolean(body.approved) === true,
        previewOnly: this.parseBoolean(body.previewOnly) === true,
        payload: this.readRecord(body.payload) || {},
      });
      deps.writeJson(
        res,
        result || { ok: false, error: 'Runtime state bus is not attached.' },
        result?.ok ? 200 : 409,
      );
      return true;
    }

    if (pathname === '/api/experience/ask' && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      const text = this.readOptionalString(body.text) || this.readOptionalString(body.message);
      if (!text) {
        deps.writeJson(res, { ok: false, error: 'Campo "text" precisa ser uma string nao vazia.' }, 400);
        return true;
      }
      const metadata = this.readRecord(body.metadata) || { source: 'runtime-api' };
      const command: Partial<ExperienceCommand> & { text: string } = {
        text,
        intent: (this.readOptionalString(body.intent) as ExperienceCommand['intent']) || 'ask',
        surface: this.readExperienceSurface(body.surface),
        userId: this.readOptionalString(body.userId) || 'web-user',
        sessionId: this.readOptionalString(body.sessionId),
        workspace: this.readOptionalString(body.workspace),
        trustMode: (this.readOptionalString(body.trustMode) as ExperienceCommand['trustMode']) || 'protected',
        responseProfile: this.readOptionalString(body.responseProfile) as ExperienceCommand['responseProfile'],
        metadata: {
          ...metadata,
          trustedDesktopBridge: req.headers['x-zavorth-desktop-bridge'] === '1',
        },
      };
      deps.writeJson(res, await service.executeCommand(command));
      return true;
    }

    if (pathname === '/api/experience/approvals' && req.method === 'GET') {
      deps.writeJson(res, { approvals: service.buildHome(homeInput).approvals });
      return true;
    }

    const approvalDecision = pathname.match(/^\/api\/experience\/approvals\/([^/]+)\/decision$/);
    if (approvalDecision && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      const decision = this.readOptionalString(body.decision) === 'reject' ? 'reject' : 'approve';
      const approvalId = decodeURIComponent(approvalDecision[1] || '');
      deps.writeJson(res, await service.executeCommand({
        text: `${decision} approval ${approvalId}`,
        intent: 'approve',
        surface: this.readExperienceSurface(body.surface),
        userId: this.readOptionalString(body.userId) || 'web-user',
        sessionId: this.readOptionalString(body.sessionId),
        workspace: this.readOptionalString(body.workspace),
        approval: { id: approvalId, decision },
        metadata: this.readRecord(body.metadata) || { source: 'runtime-api' },
      }));
      return true;
    }

    if (pathname === '/api/experience/learning' && req.method === 'GET') {
      deps.writeJson(res, service.buildHome(homeInput).learning);
      return true;
    }

    const learningDecision = pathname.match(/^\/api\/experience\/learning\/([^/]+)\/decision$/);
    if (learningDecision && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      const rawDecision = this.readOptionalString(body.decision);
      const decision = rawDecision === 'approve' || rawDecision === 'promote'
        ? 'approve'
        : 'reject';
      const candidateId = decodeURIComponent(learningDecision[1] || '');
      deps.writeJson(res, await service.executeCommand({
        text: `${decision} learning ${candidateId}`,
        intent: 'learn',
        surface: this.readExperienceSurface(body.surface),
        userId: this.readOptionalString(body.userId) || 'web-user',
        sessionId: this.readOptionalString(body.sessionId),
        workspace: this.readOptionalString(body.workspace),
        learning: { candidateId, decision },
        metadata: this.readRecord(body.metadata) || { source: 'runtime-api' },
      }));
      return true;
    }

    const timeline = pathname.match(/^\/api\/experience\/runs\/([^/]+)\/timeline$/);
    if (timeline && req.method === 'GET') {
      const runId = decodeURIComponent(timeline[1] || '');
      deps.writeJson(res, {
        runId,
        timeline: service.buildTimelineForRun({ ...homeInput, runId }),
      });
      return true;
    }

    deps.writeJson(res, { ok: false, error: 'Experience route not found.' }, 404);
    return true;
  }

  private async handleMemoryEncryptionRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    deps: DashboardCoreRouteDeps,
  ): Promise<boolean> {
    let body: Record<string, any> = {};
    if (req.method === 'POST') {
      body = await deps.readJsonBody(req);
    }
    if (!this.isExperienceManagementAuthorized(req, url, deps, body)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }

    const service = new ZavorthMemoryEncryptionStatusService();
    const input = this.readMemoryEncryptionInput(url, body);
    if (req.method === 'GET') {
      deps.writeJson(res, {
        ok: true,
        surface: this.readOptionalString(url.searchParams.get('surface')) || 'web',
        status: service.buildStatus(input),
      });
      return true;
    }

    const action = String(body.action || 'preview').trim().toLowerCase();
    const receipt = action === 'apply' || action === 'enable'
      ? service.applyMigration(input)
      : action === 'rollback' || action === 'restore'
        ? service.rollbackMigration(input)
        : service.previewMigration(input);
    deps.writeJson(res, {
      ok: receipt.status !== 'failed',
      receipt,
      status: service.buildStatus(input),
    }, receipt.status === 'blocked' ? 409 : receipt.status === 'failed' ? 500 : 200);
    return true;
  }

  private isExperienceManagementAuthorized(
    req: http.IncomingMessage,
    url: URL,
    deps: DashboardCoreRouteDeps,
    body: Record<string, any> = {},
  ): boolean {
    const authService = deps.authService;
    if (!authService) {
      return false;
    }
    if (authService.resolveAuthenticatedIdentity(req)) {
      return true;
    }
    const authorization = String(req.headers.authorization || '').trim();
    const bearer = authorization.toLowerCase().startsWith('bearer ')
      ? authorization.slice('bearer '.length).trim()
      : '';
    const token = bearer
      || String(url.searchParams.get('token') || body.token || body.runtimeToken || '').trim();
    return Boolean(token && authService.validate(token));
  }

  private readMemoryEncryptionInput(url: URL, body: Record<string, any>): {
    dbPath?: string | null;
    mode?: ZavorthMemoryEncryptionMode | null;
    key?: string | null;
    keyPath?: string | null;
    keyStore?: 'auto' | 'file' | 'os' | null;
    backupPath?: string | null;
    driverPackages?: string[];
  } {
    return {
      dbPath: this.readOptionalString(body.dbPath) || this.readOptionalString(url.searchParams.get('dbPath')),
      mode: this.readMemoryEncryptionMode(body.mode) || this.readMemoryEncryptionMode(url.searchParams.get('mode')),
      key: typeof body.key === 'string' ? body.key : null,
      keyPath: this.readOptionalString(body.keyPath) || this.readOptionalString(url.searchParams.get('keyPath')),
      keyStore: this.readMemoryEncryptionKeyStore(body.keyStore) || this.readMemoryEncryptionKeyStore(url.searchParams.get('keyStore')),
      backupPath: this.readOptionalString(body.backupPath) || this.readOptionalString(url.searchParams.get('backupPath')),
      driverPackages: Array.isArray(body.driverPackages)
        ? body.driverPackages.map((entry) => String(entry || '').trim()).filter(Boolean)
        : this.readMemoryEncryptionDrivers(body.drivers || url.searchParams.get('drivers')),
    };
  }

  private readMemoryEncryptionMode(value: unknown): ZavorthMemoryEncryptionMode | null {
    const text = String(value || '').trim().toLowerCase();
    if (text === 'off' || text === 'opportunistic' || text === 'required') {
      return text;
    }
    return null;
  }

  private readMemoryEncryptionKeyStore(value: unknown): 'auto' | 'file' | 'os' | null {
    const text = String(value || '').trim().toLowerCase();
    if (text === 'auto' || text === 'file' || text === 'os') {
      return text;
    }
    return null;
  }

  private readMemoryEncryptionDrivers(value: unknown): string[] | undefined {
    const text = String(value || '').trim();
    if (!text) {
      return undefined;
    }
    return text.split(',').map((entry) => entry.trim()).filter(Boolean);
  }

  private readExperienceSurface(value: unknown): ExperienceSurface {
    const surface = String(value || '').trim();
    return surface === 'cli' || surface === 'api' || surface === 'telegram' || surface === 'discord' || surface === 'web'
      ? surface
      : 'web';
  }

  private parseBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') {
        return true;
      }
      if (value.toLowerCase() === 'false') {
        return false;
      }
    }
    return null;
  }

  private readResolverContext(body: Record<string, any>): Record<string, unknown> | null {
    const context = {
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
      surface: typeof body.surface === 'string' ? body.surface : undefined,
      requestedBy: typeof body.requestedBy === 'string' ? body.requestedBy : undefined,
      channel: typeof body.channel === 'string' ? body.channel : undefined,
      chatId: typeof body.chatId === 'string' ? body.chatId : undefined,
      threadId: typeof body.threadId === 'string' ? body.threadId : undefined,
      userId: typeof body.userId === 'string' ? body.userId : undefined,
    };
    return Object.values(context).some((value) => typeof value === 'string' && value.trim().length > 0)
      ? context
      : null;
  }

  private readSalesPackInboundMessage(body: Record<string, any>): SalesPackInboundMessageInput | null {
    const text = this.readNonEmptyString(body.text);
    const customerId = this.readNonEmptyString(body.customerId);
    if (!text || !customerId) {
      return null;
    }

    return {
      tenantId: this.readNonEmptyString(body.tenantId) || 'default-tenant',
      channelAccountId: this.readOptionalString(body.channelAccountId),
      customerId,
      conversationId: this.readOptionalString(body.conversationId),
      actorId: this.readOptionalString(body.actorId),
      text,
      traceId: this.readOptionalString(body.traceId),
      runId: this.readOptionalString(body.runId),
      surface: this.readOptionalString(body.surface) || 'dashboard-sales-pack',
      receivedAt: this.readOptionalString(body.receivedAt),
      metadata: this.readRecord(body.metadata),
    };
  }

  private readSalesPackChannelIoEnvelope(
    body: Record<string, any>,
    headers: http.IncomingHttpHeaders,
  ): SalesPackChannelIoEnvelope {
    return {
      tenantId: this.readOptionalString(body.tenantId),
      channelAccountId: this.readOptionalString(body.channelAccountId),
      platform: this.readOptionalString(body.platform) as SalesPackChannelIoEnvelope['platform'],
      provider: this.readOptionalString(body.provider) as SalesPackChannelIoEnvelope['provider'],
      providerMessageId: this.readOptionalString(body.providerMessageId),
      customerId: this.readOptionalString(body.customerId),
      conversationId: this.readOptionalString(body.conversationId),
      actorId: this.readOptionalString(body.actorId),
      text: this.readOptionalString(body.text),
      traceId: this.readOptionalString(body.traceId),
      runId: this.readOptionalString(body.runId),
      receivedAt: this.readOptionalString(body.receivedAt),
      headers,
      body,
      metadata: this.readRecord(body.metadata),
    };
  }

  private readBusinessModeIdentity(
    req: http.IncomingMessage,
    url: URL,
    body: Record<string, any> = {},
    deps: DashboardCoreRouteDeps,
  ): SalesPackBusinessModeIdentity & { authorized: boolean } {
    const authenticatedIdentity = deps.authService?.resolveAuthenticatedIdentity(req) || null;
    if (!authenticatedIdentity) {
      return {
        userId: null,
        profileId: null,
        authorized: false,
      };
    }
    const profileId = authenticatedIdentity.profileId
      || this.readOptionalString(body.productModeId)
      || this.readOptionalString(url.searchParams.get('productModeId'))
      || this.readScopedProfileId(authenticatedIdentity, body, url);
    return {
      userId: authenticatedIdentity.userId,
      profileId,
      authorized: true,
    };
  }

  private readScopedProfileId(
    authenticatedIdentity: DashboardAuthenticatedIdentity,
    body: Record<string, any>,
    url: URL,
  ): string | null {
    if (authenticatedIdentity.source === 'dashboard-token') {
      return authenticatedIdentity.profileId;
    }
    return this.readOptionalString(body.profileId)
      || this.readOptionalString(body.tenantId)
      || this.readOptionalString(url.searchParams.get('profileId'));
  }

  private readNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private readOptionalString(value: unknown): string | null {
    return this.readNonEmptyString(value);
  }

  private readRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }
}
