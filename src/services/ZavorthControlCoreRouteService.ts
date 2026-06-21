import * as http from 'http';
import path from 'path';
import fs from 'fs';
import { NodeMeshTransportRouteService } from './NodeMeshTransportRouteService.js';
import { WorkspaceWriteApprovalPayloadCache } from './WorkspaceWriteApprovalPayloadCache.js';
import { WorkspaceWriteApprovalService } from './WorkspaceWriteApprovalService.js';
import { WorkspaceSessionGrantCache } from './WorkspaceSessionGrantCache.js';
import { WorkspaceCommandApprovalService } from './WorkspaceCommandApprovalService.js';
import { WorkspaceTaskMandateService } from './WorkspaceTaskMandateService.js';
import { TemporaryDirectoryTrustService } from './TemporaryDirectoryTrustService.js';
import { WorkspacePathGuard } from '../mcp/workspace/WorkspacePathGuard.js';
import { AgentWorkspaceConfigService } from './AgentWorkspaceConfigService.js';
import { WorkspaceRuntimeReadinessService } from './WorkspaceRuntimeReadinessService.js';
import { WorkspacePolicyPreviewService } from './WorkspacePolicyPreviewService.js';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';
import { LogRepository } from '../storage/LogRepository.js';
import { InternalBetaDiagnosticsService } from './InternalBetaDiagnosticsService.js';
import { InternalBetaChecklistService } from './InternalBetaChecklistService.js';
import { ErrorNormalizationService } from './ErrorNormalizationService.js';

import { PtySessionService } from './PtySessionService.js';
import { PtySessionApprovalService } from './PtySessionApprovalService.js';
import { PtyInputApprovalService } from './PtyInputApprovalService.js';

import { HostCommandApprovalService } from './HostCommandApprovalService.js';
import { HostCommandRunnerService } from './HostCommandRunnerService.js';
import { HostCommandPayloadCache } from './HostCommandPayloadCache.js';
import { HostPowerModeService } from './HostPowerModeService.js';
import { Database } from '../storage/Database.js';
import { config } from '../config/index.js';
import { OperationalMaturityService } from '../domain/platform-ecosystem/application/OperationalMaturityService.js';
import {
  SalesPackMvpService,
} from '../domain/platform-ecosystem/application/sales-pack/index.js';
import { SalesPackBusinessModeService } from './SalesPackBusinessModeService.js';
import { SalesPackChannelIoService } from './SalesPackChannelIoService.js';
import type {
  ZavorthControlAuthenticatedIdentity,
  ZavorthControlAuthService,
} from './ZavorthControlAuthService.js';
import type {
  SalesPackInboundMessageInput,
} from '../contracts/SalesPackContract.js';
import type { SalesPackChannelIoEnvelope } from '../contracts/SalesPackChannelIoContract.js';
import type { ExperienceCommand, ExperienceSurface } from './experience/ExperienceContracts.js';
import { ExperienceCoreService } from './experience/ExperienceCoreService.js';
import type { ZavorthRuntimeStateActionType } from '../contracts/ZavorthRuntimeStateBusContract.js';
import { globalLiveNodeRegistry } from './LiveNodeRegistryService.js';
import { TrustedDeviceAccessService } from './TrustedDeviceAccessService.js';
import { TrustedDeviceAccessRouteService } from './TrustedDeviceAccessRouteService.js';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';
import { TrustedWorkspaceService } from './TrustedWorkspaceService.js';
import { ProviderConfigService } from './ProviderConfigService.js';
import { LocalEncryptedProviderSecretStore } from './ProviderSecretStore.js';
import { ProviderConnectionTestService } from './ProviderConnectionTestService.js';
import * as schemas from '../domain/validation/controlSchemas.js';



type WriteJson = (res: http.ServerResponse, body: unknown, statusCode?: number) => void;
type WriteText = (res: http.ServerResponse, body: string, statusCode?: number) => void;
type WriteRedirect = (res: http.ServerResponse, location: string, statusCode?: number) => void;
type ReadJsonBody = (req: http.IncomingMessage) => Promise<Record<string, any>>;
type ReadRawBody = (req: http.IncomingMessage) => Promise<string>;

const RUNTIME_STATE_ACTION_TYPES = new Set<ZavorthRuntimeStateActionType>([
  'sync-command',
  'set-effort',
  'set-model',
  'set-workspace',
  'surface-event',
  'skill-lifecycle',
  'domain-state',
  'operate-domain',
  'set-permission',
  'select-model-spec',
  'route-model',
  'set-provider-connection',
  'set-workspace-knowledge',
  'register-personal-connector',
  'set-mcp-trust',
  'recover-scheduled-jobs',
  'resume-stream',
]);

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

export type ZavorthControlCoreRouteDeps = {
  nodeHeartbeat: NodeHeartbeatLike;
  nodeMesh: NodeMeshLike;
  readJsonBody: ReadJsonBody;
  readRawBody: ReadRawBody;
  writeJson: WriteJson;
  writeText: WriteText;
  writeRedirect: WriteRedirect;
  a2ui: any;
  proactivePermissions: any;
  experienceCore?: Pick<ExperienceCoreService, 'buildHome' | 'executeCommand' | 'buildTimelineForRun' | 'dispatchRuntimeStateAction' | 'buildRuntimeCapabilities' | 'syncRuntimeOperationalState'> | null;
  authService?: Pick<ZavorthControlAuthService, 'validate' | 'resolveAuthenticatedIdentity'>;
  echo?: {
    getPendingPermissions: () => unknown[];
    resolvePermission: (id: string, approved: boolean, resolvedBy?: Record<string, unknown>) => Promise<any>;
  };
  slackIngressGateway?: SlackWebhookGatewayLike | null;
  teamsIngressGateway?: TeamsWebhookGatewayLike | null;
  whatsappIngressGateway?: WhatsAppWebhookGatewayLike | null;
  instagramIngressGateway?: InstagramWebhookGatewayLike | null;
};

