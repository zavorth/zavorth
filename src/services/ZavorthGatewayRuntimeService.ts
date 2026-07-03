import type { ChannelAdapterContract } from '../contracts/ChannelMeshContract.js';
import type { ZavorthCapabilityCatalogService } from './ZavorthCapabilityCatalogService.js';
import type { ZavorthChannelMeshService } from './ZavorthChannelMeshService.js';
import type { ZavorthGatewayService } from './ZavorthGatewayService.js';
import type { ZavorthHookPlaneService } from './ZavorthHookPlaneService.js';
import type { ZavorthMemoryPlaneService } from './ZavorthMemoryPlaneService.js';
import type { ZavorthNodeMeshService } from './ZavorthNodeMeshService.js';
import type { ZavorthPlatformRegistryService } from './ZavorthPlatformRegistryService.js';
import type { ZavorthPluginRegistryService } from './ZavorthPluginRegistryService.js';
import type { ZavorthRemoteTransportService } from './ZavorthRemoteTransportService.js';
import type { ZavorthRuntimeModesService } from './ZavorthRuntimeModesService.js';
import type { ZavorthSecurityMeshService } from './ZavorthSecurityMeshService.js';
import type { ZavorthSessionPlaneService } from './ZavorthSessionPlaneService.js';
import type { ZavorthTeamCatalogService } from './ZavorthTeamCatalogService.js';
import type { ZavorthToolSurfaceService } from './ZavorthToolSurfaceService.js';
import { ZavorthControlAuthService } from './ZavorthControlAuthService.js';
import type { GatewayChannelRegistryService } from './GatewayChannelRegistryService.js';
import type { GatewayChannelRouterService } from './GatewayChannelRouterService.js';
import type { GatewaySessionReadModelService } from '../runtime/sessions/GatewaySessionReadModelService.js';
import type { GatewaySessionService } from '../runtime/sessions/GatewaySessionService.js';
import type { GatewaySessionStoreService } from '../runtime/sessions/GatewaySessionStoreService.js';
import type { GatewaySessionToolsService } from '../runtime/sessions/GatewaySessionToolsService.js';
import type { IntegrationHubService } from './IntegrationHubService.js';
import type { OperationsHealthService } from '../observability/OperationsHealthService.js';
import type {
  ProviderCatalogEntry,
  ProviderControlPlaneService,
  ProviderProfile,
} from './ProviderControlPlaneService.js';
import type { FirstRunOnboardingContractSnapshot } from '../contracts/FirstRunOnboardingContract.js';
import type { ModelPickerContract } from '../contracts/ModelPickerContract.js';
import type { WebsitePublicContractSnapshot } from '../contracts/WebsitePublicContract.js';
import type {
  ZavorthAgentGatewayHandoffContext,
  ZavorthAgentGatewayHandoffSnapshot,
} from '../contracts/ZavorthAgentGatewayHandoffContract.js';
import type {
  ZavorthAgentGatewaySnapshot,
  ZavorthAgentGatewaySnapshotOptions,
} from '../runtime/agent/index.js';
import { ModelPickerContractService } from '../domain/providers/index.js';
import type {
  AIGatewayProxyService,
  AIGatewayProxyStatus,
} from './AIGatewayProxyService.js';
import {
  AIGatewayNativeConvergenceService,
  type AIGatewayNativeConvergenceSnapshot,
} from './AIGatewayNativeConvergenceService.js';
import type { ZavorthProductModeSnapshot } from './ProductModeService.js';
import {
  ZavorthProductizationContractService,
  type ZavorthProductizationContractSnapshot,
} from './ZavorthProductizationContractService.js';
import type { ZavorthSandboxControlPlaneSnapshot } from './ZavorthSandboxControlPlaneService.js';
import type { SharedSurfaceRuntime } from './SurfaceRuntime.js';
import {
  WebAppRuntimeInfrastructureService,
  type WebAppRealtimeInfrastructure,
  type WebAppRuntimeGatewayInfrastructure,
} from '../domain/surface/presentation/web-app/WebAppRuntimeInfrastructureService.js';
import type { WebRealtimeBusSnapshot } from './WebRealtimeService.js';
import { ZavorthHomePathService } from './ZavorthHomePathService.js';

export type ZavorthGatewayRuntimeHealthSnapshot = {
  status: 'ready' | 'partial' | 'degraded';
  runtimeAttached: boolean;
  operationsAttached: boolean;
  realtimeAttached: boolean;
  gatewayAvailable: boolean;
  sessionPlaneAvailable: boolean;
  authEnabled: boolean;
  gatewaySource: 'runtime' | 'operations' | 'none';
  issues: string[];
  summary: string;
};

