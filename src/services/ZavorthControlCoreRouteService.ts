import { asErrorLike } from '../utils/errorLike';
import { SalesPackBusinessModeService } from './SalesPackBusinessModeService.js';

import * as http from 'http';
import path from 'path';
import fs from 'fs';
import { safeParseInt } from '../ai-gateway/shared/utils/safeParseInt.js';
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
import { logger } from '../logger.js';

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
import { handleControlPlatformRoutes } from './ZavorthControlPlatformRoutes.js';
import { handleControlWorkspaceApprovalRoutes } from './ZavorthControlWorkspaceApprovalRoutes.js';
import { handleControlWorkspaceTrustRoutes } from './ZavorthControlWorkspaceTrustRoutes.js';
import { handleControlProviderHostRoutes } from './ZavorthControlProviderHostRoutes.js';
import { handleControlPermissionRoutes } from './ZavorthControlPermissionRoutes.js';

type WriteJson = (res: http.ServerResponse, body: unknown, statusCode?: number) => void;
type WriteText = (res: http.ServerResponse, body: string, statusCode?: number) => void;
type WriteRedirect = (res: http.ServerResponse, location: string, statusCode?: number) => void;
type ReadJsonBody = (req: http.IncomingMessage) => Promise<Record<string, unknown>>;
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
  'workboard-sync',
]);

type NodeMeshLike = {
  buildSnapshot: (input?: { selectedNodeId?: string | null }) => unknown;
};

type NodeHeartbeatLike = {
  claimPairing: (input: Record<string, unknown>) => unknown;
  receiveHeartbeat: (input: Record<string, unknown>) => unknown;
};

type A2UISurfaceSnapshot = {
  generatedAt: string;
  protocolVersion: string;
  capabilities: string[];
  allowedComponents: unknown[];
  surfaceId: string | null;
  surfaces: unknown[];
  commands: Record<string, string>;
};

type A2UIStreamItem = {
  generatedAt: string;
  protocolVersion: string;
  surfaceId: string | null;
  items: unknown[];
  commands: Record<string, string>;
};

type A2UIActionResult = {
  ok: boolean;
  status?: string;
  [key: string]: unknown;
};

type A2UIServiceLike = {
  readSnapshot?: (surfaceId?: string) => A2UISurfaceSnapshot;
  listSurfaces?: () => unknown[];
  listEvents?: (surfaceId?: string, limit?: number) => unknown[];
  readStream?: (surfaceId?: string, limit?: number) => A2UIStreamItem;
  listAssets?: (surfaceId?: string) => unknown[];
  dispatchAction?: (input: {
    surfaceId: string;
    actionId: string;
    requestedBy?: string;
    payload?: Record<string, unknown>;
    correlation?: Record<string, unknown> | null;
  }) => Promise<A2UIActionResult>;
  getSurfaceState?: (surfaceId: string) => unknown;
};

type ProactivePermissionsServiceLike = {
  listPending?: () => unknown[];
  resolve: (id: string, approved: boolean) => boolean;
};

type CommandApprovalRow = {
  operation_id: string;
  workspace_id: string;
  command: string;
  created_at: string;
  expires_at: string;
};

