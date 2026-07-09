import * as http from 'http';
import { configureCanonicalPublicApi } from '../api/public/endpoints.js';
import { ZavorthControlAuthService } from './ZavorthControlAuthService.js';
import { SharedSurfaceCommandService } from './SharedSurfaceCommandService.js';
import type { SharedSurfaceRuntime } from './SurfaceRuntime.js';
import { WebAppConversationService } from './WebAppConversationService.js';
import type { WebAppRealtimeInfrastructure } from '../domain/surface/presentation/web-app/WebAppRuntimeInfrastructureService.js';
import type { WebAppSharedSurfaceFactorySource } from '../domain/surface/presentation/web-app/WebAppSharedSurfaceFactoryService.js';
import type { UniversalAgentToolRuntime, ZavorthAgentGateway } from '../runtime/agent/index.js';
import {
  createWebAppServiceComposition,
  type WebAppServiceComposition,
} from '../domain/surface/presentation/web-app/WebAppServiceComposition.js';
import {
  createWebAppOperationsState,
  createWebAppRuntimeServiceState,
  type WebAppOperationsDeps,
  type WebAppOperationsState,
  type WebAppRuntimeServiceState,
} from '../domain/surface/presentation/web-app/WebAppServiceState.js';
import { ExecutionEngineRegistryService } from './ExecutionEngineRegistryService.js';
import { ExecutionEngineRouterService } from './ExecutionEngineRouterService.js';
import { GlassBoxTraceService } from './GlassBoxTraceService.js';
import { TrustedWorkspacePolicyService } from './TrustedWorkspacePolicyService.js';

export type WebAppRuntime = SharedSurfaceRuntime;
export type { WebAppOperationsDeps } from '../domain/surface/presentation/web-app/WebAppServiceState.js';

export type WebAppServiceOptions = {
  agentGateway?: ZavorthAgentGateway | null;
  toolRuntime?: UniversalAgentToolRuntime | null;
};

export class WebAppService {
  private runtime: SharedSurfaceRuntime | null = null;
  private realtime: WebAppRealtimeInfrastructure['realtime'] | null = null;
  private conversation: WebAppConversationService | null = null;
  private sharedSurfaceCommandService: SharedSurfaceCommandService | null = null;
  private readonly operations: WebAppOperationsState = createWebAppOperationsState();
  private readonly runtimeServices: WebAppRuntimeServiceState = createWebAppRuntimeServiceState();
  private readonly composition: WebAppServiceComposition;
  private readonly executionEngineRegistry = new ExecutionEngineRegistryService();
  private readonly trustedWorkspaces = new TrustedWorkspacePolicyService();
  private readonly glassBoxTrace = new GlassBoxTraceService();
  private readonly executionEngineRouter = new ExecutionEngineRouterService(
    this.executionEngineRegistry,
    this.trustedWorkspaces,
    this.glassBoxTrace,
  );

  constructor(private auth: ZavorthControlAuthService, options: WebAppServiceOptions = {}) {
    this.composition = createWebAppServiceComposition({
      auth: this.auth,
      operations: this.operations,
      runtimeServices: this.runtimeServices,
      getRuntime: () => this.runtime,
      getRealtime: () => this.realtime,
      getConversationService: this.getConversationService.bind(this),
      getSharedSurfaceFactorySource: this.getSharedSurfaceFactorySource.bind(this),
      isComputerUseEnabled: this.isComputerUseEnabled.bind(this),
      agentGateway: options.agentGateway || null,
      toolRuntime: options.toolRuntime || null,
    });
    configureCanonicalPublicApi(this.composition.publicApiRouter, this.composition.publicApi);
  }

  public attachRuntime(runtime: SharedSurfaceRuntime): void {
    const infrastructure = this.composition.gatewayRuntime.attachRuntime(runtime);
    this.runtime = this.composition.gatewayRuntime.getRuntime();
    this.applyRealtimeInfrastructure(infrastructure);
    this.sharedSurfaceCommandService = null;
    this.initializeConversationInfrastructure();
    this.syncRuntimeChannelRegistry();
    this.rebuildRuntimeGatewayServices();
  }

  public attachOperationsServices(deps: WebAppOperationsDeps): void {
    this.composition.operationsAttachment.apply(this.operations, deps);
    this.composition.gatewayRuntime.attachOperations(
      this.composition.operationsAttachment.buildGatewayRuntimeAttachment(this.operations),
    );
    this.syncRuntimeChannelRegistry();
    this.rebuildRuntimeGatewayServices();
    this.sharedSurfaceCommandService = null;
  }