export type ZavorthGatewayRuntimeSnapshot = {
  generatedAt: string;
  auth: ReturnType<ZavorthControlAuthService['getStatus']>;
  health: ZavorthGatewayRuntimeHealthSnapshot;
  gatewayControlApi: ZavorthGatewayControlApiSnapshot;
  controlPlane: {
    preferredTransport: 'http' | 'sse' | 'ws';
    availableTransports: Array<'http' | 'sse' | 'ws'>;
    websocketPath: string;
    ssePath: string;
    statePath: string;
    historyPath: string;
    sendPath: string;
    spawnPath: string;
    heartbeatIntervalMs: number;
    reconnectStrategy: 'reuse-session-state';
    sessionId: string | null;
    chatId: string | null;
  };
  sessionBus: WebRealtimeBusSnapshot | null;
  gateway:
    | Awaited<ReturnType<ZavorthGatewayService['buildHydratedSnapshot']>>
    | ReturnType<ZavorthGatewayService['buildShellSnapshot']>
    | null;
  aiGatewayConvergence: AIGatewayNativeConvergenceSnapshot | null;
  productization: ZavorthProductizationContractSnapshot | null;
};

export const GATEWAY_CONTROL_API_CONTRACT_VERSION = '2026-04-27.p2-006h' as const;

export type GatewayControlApiOperationRisk = 'read' | 'write' | 'sensitive';
export type GatewayControlApiOperationStatus = 'available' | 'delegated' | 'planned';

export type GatewayControlApiOperationDescriptor = {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  risk: GatewayControlApiOperationRisk;
  requiresApproval: boolean;
  status: GatewayControlApiOperationStatus;
  source: 'zavorth-runtime' | 'provider-control-plane' | 'ai-gateway-route';
  summary: string;
};

export type ZavorthGatewayControlApiSnapshot = {
  ok: boolean;
  contractVersion: typeof GATEWAY_CONTROL_API_CONTRACT_VERSION;
  generatedAt: string;
  boundary: {
    stableEntry: string;
    currentCut: 'P2-006h';
    doNotBypass: string[];
  };
  health: {
    status: 'ready' | 'partial' | 'degraded';
    providerControlPlaneAttached: boolean;
    AIGateway: AIGatewayProxyStatus | null;
    lastHealthyProvider: string | null;
    issues: string[];
  };
  home: {
    root: string;
    source: 'explicit' | 'env' | 'compat';
    isolated: boolean;
    statusCommand: string;
    switchCommand: string;
    warnings: string[];
  };
  providers: {
    source: 'provider-control-plane';
    includeAdvanced: boolean;
    currentProvider: string | null;
    currentModel: string | null;
    summary: {
      total: number;
      ready: number;
      needsConfig: number;
      needsProbe: number;
    };
    entries: ProviderCatalogEntry[];
  };
  models: {
    source: 'provider-control-plane';
    entries: Array<{
      providerId: string;
      providerLabel: string;
      model: string;
      ready: boolean;
      modality: 'chat';
    }>;
  };
  modelPicker?: ModelPickerContract | null;
  routing?: {
    source: 'model-picker' | 'provider-control-plane';
    strategy: 'selected-route-first' | 'provider-control-plane-current';
    activeProvider: string | null;
    activeModel: string | null;
    activeRouteId: string | null;
    activeFamilyId: string | null;
    readyRouteCount: number;
    totalRouteCount: number;
    fallback: Array<{
      routeId: string;
      providerId: string;
      providerLabel: string;
      model: string | null;
      readiness: string;
      ready: boolean;
    }>;
    warnings: string[];
  };
  usage?: {
    latency: {
      status: 'not_enough_data';
      requests: number;
      p50Ms: number | null;
      p95Ms: number | null;
      source: string;
    };
    cost: {
      status: 'not_configured';
      currentRequestEstimateUsd: number | null;
      windowCostUsd: number | null;
      source: string;
    };
  };
  profiles: ProviderProfile[];
  combos: {
    status: GatewayControlApiOperationStatus;
    sourceRoutes: string[];
    entries: unknown[];
    warnings: string[];
  };
  cache: {
    status: GatewayControlApiOperationStatus;
    sourceRoutes: string[];
    semanticStats: Record<string, unknown> | null;
    warnings: string[];
  };
  rateLimits: {
    status: GatewayControlApiOperationStatus;
    sourceRoutes: string[];
    entries: unknown[];
    warnings: string[];
  };
  operations: GatewayControlApiOperationDescriptor[];
  warnings: string[];
};