type HostCommandProposalRow = {
  operation_id: string;
  workspace_id: string;
  command_preview_redacted: string;
  args_preview_redacted: string;
  cwd_suffix: string;
  shell: number;
  risk_level: string;
  reason_redacted: string;
  created_at: string;
  expires_at: string;
  requires_strong_confirmation: number;
  strong_confirmation_phrase: string;
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
  a2ui: A2UIServiceLike;
  proactivePermissions: ProactivePermissionsServiceLike;
  experienceCore?: Pick<ExperienceCoreService, 'buildHome' | 'executeCommand' | 'buildTimelineForRun' | 'dispatchRuntimeStateAction' | 'buildRuntimeCapabilities' | 'syncRuntimeOperationalState'> | null;
  authService?: Pick<ZavorthControlAuthService, 'validate' | 'resolveAuthenticatedIdentity'>;
  echo?: {
    getPendingPermissions: () => unknown[];
    resolvePermission: (id: string, approved: boolean, resolvedBy?: Record<string, unknown>) => Promise<unknown>;
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
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('WorkspaceResolver.resolve failed for hint "%s": %s', workspaceHint, (err as Error).message);
    }
    try {
      const allowed = WorkspaceResolver.getAllowedRoots();
      for (const root of allowed) {
        if (path.basename(root).toLowerCase() === workspaceHint.toLowerCase()) {
          return fs.realpathSync(root);
        }
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('WorkspaceResolver.getAllowedRoots failed for hint "%s": %s', workspaceHint, (err as Error).message);
    }
    try {
      const resolved = path.resolve(workspaceHint);
      if (fs.existsSync(resolved) && WorkspaceResolver.isWorkspaceAllowed(resolved)) {
        return fs.realpathSync(resolved);
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('Path resolution fallback failed for hint "%s": %s', workspaceHint, (err as Error).message);
    }
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
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('validateWorkspaceSession: workspace comparison failed for "%s": %s', workspaceId, (err as Error).message);
    }

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
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('validateWorkspaceSession: alias resolution failed for "%s": %s', workspaceId, (err as Error).message);
    }

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
    const routeInput = { req, res, url, pathname, deps };
    const platformResult = await handleControlPlatformRoutes(routeInput, {
      transportRoutes: this.transportRoutes,
      operationalMaturity: this.operationalMaturity,
      salesPack: this.salesPack,
      salesPackBusinessMode: this.salesPackBusinessMode,
      salesPackChannelIo: this.salesPackChannelIo,
      localAccessRoutes: this.localAccessRoutes,
      handleExperienceRequest: this.handleExperienceRequest.bind(this),
      handleNodeMeshLiveEvents: this.handleNodeMeshLiveEvents.bind(this),
      isNodeMeshLiveAuthorized: this.isNodeMeshLiveAuthorized.bind(this),
      parseBoolean: this.parseBoolean.bind(this),
      readBusinessModeIdentity: this.readBusinessModeIdentity.bind(this),
      readOptionalString: this.readOptionalString.bind(this),
      readSalesPackChannelIoEnvelope: this.readSalesPackChannelIoEnvelope.bind(this),
      readSalesPackInboundMessage: this.readSalesPackInboundMessage.bind(this),
    });
    if (platformResult !== null) return platformResult;

    const workspaceContext = {
      validateWorkspaceSession: this.validateWorkspaceSession.bind(this),
    };
    const approvalResult = await handleControlWorkspaceApprovalRoutes(routeInput, workspaceContext);
    if (approvalResult !== null) return approvalResult;
    const trustResult = await handleControlWorkspaceTrustRoutes(routeInput, workspaceContext);
    if (trustResult !== null) return trustResult;
    const providerHostResult = await handleControlProviderHostRoutes(routeInput);
    if (providerHostResult !== null) return providerHostResult;
    const permissionResult = await handleControlPermissionRoutes(routeInput, {
      readResolverContext: this.readResolverContext.bind(this),
    });
    return permissionResult ?? false;
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
    body: Record<string, unknown> = {},
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
        surface: this.readOptionalString(body['surface']) || homeInput.surface,
        userId: desktopBridgeUserId || this.readIdentityUserId(authenticatedIdentity) || 'authenticated-user',
        sessionId: this.readOptionalString(body['sessionId']) || homeInput.sessionId,
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
      const text = this.readOptionalString(body['text']) || this.readOptionalString(body.message);
      if (!text) {
        deps.writeJson(res, { ok: false, error: 'Campo "text" needs ser uma string not empty.' }, 400);
        return true;
      }
      const metadata = this.readRecord(body['metadata']) || { source: 'runtime-api' };
      const command: Partial<ExperienceCommand> & { text: string } = {
        text,
        intent: (this.readOptionalString(body.intent) as ExperienceCommand['intent']) || 'ask',
        surface: this.readExperienceSurface(body['surface']),
        userId: this.readOptionalString(body['userId']) || 'web-user',
        sessionId: this.readOptionalString(body['sessionId']),
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
      const choice =
        this.readOptionalString(body.choice) ||
        this.readOptionalString(body.permissionChoice) ||
        (decision === 'reject' ? 'deny' : 'once');
      const baseMeta = this.readRecord(body['metadata']) || { source: 'runtime-api' };
      deps.writeJson(res, await service.executeCommand({
        text: `${decision} approval ${approvalId}`,
        intent: 'approve',
        surface: this.readExperienceSurface(body['surface']),
        userId: this.readOptionalString(body['userId']) || 'web-user',
        sessionId: this.readOptionalString(body['sessionId']),
        workspace: this.readOptionalString(body.workspace),
        approval: { id: approvalId, decision },
        metadata: {
          ...baseMeta,
          choice,
          source: baseMeta.source || 'runtime-api',
        },
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
        surface: this.readExperienceSurface(body['surface']),
        userId: this.readOptionalString(body['userId']) || 'web-user',
        sessionId: this.readOptionalString(body['sessionId']),
        workspace: this.readOptionalString(body.workspace),
        learning: { candidateId, decision },
        metadata: this.readRecord(body['metadata']) || { source: 'runtime-api' },
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

  private readResolverContext(body: Record<string, unknown>): Record<string, unknown> | null {
    const context = {
      sessionId: typeof body['sessionId'] === 'string' ? body['sessionId'] : undefined,
      surface: typeof body['surface'] === 'string' ? body['surface'] : undefined,
      requestedBy: typeof body['requestedBy'] === 'string' ? body['requestedBy'] : undefined,
      channel: typeof body['channel'] === 'string' ? body['channel'] : undefined,
      chatId: typeof body['chatId'] === 'string' ? body['chatId'] : undefined,
      threadId: typeof body['threadId'] === 'string' ? body['threadId'] : undefined,
      userId: typeof body['userId'] === 'string' ? body['userId'] : undefined,
    };
    return Object.values(context).some((value) => typeof value === 'string' && value.trim().length > 0)
      ? context
      : null;
  }

  private readSalesPackInboundMessage(body: Record<string, unknown>): SalesPackInboundMessageInput | null {
    const text = this.readNonEmptyString(body['text']);
    const customerId = this.readNonEmptyString(body['customerId']);
    if (!text || !customerId) {
      return null;
    }

    return {
      tenantId: this.readNonEmptyString(body['tenantId']) || 'default-tenant',
      channelAccountId: this.readOptionalString(body['channelAccountId']),
      customerId,
      conversationId: this.readOptionalString(body['conversationId']),
      actorId: this.readOptionalString(body['actorId']),
      text,
      traceId: this.readOptionalString(body['traceId']),
      runId: this.readOptionalString(body['runId']),
      surface: this.readOptionalString(body['surface']) || 'zavorthControl-sales-pack',
      receivedAt: this.readOptionalString(body['receivedAt']),
      metadata: this.readRecord(body['metadata']),
    };
  }

  private readSalesPackChannelIoEnvelope(
    body: Record<string, unknown>,
    headers: http.IncomingHttpHeaders,
  ): SalesPackChannelIoEnvelope {
    return {
      tenantId: this.readOptionalString(body['tenantId']),
      channelAccountId: this.readOptionalString(body['channelAccountId']),
      platform: this.readOptionalString(body.platform) as SalesPackChannelIoEnvelope['platform'],
      provider: this.readOptionalString(body.provider) as SalesPackChannelIoEnvelope['provider'],
      providerMessageId: this.readOptionalString(body.providerMessageId),
      customerId: this.readOptionalString(body['customerId']),
      conversationId: this.readOptionalString(body['conversationId']),
      actorId: this.readOptionalString(body['actorId']),
      text: this.readOptionalString(body['text']),
      traceId: this.readOptionalString(body['traceId']),
      runId: this.readOptionalString(body['runId']),
      receivedAt: this.readOptionalString(body['receivedAt']),
      headers,
      body,
      metadata: this.readRecord(body['metadata']),
    };
  }

  private readBusinessModeIdentity(
    req: http.IncomingMessage,
    url: URL,
    body: Record<string, unknown> = {},
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
      || this.readOptionalString(body['productModeId'])
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
    body: Record<string, unknown>,
    url: URL,
  ): string | null {
    if (authenticatedIdentity.source === 'zavorthControl-token') {
      return authenticatedIdentity.profileId;
    }
    return this.readOptionalString(body['profileId'])
      || this.readOptionalString(body['tenantId'])
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