  private applyRealtimeInfrastructure(infrastructure: WebAppRealtimeInfrastructure): void {
    this.realtime = infrastructure.realtime;
    this.runtimeServices.gatewaySessionStore = infrastructure.gatewaySessionStore;
    this.runtimeServices.gatewaySessionService = infrastructure.gatewaySessionService;
    this.runtimeServices.gatewaySessionReadModel = infrastructure.gatewaySessionReadModel;
    this.runtimeServices.gatewayChannelRegistry = infrastructure.gatewayChannelRegistry;
    this.runtimeServices.gatewayChannelRouter = infrastructure.gatewayChannelRouter;
  }

  private syncRuntimeChannelRegistry(): void {
    if (!this.runtimeServices.gatewayChannelRegistry) {
      return;
    }
    this.runtimeServices.gatewayChannelRegistry.setRuntimeAdapters(this.operations.runtimeChannelAdapters);
  }

  private initializeConversationInfrastructure(): void {
    if (!this.runtime || !this.realtime) {
      throw new Error('Runtime web ainda nao conectada ao gateway principal.');
    }

    this.conversation = new WebAppConversationService({
      runtime: this.runtime,
      realtime: this.realtime,
      getGatewaySessionTools: this.composition.runtimeContextBridge.getGatewaySessionTools.bind(
        this.composition.runtimeContextBridge,
      ),
      getSharedSurfaceCommandService: () => this.getSharedSurfaceCommandService(),
      taskResourcePlanner: this.composition.taskResourcePlanner,
      modeEscalation: this.composition.modeEscalation,
      agentGateway: this.composition.agentGateway,
      executionEngineRouter: this.executionEngineRouter,
    });
  }

  private getSharedSurfaceCommandService(): SharedSurfaceCommandService | null {
    if (!this.runtime) {
      return null;
    }

    if (!this.sharedSurfaceCommandService) {
      this.sharedSurfaceCommandService = this.composition.sharedSurfaceFactory.build(
        this.getSharedSurfaceFactorySource(),
      );
    }

    return this.sharedSurfaceCommandService;
  }

  private getSharedSurfaceFactorySource(): WebAppSharedSurfaceFactorySource {
    return {
      runtime: this.runtime,
      operations: this.operations,
      runtimeServices: this.runtimeServices,
      channelSetupAssistant: this.composition.channelSetupAssistant,
      computerUseWatchModePolicy: this.composition.computerUseWatchModePolicy,
      computerUseWatchModeState: this.composition.computerUseWatchModeState,
      computerUseWatchMode: this.composition.computerUseWatchMode,
      accessManifest: this.composition.accessManifest,
      installJourney: this.composition.installJourney,
      officialRemoteAccess: this.composition.officialRemoteAccess,
      desktopResources: this.composition.desktopResources,
      companions: this.composition.companions,
      taskResourcePlanner: this.composition.taskResourcePlanner,
      modeEscalation: this.composition.modeEscalation,
      workspaceOptimizer: this.composition.workspaceOptimizer,
      surfaceConsistency: this.composition.surfaceConsistency,
      skillCatalogApi: this.composition.skillCatalogApi,
      skillMcpSidecar: this.composition.skillMcpSidecar,
      skillLibraryPresentation: this.composition.skillLibraryPresentation,
      skillInstallPlanPresentation: this.composition.skillInstallPlanPresentation,
      skillBridgeActivation: this.composition.skillBridgeActivation,
      selfModificationCommandService: this.composition.selfModificationCommandService,
      systemOverlordControl: this.composition.systemOverlordControl,
      engineeringCore: this.composition.engineeringCore,
    };
  }

  private rebuildRuntimeGatewayServices(): void {
    if (!this.runtime || !this.runtimeServices.gatewayChannelRegistry) {
      this.runtimeServices.sessionPlane = null;
      this.runtimeServices.memoryPlane = null;
      this.runtimeServices.sessionTools = null;
      this.runtimeServices.gatewaySessionTools = null;
      this.runtimeServices.toolSurface = null;
      this.runtimeServices.gateway = null;
      return;
    }

    this.runtimeServices.sessionTools = this.composition.gatewayRuntime.getSessionTools();
    this.runtimeServices.gatewaySessionTools = this.composition.gatewayRuntime.getGatewaySessionTools();
    this.runtimeServices.toolSurface = this.composition.gatewayRuntime.getToolSurface();
    this.runtimeServices.memoryPlane = this.composition.gatewayRuntime.getMemoryPlane();
    this.runtimeServices.sessionPlane = this.composition.gatewayRuntime.getSessionPlane();
    this.runtimeServices.gateway = this.composition.gatewayRuntime.getGateway();
  }

  public start(): void {
    this.realtime?.start();
  }