type ZavorthGatewayRuntimeOperations = {
  capabilityCatalog?: ZavorthCapabilityCatalogService | null;
  channelMesh?: ZavorthChannelMeshService | null;
  memoryPlane?: ZavorthMemoryPlaneService | null;
  securityMesh?: ZavorthSecurityMeshService | null;
  runtimeModes?: ZavorthRuntimeModesService | null;
  teamCatalog?: ZavorthTeamCatalogService | null;
  hookPlane?: ZavorthHookPlaneService | null;
  nodeMesh?: ZavorthNodeMeshService | null;
  pluginRegistry?: ZavorthPluginRegistryService | null;
  platformRegistry?: ZavorthPlatformRegistryService | null;
  remoteTransports?: ZavorthRemoteTransportService | null;
  operationsHealth?: OperationsHealthService | null;
  providerControlPlane?: ProviderControlPlaneService | null;
  aiGatewayGateway?: Pick<AIGatewayProxyService, 'readStatus'> | null;
  agentGateway?: {
    buildSnapshot(input?: ZavorthAgentGatewaySnapshotOptions): ZavorthAgentGatewaySnapshot;
  } | null;
  agentGatewayHandoff?: {
    buildHandoffSnapshot(context?: ZavorthAgentGatewayHandoffContext): Promise<ZavorthAgentGatewayHandoffSnapshot>;
  } | null;
  firstRunOnboardingContract?: {
    buildSnapshot(): FirstRunOnboardingContractSnapshot;
  } | null;
  websitePublicContract?: {
    buildSnapshot(): WebsitePublicContractSnapshot;
  } | null;
  sandboxControlPlane?: {
    buildSnapshot(input?: Record<string, unknown>): ZavorthSandboxControlPlaneSnapshot;
  } | null;
  productModeSnapshot?: ZavorthProductModeSnapshot | null;
  integrationHub?: IntegrationHubService | null;
  gateway?: ZavorthGatewayService | null;
  runtimeChannelAdapters?: ChannelAdapterContract[] | null;
};

export class ZavorthGatewayRuntimeService {
  private runtime: SharedSurfaceRuntime | null = null;
  private realtimeInfrastructure: WebAppRealtimeInfrastructure | null = null;
  private gatewayInfrastructure: WebAppRuntimeGatewayInfrastructure | null = null;
  private operations: ZavorthGatewayRuntimeOperations = {};

  constructor(
    private readonly auth: ZavorthControlAuthService,
    private readonly infrastructure: WebAppRuntimeInfrastructureService = new WebAppRuntimeInfrastructureService(),
  ) {}

  public attachRuntime(runtime: SharedSurfaceRuntime): WebAppRealtimeInfrastructure {
    const normalizedRuntime = this.infrastructure.ensureSurfaceDispatcher(runtime);
    this.runtime = normalizedRuntime;
    this.realtimeInfrastructure = this.infrastructure.buildRealtimeInfrastructure(normalizedRuntime);
    this.syncRuntimeChannelAdapters();
    this.rebuildGatewayInfrastructure();
    return this.realtimeInfrastructure;
  }

  public attachOperations(input: ZavorthGatewayRuntimeOperations): void {
    this.operations = {
      ...this.operations,
      ...input,
      runtimeChannelAdapters: Array.isArray(input.runtimeChannelAdapters)
        ? input.runtimeChannelAdapters.slice()
        : this.operations.runtimeChannelAdapters || [],
    };
    this.syncRuntimeChannelAdapters();
    this.rebuildGatewayInfrastructure();
  }

  public getRuntime(): SharedSurfaceRuntime | null {
    return this.runtime;
  }

  public getRealtime() {
    return this.realtimeInfrastructure?.realtime || null;
  }

  public getGateway(): ZavorthGatewayService | null {
    return this.gatewayInfrastructure?.gateway || this.operations.gateway || null;
  }

  public getMemoryPlane(): ZavorthMemoryPlaneService | null {
    return this.gatewayInfrastructure?.memoryPlane || this.operations.memoryPlane || null;
  }

  public getSessionPlane(): ZavorthSessionPlaneService | null {
    return this.gatewayInfrastructure?.sessionPlane || null;
  }

  public getSessionTools() {
    return this.gatewayInfrastructure?.sessionTools || null;
  }

  public getGatewaySessionTools() {
    return this.gatewayInfrastructure?.gatewaySessionTools || null;
  }

  public getToolSurface(): ZavorthToolSurfaceService | null {
    return this.gatewayInfrastructure?.toolSurface || null;
  }

  public getGatewaySessionStore(): GatewaySessionStoreService | null {
    return this.realtimeInfrastructure?.gatewaySessionStore || null;
  }

  public getGatewaySessionService(): GatewaySessionService | null {
    return this.realtimeInfrastructure?.gatewaySessionService || null;
  }

  public getGatewaySessionReadModel(): GatewaySessionReadModelService | null {
    return this.realtimeInfrastructure?.gatewaySessionReadModel || null;
  }

  public getGatewayChannelRegistry(): GatewayChannelRegistryService | null {
    return this.realtimeInfrastructure?.gatewayChannelRegistry || null;
  }

