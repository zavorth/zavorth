import { DomainRegistry, type DomainRegistrySnapshot, type DomainRegistrySummarySnapshot } from '../domain/DomainRegistry.js';
import { ArtifactsFacade } from '../domain/artifacts/ArtifactsFacade.js';
import { ChannelsFacade } from '../domain/channels/ChannelsFacade.js';
import { ExecutionFacade } from '../domain/execution/ExecutionFacade.js';
import { GatewayFacade } from '../domain/gateway/GatewayFacade.js';
import { MemoryFacade } from '../domain/memory/MemoryFacade.js';
import { NodesFacade } from '../domain/nodes/NodesFacade.js';
import { OpsFacade } from '../domain/ops/OpsFacade.js';
import type { OperationsHealthPort } from '../domain/ops/domain/OpsDomainTypes.js';
import { PlatformFacade } from '../domain/platform/PlatformFacade.js';
import { ProvidersFacade } from '../domain/providers/ProvidersFacade.js';
import { SecurityFacade } from '../domain/security/SecurityFacade.js';
import { SessionsFacade } from '../domain/sessions/SessionsFacade.js';
import { TransportsFacade } from '../domain/transports/TransportsFacade.js';
import { ArtifactPipelineService } from './ArtifactPipelineService.js';
import { PlatformCapabilityService } from './PlatformCapabilityService.js';
import { ZavorthCapabilityCatalogService } from './ZavorthCapabilityCatalogService.js';
import { ZavorthChannelMeshService } from './ZavorthChannelMeshService.js';
import {
  GatewayChannelRegistryService,
  type GatewayChannelRegistryEntry,
} from './GatewayChannelRegistryService.js';
import { ZavorthHookPlaneService } from './ZavorthHookPlaneService.js';
import { ZavorthMemoryPlaneService } from './ZavorthMemoryPlaneService.js';
import { ZavorthNodeMeshService } from './ZavorthNodeMeshService.js';
import { ZavorthPluginRegistryService } from './ZavorthPluginRegistryService.js';
import { ZavorthPlatformRegistryService } from './ZavorthPlatformRegistryService.js';
import { ZavorthRemoteTransportService } from './ZavorthRemoteTransportService.js';
import { ZavorthSecurityMeshService } from './ZavorthSecurityMeshService.js';
import { ZavorthRuntimeModesService } from './ZavorthRuntimeModesService.js';
import { ZavorthSessionPlaneService } from './ZavorthSessionPlaneService.js';
import { ZavorthSessionToolsService } from '../runtime/sessions/ZavorthSessionToolsService.js';
import { ZavorthTeamCatalogService } from './ZavorthTeamCatalogService.js';
import { ZavorthToolSurfaceService } from './ZavorthToolSurfaceService.js';
import { ProviderControlPlaneService } from './ProviderControlPlaneService.js';
import { OperationsHealthService } from '../observability/OperationsHealthService.js';
import { ZavorthA2UIService } from './ZavorthA2UIService.js';
import { ZavorthProactivePermissionService } from './ZavorthProactivePermissionService.js';
import { GoalLoopStatusProjectionService, type GoalLoopStatusProjection } from './GoalLoopStatusProjectionService.js';
import { logger } from '../logger.js';