export type ZavorthControlCoreRouteServiceOptions = {
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

export class ZavorthControlCoreRouteService {
  private readonly transportRoutes = new NodeMeshTransportRouteService();
  private readonly operationalMaturity: OperationalMaturityService;
  private readonly salesPack: SalesPackMvpService;
  private readonly salesPackBusinessMode: SalesPackBusinessModeService;
  private readonly salesPackChannelIo: SalesPackChannelIoService;
  private readonly localAccessRoutes: TrustedDeviceAccessRouteService;

  private getCanonicalWorkspacePath(workspaceHint: string): string {
    if (!workspaceHint) {
      return fs.realpathSync(WorkspaceResolver.resolve(null));
    }
    try {
      const resolved = WorkspaceResolver.resolve(workspaceHint);
      if (WorkspaceResolver.isWorkspaceAllowed(resolved)) {
        return fs.realpathSync(resolved);
      }
    } catch {}
    try {
      const allowed = WorkspaceResolver.getAllowedRoots();
      for (const root of allowed) {
        if (path.basename(root).toLowerCase() === workspaceHint.toLowerCase()) {
          return fs.realpathSync(root);
        }
      }
    } catch {}
    try {
      const resolved = path.resolve(workspaceHint);
      if (fs.existsSync(resolved) && WorkspaceResolver.isWorkspaceAllowed(resolved)) {
        return fs.realpathSync(resolved);
      }
    } catch {}
    return path.resolve(workspaceHint);
  }

  private validateWorkspaceSession(workspaceId: string): boolean {
    if (!workspaceId) return false;
    try {
      const activeWs = WorkspaceResolver.resolve(null);
      const activeReal = fs.realpathSync(activeWs);

      const candidateWs = WorkspaceResolver.resolve(workspaceId);
      const candidateReal = fs.realpathSync(candidateWs);

      if (path.normalize(activeReal).toLowerCase() === path.normalize(candidateReal).toLowerCase()) {
        return true;
      }
    } catch {}

    try {
      const activeWs = WorkspaceResolver.resolve(null);
      const activeReal = fs.realpathSync(activeWs);
      const aliases = WorkspaceResolver.getAliases();
      const resolvedAlias = aliases[workspaceId.toLowerCase()];
      if (resolvedAlias) {
        const aliasReal = fs.realpathSync(resolvedAlias);
        if (path.normalize(activeReal).toLowerCase() === path.normalize(aliasReal).toLowerCase()) {
          return true;
        }
      }
    } catch {}

    return false;
  }

  public constructor(options: ZavorthControlCoreRouteServiceOptions = {}) {
    this.operationalMaturity = options.operationalMaturity || new OperationalMaturityService();
    this.salesPack = options.salesPack || new SalesPackMvpService();
    this.salesPackBusinessMode = options.salesPackBusinessMode || new SalesPackBusinessModeService();
    this.salesPackChannelIo = options.salesPackChannelIo || new SalesPackChannelIoService({
      salesPack: this.salesPack,
    });
    this.localAccessRoutes = new TrustedDeviceAccessRouteService(
      options.localAccess || new TrustedDeviceAccessService(),
      'zavorthControl-token',
    );
  }

  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    pathname: string,
    deps: ZavorthControlCoreRouteDeps,
  ): Promise<boolean> {
    if (pathname === '/') {
      deps.writeRedirect(res, '/control');
      return true;
    }

    if (pathname.startsWith('/api/v2/local-access')) {
      return this.localAccessRoutes.handleRequest(req, res, pathname, deps);
    }

    if (pathname === '/api/runtime/capabilities' && req.method === 'GET') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      await deps.experienceCore?.syncRuntimeOperationalState?.({
        userId: String(url.searchParams.get('userId') || 'desktop-user'),
        sessionId: String(url.searchParams.get('sessionId') || 'desktop-main'),
        workspacePath: url.searchParams.get('workspacePath'),
      });
      const snapshot = deps.experienceCore?.buildRuntimeCapabilities?.() || null;
      deps.writeJson(
        res,
        snapshot || { ok: false, error: 'Runtime capabilities are not attached.' },
        snapshot ? 200 : 503,
      );
      return true;
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
          error: 'Campo "enabled" needs ser booleano.',
        }, 400);
        return true;
      }
      deps.writeJson(res, {
        ok: true,
        data: this.salesPackBusinessMode.setEnabled({
          userId: identity.userId,
          profileId: identity.profileId,
          enabled,
          updatedBy: this.readOptionalString(body.updatedBy) || 'zavorthControl',
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
          error: 'Campos "text" e "customerId" need ser strings not emptys.',
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
        deps.writeJson(res, { ok: false, error: 'Payload JSON invalid para WhatsApp Cloud API.' }, 400);
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
        String(body.reason || 'Disconnected through zavorthControl live endpoint.').trim(),
      );
      deps.writeJson(res, {
        ok: true,
        live: globalLiveNodeRegistry.buildSnapshot(),
      });
      return true;
    }

    if (pathname === '/api/webhooks/slack' && req.method === 'POST') {
      if (!deps.slackIngressGateway) {
        deps.writeJson(res, { ok: false, error: 'Slack webhook unavailable.' }, 503);
        return true;
      }

      const rawBody = await deps.readRawBody(req);
      let body: Record<string, unknown> = {};
      try {
        body = rawBody.trim() ? JSON.parse(rawBody) as Record<string, unknown> : {};
      } catch {
        deps.writeJson(res, { ok: false, error: 'Payload JSON invalid para webhook do Slack.' }, 400);
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
        deps.writeText(res, 'WhatsApp webhook unavailable.', 503);
        return true;
      }

      const verification = deps.whatsappIngressGateway.handleWebhookVerification(url);
      deps.writeText(res, verification.textBody, verification.statusCode);
      return true;
    }

    if (pathname === '/api/webhooks/whatsapp' && req.method === 'POST') {
      if (!deps.whatsappIngressGateway) {
        deps.writeJson(res, { ok: false, error: 'WhatsApp webhook unavailable.' }, 503);
        return true;
      }

      const body = await deps.readJsonBody(req);
      const result = await deps.whatsappIngressGateway.handleWebhookEvent({ body });
      deps.writeJson(res, result.body, result.statusCode);
      return true;
    }

    if (pathname === '/api/webhooks/instagram' && req.method === 'GET') {
      if (!deps.instagramIngressGateway) {
        deps.writeText(res, 'Instagram webhook unavailable.', 503);
        return true;
      }

      const verification = deps.instagramIngressGateway.handleWebhookVerification(url);
      deps.writeText(res, verification.textBody, verification.statusCode);
      return true;
    }

    if (pathname === '/api/webhooks/instagram' && req.method === 'POST') {
      if (!deps.instagramIngressGateway) {
        deps.writeJson(res, { ok: false, error: 'Instagram webhook unavailable.' }, 503);
        return true;
      }

      const body = await deps.readJsonBody(req);
      const result = await deps.instagramIngressGateway.handleWebhookEvent({ body });
      deps.writeJson(res, result.body, result.statusCode);
      return true;
    }

    if (pathname === '/api/webhooks/teams' && req.method === 'POST') {
      if (!deps.teamsIngressGateway) {
        deps.writeJson(res, { ok: false, error: 'Teams webhook unavailable.' }, 503);
        return true;
      }

      const rawBody = await deps.readRawBody(req);
      let body: Record<string, unknown> = {};
      try {
        body = rawBody.trim() ? JSON.parse(rawBody) as Record<string, unknown> : {};
      } catch {
        deps.writeJson(res, { ok: false, error: 'Payload JSON invalid para webhook do Teams.' }, 400);
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
          error: 'A2UI action dispatch unavailable nesta surface.',
        }, 503);
        return true;
      }

      const result = await deps.a2ui.dispatchAction({
        surfaceId: body.surfaceId,
        actionId: body.actionId,
        requestedBy: typeof body.requestedBy === 'string' ? body.requestedBy : 'zavorthControl',
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
        canonical: `/api/v2/a2ui/snapshotissurfaceId=${encodeURIComponent(surfaceId)}`,
        data: state,
      });
      return true;
    }

    // --- Workspace Write Approvals Endpoints ---
    if (pathname === '/api/v2/workspace/approvals/pending' && req.method === 'GET') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const db = await Database.getInstance();
        const cache = WorkspaceWriteApprovalPayloadCache.getInstance();
        await cache.clearExpired(db);

        const now = new Date().toISOString();
        const rows = db.all<{ operation_id: string; workspace_id: string; tool_name: string; path_suffix: string; created_at: string; expires_at: string }>(
          'SELECT operation_id, workspace_id, tool_name, path_suffix, created_at, expires_at FROM workspace_write_approvals WHERE approved = 0 AND expires_at > is',
          [now]
        );

        const activeSessionId = url.searchParams.get('sessionId');
        const data = rows
          .filter(row => {
            if (activeSessionId && row.workspace_id !== activeSessionId) {
              return false;
            }
            return cache.getPayload(row.operation_id) !== undefined;
          })
          .map(row => {
            const cached = cache.getPayload(row.operation_id);
            return {
              operationId: row.operation_id,
              toolName: row.tool_name,
              pathSuffix: row.path_suffix,
              path: cached?.file || null,
              createdAt: row.created_at,
              expiresAt: row.expires_at,
            };
          });

        deps.writeJson(res, { ok: true, data });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/approvals/payload' && req.method === 'GET') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const operationId = url.searchParams.get('operationId');
        if (!operationId) {
          deps.writeJson(res, { ok: false, error: 'operationId parameter is required' }, 400);
          return true;
        }

        const db = await Database.getInstance();
        const cache = WorkspaceWriteApprovalPayloadCache.getInstance();
        await cache.clearExpired(db);

        // 1. Operation exists in DB
        const entry = db.get<{ approved: number; expires_at: string; workspace_id: string; tool_name: string }>(
          'SELECT approved, expires_at, workspace_id, tool_name FROM workspace_write_approvals WHERE operation_id = is',
          [operationId]
        );
        if (!entry) {
          deps.writeJson(res, { ok: false, error: 'Operation not found' }, 404);
          return true;
        }

        // 2. Operation has not expired
        if (new Date(entry.expires_at) <= new Date()) {
          deps.writeJson(res, { ok: false, error: 'Operation expired' }, 410);
          return true;
        }

        // 3. Operation belongs to the active workspace/session
        const activeSessionId = url.searchParams.get('sessionId');
        if (activeSessionId && entry.workspace_id !== activeSessionId) {
          deps.writeJson(res, { ok: false, error: 'Operation session mismatch' }, 403);
          return true;
        }

        // 4. Payload exists in the memory cache
        const cachedPayload = cache.getPayload(operationId);
        if (!cachedPayload) {
          deps.writeJson(res, { ok: false, error: 'Payload not found in transient cache' }, 404);
          return true;
        }

        // proposed content must not be binary (contains no null bytes)
        if (cachedPayload.content && cachedPayload.content.includes('\x00')) {
          deps.writeJson(res, { ok: false, error: 'Proposed content is binary' }, 400);
          return true;
        }

        // 5. Relative path is safe
        const workspacePath = url.searchParams.get('workspacePath')
          || url.searchParams.get('workspace')
          || process.env.ZAVORTH_WORKSPACE_ROOT
          || config.workspaceRoot
          || process.cwd();

        const pathGuard = new WorkspacePathGuard(workspacePath);
        const relativePath = cachedPayload.file;
        let resolvedPath: string;
        try {
          resolvedPath = pathGuard.resolveForWrite(relativePath);
        } catch (pathErr: any) {
          deps.writeJson(res, { ok: false, error: `Unsafe relative path: ${pathErr.message}` }, 403);
          return true;
        }

        // 6. Current content was read via WorkspacePathGuard
        let currentContent = '';
        let currentContentExists = false;
        try {
          if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
            const buffer = fs.readFileSync(resolvedPath);
            // Check if current content is binary
            if (buffer.includes(0)) {
              deps.writeJson(res, { ok: false, error: 'Current file is binary' }, 400);
              return true;
            }
            currentContent = buffer.toString('utf8');
            currentContentExists = true;
          }
        } catch (readErr: any) {
          deps.writeJson(res, { ok: false, error: `Failed to read current file: ${readErr.message}` }, 403);
          return true;
        }

        // 7. Preview/diff already comes truncated from backend
        // Max 100KB and 1000 lines helper
        const truncateContent = (content: string): string => {
          if (!content) return '';
          let truncated = content;
          if (Buffer.byteLength(content, 'utf8') > 100 * 1024) {
            truncated = content.slice(0, 100 * 1024);
          }
          const lines = truncated.split(/\ris\n/);
          if (lines.length > 1000) {
            return lines.slice(0, 1000).join('\n') + '\n... [TRUNCATED]';
          }
          return truncated;
        };

        const truncatedProposed = cachedPayload.content !== undefined ? truncateContent(cachedPayload.content) : undefined;
        const truncatedCurrent = truncateContent(currentContent);

        deps.writeJson(res, {
          ok: true,
          data: {
            operationId,
            file: relativePath,
            toolName: entry.tool_name,
            currentContent: truncatedCurrent,
            proposedContent: truncatedProposed,
            currentContentExists,
          }
        });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/approvals/resolve' && req.method === 'POST') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const body = await deps.readJsonBody(req);
        const parsed = schemas.resolveWriteApprovalSchema.safeParse(body);
        if (!parsed.success) {
          deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
          return true;
        }
        const { operationId, decision } = parsed.data;

        const approvalService = new WorkspaceWriteApprovalService();
        const cache = WorkspaceWriteApprovalPayloadCache.getInstance();

        if (decision === 'approve') {
          await approvalService.approveOperation(operationId);
        } else if (decision === 'deny') {
          await approvalService.denyOperation(operationId);
          cache.clearPayload(operationId);
        } else {
          deps.writeJson(res, { ok: false, error: 'Invalid decision' }, 400);
          return true;
        }

        deps.writeJson(res, { ok: true });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    // --- Workspace Command Approvals Endpoints ---
    if (pathname === '/api/v2/workspace/command-approvals/session-grant' && req.method === 'POST') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const body = await deps.readJsonBody(req);
        const parsed = schemas.sessionGrantSchema.safeParse(body);
        if (!parsed.success) {
          deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
          return true;
        }
        const { workspaceId, active, durationMinutes, allowRiskUpTo, allowPackageInstall, allowNetwork } = parsed.data;

        const cache = WorkspaceSessionGrantCache.getInstance();
        if (active === false) {
          cache.setDeveloperMode(workspaceId, false);
          deps.writeJson(res, { ok: true, developerModeActive: false });
          return true;
        }

        const mins = Number(durationMinutes || 30);
        const expiresAt = new Date(Date.now() + mins * 60 * 1000).toISOString();

        const grant = {
          workspaceId,
          expiresAt,
          allowRiskUpTo: (allowRiskUpTo === 'MEDIUM' ? 'MEDIUM' : 'LOW') as 'LOW' | 'MEDIUM',
          allowPackageInstall: allowPackageInstall !== false,
          allowNetwork: allowNetwork === true,
        };

        cache.setDeveloperMode(workspaceId, true);
        cache.setGrant(workspaceId, grant);

        deps.writeJson(res, {
          ok: true,
          developerModeActive: true,
          grant: {
            workspaceId: grant.workspaceId,
            expiresAt: grant.expiresAt,
            allowRiskUpTo: grant.allowRiskUpTo,
            allowPackageInstall: grant.allowPackageInstall,
            allowNetwork: grant.allowNetwork,
          }
        });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/command-approvals/session-grant' && req.method === 'GET') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const workspaceId = url.searchParams.get('workspaceId');
        if (!workspaceId) {
          deps.writeJson(res, { ok: false, error: 'workspaceId parameter is required' }, 400);
          return true;
        }

        const cache = WorkspaceSessionGrantCache.getInstance();
        const active = cache.isDeveloperModeActive(workspaceId);
        const grant = cache.getGrant(workspaceId);

        deps.writeJson(res, {
          ok: true,
          developerModeActive: active,
          grant
        });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    // --- Workspace Trust Endpoints ---
    if (pathname === '/api/v2/workspace/trust/status' && req.method === 'GET') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const workspaceId = url.searchParams.get('workspaceId');
        if (!workspaceId) {
          deps.writeJson(res, { ok: false, error: 'workspaceId parameter is required' }, 400);
          return true;
        }

        // Validate workspaceId matches the active session workspace to prevent spoofing
        if (!this.validateWorkspaceSession(workspaceId)) {
          deps.writeJson(res, { ok: false, error: 'workspaceId does not match the active session workspace' }, 403);
          return true;
        }


        const trustService = await TrustedWorkspaceService.getInstance();
        const entry = trustService.loadTrust(workspaceId, workspaceId);

        deps.writeJson(res, {
          ok: true,
          trusted: entry !== null && entry.trusted,
          entry
        });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/trust/resolve' && req.method === 'POST') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const body = await deps.readJsonBody(req);
        const parsed = schemas.resolveWorkspaceTrustSchema.safeParse(body);
        if (!parsed.success) {
          deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
          return true;
        }
        const { workspaceId, rootPath, trusted, allowRiskUpTo, allowPackageInstall, allowNetwork } = parsed.data;


        // Validate rootPath and workspaceId against active workspace to prevent path spoofing
        let resolvedPath: string;
        try {
          resolvedPath = fs.realpathSync(path.resolve(rootPath));
        } catch {
          resolvedPath = path.resolve(rootPath);
        }

        let activeWorkspace: string;
        try {
          activeWorkspace = fs.realpathSync(WorkspaceResolver.resolve(null));
        } catch {
          activeWorkspace = path.resolve(WorkspaceResolver.resolve(null));
        }

        const normResolved = path.normalize(resolvedPath).toLowerCase();
        const normActive = path.normalize(activeWorkspace).toLowerCase();

        if (normResolved !== normActive) {
          deps.writeJson(res, { ok: false, error: 'rootPath does not match active session workspace' }, 403);
          return true;
        }

        if (!this.validateWorkspaceSession(workspaceId)) {
          deps.writeJson(res, { ok: false, error: 'rootPath does not match active session workspace' }, 403);
          return true;
        }


        const trustService = await TrustedWorkspaceService.getInstance();

        if (trusted === false) {
          await trustService.revokeTrust(workspaceId);
          deps.writeJson(res, { ok: true, trusted: false });
        } else {
          const entry = await trustService.grantTrust(workspaceId, rootPath, {
            allowRiskUpTo: allowRiskUpTo as 'LOW' | 'MEDIUM',
            allowPackageInstall: !!allowPackageInstall,
            allowNetwork: !!allowNetwork
          });
          deps.writeJson(res, { ok: true, trusted: true, entry });
        }
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/task-mandates/pending' && req.method === 'GET') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const workspaceId = url.searchParams.get('workspaceId');
        if (!workspaceId) {
          deps.writeJson(res, { ok: false, error: 'workspaceId is required' }, 400);
          return true;
        }

        if (!this.validateWorkspaceSession(workspaceId)) {
          deps.writeJson(res, { ok: false, error: 'workspaceId does not match active session workspace' }, 403);
          return true;
        }
        const activeWorkspace = WorkspaceResolver.resolve(null);

        const mandateService = WorkspaceTaskMandateService.getInstance();
        const proposed = mandateService.getProposedMandate(workspaceId);

        if (!proposed) {
          deps.writeJson(res, { ok: true, proposed: null });
          return true;
        }

        // Relativize targetDirectories
        const relativeTargets = proposed.targetDirectories.map(dir => {
          const relative = path.relative(activeWorkspace, dir);
          return relative.replace(/\\/g, '/');
        });

        deps.writeJson(res, {
          ok: true,
          proposed: {
            ...proposed,
            targetDirectories: relativeTargets
          }
        });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/task-mandates/active' && req.method === 'GET') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const workspaceId = url.searchParams.get('workspaceId');
        if (!workspaceId) {
          deps.writeJson(res, { ok: false, error: 'workspaceId is required' }, 400);
          return true;
        }

        if (!this.validateWorkspaceSession(workspaceId)) {
          deps.writeJson(res, { ok: false, error: 'workspaceId does not match active session workspace' }, 403);
          return true;
        }
        const activeWorkspace = WorkspaceResolver.resolve(null);

        const mandateService = WorkspaceTaskMandateService.getInstance();
        const active = mandateService.getActiveMandate(workspaceId);

        if (!active) {
          deps.writeJson(res, { ok: true, active: null });
          return true;
        }

        // Relativize targetDirectories
        const relativeTargets = active.targetDirectories.map(dir => {
          const relative = path.relative(activeWorkspace, dir);
          return relative.replace(/\\/g, '/');
        });

        deps.writeJson(res, {
          ok: true,
          active: {
            ...active,
            targetDirectories: relativeTargets
          }
        });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/task-mandates/resolve' && req.method === 'POST') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const body = await deps.readJsonBody(req);
        const parsed = schemas.resolveTaskMandateSchema.safeParse(body);
        if (!parsed.success) {
          deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
          return true;
        }
        const { workspaceId, approved } = parsed.data;

        const activeWorkspace = WorkspaceResolver.resolve(null);
        if (!this.validateWorkspaceSession(workspaceId)) {
          deps.writeJson(res, { ok: false, error: 'workspaceId does not match active session workspace' }, 403);
          return true;
        }

        const mandateService = WorkspaceTaskMandateService.getInstance();
        const resolved = mandateService.resolveMandate(workspaceId, !!approved);

        deps.writeJson(res, { ok: true, resolved: resolved ? { mandateId: resolved.mandateId, expiresAt: resolved.expiresAt } : null });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/task-mandates/revoke' && req.method === 'POST') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const body = await deps.readJsonBody(req);
        const parsed = schemas.revokeTaskMandateSchema.safeParse(body);
        if (!parsed.success) {
          deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
          return true;
        }
        const { workspaceId } = parsed.data;

        const activeWorkspace = WorkspaceResolver.resolve(null);
        if (!this.validateWorkspaceSession(workspaceId)) {
          deps.writeJson(res, { ok: false, error: 'workspaceId does not match active session workspace' }, 403);
          return true;
        }

        const mandateService = WorkspaceTaskMandateService.getInstance();
        mandateService.revokeMandate(workspaceId);

        deps.writeJson(res, { ok: true });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    // ── Fase 21E-A: Temporary Directory Trust routes ─────────────────────────────
    // GET /api/v2/workspace/temporary-directory-trusts/pendingisworkspaceId=X
    if (pathname === '/api/v2/workspace/temporary-directory-trusts/pending' && req.method === 'GET') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const workspaceId = url.searchParams.get('workspaceId');
        if (!workspaceId) {
          deps.writeJson(res, { ok: false, error: 'workspaceId is required' }, 400);
          return true;
        }

        if (!this.validateWorkspaceSession(workspaceId)) {
          deps.writeJson(res, { ok: false, error: 'workspaceId does not match active session workspace' }, 403);
          return true;
        }

        const trustService = TemporaryDirectoryTrustService.getInstance();
        const proposed = trustService.getProposedTrust(workspaceId);

        deps.writeJson(res, {
          ok: true,
          proposed: proposed
            ? {
                trustId: proposed.trustId,
                workspaceId: proposed.workspaceId,
                rootSuffix: proposed.rootSuffix,
                rootHash: proposed.rootHash,
                kind: proposed.kind,
                displayName: proposed.displayName,
                allowedOperations: proposed.allowedOperations,
                createdAt: proposed.createdAt,
              }
            : null,
        });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    // GET /api/v2/workspace/temporary-directory-trusts/activeisworkspaceId=X
    if (pathname === '/api/v2/workspace/temporary-directory-trusts/active' && req.method === 'GET') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const workspaceId = url.searchParams.get('workspaceId');
        if (!workspaceId) {
          deps.writeJson(res, { ok: false, error: 'workspaceId is required' }, 400);
          return true;
        }

        if (!this.validateWorkspaceSession(workspaceId)) {
          deps.writeJson(res, { ok: false, error: 'workspaceId does not match active session workspace' }, 403);
          return true;
        }

        const trustService = TemporaryDirectoryTrustService.getInstance();
        const trusts = trustService.getActiveTrusts(workspaceId);

        deps.writeJson(res, {
          ok: true,
          trusts: trusts.map(t => ({
            trustId: t.trustId,
            workspaceId: t.workspaceId,
            rootSuffix: t.rootSuffix,
            rootHash: t.rootHash,
            kind: t.kind,
            displayName: t.displayName,
            allowedOperations: t.allowedOperations,
            expiresAt: t.expiresAt,
            createdAt: t.createdAt,
          })),
        });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    // POST /api/v2/workspace/temporary-directory-trusts/resolve  { workspaceId, trustId, approved }
    if (pathname === '/api/v2/workspace/temporary-directory-trusts/resolve' && req.method === 'POST') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const body = await deps.readJsonBody(req);
        const parsed = schemas.resolveTempDirTrustSchema.safeParse(body);
        if (!parsed.success) {
          deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
          return true;
        }
        const { workspaceId, trustId, approved } = parsed.data;

        if (!this.validateWorkspaceSession(workspaceId)) {
          deps.writeJson(res, { ok: false, error: 'workspaceId does not match active session workspace' }, 403);
          return true;
        }

        const trustService = TemporaryDirectoryTrustService.getInstance();
        const resolved = trustService.resolveTrust(workspaceId, trustId, !!approved);

        deps.writeJson(res, {
          ok: true,
          resolved: resolved
            ? {
                trustId: resolved.trustId,
                expiresAt: resolved.expiresAt,
                rootSuffix: resolved.rootSuffix,
                rootHash: resolved.rootHash,
                kind: resolved.kind,
                displayName: resolved.displayName,
              }
            : null,
        });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    // POST /api/v2/workspace/temporary-directory-trusts/revoke  { workspaceId, trustId }
    if (pathname === '/api/v2/workspace/temporary-directory-trusts/revoke' && req.method === 'POST') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const body = await deps.readJsonBody(req);
        const parsed = schemas.revokeTempDirTrustSchema.safeParse(body);
        if (!parsed.success) {
          deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
          return true;
        }
        const { workspaceId, trustId } = parsed.data;

        if (!this.validateWorkspaceSession(workspaceId)) {
          deps.writeJson(res, { ok: false, error: 'workspaceId does not match active session workspace' }, 403);
          return true;
        }

        const trustService = TemporaryDirectoryTrustService.getInstance();
        trustService.revokeTrust(workspaceId, trustId);

        deps.writeJson(res, { ok: true });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/command-approvals/pending' && req.method === 'GET') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const workspaceId = url.searchParams.get('workspaceId');
        const db = await Database.getInstance();
        const now = new Date().toISOString();

        let rows;
        if (workspaceId) {
          rows = db.all<{ operation_id: string; workspace_id: string; command: string; created_at: string; expires_at: string }>(
            'SELECT operation_id, workspace_id, command, created_at, expires_at FROM workspace_command_approvals WHERE approved = 0 AND expires_at > is AND workspace_id = is',
            [now, workspaceId]
          );
        } else {
          rows = db.all<{ operation_id: string; workspace_id: string; command: string; created_at: string; expires_at: string }>(
            'SELECT operation_id, workspace_id, command, created_at, expires_at FROM workspace_command_approvals WHERE approved = 0 AND expires_at > is',
            [now]
          );
        }

        const data = rows.map(row => ({
          operationId: row.operation_id,
          workspaceId: row.workspace_id,
          command: row.command,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
        }));

        deps.writeJson(res, { ok: true, data });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/command-approvals/payload' && req.method === 'GET') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const operationId = url.searchParams.get('operationId');
        if (!operationId) {
          deps.writeJson(res, { ok: false, error: 'operationId parameter is required' }, 400);
          return true;
        }

        const db = await Database.getInstance();
        const entry = db.get<{ operation_id: string; workspace_id: string; command: string; approved: number; expires_at: string; created_at: string }>(
          'SELECT operation_id, workspace_id, command, approved, expires_at, created_at FROM workspace_command_approvals WHERE operation_id = is',
          [operationId]
        );

        if (!entry) {
          deps.writeJson(res, { ok: false, error: 'Operation not found' }, 404);
          return true;
        }

        if (new Date(entry.expires_at) <= new Date()) {
          deps.writeJson(res, { ok: false, error: 'Operation expired' }, 410);
          return true;
        }

        deps.writeJson(res, {
          ok: true,
          data: {
            operationId: entry.operation_id,
            workspaceId: entry.workspace_id,
            command: entry.command,
            approved: entry.approved === 1,
            createdAt: entry.created_at,
            expiresAt: entry.expires_at
          }
        });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/command-approvals/resolve' && req.method === 'POST') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const body = await deps.readJsonBody(req);
        const parsed = schemas.resolveCommandApprovalSchema.safeParse(body);
        if (!parsed.success) {
          deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
          return true;
        }
        const { operationId, decision } = parsed.data;

        const approvalService = new WorkspaceCommandApprovalService();
        if (decision === 'approve') {
          await approvalService.approveOperation(operationId);
        } else if (decision === 'deny') {
          await approvalService.denyOperation(operationId);
        } else {
          deps.writeJson(res, { ok: false, error: 'Invalid decision' }, 400);
          return true;
        }

        deps.writeJson(res, { ok: true });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    // --- Host Power Mode Endpoints ---

    // --- PTY Routes ---

    if (pathname === '/api/v2/workspace/pty/pending-sessions' && req.method === 'GET') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const workspaceId = new URL(req.url || '/', 'http://localhost').searchParams.get('workspaceId');
        if (!workspaceId) {
          deps.writeJson(res, { ok: false, error: 'workspaceId required' }, 400);
          return true;
        }
        const srv = new PtySessionApprovalService();
        const pending = await srv.getPendingProposals(workspaceId);
        deps.writeJson(res, { ok: true, data: pending });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/pty/resolve-session' && req.method === 'POST') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const body = await deps.readJsonBody(req);
        const parsed = schemas.resolvePtySessionSchema.safeParse(body);
        if (!parsed.success) {
          deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
          return true;
        }
        const { workspaceId, sessionId, approve } = parsed.data;

        const srv = new PtySessionApprovalService();
        await srv.resolveProposal(workspaceId, sessionId, approve);
        deps.writeJson(res, { ok: true });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/pty/pending-inputs' && req.method === 'GET') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const workspaceId = new URL(req.url || '/', 'http://localhost').searchParams.get('workspaceId');
        if (!workspaceId) {
          deps.writeJson(res, { ok: false, error: 'workspaceId required' }, 400);
          return true;
        }
        const srv = new PtyInputApprovalService();
        const pending = await srv.getPendingProposals(workspaceId);
        deps.writeJson(res, { ok: true, data: pending });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/pty/resolve-input' && req.method === 'POST') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const body = await deps.readJsonBody(req);
        const parsed = schemas.resolvePtyInputSchema.safeParse(body);
        if (!parsed.success) {
          deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
          return true;
        }
        const { workspaceId, operationId, sessionId, approve, strongConfirmationInput } = parsed.data;

        const inputSrv = new PtyInputApprovalService();
        await inputSrv.resolveProposal(workspaceId, operationId, approve, strongConfirmationInput);

        deps.writeJson(res, { ok: true });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/pty/output' && req.method === 'GET') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const workspaceId = new URL(req.url || '/', 'http://localhost').searchParams.get('workspaceId');
        const sessionId = new URL(req.url || '/', 'http://localhost').searchParams.get('sessionId');
        const afterSeqStr = new URL(req.url || '/', 'http://localhost').searchParams.get('afterSeq');
        if (!workspaceId || !sessionId) {
          deps.writeJson(res, { ok: false, error: 'Missing parameters' }, 400);
          return true;
        }
        const afterSeq = afterSeqStr ? parseInt(afterSeqStr, 10) : 0;

        const chunks = PtySessionService.getInstance().getOutput(sessionId, afterSeq);
        deps.writeJson(res, { ok: true, data: chunks });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/pty/terminate' && req.method === 'POST') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const body = await deps.readJsonBody(req);
        const parsed = schemas.terminatePtySessionSchema.safeParse(body);
        if (!parsed.success) {
          deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
          return true;
        }
        const { workspaceId, sessionId } = parsed.data;

        await PtySessionService.getInstance().terminateSession(sessionId, workspaceId);
        deps.writeJson(res, { ok: true });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    // --- Provider Config & Auth Endpoints ---

    if (pathname === '/api/v2/providers' && req.method === 'GET') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const providers = await ProviderConfigService.getInstance().getProviders();
        const safeProviders = providers.map(p => {
          const { secretRef, keySuffix, key_suffix, ...rest } = p as any;
          return { ...rest, configured: !!secretRef };
        });
        deps.writeJson(res, { ok: true, data: safeProviders });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/providers' && req.method === 'POST') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const body = await deps.readJsonBody(req);
        const parsed = schemas.providerConfigSchema.safeParse(body);
        if (!parsed.success) {
          deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
          return true;
        }
        const validatedBody = parsed.data;
        const srv = ProviderConfigService.getInstance();

        let providerId = validatedBody.providerId;
        let config;

        if (providerId) {
          config = await srv.updateProvider(providerId, validatedBody);
        } else {
          config = await srv.createProvider(validatedBody);
          providerId = config.providerId;
        }

        if (validatedBody.apiKey) {
          const store = LocalEncryptedProviderSecretStore.getInstance();
          const saveResult = await store.saveSecret(providerId, validatedBody.apiKey);
          await srv.setSecretRef(providerId, saveResult.secretRef);
          config.secretRef = saveResult.secretRef;
        }

        const { secretRef, keySuffix, key_suffix, ...safeConfig } = config as any;
        const finalConfig = { ...safeConfig, configured: !!secretRef };

        deps.writeJson(res, { ok: true, data: finalConfig });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 400);
      }
      return true;
    }

    if (pathname === '/api/v2/providers/test-connection' && req.method === 'POST') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const body = await deps.readJsonBody(req);
        const parsed = schemas.testConnectionSchema.safeParse(body);
        if (!parsed.success) {
          deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
          return true;
        }
        const { providerId } = parsed.data;
        const result = await ProviderConnectionTestService.getInstance().testConnection(providerId);
        deps.writeJson(res, { ok: true, data: result });
      } catch (err: any) {
        const normalized = ErrorNormalizationService.getInstance().normalize(err);
        deps.writeJson(res, { ok: false, error: normalized.message, code: normalized.code }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/providers' && req.method === 'DELETE') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const providerId = url.searchParams.get('providerId');
        if (!providerId) {
          deps.writeJson(res, { ok: false, error: 'providerId is required' }, 400);
          return true;
        }
        await ProviderConfigService.getInstance().deleteProvider(providerId);

        const db = await Database.getInstance();
        await db.run('DELETE FROM provider_secret_refs WHERE provider_id = ?', [providerId]);

        deps.writeJson(res, { ok: true });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    const deleteSecretMatch = pathname.match(/^\/api\/v2\/providers\/([^/]+)\/secret$/);
    if (deleteSecretMatch && req.method === 'DELETE') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const providerId = deleteSecretMatch[1];
        await ProviderConfigService.getInstance().setSecretRef(providerId, null);
        const db = await Database.getInstance();
        await db.run('DELETE FROM provider_secret_refs WHERE provider_id = ?', [providerId]);
        deps.writeJson(res, { ok: true });
      } catch (err: any) {
        const normalized = ErrorNormalizationService.getInstance().normalize(err);
        deps.writeJson(res, { ok: false, error: normalized.message, code: normalized.code }, 500);
      }
      return true;
    }



    // GET /api/v2/workspace/agent-config
    if (pathname === '/api/v2/workspace/agent-config' && req.method === 'GET') {
      const identity = deps.authService ? deps.authService.resolveAuthenticatedIdentity(req) : null;
      if (!identity) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const workspaceId = url.searchParams.get('workspaceId');
        if (!workspaceId) {
          deps.writeJson(res, { ok: false, error: 'workspaceId parameter is required' }, 400);
          return true;
        }

        if (workspaceId.includes('..') || path.isAbsolute(workspaceId)) {
          const auditLogger = new SecurityAuditLogger();
          auditLogger.logWorkspaceEvent({
            event: 'blocked_cross_workspace_config_access',
            workspaceId: workspaceId,
            metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'path_traversal' }
          });
          deps.writeJson(res, { ok: false, error: 'Invalid workspaceId' }, 400);
          return true;
        }

        if (!WorkspaceResolver.isWorkspaceAllowed(workspaceId)) {
          const auditLogger = new SecurityAuditLogger();
          auditLogger.logWorkspaceEvent({
            event: 'blocked_cross_workspace_config_access',
            workspaceId: workspaceId,
            metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'cross_workspace_access' }
          });
          deps.writeJson(res, { ok: false, error: 'Forbidden cross-workspace access' }, 403);
          return true;
        }

        const config = await AgentWorkspaceConfigService.getInstance().getConfig(workspaceId);
        deps.writeJson(res, { ok: true, data: config });
      } catch (err: any) {
        const normalized = ErrorNormalizationService.getInstance().normalize(err);
        deps.writeJson(res, { ok: false, error: normalized.message, code: normalized.code }, 500);
      }
      return true;
    }

    // PATCH /api/v2/workspace/agent-config
    if (pathname === '/api/v2/workspace/agent-config' && (req.method === 'PATCH' || req.method === 'POST')) {
      const identity = deps.authService ? deps.authService.resolveAuthenticatedIdentity(req) : null;
      if (!identity) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const body = await deps.readJsonBody(req);
        const parsed = schemas.agentConfigSchema.safeParse(body);
        if (!parsed.success) {
          deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
          return true;
        }
        const validated = parsed.data;
        const workspaceId = validated.workspaceId || url.searchParams.get('workspaceId');
        if (!workspaceId) {
          deps.writeJson(res, { ok: false, error: 'workspaceId is required' }, 400);
          return true;
        }

        if (workspaceId.includes('..') || path.isAbsolute(workspaceId)) {
          const auditLogger = new SecurityAuditLogger();
          auditLogger.logWorkspaceEvent({
            event: 'blocked_cross_workspace_config_access',
            workspaceId: workspaceId,
            metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'path_traversal' }
          });
          deps.writeJson(res, { ok: false, error: 'Invalid workspaceId' }, 400);
          return true;
        }

        if (!WorkspaceResolver.isWorkspaceAllowed(workspaceId)) {
          const auditLogger = new SecurityAuditLogger();
          auditLogger.logWorkspaceEvent({
            event: 'blocked_cross_workspace_config_access',
            workspaceId: workspaceId,
            metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'cross_workspace_access' }
          });
          deps.writeJson(res, { ok: false, error: 'Forbidden cross-workspace access' }, 403);
          return true;
        }

        const currentConfig = await AgentWorkspaceConfigService.getInstance().getConfig(workspaceId);
        const updatedConfig = { ...currentConfig, ...body.config };
        await AgentWorkspaceConfigService.getInstance().updateConfig(workspaceId, updatedConfig);

        deps.writeJson(res, { ok: true });
      } catch (err: any) {
        const normalized = ErrorNormalizationService.getInstance().normalize(err);
        deps.writeJson(res, { ok: false, error: normalized.message, code: normalized.code }, 500);
      }
      return true;
    }

    // GET /api/v2/workspace/agent-config/readiness
    if (pathname === '/api/v2/workspace/agent-config/readiness' && req.method === 'GET') {
      const identity = deps.authService ? deps.authService.resolveAuthenticatedIdentity(req) : null;
      if (!identity) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const workspaceId = url.searchParams.get('workspaceId');
        if (!workspaceId) {
          deps.writeJson(res, { ok: false, error: 'workspaceId parameter is required' }, 400);
          return true;
        }

        if (workspaceId.includes('..') || path.isAbsolute(workspaceId)) {
          const auditLogger = new SecurityAuditLogger();
          auditLogger.logWorkspaceEvent({
            event: 'blocked_cross_workspace_config_access',
            workspaceId: workspaceId,
            metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'path_traversal' }
          });
          deps.writeJson(res, { ok: false, error: 'Invalid workspaceId' }, 400);
          return true;
        }

        if (!WorkspaceResolver.isWorkspaceAllowed(workspaceId)) {
          const auditLogger = new SecurityAuditLogger();
          auditLogger.logWorkspaceEvent({
            event: 'blocked_cross_workspace_config_access',
            workspaceId: workspaceId,
            metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'cross_workspace_access' }
          });
          deps.writeJson(res, { ok: false, error: 'Forbidden cross-workspace access' }, 403);
          return true;
        }

        const readiness = await WorkspaceRuntimeReadinessService.getInstance().checkReadiness(workspaceId);
        deps.writeJson(res, { ok: true, data: readiness });
      } catch (err: any) {
        const normalized = ErrorNormalizationService.getInstance().normalize(err);
        deps.writeJson(res, { ok: false, error: normalized.message, code: normalized.code }, 500);
      }
      return true;
    }

    // POST /api/v2/workspace/agent-config/preview
    if (pathname === '/api/v2/workspace/agent-config/preview' && req.method === 'POST') {
      const identity = deps.authService ? deps.authService.resolveAuthenticatedIdentity(req) : null;
      if (!identity) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const body = await deps.readJsonBody(req);
        const parsed = schemas.agentConfigPreviewSchema.safeParse(body);
        if (!parsed.success) {
          deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
          return true;
        }
        const validated = parsed.data;
        const workspaceId = validated.workspaceId || url.searchParams.get('workspaceId');
        if (!workspaceId) {
          deps.writeJson(res, { ok: false, error: 'workspaceId parameter is required' }, 400);
          return true;
        }

        if (workspaceId.includes('..') || path.isAbsolute(workspaceId)) {
          const auditLogger = new SecurityAuditLogger();
          auditLogger.logWorkspaceEvent({
            event: 'blocked_cross_workspace_config_access',
            workspaceId: workspaceId,
            metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'path_traversal' }
          });
          deps.writeJson(res, { ok: false, error: 'Invalid workspaceId' }, 400);
          return true;
        }

        if (!WorkspaceResolver.isWorkspaceAllowed(workspaceId)) {
          const auditLogger = new SecurityAuditLogger();
          auditLogger.logWorkspaceEvent({
            event: 'blocked_cross_workspace_config_access',
            workspaceId: workspaceId,
            metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'cross_workspace_access' }
          });
          deps.writeJson(res, { ok: false, error: 'Forbidden cross-workspace access' }, 403);
          return true;
        }

        const previewData = await WorkspacePolicyPreviewService.getInstance().previewPolicy(workspaceId, body.config || {});
        deps.writeJson(res, { ok: true, data: previewData });
      } catch (err: any) {
        const normalized = ErrorNormalizationService.getInstance().normalize(err);
        deps.writeJson(res, { ok: false, error: normalized.message, code: normalized.code }, 500);
      }
      return true;
    }

    // GET /api/v2/workspace/agent-config/diagnostics
    if (pathname === '/api/v2/workspace/agent-config/diagnostics' && req.method === 'GET') {
      const identity = deps.authService ? deps.authService.resolveAuthenticatedIdentity(req) : null;
      if (!identity) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const workspaceId = url.searchParams.get('workspaceId');
        if (!workspaceId) {
          deps.writeJson(res, { ok: false, error: 'workspaceId parameter is required' }, 400);
          return true;
        }

        if (workspaceId.includes('..') || path.isAbsolute(workspaceId)) {
          const auditLogger = new SecurityAuditLogger();
          auditLogger.logWorkspaceEvent({
            event: 'blocked_cross_workspace_config_access',
            workspaceId: workspaceId,
            metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'path_traversal' }
          });
          deps.writeJson(res, { ok: false, error: 'Invalid workspaceId' }, 400);
          return true;
        }

        if (!WorkspaceResolver.isWorkspaceAllowed(workspaceId)) {
          const auditLogger = new SecurityAuditLogger();
          auditLogger.logWorkspaceEvent({
            event: 'blocked_cross_workspace_config_access',
            workspaceId: workspaceId,
            metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'cross_workspace_access' }
          });
          deps.writeJson(res, { ok: false, error: 'Forbidden cross-workspace access' }, 403);
          return true;
        }

        const diagnostics = await InternalBetaDiagnosticsService.getInstance().runDiagnostics(workspaceId);
        deps.writeJson(res, { ok: true, data: diagnostics });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    // GET /api/v2/workspace/agent-config/checklist
    if (pathname === '/api/v2/workspace/agent-config/checklist' && req.method === 'GET') {
      const identity = deps.authService ? deps.authService.resolveAuthenticatedIdentity(req) : null;
      if (!identity) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const workspaceId = url.searchParams.get('workspaceId');
        if (!workspaceId) {
          deps.writeJson(res, { ok: false, error: 'workspaceId parameter is required' }, 400);
          return true;
        }

        if (workspaceId.includes('..') || path.isAbsolute(workspaceId)) {
          const auditLogger = new SecurityAuditLogger();
          auditLogger.logWorkspaceEvent({
            event: 'blocked_cross_workspace_config_access',
            workspaceId: workspaceId,
            metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'path_traversal' }
          });
          deps.writeJson(res, { ok: false, error: 'Invalid workspaceId' }, 400);
          return true;
        }

        if (!WorkspaceResolver.isWorkspaceAllowed(workspaceId)) {
          const auditLogger = new SecurityAuditLogger();
          auditLogger.logWorkspaceEvent({
            event: 'blocked_cross_workspace_config_access',
            workspaceId: workspaceId,
            metadata: { requestedWorkspaceId: workspaceId, status: 'blocked', errorCode: 'cross_workspace_access' }
          });
          deps.writeJson(res, { ok: false, error: 'Forbidden cross-workspace access' }, 403);
          return true;
        }

        const checklist = await InternalBetaChecklistService.getInstance().getChecklist(workspaceId);
        deps.writeJson(res, { ok: true, data: checklist });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/host-power/status' && req.method === 'GET') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const workspaceId = url.searchParams.get('workspaceId');
        if (!workspaceId) {
          deps.writeJson(res, { ok: false, error: 'workspaceId parameter is required' }, 400);
          return true;
        }
        const state = HostPowerModeService.getInstance().getState(workspaceId);
        deps.writeJson(res, { ok: true, data: state });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/host-power/enable' && req.method === 'POST') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const body = await deps.readJsonBody(req);
        const parsed = schemas.enableHostPowerSchema.safeParse(body);
        if (!parsed.success) {
          deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
          return true;
        }
        const { workspaceId, durationMinutes } = parsed.data;

        await HostPowerModeService.getInstance().enable(workspaceId, durationMinutes);
        deps.writeJson(res, { ok: true });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/host-power/disable' && req.method === 'POST') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const body = await deps.readJsonBody(req);
        const parsed = schemas.disableHostPowerSchema.safeParse(body);
        if (!parsed.success) {
          deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
          return true;
        }
        const { workspaceId } = parsed.data;

        await HostPowerModeService.getInstance().disable(workspaceId);
        deps.writeJson(res, { ok: true });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    // --- Host Command Endpoints ---
    if (pathname === '/api/v2/workspace/host-commands/pending' && req.method === 'GET') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const workspaceId = url.searchParams.get('workspaceId');
        const db = await Database.getInstance();
        const now = new Date().toISOString();

        let rows;
        if (workspaceId) {
          rows = db.all<any>(
            `SELECT operation_id, workspace_id, command_preview_redacted, args_preview_redacted,
                    cwd_suffix, shell, risk_level, reason_redacted, created_at, expires_at,
                    requires_strong_confirmation, strong_confirmation_phrase
             FROM workspace_host_command_proposals
             WHERE approved = 0 AND expires_at > is AND workspace_id = is`,
            [now, workspaceId]
          );
        } else {
          rows = db.all<any>(
            `SELECT operation_id, workspace_id, command_preview_redacted, args_preview_redacted,
                    cwd_suffix, shell, risk_level, reason_redacted, created_at, expires_at,
                    requires_strong_confirmation, strong_confirmation_phrase
             FROM workspace_host_command_proposals
             WHERE approved = 0 AND expires_at > is`,
            [now]
          );
        }

        const data = rows.map(row => ({
          operationId: row.operation_id,
          workspaceId: row.workspace_id,
          commandPreview: row.command_preview_redacted,
          argsPreview: row.args_preview_redacted,
          cwdSuffix: row.cwd_suffix,
          shell: row.shell === 1,
          riskLevel: row.risk_level,
          reasonRedacted: row.reason_redacted,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
          requiresStrongConfirmation: row.requires_strong_confirmation === 1,
          strongConfirmationPhrase: row.strong_confirmation_phrase
        }));

        deps.writeJson(res, { ok: true, data });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/host-commands/resolve' && req.method === 'POST') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const body = await deps.readJsonBody(req);
        const parsed = schemas.resolveHostCommandSchema.safeParse(body);
        if (!parsed.success) {
          deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
          return true;
        }
        const { operationId, decision, strongConfirmationInput } = parsed.data;

        const approvalService = new HostCommandApprovalService();
        if (decision === 'approve') {
          await approvalService.resolve(operationId, true, strongConfirmationInput);
        } else if (decision === 'deny') {
          await approvalService.resolve(operationId, false);
        } else {
          deps.writeJson(res, { ok: false, error: 'Invalid decision' }, 400);
          return true;
        }

        deps.writeJson(res, { ok: true });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/host-commands/execute' && req.method === 'POST') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const body = await deps.readJsonBody(req);
        const parsed = schemas.executeHostCommandSchema.safeParse(body);
        if (!parsed.success) {
          deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
          return true;
        }
        const { operationId } = parsed.data;

        const db = await Database.getInstance();
        const proposal = db.get<any>(
          'SELECT workspace_id, risk_level, shell FROM workspace_host_command_proposals WHERE operation_id = is AND approved = 1',
          [operationId]
        );

        if (!proposal) {
          deps.writeJson(res, { ok: false, error: 'Host command proposal not found or already executed' }, 404);
          return true;
        }

        const payloadCache = HostCommandPayloadCache.getInstance();
        const cached = payloadCache.get(operationId);
        if (!cached) {
          deps.writeJson(res, { ok: false, error: 'Transit raw payload cache is missing or expired' }, 410);
          return true;
        }

        const workspaceRoot = WorkspaceResolver.resolve(proposal.workspace_id);
        const shell = proposal.shell === 1;

        // Path validation inside or outside workspace
        const resolvedRoot = path.resolve(workspaceRoot);
        const resolvedCwd = path.isAbsolute(cached.cwd)
          ? path.resolve(cached.cwd)
          : path.resolve(workspaceRoot, cached.cwd);

        const isPathOutside = (target: string, root: string): boolean => {
          const relative = path.relative(root, target);
          if (relative.startsWith('..') || path.isAbsolute(relative)) {
            return true;
          }
          const normalizedTarget = target.replace(/\\/g, '/').toLowerCase();
          const normalizedRoot = root.replace(/\\/g, '/').toLowerCase();
          return !normalizedTarget.startsWith(normalizedRoot + '/') && normalizedTarget !== normalizedRoot;
        };

        const isOutside = isPathOutside(resolvedCwd, resolvedRoot);
        const requiresHpm = shell || isOutside;

        if (requiresHpm) {
          const hpmState = HostPowerModeService.getInstance().getState(proposal.workspace_id);
          if (!hpmState.enabled) {
            deps.writeJson(res, {
              ok: false,
              error: 'Host Power Mode is disabled. shell:true or out-of-workspace commands require Host Power Mode to be active.'
            }, 403);
            return true;
          }
        }

        // Atomically consume approval
        const approvalService = new HostCommandApprovalService();
        const consumed = await approvalService.consumeApproval(
          proposal.workspace_id,
          operationId,
          cached.command,
          cached.args,
          cached.cwd,
          shell,
          proposal.risk_level
        );

        if (!consumed) {
          deps.writeJson(res, { ok: false, error: 'Approval validation or consumption failed.' }, 400);
          return true;
        }

        // Run command
        const runner = new HostCommandRunnerService();
        const runResult = await runner.executeCommand(
          proposal.workspace_id,
          cached.command,
          cached.args,
          cached.cwd,
          shell,
          30000,
          proposal.risk_level
        );

        // Delete from payload cache
        payloadCache.delete(operationId);

        deps.writeJson(res, {
          ok: true,
          data: runResult
        });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/host-commands/revoke' && req.method === 'POST') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const body = await deps.readJsonBody(req);
        const parsed = schemas.revokeHostCommandSchema.safeParse(body);
        if (!parsed.success) {
          deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
          return true;
        }
        const { operationId } = parsed.data;
        const db = await Database.getInstance();
        db.run('DELETE FROM workspace_host_command_proposals WHERE operation_id = is', [operationId]);
        HostCommandPayloadCache.getInstance().delete(operationId);
        deps.writeJson(res, { ok: true });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
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
      const parsed = schemas.resolvePermissionSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, {
          ok: false,
          deprecated: true,
          canonical: '/api/v2/echo/permissions/resolve',
          error: 'Validation failed',
          details: parsed.error.format()
        }, 400);
        return true;
      }
      const { id, approved } = parsed.data;

      if (deps.echo) {
        const resolverContext = this.readResolverContext(parsed.data);
        const result = resolverContext
          ? await deps.echo.resolvePermission(id, approved, resolverContext)
          : await deps.echo.resolvePermission(id, approved);
        deps.writeJson(res, {
          deprecated: true,
          canonical: '/api/v2/echo/permissions/resolve',
          ...result,
        }, result.ok ? 200 : 404);
        return true;
      }

      const success = deps.proactivePermissions.resolve(id, approved);
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
    deps: ZavorthControlCoreRouteDeps,
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
    deps: ZavorthControlCoreRouteDeps,
  ): Promise<boolean> {
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
      const desktopBridgeUserId = this.getVerifiedDesktopBridgeUserId(req, deps);
      const trustedDesktopBridge = desktopBridgeUserId !== null;
      const authenticatedIdentity = deps.authService?.resolveAuthenticatedIdentity(req) || null;
      if (!trustedDesktopBridge && !authenticatedIdentity) {
        deps.writeJson(res, { ok: false, error: 'Authentication required for runtime state actions.' }, 401);
        return true;
      }
      const actionType = this.readRuntimeStateActionType(body.type);
      if (!actionType) {
        deps.writeJson(res, { ok: false, error: 'Unsupported runtime state action type.' }, 400);
        return true;
      }
      const result = service.dispatchRuntimeStateAction({
        type: actionType,
        surface: this.readOptionalString(body.surface) || homeInput.surface,
        userId: desktopBridgeUserId || this.readIdentityUserId(authenticatedIdentity) || 'authenticated-user',
        sessionId: this.readOptionalString(body.sessionId) || homeInput.sessionId,
        source: trustedDesktopBridge ? 'zavorth-desktop-bridge' : 'runtime-api',
        approved: trustedDesktopBridge,
        previewOnly: this.parseBoolean(body.previewOnly) === true,
        connectedModelIds: this.readStringArray(body.connectedModelIds),
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
        deps.writeJson(res, { ok: false, error: 'Campo "text" needs ser uma string not empty.' }, 400);
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
          trustedDesktopBridge: this.isVerifiedDesktopBridge(req, deps),
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
      surface: this.readOptionalString(body.surface) || 'zavorthControl-sales-pack',
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
    deps: ZavorthControlCoreRouteDeps,
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
    authenticatedIdentity: ZavorthControlAuthenticatedIdentity,
    body: Record<string, any>,
    url: URL,
  ): string | null {
    if (authenticatedIdentity.source === 'zavorthControl-token') {
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

  private readStringArray(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
      return null;
    }
    const values = value
      .map((entry) => this.readOptionalString(entry))
      .filter((entry): entry is string => Boolean(entry));
    return values.length > 0 ? values : null;
  }

  private readRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private isVerifiedDesktopBridge(req: http.IncomingMessage, deps: ZavorthControlCoreRouteDeps): boolean {
    return this.getVerifiedDesktopBridgeUserId(req, deps) !== null;
  }

  private getVerifiedDesktopBridgeUserId(req: http.IncomingMessage, deps: ZavorthControlCoreRouteDeps): string | null {
    if (req.headers['x-zavorth-desktop-bridge'] !== '1') {
      return null;
    }
    const identity = deps.authService?.resolveAuthenticatedIdentity(req);
    if (identity?.authenticated !== true || !identity.userId) {
      return null;
    }
    return identity.userId;
  }

  private readRuntimeStateActionType(value: unknown): ZavorthRuntimeStateActionType | null {
    const actionType = this.readOptionalString(value) as ZavorthRuntimeStateActionType | null;
    return actionType && RUNTIME_STATE_ACTION_TYPES.has(actionType) ? actionType : null;
  }

  private readIdentityUserId(identity: ZavorthControlAuthenticatedIdentity | null): string | null {
    const userId = this.readOptionalString(identity && 'userId' in identity ? identity.userId : null);
    return userId || null;
  }
}