  public getGatewayChannelRouter(): GatewayChannelRouterService | null {
    return this.realtimeInfrastructure?.gatewayChannelRouter || null;
  }

  public buildHealthSnapshot(): ZavorthGatewayRuntimeHealthSnapshot {
    const runtimeAttached = Boolean(this.runtime);
    const operationsAttached = Object.values(this.operations).some((value) =>
      Array.isArray(value) ? value.length > 0 : Boolean(value),
    );
    const realtimeAttached = Boolean(this.realtimeInfrastructure?.realtime);
    const runtimeGatewayAvailable = Boolean(this.gatewayInfrastructure?.gateway);
    const fallbackGatewayAvailable = Boolean(this.operations.gateway);
    const gatewayAvailable = runtimeGatewayAvailable || fallbackGatewayAvailable;
    const sessionPlaneAvailable = Boolean(this.gatewayInfrastructure?.sessionPlane);
    const issues: string[] = [];

    if (!runtimeAttached) {
      issues.push('Runtime compartilhado ainda nao foi conectado ao Zavorth Gateway.');
    }
    if (!realtimeAttached) {
      issues.push('Session bus realtime ainda nao foi inicializado.');
    }
    if (!gatewayAvailable) {
      issues.push('Gateway canÃ´nico ainda nao foi composto.');
    }
    if (!sessionPlaneAvailable) {
      issues.push('Session plane canÃ´nico ainda nao foi conectado ao gateway.');
    }

    const status = issues.length === 0
      ? 'ready'
      : gatewayAvailable
        ? 'partial'
        : 'degraded';
    const gatewaySource = runtimeGatewayAvailable
      ? 'runtime'
      : fallbackGatewayAvailable
        ? 'operations'
        : 'none';

    return {
      status,
      runtimeAttached,
      operationsAttached,
      realtimeAttached,
      gatewayAvailable,
      sessionPlaneAvailable,
      authEnabled: this.auth.getStatus().enabled,
      gatewaySource,
      issues,
      summary: issues.length === 0
        ? 'Gateway canÃ´nico pronto para servir a ZavorthControl do Zavorth.'
        : issues.join(' '),
    };
  }

  public async buildCanonicalSnapshot(input: {
    sessionId?: string | null;
    chatId?: string | null;
    userId?: string | null;
    workspaceHint?: string | null;
    hydrated?: boolean;
    preferredTransport?: 'http' | 'sse' | 'ws';
    heartbeatIntervalMs?: number;
  } = {}): Promise<ZavorthGatewayRuntimeSnapshot> {
    const gatewayService = this.getGateway();
    const auth = this.auth.getStatus();
    const health = this.buildHealthSnapshot();
    const realtime = this.getRealtime();
    const runtime = this.getRuntime();
    const gatewayAny = gatewayService as
      | (ZavorthGatewayService & {
          buildSnapshot?: (input?: Record<string, any>) => any;
          buildShellSnapshot?: (input?: Record<string, any>) => any;
        })
      | null;
    const hasContext = Boolean(
      gatewayService
      && runtime
      && realtime
      && String(input.sessionId || '').trim(),
    );
    const normalizedContext = {
      sessionId: String(input.sessionId || '').trim() || null,
      chatId: String(input.chatId || realtime?.getChatId(String(input.sessionId || '').trim()) || '').trim() || null,
      userId: String(input.userId || runtime?.webUserId || '').trim() || null,
      workspaceHint: String(input.workspaceHint || '').trim() || null,
    };

    const gateway = !gatewayService
      ? null
      : hasContext
        ? input.hydrated === false
          ? gatewayAny?.buildShellSnapshot
            ? gatewayAny.buildShellSnapshot(normalizedContext)
            : gatewayAny?.buildSnapshot
              ? gatewayAny.buildSnapshot(normalizedContext)
              : await gatewayService.buildHydratedSnapshot(normalizedContext)
          : await gatewayService.buildHydratedSnapshot(normalizedContext)
        : gatewayAny?.buildShellSnapshot
          ? gatewayAny.buildShellSnapshot({ workspaceHint: normalizedContext.workspaceHint })
          : gatewayAny?.buildSnapshot
            ? gatewayAny.buildSnapshot({ workspaceHint: normalizedContext.workspaceHint })
            : await gatewayService.buildHydratedSnapshot({ workspaceHint: normalizedContext.workspaceHint });

    const snapshot: ZavorthGatewayRuntimeSnapshot = {
      generatedAt: new Date().toISOString(),
      auth,
      health,
      gatewayControlApi: this.buildGatewayControlApiSnapshot(),
      controlPlane: {
        preferredTransport: input.preferredTransport || 'ws',
        availableTransports: ['http', 'sse', 'ws'],
        websocketPath: '/api/web/gateway/ws',
        ssePath: '/api/web/events',
        statePath: '/api/web/state',
        historyPath: '/api/web/gateway/sessions/history',
        sendPath: '/api/web/gateway/sessions/send',
        spawnPath: '/api/web/gateway/sessions/spawn',
        heartbeatIntervalMs: Number(input.heartbeatIntervalMs || 15_000) || 15_000,
        reconnectStrategy: 'reuse-session-state',
        sessionId: normalizedContext.sessionId,
        chatId: normalizedContext.chatId,
      },
      sessionBus: realtime?.buildBusSnapshot() || null,
      gateway,
      aiGatewayConvergence: null,
      productization: null,
    };
    snapshot.aiGatewayConvergence = await this.buildAIGatewayConvergenceSnapshot(snapshot, {
      sessionId: normalizedContext.sessionId,
      chatId: normalizedContext.chatId,
      userId: normalizedContext.userId,
      workspaceHint: normalizedContext.workspaceHint,
      hydrated: input.hydrated === true,
    });
    snapshot.productization = this.buildProductizationSnapshot(snapshot, {
      sessionId: normalizedContext.sessionId,
      chatId: normalizedContext.chatId,
      userId: normalizedContext.userId,
      workspaceHint: normalizedContext.workspaceHint,
      hydrated: input.hydrated === true,
    });
    return snapshot;
  }