type ZavorthGatewayRuntime = {
  now?: () => Date;
  capabilityCatalogService?: Pick<ZavorthCapabilityCatalogService, 'buildSnapshot'>;
  channelMeshService?: Pick<ZavorthChannelMeshService, 'buildSnapshot'>;
  memoryPlaneService?: Pick<ZavorthMemoryPlaneService, 'buildSnapshotFast'> & Partial<Pick<ZavorthMemoryPlaneService, 'buildSnapshot'>>;
  runtimeModesService?: Pick<ZavorthRuntimeModesService, 'buildSnapshot'>;
  securityMeshService?: Pick<ZavorthSecurityMeshService, 'buildSnapshot'>;
  teamCatalogService?: Pick<ZavorthTeamCatalogService, 'buildSnapshot'>;
  sessionPlaneService?: Pick<ZavorthSessionPlaneService, 'buildStatusSummaryFast'>;
  sessionToolsService?: ZavorthSessionToolsService;
  toolSurfaceService?: Pick<ZavorthToolSurfaceService, 'buildSnapshot'>;
  hookPlaneService?: Pick<ZavorthHookPlaneService, 'buildSnapshot'>;
  nodeMeshService?: Pick<ZavorthNodeMeshService, 'buildSnapshot'>;
  pluginRegistryService?: Pick<ZavorthPluginRegistryService, 'buildSnapshot'>;
  platformRegistryService?: Pick<ZavorthPlatformRegistryService, 'buildStatusSummarySnapshot'>;
  remoteTransportService?: Pick<ZavorthRemoteTransportService, 'buildSnapshot'>;
  operationsHealthService?: Pick<OperationsHealthService, 'readSnapshotFast'>;
  providerControlPlaneService?: Pick<
    ProviderControlPlaneService,
    'listProviders' | 'listProfiles' | 'getCurrentConversationalProvider' | 'getCurrentConversationalModel'
  >;
  artifactPipelineService?: Pick<ArtifactPipelineService, 'normalizeArtifacts' | 'buildManifest'>;
  platformCapabilityService?: Pick<PlatformCapabilityService, 'getCapabilities' | 'getSummary'>;
  channelRegistryService?: Pick<GatewayChannelRegistryService, 'listChannels'>;
  a2ui?: ZavorthA2UIService;
  proactivePermissions?: ZavorthProactivePermissionService;
  goalLoopStatusService?: Pick<GoalLoopStatusProjectionService, 'buildSnapshot'>;
};