  public stop(): void {
    this.realtime?.stop();
    this.composition.satelliteTransport.shutdown();
    this.composition.sessionV2.shutdown();
    this.composition.swarmV2.shutdown();
    this.composition.gatewayControlSockets.shutdown();
    this.composition.sessionV2Sockets.shutdown();
  }

  public handleUpgrade(
    req: http.IncomingMessage,
    socket: import('stream').Duplex,
    head: Buffer,
  ): boolean {
    if (this.composition.satelliteTransport.handleUpgrade(req, socket, head)) {
      return true;
    }

    if (
      this.composition.gatewayControlSockets.handleUpgrade(
        req,
        socket,
        head,
        this.composition.routeDepsFactory.buildGatewayControlSocketDeps(),
      )
    ) {
      return true;
    }

    const sharedPtyOptions = {
      authorize: (request: http.IncomingMessage, requestUrl: URL) =>
        this.composition.webSecurity.isAuthorizedUpgrade(request, requestUrl),
      authorizeInput: () => {
        const profile = String(
          process.env.ZAVORTH_LIVE_TERMINAL_INPUT
            || process.env.ZAVORTH_WEB_RUNTIME_PROFILE
            || 'safe',
        ).trim().toLowerCase();
        return profile === 'trusted' || profile === 'dangerous' || profile === 'true';
      },
      resolveSession: (sessionId: string, requestUrl: URL) => this.composition.sessionV2.ensureController({
        sessionId,
        cwd: String(requestUrl.searchParams.get('cwd') || '').trim() || undefined,
        record: String(requestUrl.searchParams.get('record') || '').trim().toLowerCase() !== 'false',
      }),
    };
    if (this.composition.sessionV2Sockets.handleUpgrade(req, socket, head, {
      ...sharedPtyOptions,
      path: '/api/web/gateway/session-v2/ws',
    })) {
      return true;
    }
    return this.composition.sessionV2Sockets.handleUpgrade(req, socket, head, {
      ...sharedPtyOptions,
      path: '/api/web/experimental/session-v2/ws',
    });
  }

  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    pathname: string,
  ): Promise<boolean> {
    if (!this.applyCorsHeaders(req, res)) {
      this.composition.runtimeContextBridge.writeJson(res, { error: 'Origin not allowed.' }, 403);
      return true;
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }

    if (
      this.composition.satellitePwaRoutes.handleStaticRoute(
        pathname,
        res,
        this.composition.runtimeContextBridge.writeJson.bind(this.composition.runtimeContextBridge),
      )
    ) {
      return true;
    }

    if (
      this.composition.consoleAssets.handleStaticRoute(
        pathname,
        res,
        this.composition.runtimeContextBridge.writeJson.bind(this.composition.runtimeContextBridge),
      )
    ) {
      return true;
    }

    if (pathname === '/api/auth/status' && req.method === 'GET') {
      const status = this.auth.getStatus();
      const gatewayHealth = this.composition.gatewayRuntime.buildHealthSnapshot();
      this.composition.runtimeContextBridge.writeJson(
        res,
        {
          ok: true,
          authRequired: status.enabled,
          tokenSource: status.source,
          webReady: Boolean(this.runtime),
          gatewayReady: gatewayHealth.gatewayAvailable,
          gatewayStatus: gatewayHealth.status,
          gatewaySource: gatewayHealth.gatewaySource,
          runtimeAttached: gatewayHealth.runtimeAttached,
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/auth/validate' && req.method === 'POST') {
      const body = await this.composition.runtimeContextBridge.readJsonBody(req);
      const token = String(body.token || '').trim();
      if (!this.auth.validate(token)) {
        this.composition.runtimeContextBridge.writeJson(
          res,
          {
            ok: false,
            error: 'Token invalido ou antigo.',
            code: 'zavorthControl_token_mismatch',
            recovery: {
              primaryCommand: 'zavorth zavorthControl',
              commands: [
                'zavorth zavorthControl',
                'zavorth zavorthControl url',
                'zavorth zavorthControl repair',
                'zavorth zavorthControl generate-token',
                'zavorth zavorthControl token',
              ],
              hint: 'Abra uma nova aba com `zavorth zavorthControl`. Se continuar falhando, rode `zavorth zavorthControl repair`.',
            },
          },
          401,
        );
        return true;
      }

      this.composition.runtimeContextBridge.writeJson(res, { ok: true }, 200);
      return true;
    }

    if (pathname === '/api/auth/ticket' && req.method === 'POST') {
      const ticket = this.composition.webSecurity.issueUpgradeTicket(req);
      if (!ticket.ok) {
        this.composition.runtimeContextBridge.writeJson(
          res,
          {
            ok: false,
            error: 'Unauthorized',
          },
          401,
        );
        return true;
      }

      this.composition.runtimeContextBridge.writeJson(res, ticket, 200);
      return true;
    }

    if (pathname.startsWith('/api/v1')) {
      await this.composition.publicApiRouter.route(req, res);
      return true;
    }

    if (!pathname.startsWith('/api/web')) {
      return false;
    }

    const isNodeMeshPublicRoute =
      (pathname === '/api/web/nodes/pairing/claim' && req.method === 'POST')
      || (pathname === '/api/web/nodes/heartbeat' && req.method === 'POST');

    if (
      pathname === '/api/web/zavorthControl'
      && req.method === 'GET'
      && !this.isAuthorized(req, url)
    ) {
      this.composition.runtimeContextBridge.writeJson(
        res,
        this.buildPublicZavorthControlFallbackSnapshot(),
        200,
      );
      return true;
    }

    if (!isNodeMeshPublicRoute && !this.isAuthorized(req, url)) {
      this.composition.runtimeContextBridge.writeJson(res, { error: 'Unauthorized' }, 401);
      return true;
    }

    try {
      if (
        await this.composition.surfaceRoutes.handleRequest(
          req,
          res,
          url,
          pathname,
          this.composition.routeDepsFactory.buildSurfaceRouteDeps(),
        )
      ) {
        return true;
      }

      if (
        await this.composition.nodeRoutes.handleRequest(
          req,
          res,
          url,
          pathname,
          this.composition.routeDepsFactory.buildNodeRouteDeps(),
        )
      ) {
        return true;
      }

      if (!this.ensureRuntimeAttached(res)) {
        return true;
      }

      if (
        await this.composition.runtimeRoutes.handleRequest(
          req,
          res,
          url,
          pathname,
          this.composition.routeDepsFactory.buildRuntimeRouteDeps(),
        )
      ) {
        return true;
      }
    } catch (error: any) {
      const message = error?.message || 'Falha interna ao processar a rota web.';
      if (!res.headersSent) {
        this.composition.runtimeContextBridge.writeJson(res, { ok: false, error: message }, 500);
        return true;
      }
      throw error;
    }

    this.composition.runtimeContextBridge.writeJson(res, { error: 'Not found' }, 404);
    return true;
  }

  private isComputerUseEnabled(): boolean {
    const explicit = String(process.env.ZAVORTH_COMPUTER_USE_ENABLED || '').trim().toLowerCase();
    if (explicit === 'true') {
      return true;
    }
    if (explicit === 'false') {
      return false;
    }

    const profile = String(
      process.env.ZAVORTH_COMPUTER_USE_PROFILE
        || process.env.ZAVORTH_WEB_RUNTIME_PROFILE
        || process.env.ZAVORTH_MCP_PROFILE
        || 'safe',
    ).trim().toLowerCase();
    return profile === 'trusted' || profile === 'dangerous';
  }

  private isAuthorized(req: http.IncomingMessage, _url: URL): boolean {
    return this.composition.webSecurity.isAuthorized(req);
  }

  private ensureRuntimeAttached(res?: http.ServerResponse): boolean {
    if (this.runtime && this.realtime) {
      return true;
    }

    if (res) {
      this.composition.runtimeContextBridge.writeJson(
        res,
        {
          ok: false,
          error: 'Web app ainda nao conectada ao gateway principal.',
        },
        503,
      );
    }
    return false;
  }

  private buildPublicZavorthControlFallbackSnapshot(): Record<string, any> {
    const generatedAt = new Date().toISOString();
    return {
      ok: true,
      live: false,
      authRequired: true,
      generatedAt,
      snapshot: {
        generatedAt,
        source: {
          kind: 'universal-agent-runtime',
          label: 'Zavorth Agent Gateway',
        },
        activeRun: null,
        runs: [],
        workflowJobs: [],
        workflowQueue: {
          kind: 'memory',
          label: 'ZavorthControl safe public fallback',
          version: 'agent-workflow-queue-store/v1',
          capabilities: {
            durable: false,
            localOnly: true,
            multiHostSafe: false,
            atomicClaim: false,
            lease: false,
            heartbeat: false,
            backoff: false,
            retry: false,
          },
          notes: [
            'Autenticacao necessaria para ler runs reais do Zavorth Agent Gateway.',
          ],
        },
      },
    };
  }

  private getConversationService(): WebAppConversationService {
    if (!this.conversation) {
      throw new Error('Fluxo de conversa web indisponivel.');
    }
    return this.conversation;
  }

  private applyCorsHeaders(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    return this.composition.webSecurity.applyCorsHeaders(req, res);
  }
}