  public buildGatewayControlApiSnapshot(input: {
    includeAdvancedProviders?: boolean;
  } = {}): ZavorthGatewayControlApiSnapshot {
    const includeAdvanced = input.includeAdvancedProviders === true;
    const providerControlPlane = this.operations.providerControlPlane || null;
    const providers = providerControlPlane
      ? this.sanitizeControlPayload(providerControlPlane.listProviders({ includeAdvanced }))
      : [];
    const profiles = providerControlPlane
      ? this.sanitizeControlPayload(providerControlPlane.listProfiles())
      : [];
    const modelPicker = providerControlPlane
      ? this.sanitizeControlPayload(new ModelPickerContractService({
        providerControlPlane,
      }).buildContract({ includeAdvanced }))
      : null;
    const aiGateway = this.readAIGatewayStatus();
    const home = new ZavorthHomePathService({
      projectRoot: process.cwd(),
      env: process.env,
    }).resolveSnapshot();
    const issues: string[] = [];

    if (!providerControlPlane) {
      issues.push('ProviderControlPlaneService nao esta anexado ao Gateway Runtime.');
    }
    if (!aiGateway) {
      issues.push('AIGatewayProxyService nao esta anexado ao Gateway Runtime.');
    } else if (!aiGateway.ready) {
      issues.push(aiGateway.message || 'AIGateway anexado, mas ainda nao esta pronto.');
    }

    const readyProviders = providers.filter((entry) => entry.ready);
    const status = providerControlPlane && aiGateway?.ready
      ? 'ready'
      : providerControlPlane || aiGateway
        ? 'partial'
        : 'degraded';
    const routing = this.buildGatewayControlRoutingSnapshot({
      modelPicker,
      providers,
      providerControlPlane,
    });

    return {
      ok: status !== 'degraded',
      contractVersion: GATEWAY_CONTROL_API_CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
      boundary: {
        stableEntry: 'ZavorthGatewayRuntimeService.buildGatewayControlApiSnapshot',
        currentCut: 'P2-006h',
        doNotBypass: [
          'src/ai-gateway/app/api/* internals',
          'provider secrets',
          'zavorthControl-only DTOs',
        ],
      },
      health: {
        status,
        providerControlPlaneAttached: Boolean(providerControlPlane),
        AIGateway: aiGateway,
        lastHealthyProvider: readyProviders[0]?.id || null,
        issues,
      },
      home: {
        root: home.root,
        source: home.source,
        isolated: home.isolated,
        statusCommand: home.dailyUse.statusCommand,
        switchCommand: home.dailyUse.switchCommand,
        warnings: home.warnings,
      },
      providers: {
        source: 'provider-control-plane',
        includeAdvanced,
        currentProvider: providerControlPlane?.getCurrentConversationalProvider() || null,
        currentModel: providerControlPlane?.getCurrentConversationalModel() || null,
        summary: {
          total: providers.length,
          ready: readyProviders.length,
          needsConfig: providers.filter((entry) => entry.readiness === 'needs_config').length,
          needsProbe: providers.filter((entry) => entry.readiness === 'needs_probe').length,
        },
        entries: providers,
      },
      models: {
        source: 'provider-control-plane',
        entries: providers
          .map((entry) => ({
            providerId: entry.id,
            providerLabel: entry.label,
            model: String(entry.currentModel || '').trim(),
            ready: entry.ready,
            modality: 'chat' as const,
          }))
          .filter((entry) => entry.model.length > 0),
      },
      modelPicker,
      routing,
      usage: this.buildGatewayControlUsageSnapshot(),
      profiles,
      combos: {
        status: 'delegated',
        sourceRoutes: ['/api/combos', '/api/combos/test'],
        entries: [],
        warnings: ['P2-006a registra o contrato; leitura/escrita de combos converge em P2-006b.'],
      },
      cache: {
        status: 'delegated',
        sourceRoutes: ['/api/cache/stats', '/api/settings/cache-metrics'],
        semanticStats: null,
        warnings: ['P2-006a mantem cache como rota delegada ate a facade unificar estatisticas.'],
      },
      rateLimits: {
        status: 'delegated',
        sourceRoutes: ['/api/rate-limit', '/api/rate-limits', '/api/usage/provider-limits'],
        entries: [],
        warnings: ['P2-006a documenta rotas existentes; enforcement de escrita fica para cortes posteriores.'],
      },
      operations: this.buildGatewayControlApiOperations(),
      warnings: issues,
    };
  }