export type ZavorthGatewayControlPlaneSnapshot = {
  generatedAt: string;
  summary: {
    hooksRegistered: number;
    hooksCovered: number;
    runtimeModesReady: number;
    runtimeModesPartial: number;
    securityLevel: string;
    remoteTransportsReady: number;
    remoteAttention: number;
    remotePendingWork: number;
    toolFamilies: number;
  };
  hookPlane: ReturnType<ZavorthHookPlaneService['buildSnapshot']>;
  runtimeModes: ReturnType<ZavorthRuntimeModesService['buildSnapshot']>;
  securityMesh: ReturnType<ZavorthSecurityMeshService['buildSnapshot']>;
  remoteTransports: ReturnType<ZavorthRemoteTransportService['buildSnapshot']>;
  toolSurface: ReturnType<ZavorthToolSurfaceService['buildSnapshot']>;
  suggestedActions: Array<{
    id: string;
    label: string;
    command: string;
    severity: 'info' | 'warn';
    reason: string;
  }>;
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type ZavorthGatewaySnapshot = {
  generatedAt: string;
  summary: {
  channelsReady: number;
    channelsTotal: number;
    runtimeModesReady: number;
    securityPosture: string;
    memoryArtifacts: number;
    teams: number;
    integrationsReady: number;
    nodesPaired: number;
    remoteTransportsReady: number;
    sessionTargets: number;
    toolFamilies: number;
    plugins: number;
  };
  channels: GatewayChannelRegistryEntry[];
  channelMesh: ReturnType<ZavorthChannelMeshService['buildSnapshot']>;
  capabilities: ReturnType<ZavorthCapabilityCatalogService['buildSnapshot']>;
  memoryPlane: ReturnType<ZavorthMemoryPlaneService['buildSnapshotFast']>;
  runtimeModes: ReturnType<ZavorthRuntimeModesService['buildSnapshot']>;
  securityMesh: ReturnType<ZavorthSecurityMeshService['buildSnapshot']>;
  controlPlane: ZavorthGatewayControlPlaneSnapshot;
  domains: DomainRegistrySummarySnapshot;
  teams: ReturnType<ZavorthTeamCatalogService['buildSnapshot']>;
  sessionTools: ReturnType<ZavorthSessionToolsService['buildSnapshot']> | null;
  toolSurface: ReturnType<ZavorthToolSurfaceService['buildSnapshot']>;
  hookPlane: ReturnType<ZavorthHookPlaneService['buildSnapshot']>;
  nodeMesh: ReturnType<ZavorthNodeMeshService['buildSnapshot']>;
  pluginRegistry: ReturnType<ZavorthPluginRegistryService['buildSnapshot']>;
  remoteTransports: ReturnType<ZavorthRemoteTransportService['buildSnapshot']>;
  goalLoop: GoalLoopStatusProjection | null;
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type ZavorthGatewayShellSnapshot = {
  generatedAt: string;
  summary: ZavorthGatewaySnapshot['summary'];
  narrative: ZavorthGatewaySnapshot['narrative'];
  memoryPlane: Pick<ZavorthGatewaySnapshot['memoryPlane'], 'generatedAt' | 'summary' | 'narrative'>;
  controlPlane: Pick<ZavorthGatewayControlPlaneSnapshot, 'generatedAt' | 'summary' | 'narrative'>;
};

export class ZavorthGatewayService {
  private readonly now: () => Date;
  private readonly capabilityCatalog: Pick<ZavorthCapabilityCatalogService, 'buildSnapshot'>;
  private readonly channelMesh: Pick<ZavorthChannelMeshService, 'buildSnapshot'>;
  private readonly memoryPlane: Pick<ZavorthMemoryPlaneService, 'buildSnapshotFast'> & Partial<Pick<ZavorthMemoryPlaneService, 'buildSnapshot'>>;
  private readonly runtimeModes: Pick<ZavorthRuntimeModesService, 'buildSnapshot'>;
  private readonly securityMesh: Pick<ZavorthSecurityMeshService, 'buildSnapshot'>;
  private readonly teamCatalog: Pick<ZavorthTeamCatalogService, 'buildSnapshot'>;
  private readonly sessionPlane: Pick<ZavorthSessionPlaneService, 'buildStatusSummaryFast'> | null;
  private readonly sessionTools: ZavorthSessionToolsService;
  private readonly toolSurface: Pick<ZavorthToolSurfaceService, 'buildSnapshot'>;
  private readonly hookPlane: Pick<ZavorthHookPlaneService, 'buildSnapshot'>;
  private readonly nodeMesh: Pick<ZavorthNodeMeshService, 'buildSnapshot'>;
  private readonly pluginRegistry: Pick<ZavorthPluginRegistryService, 'buildSnapshot'>;
  private readonly platformRegistry: Pick<ZavorthPlatformRegistryService, 'buildStatusSummarySnapshot'> | null;
  private readonly remoteTransports: Pick<ZavorthRemoteTransportService, 'buildSnapshot'>;
  private readonly operationsHealth: Pick<OperationsHealthService, 'readSnapshotFast'> | null;
  private readonly providerControlPlane: Pick<
    ProviderControlPlaneService,
    'listProviders' | 'listProfiles' | 'getCurrentConversationalProvider' | 'getCurrentConversationalModel'
  > | null;
  private readonly artifactPipeline: Pick<ArtifactPipelineService, 'normalizeArtifacts' | 'buildManifest'>;
  private readonly platforms: Pick<PlatformCapabilityService, 'getCapabilities' | 'getSummary'>;
  private readonly channelRegistry: Pick<GatewayChannelRegistryService, 'listChannels'>;
  private readonly domains: DomainRegistry;
  public readonly a2ui: ZavorthA2UIService;
  public readonly proactivePermissions: ZavorthProactivePermissionService;
  private readonly goalLoopStatus: Pick<GoalLoopStatusProjectionService, 'buildSnapshot'> | null;

  constructor(runtime: ZavorthGatewayRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.capabilityCatalog = runtime.capabilityCatalogService || new ZavorthCapabilityCatalogService();
    this.channelMesh = runtime.channelMeshService || new ZavorthChannelMeshService();
    this.memoryPlane = runtime.memoryPlaneService || new ZavorthMemoryPlaneService();
    this.runtimeModes = runtime.runtimeModesService || new ZavorthRuntimeModesService();
    this.securityMesh = runtime.securityMeshService || new ZavorthSecurityMeshService({
      runtimeModesService: this.runtimeModes,
    });
    this.teamCatalog = runtime.teamCatalogService || new ZavorthTeamCatalogService();
    this.sessionPlane = runtime.sessionPlaneService || null;
    this.sessionTools = runtime.sessionToolsService || new ZavorthSessionToolsService();
    this.toolSurface =
      runtime.toolSurfaceService ||
      new ZavorthToolSurfaceService({
        sessionToolsService: this.sessionTools,
      });
    this.hookPlane = runtime.hookPlaneService || new ZavorthHookPlaneService();
    this.nodeMesh = runtime.nodeMeshService || new ZavorthNodeMeshService();
    this.pluginRegistry = runtime.pluginRegistryService || new ZavorthPluginRegistryService();
    this.platformRegistry = runtime.platformRegistryService || null;
    this.remoteTransports = runtime.remoteTransportService || new ZavorthRemoteTransportService();
    this.operationsHealth = runtime.operationsHealthService || null;
    this.providerControlPlane = runtime.providerControlPlaneService || null;
    this.artifactPipeline = runtime.artifactPipelineService || new ArtifactPipelineService();
    this.platforms = runtime.platformCapabilityService || new PlatformCapabilityService();
      this.channelRegistry =
        runtime.channelRegistryService ||
        new GatewayChannelRegistryService({
          platformCapabilityService: this.platforms,
        });
      this.a2ui = runtime.a2ui || new ZavorthA2UIService();
      this.proactivePermissions = runtime.proactivePermissions || new ZavorthProactivePermissionService();
      this.goalLoopStatus = runtime.goalLoopStatusService || null;
      
      this.domains = new DomainRegistry({
      now: this.now,
      gatewayFacade: new GatewayFacade({
        now: this.now,
        channelRegistryService: this.channelRegistry,
        sessionPlaneService: this.sessionPlane || undefined,
        memoryPlaneService: this.memoryPlane,
        remoteTransportService: this.remoteTransports,
      }),
      executionFacade: new ExecutionFacade({
        now: this.now,
        continuityLinked: true,
        approvalLinked: true,
      }),
      sessionsFacade: new SessionsFacade({
        now: this.now,
        sessionPlaneService: this.sessionPlane || undefined,
      }),
      memoryFacade: new MemoryFacade({
        now: this.now,
        memoryPlaneService: this.memoryPlane,
      }),
      artifactsFacade: new ArtifactsFacade({
        now: this.now,
        memoryPlaneService: this.memoryPlane,
        artifactPipelineService: this.artifactPipeline,
      }),
      platformFacade: new PlatformFacade({
        now: this.now,
        platformRegistryService: this.platformRegistry || undefined,
      }),
      channelsFacade: new ChannelsFacade({
        now: this.now,
        channelMeshService: this.channelMesh,
        channelRegistryService: this.channelRegistry,
      }),
      nodesFacade: new NodesFacade({
        now: this.now,
        nodeMeshService: this.nodeMesh,
      }),
      transportsFacade: new TransportsFacade({
        now: this.now,
        remoteTransportService: this.remoteTransports,
      }),
      securityFacade: new SecurityFacade({
        now: this.now,
        securityMeshService: this.securityMesh,
      }),
      opsFacade: new OpsFacade({
        now: this.now,
        operationsHealthService: (this.operationsHealth || undefined) as OperationsHealthPort | undefined,
      }),
      providersFacade: new ProvidersFacade({
        now: this.now,
        providerControlPlaneService: this.providerControlPlane || undefined,
      }),
    });
    this.domains.primeAll();
  }

  public buildDomainSummarySnapshot(): DomainRegistrySummarySnapshot {
    return this.domains.buildSummarySnapshot();
  }

  public buildDomainSnapshot(): DomainRegistrySnapshot {
    return this.domains.buildSnapshot();
  }

  public buildSnapshot(input?: {
    sessionId?: string | null;
    chatId?: string | null;
    userId?: string | null;
    workspaceHint?: string | null;
  }): ZavorthGatewaySnapshot {
    return this.composeSnapshot(
      input,
      this.memoryPlane.buildSnapshotFast({
        userId: input?.userId || null,
        chatId: input?.chatId || null,
        sessionId: input?.sessionId || null,
      }),
    );
  }

  public buildShellSnapshot(input?: {
    sessionId?: string | null;
    chatId?: string | null;
    userId?: string | null;
    workspaceHint?: string | null;
  }): ZavorthGatewayShellSnapshot {
    const channels = this.channelRegistry.listChannels();
    const platformSummary = this.platforms.getSummary();
    const memoryPlane = this.memoryPlane.buildSnapshotFast({
      userId: input?.userId || null,
      chatId: input?.chatId || null,
      sessionId: input?.sessionId || null,
    });
    const runtimeModes = this.runtimeModes.buildSnapshot();
    const nodeMesh = this.nodeMesh.buildSnapshot();
    const remoteTransports = this.remoteTransports.buildSnapshot();
    const hasSessionContext = Boolean(
      String(input?.sessionId || '').trim()
      && String(input?.chatId || '').trim()
      && String(input?.userId || '').trim(),
    );

    const summary: ZavorthGatewaySnapshot['summary'] = {
      channelsReady: channels.filter((entry) => entry.readiness === 'ready').length,
      channelsTotal: channels.length,
      runtimeModesReady: Number(runtimeModes.summary.ready || 0),
      securityPosture: 'summary',
      memoryArtifacts: Number(memoryPlane.summary.artifacts || 0),
      teams: 0,
      integrationsReady: platformSummary.ready.length,
      nodesPaired: Number(nodeMesh.summary.paired || 0),
      remoteTransportsReady: Number(remoteTransports.summary.ready || 0),
      sessionTargets: hasSessionContext ? 1 : 0,
      toolFamilies: hasSessionContext ? 1 : 0,
      plugins: 0,
    };

    const controlPlane: ZavorthGatewayShellSnapshot['controlPlane'] = {
      generatedAt: this.now().toISOString(),
      summary: {
        hooksRegistered: 0,
        hooksCovered: 0,
        runtimeModesReady: Number(runtimeModes.summary.ready || 0),
        runtimeModesPartial: Number(runtimeModes.summary.partial || 0),
        securityLevel: 'summary',
        remoteTransportsReady: Number(remoteTransports.summary.ready || 0),
        remoteAttention: Number(remoteTransports.summary.attentionRequired || 0),
        remotePendingWork: Number(remoteTransports.summary.pendingWork || 0),
        toolFamilies: hasSessionContext ? 1 : 0,
      },
      narrative: {
        headline: 'Control plane enxuto para o shell web do runtime.',
        operatorSummary: `${Number(runtimeModes.summary.ready || 0)} runtime(s) pronto(s) e ${Number(remoteTransports.summary.ready || 0)} transporte(s) remoto(s) prontos no resumo rapido.`,
      },
    };

    return {
      generatedAt: this.now().toISOString(),
      summary,
      narrative: {
        headline: 'Resumo rapido do Zavorth Gateway para o shell web.',
        operatorSummary: `${summary.channelsReady} canal(is) pronto(s), ${summary.runtimeModesReady} modo(s) de runtime pronto(s) e ${summary.memoryArtifacts} artefato(s) recentes no memory plane.`,
      },
      memoryPlane: {
        generatedAt: memoryPlane.generatedAt,
        summary: memoryPlane.summary,
        narrative: memoryPlane.narrative,
      },
      controlPlane,
    };
  }

  public async buildHydratedSnapshot(input?: {
    sessionId?: string | null;
    chatId?: string | null;
    userId?: string | null;
    workspaceHint?: string | null;
  }): Promise<ZavorthGatewaySnapshot> {
    const memoryPlane = this.memoryPlane.buildSnapshot
      ? await this.memoryPlane.buildSnapshot({
          userId: input?.userId || null,
          chatId: input?.chatId || null,
          sessionId: input?.sessionId || null,
        })
      : this.memoryPlane.buildSnapshotFast({
          userId: input?.userId || null,
          chatId: input?.chatId || null,
          sessionId: input?.sessionId || null,
        });

    return this.composeSnapshot(input, memoryPlane);
  }

  private composeSnapshot(
    input: {
      sessionId?: string | null;
      chatId?: string | null;
      userId?: string | null;
      workspaceHint?: string | null;
    } | undefined,
    memoryPlane: ReturnType<ZavorthMemoryPlaneService['buildSnapshotFast']>,
  ): ZavorthGatewaySnapshot {
    const channels = this.channelRegistry.listChannels();
    const channelMesh = this.channelMesh.buildSnapshot();
    const capabilities = this.capabilityCatalog.buildSnapshot();
    const runtimeModes = this.runtimeModes.buildSnapshot();
    const securityMesh = this.securityMesh.buildSnapshot();
    const hasSessionContext = Boolean(
      String(input?.sessionId || '').trim()
      && String(input?.chatId || '').trim()
      && String(input?.userId || '').trim(),
    );
    const sessionTools = hasSessionContext
      ? this.sessionTools.buildSnapshot({
          sessionId: String(input?.sessionId || '').trim(),
          chatId: String(input?.chatId || '').trim(),
          userId: String(input?.userId || '').trim(),
        })
      : null;
    const toolSurface = hasSessionContext
      ? this.toolSurface.buildSnapshot({
          sessionId: String(input?.sessionId || '').trim(),
          chatId: String(input?.chatId || '').trim(),
          userId: String(input?.userId || '').trim(),
        })
      : this.toolSurface.buildSnapshot();
    const effectiveWorkspace = String(
      input?.workspaceHint
      || sessionTools?.continuity?.focusTask?.workspace
      || sessionTools?.continuity?.currentSurfaceTask?.workspace
      || sessionTools?.continuity?.latestTelegramTask?.workspace
      || sessionTools?.continuity?.latestWebTask?.workspace
      || '',
    ).trim() || null;
    const teams = this.teamCatalog.buildSnapshot({ workspace: effectiveWorkspace });
    const hookPlane = this.hookPlane.buildSnapshot();
    const nodeMesh = this.nodeMesh.buildSnapshot();
    const pluginRegistry = this.pluginRegistry.buildSnapshot();
    const remoteTransports = this.remoteTransports.buildSnapshot();
    const goalLoop = this.goalLoopStatus ? this.safeBuildGoalLoopStatus() : null;
    const controlPlane = this.buildControlPlane({
      hookPlane,
      nodeMesh,
      runtimeModes,
      securityMesh,
      remoteTransports,
      toolSurface,
    });
    const domains = this.buildDomainSummarySnapshot();

    return {
      generatedAt: this.now().toISOString(),
      summary: {
        channelsReady: channels.filter((entry) => entry.readiness === 'ready').length,
        channelsTotal: channelMesh.summary.total,
        runtimeModesReady: runtimeModes.summary.ready,
        securityPosture: securityMesh.posture.level,
        memoryArtifacts: memoryPlane.summary.artifacts,
        teams: teams.summary.total,
        integrationsReady: capabilities.integrations.ready,
        nodesPaired: nodeMesh.summary.paired,
        remoteTransportsReady: remoteTransports.summary.ready,
        sessionTargets: sessionTools?.sessions.length || 0,
        toolFamilies: toolSurface.summary.families,
        plugins: pluginRegistry.summary.total,
      },
      channels,
      channelMesh,
      capabilities,
      memoryPlane,
      runtimeModes,
      securityMesh,
      controlPlane,
      domains,
      teams,
      sessionTools,
      toolSurface,
      hookPlane,
      nodeMesh,
      pluginRegistry,
      remoteTransports,
      goalLoop,
      narrative: {
        headline: 'Zavorth Gateway consolida canais, sessao, tools, plugins, runtime e transportes remotos em um unico snapshot.',
        operatorSummary: hasSessionContext
          ? `${channels.filter((entry) => entry.readiness === 'ready').length} canal(is) pronto(s), `
            + `${runtimeModes.summary.ready} modo(s) de runtime pronto(s) e `
            + `postura ${securityMesh.posture.label.toLowerCase()}. `
            + `${memoryPlane.summary.artifacts} artefato(s) recente(s) no memory plane. `
            + `${sessionTools?.sessions.length || 0} alvo(s) de sessao visiveis agora. `
            + `${nodeMesh.summary.paired} node(s) pareado(s) e `
            + `${remoteTransports.summary.ready} transporte(s) remoto(s) pronto(s).`
            + this.buildNodeHostMaintenanceNarrative(nodeMesh)
            + (effectiveWorkspace ? ` Workspace em foco: ${effectiveWorkspace}.` : '')
          : `${channelMesh.summary.ready} canal(is) pronto(s), `
            + `${runtimeModes.summary.ready} modo(s) de runtime pronto(s), `
            + `${securityMesh.posture.label.toLowerCase()} no mesh de seguranca, `
            + `${memoryPlane.summary.artifacts} artefato(s) recente(s) no memory plane, `
            + `${toolSurface.summary.families} familia(s) de tools e `
            + `${pluginRegistry.summary.total} item(ns) no registry. `
            + `${nodeMesh.summary.total} node(s) visiveis no mesh e `
            + `${remoteTransports.summary.total} transporte(s) remoto(s) catalogado(s).`
            + this.buildNodeHostMaintenanceNarrative(nodeMesh),
      },
    };
  }

  private safeBuildGoalLoopStatus(): GoalLoopStatusProjection | null {
    try {
      return this.goalLoopStatus?.buildSnapshot() || null;
    } catch (error: unknown) {logger.warn('[Zavorth way] creation failed', error); return null; }
  }

  private buildControlPlane(input: {
    hookPlane: ReturnType<ZavorthHookPlaneService['buildSnapshot']>;
    nodeMesh: ReturnType<ZavorthNodeMeshService['buildSnapshot']>;
    runtimeModes: ReturnType<ZavorthRuntimeModesService['buildSnapshot']>;
    securityMesh: ReturnType<ZavorthSecurityMeshService['buildSnapshot']>;
    remoteTransports: ReturnType<ZavorthRemoteTransportService['buildSnapshot']>;
    toolSurface: ReturnType<ZavorthToolSurfaceService['buildSnapshot']>;
  }): ZavorthGatewayControlPlaneSnapshot {
    const suggestedActions = [
      ...this.buildNodeHostControlPlaneActions(input.nodeMesh),
      ...(Array.isArray(input.securityMesh.suggestedActions) ? input.securityMesh.suggestedActions : []),
      ...(Array.isArray(input.remoteTransports.suggestedActions) ? input.remoteTransports.suggestedActions : []),
    ]
      .filter((entry, index, collection) =>
        collection.findIndex((candidate) => candidate.id === entry.id) === index,
      )
      .slice(0, 5);

    return {
      generatedAt: this.now().toISOString(),
      summary: {
        hooksRegistered: Number(input.hookPlane.summary.registeredHooks || 0),
        hooksCovered: Number(input.hookPlane.summary.coveredEvents || 0),
        runtimeModesReady: Number(input.runtimeModes.summary.ready || 0),
        runtimeModesPartial: Number(input.runtimeModes.summary.partial || 0),
        securityLevel: String(input.securityMesh.posture.level || input.securityMesh.posture.label || 'unknown'),
        remoteTransportsReady: Number(input.remoteTransports.summary.ready || 0),
        remoteAttention: Number(input.remoteTransports.summary.attentionRequired || 0),
        remotePendingWork: Number(input.remoteTransports.summary.pendingWork || 0),
        toolFamilies: Number(input.toolSurface.summary.families || 0),
      },
      hookPlane: input.hookPlane,
      runtimeModes: input.runtimeModes,
      securityMesh: input.securityMesh,
      remoteTransports: input.remoteTransports,
      toolSurface: input.toolSurface,
      suggestedActions,
      narrative: {
        headline: 'Gateway / Hooks / Runtime / Transports',
        operatorSummary: `${Number(input.runtimeModes.summary.ready || 0)} runtime(s) pronto(s), `
          + `${Number(input.hookPlane.summary.registeredHooks || 0)} hook(s) registrado(s), `
          + `${Number(input.remoteTransports.summary.attentionRequired || 0)} transporte(s) remoto(s) pedindo atencao e `
          + `${Number(input.remoteTransports.summary.pendingWork || 0)} item(ns) pendente(s) no plano remoto.`
          + this.buildNodeHostMaintenanceNarrative(input.nodeMesh),
      },
    };
  }

  private buildNodeHostMaintenanceNarrative(
    nodeMesh: ReturnType<ZavorthNodeMeshService['buildSnapshot']>,
  ): string {
    const target = this.resolveNodeHostMaintenanceTarget(nodeMesh);
    const maintenance = target?.maintenance;
    if (!target || !maintenance?.supported) {
      return '';
    }

    if (maintenance.recoverKind === 'queue-node-host-maintenance') {
      return ` Maintenance do node host ${target.label} pede repair para limpar a fila.`;
    }

    if (maintenance.latestStatus === 'failed') {
      return ` Maintenance do node host ${target.label} falhou: ${maintenance.latestResultSummary || 'repair recente sem resumo.'}`;
    }

    if (maintenance.latestStatus === 'pending' || maintenance.latestStatus === 'claimed') {
      return ` Maintenance do node host ${target.label} em andamento.`;
    }

    return '';
  }

  private buildNodeHostControlPlaneActions(
    nodeMesh: ReturnType<ZavorthNodeMeshService['buildSnapshot']>,
  ): ZavorthGatewayControlPlaneSnapshot['suggestedActions'] {
    const target = this.resolveNodeHostMaintenanceTarget(nodeMesh);
    const maintenance = target?.maintenance;
    if (!target || !maintenance?.supported || maintenance.recoverKind !== 'queue-node-host-maintenance') {
      return [];
    }

    return [
      {
        id: 'node-host-repair',
        label: 'Acionar repair do node host',
        command: '/transports repair node-host',
        severity: 'warn',
        reason: target.nextAction
          || maintenance.latestResultSummary
          || target.operatorSummary
          || 'Fila stale pede repair no node host.',
      },
    ];
  }

  private resolveNodeHostMaintenanceTarget(
    nodeMesh: ReturnType<ZavorthNodeMeshService['buildSnapshot']>,
  ): ReturnType<ZavorthNodeMeshService['buildSnapshot']>['selected'] {
    const entries = Array.isArray(nodeMesh.entries) ? nodeMesh.entries : [];
    const selected = nodeMesh.selected;

    const recoverable = entries.find((entry) =>
      entry.maintenance?.supported
      && entry.maintenance.recoverKind === 'queue-node-host-maintenance',
    );
    if (recoverable) {
      return recoverable;
    }

    const activeMaintenance = entries.find((entry) =>
      entry.maintenance?.supported
      && (entry.maintenance.latestStatus === 'failed'
        || entry.maintenance.latestStatus === 'pending'
        || entry.maintenance.latestStatus === 'claimed'
        || entry.maintenance.pending > 0
        || entry.maintenance.claimed > 0),
    );
    if (activeMaintenance) {
      return activeMaintenance;
    }

    if (selected?.maintenance?.supported) {
      return selected;
    }

    return null;
  }
}