  private buildGatewayControlRoutingSnapshot(input: {
    modelPicker: unknown;
    providers: ProviderCatalogEntry[];
    providerControlPlane: ProviderControlPlaneService | null;
  }): ZavorthGatewayControlApiSnapshot['routing'] {
    const modelPicker = this.asGatewayControlRecord(input.modelPicker);
    const selected = this.asGatewayControlRecord(modelPicker.selected);
    const routesEnvelope = this.asGatewayControlRecord(modelPicker.routes);
    const routes = Array.isArray(routesEnvelope.routes)
      ? routesEnvelope.routes.map((route) => this.asGatewayControlRecord(route))
      : [];
    const activeRouteId = this.asGatewayControlText(selected.routeId || selected.id);
    const fallbackIds = new Set(
      Array.isArray(selected.fallbackRouteIds)
        ? selected.fallbackRouteIds.map((id) => this.asGatewayControlText(id)).filter(Boolean)
        : [],
    );
    const selectedFallbackRoutes = routes.filter((route) =>
      fallbackIds.has(this.asGatewayControlText(route.id || route.routeId)),
    );
    const implicitFallbackRoutes = routes.filter((route) =>
      this.asGatewayControlText(route.id || route.routeId) !== activeRouteId
      && route.ready === true,
    );
    const fallbackRoutes = (selectedFallbackRoutes.length > 0 ? selectedFallbackRoutes : implicitFallbackRoutes)
      .slice(0, 5);
    const activeProvider = this.asGatewayControlText(
      selected.providerId
        || selected.providerName
        || selected.provider
        || input.providerControlPlane?.getCurrentConversationalProvider(),
    );
    const activeModel = this.asGatewayControlText(
      selected.model
        || selected.modelName
        || selected.modelLabel
        || input.providerControlPlane?.getCurrentConversationalModel(),
    );

    return {
      source: routes.length > 0 || Object.keys(selected).length > 0 ? 'model-picker' : 'provider-control-plane',
      strategy: routes.length > 0 ? 'selected-route-first' : 'provider-control-plane-current',
      activeProvider: activeProvider || null,
      activeModel: activeModel || null,
      activeRouteId: activeRouteId || null,
      activeFamilyId: this.asGatewayControlText(selected.familyId) || null,
      readyRouteCount: routes.filter((route) => route.ready === true).length,
      totalRouteCount: routes.length,
      fallback: fallbackRoutes.map((route) => ({
        routeId: this.asGatewayControlText(route.id || route.routeId) || 'route',
        providerId: this.asGatewayControlText(route.providerId || route.providerName || route.provider) || 'provider',
        providerLabel: this.asGatewayControlText(route.providerLabel || route.providerName || route.providerId) || 'Provider',
        model: this.asGatewayControlText(route.model || route.modelName || route.modelLabel) || null,
        readiness: this.asGatewayControlText(route.readinessCode || route.readiness || route.status) || 'unknown',
        ready: route.ready === true,
      })),
      warnings: routes.length > 0
        ? []
        : ['Model Picker routes were not published; using current provider/model as the active route.'],
    };
  }

  private buildGatewayControlUsageSnapshot(): ZavorthGatewayControlApiSnapshot['usage'] {
    return {
      latency: {
        status: 'not_enough_data',
        requests: 0,
        p50Ms: null,
        p95Ms: null,
        source: 'Provider latency is recorded by live canaries and request telemetry when traffic is available.',
      },
      cost: {
        status: 'not_configured',
        currentRequestEstimateUsd: null,
        windowCostUsd: null,
        source: 'Cost projection requires provider price tables plus observed token usage.',
      },
    };
  }

  private asGatewayControlRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, any>
      : {};
  }

  private asGatewayControlText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private syncRuntimeChannelAdapters(): void {
    if (!this.realtimeInfrastructure?.gatewayChannelRegistry) {
      return;
    }
    this.realtimeInfrastructure.gatewayChannelRegistry.setRuntimeAdapters(this.operations.runtimeChannelAdapters || []);
  }

  private rebuildGatewayInfrastructure(): void {
    if (!this.runtime || !this.realtimeInfrastructure) {
      this.gatewayInfrastructure = null;
      return;
    }

    this.gatewayInfrastructure = this.infrastructure.buildRuntimeGatewayInfrastructure({
      runtime: this.runtime,
      gatewaySessionStore: this.realtimeInfrastructure.gatewaySessionStore,
      gatewaySessionService: this.realtimeInfrastructure.gatewaySessionService,
      gatewaySessionReadModel: this.realtimeInfrastructure.gatewaySessionReadModel,
      gatewayChannelRegistry: this.realtimeInfrastructure.gatewayChannelRegistry,
      gatewayChannelRouter: this.realtimeInfrastructure.gatewayChannelRouter,
      capabilityCatalog: this.operations.capabilityCatalog || null,
      channelMesh: this.operations.channelMesh || null,
      memoryPlane: this.operations.memoryPlane || null,
      securityMesh: this.operations.securityMesh || null,
      runtimeModes: this.operations.runtimeModes || null,
      teamCatalog: this.operations.teamCatalog || null,
      hookPlane: this.operations.hookPlane || null,
      nodeMesh: this.operations.nodeMesh || null,
      pluginRegistry: this.operations.pluginRegistry || null,
      platformRegistry: this.operations.platformRegistry || null,
      remoteTransports: this.operations.remoteTransports || null,
      operationsHealth: this.operations.operationsHealth || null,
      providerControlPlane: this.operations.providerControlPlane || null,
      integrationHub: this.operations.integrationHub || null,
    });
  }

  private readAIGatewayStatus(): AIGatewayProxyStatus | null {
    try {
      const status = this.operations.aiGatewayGateway?.readStatus();
      return status ? this.sanitizeControlPayload(status) : null;
    } catch (error: any) {
      return {
        enabled: false,
        ready: false,
        running: false,
        pid: null,
        host: '',
        port: 0,
        baseUrl: '',
        upstreamBaseUrl: '',
        localOnly: true,
        overlayFile: null,
        checkedAt: new Date().toISOString(),
        message: `Falha ao ler status do AIGateway: ${error?.message || 'erro desconhecido'}.`,
      };
    }
  }

  private async buildAIGatewayConvergenceSnapshot(
    runtimeSnapshot: ZavorthGatewayRuntimeSnapshot,
    context: ZavorthAgentGatewayHandoffContext,
  ): Promise<AIGatewayNativeConvergenceSnapshot | null> {
    const agentGatewaySnapshot = this.readAgentGatewaySnapshot(context);
    const handoffSnapshot = await this.readAgentGatewayHandoff(context);
    if (!agentGatewaySnapshot && !handoffSnapshot) {
      return null;
    }

    return new AIGatewayNativeConvergenceService({
      now: () => new Date(runtimeSnapshot.generatedAt),
    }).buildSnapshot({
      runtimeSnapshot,
      agentGatewaySnapshot,
      handoffSnapshot,
    });
  }

  private readAgentGatewaySnapshot(
    context: ZavorthAgentGatewayHandoffContext,
  ): ZavorthAgentGatewaySnapshot | null {
    if (!this.operations.agentGateway) {
      return null;
    }
    try {
      return this.operations.agentGateway.buildSnapshot({
        activeSessionId: context.sessionId,
        runLimit: 50,
      });
    } catch {
      return null;
    }
  }

  private async readAgentGatewayHandoff(
    context: ZavorthAgentGatewayHandoffContext,
  ): Promise<ZavorthAgentGatewayHandoffSnapshot | null> {
    if (!this.operations.agentGatewayHandoff) {
      return null;
    }
    try {
      return await this.operations.agentGatewayHandoff.buildHandoffSnapshot(context);
    } catch {
      return null;
    }
  }

  private buildProductizationSnapshot(
    runtimeSnapshot: ZavorthGatewayRuntimeSnapshot,
    context: ZavorthAgentGatewayHandoffContext,
  ): ZavorthProductizationContractSnapshot {
    return new ZavorthProductizationContractService({
      now: () => new Date(runtimeSnapshot.generatedAt),
    }).buildSnapshot({
      runtimeSnapshot,
      gatewayControlApi: runtimeSnapshot.gatewayControlApi,
      agentGatewaySnapshot: this.readAgentGatewaySnapshot(context),
      firstRunSnapshot: this.readFirstRunOnboardingSnapshot(),
      websiteSnapshot: this.readWebsitePublicSnapshot(),
      sandboxSnapshot: this.readSandboxControlPlaneSnapshot(),
      productMode: this.operations.productModeSnapshot || null,
    });
  }

  private readFirstRunOnboardingSnapshot(): FirstRunOnboardingContractSnapshot | null {
    if (!this.operations.firstRunOnboardingContract) {
      return null;
    }
    try {
      return this.operations.firstRunOnboardingContract.buildSnapshot();
    } catch {
      return null;
    }
  }

  private readWebsitePublicSnapshot(): WebsitePublicContractSnapshot | null {
    if (!this.operations.websitePublicContract) {
      return null;
    }
    try {
      return this.operations.websitePublicContract.buildSnapshot();
    } catch {
      return null;
    }
  }

  private readSandboxControlPlaneSnapshot(): ZavorthSandboxControlPlaneSnapshot | null {
    if (!this.operations.sandboxControlPlane) {
      return null;
    }
    try {
      return this.operations.sandboxControlPlane.buildSnapshot();
    } catch {
      return null;
    }
  }

  private buildGatewayControlApiOperations(): GatewayControlApiOperationDescriptor[] {
    return [
      {
        id: 'providers.list',
        method: 'GET',
        path: '/api/gateway-control/providers',
        risk: 'read',
        requiresApproval: false,
        status: 'available',
        source: 'provider-control-plane',
        summary: 'Lista providers com segredos redigidos via ProviderControlPlaneService.',
      },
      {
        id: 'models.list',
        method: 'GET',
        path: '/api/gateway-control/models',
        risk: 'read',
        requiresApproval: false,
        status: 'available',
        source: 'provider-control-plane',
        summary: 'Lista modelos atuais e modalidades publicas.',
      },
      {
        id: 'health.read',
        method: 'GET',
        path: '/api/gateway-control/health',
        risk: 'read',
        requiresApproval: false,
        status: 'available',
        source: 'zavorth-runtime',
        summary: 'Resume saude do AIGateway e do control plane anexado.',
      },
      {
        id: 'combos.list',
        method: 'GET',
        path: '/api/gateway-control/combos',
        risk: 'read',
        requiresApproval: false,
        status: 'available',
        source: 'ai-gateway-route',
        summary: 'Lista combos publicados pela Gateway Control API sem executar testes.',
      },
      {
        id: 'cache.stats',
        method: 'GET',
        path: '/api/gateway-control/cache',
        risk: 'read',
        requiresApproval: false,
        status: 'available',
        source: 'ai-gateway-route',
        summary: 'Unifica estatisticas de cache semantico sem expor entradas sensiveis.',
      },
      {
        id: 'cache.invalidate',
        method: 'POST',
        path: '/api/gateway-control/cache/invalidate',
        risk: 'write',
        requiresApproval: true,
        status: 'available',
        source: 'ai-gateway-route',
        summary: 'Invalida cache semantico via PermissionService e delega para DELETE /api/cache.',
      },
      {
        id: 'rate-limits.list',
        method: 'GET',
        path: '/api/gateway-control/rate-limits',
        risk: 'read',
        requiresApproval: false,
        status: 'available',
        source: 'ai-gateway-route',
        summary: 'Lista limites conhecidos por provider/conta quando disponiveis.',
      },
      {
        id: 'rate-limits.toggle',
        method: 'POST',
        path: '/api/gateway-control/rate-limits/toggle',
        risk: 'write',
        requiresApproval: true,
        status: 'available',
        source: 'ai-gateway-route',
        summary: 'Alterna protecao de rate limit por conexao via PermissionService e POST /api/rate-limits.',
      },
      {
        id: 'combos.validate',
        method: 'POST',
        path: '/api/gateway-control/combos/validate',
        risk: 'write',
        requiresApproval: true,
        status: 'available',
        source: 'ai-gateway-route',
        summary: 'Cria gate estruturado para validar combos antes de delegar execucao sensivel.',
      },
      {
        id: 'providers.test',
        method: 'POST',
        path: '/api/gateway-control/providers/test',
        risk: 'sensitive',
        requiresApproval: true,
        status: 'available',
        source: 'ai-gateway-route',
        summary: 'Bloqueia teste real sem approval e aponta a rota delegada existente.',
      },
    ];
  }

  private sanitizeControlPayload<T>(value: T): T {
    if (Array.isArray(value)) {
      return value.map((entry) => this.sanitizeControlPayload(entry)) as T;
    }
    if (!value || typeof value !== 'object') {
      return value;
    }
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      output[key] = this.isSensitiveControlKey(key)
        ? entry ? '[redacted]' : entry
        : this.sanitizeControlPayload(entry);
    }
    return output as T;
  }

  private isSensitiveControlKey(key: string): boolean {
    return /api[-_]?key|access[-_]?token|refresh[-_]?token|id[-_]?token|secret|authorization|credential|password/i
      .test(key);
  }
}
