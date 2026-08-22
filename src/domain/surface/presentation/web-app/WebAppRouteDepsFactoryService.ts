import * as http from 'http';
import { ZavorthEvalControlPlaneService } from '../../../../observability/ZavorthEvalControlPlaneService.js';
import { ZavorthEvalHistoryFileService } from '../../../../services/ZavorthEvalHistoryFileService.js';
import { ZavorthTelemetryLedgerService } from '../../../../services/ZavorthTelemetryLedgerService.js';
import { ZavorthTrustPlaneActionService } from '../../../../services/ZavorthTrustPlaneActionService.js';
import { ZavorthTrustPlaneService } from '../../../../services/ZavorthTrustPlaneService.js';
import { McpToolPolicy } from '../../../../mcp/McpToolPolicy.js';
import { McpToolPolicyFileService } from '../../../../services/McpToolPolicyFileService.js';
import { NaturalChannelSetupTurnService } from '../../../../services/NaturalChannelSetupTurnService.js';
import { SkillTrustPolicyService } from '../../../../services/SkillTrustPolicyService.js';
import type { GatewayControlSocketDeps } from '../../../../services/ZavorthGatewayControlSocketService.js';
import type { ZavorthGatewayRuntimeService } from '../../../../services/ZavorthGatewayRuntimeService.js';
import type { ZavorthAgentGateway } from '../../../../runtime/agent/index.js';
import type { WebAppGatewayControlService } from './WebAppGatewayControlService.js';
import type { WebAppNodeRouteDeps } from '../../../../services/WebAppNodeRouteService.js';
import type { WebAppRuntimeRouteDeps, WebAppRuntimeRouteService } from './WebAppRuntimeRouteService.js';
import type { WebAppSurfaceRouteDeps } from '../../../../services/WebAppSurfaceRouteService.js';
import type { WebAppRuntimeContextBridge } from './WebAppRuntimeContextBridge.js';
import type { CanonicalPublicApiService } from '../../../../api/public/CanonicalPublicApiService.js';

// Dynamic service bag: route handlers access dozens of services by key.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SurfaceDynamic = any;
type SurfaceDependency = SurfaceDynamic;
type SurfaceDependencyMap = Record<string, SurfaceDependency>;
type SurfaceRuntime = SurfaceDynamic;
type SurfaceFactory<T = SurfaceDependency> = () => T;
type RealtimeEvent = SurfaceDynamic;
type RequestBody = Record<string, SurfaceDynamic>;
type RouteRecord = Record<string, unknown>;
type RouteRecordBuilder = (sessionId: string) => Promise<unknown>;

function toRouteRecord(value: unknown): RouteRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as RouteRecord
    : {};
}

function buildRouteRecord(builder: RouteRecordBuilder): (sessionId: string) => Promise<RouteRecord> {
  return async (sessionId: string) => toRouteRecord(await builder(sessionId));
}

type WebAppRouteDepsFactoryOptions = {
  auth: SurfaceDependency;
  operations: SurfaceDependencyMap;
  runtimeServices: SurfaceDependencyMap;
  getRuntime: SurfaceFactory<SurfaceRuntime | null>;
  getRealtime: SurfaceFactory<SurfaceRuntime | null>;
  getConversationService: SurfaceFactory<SurfaceRuntime>;
  runtimeRoutes: WebAppRuntimeRouteService;
  gatewayControl: Pick<
    WebAppGatewayControlService,
    | 'previewGatewayMemoryRecall'
    | 'listGatewayMemorySources'
    | 'listGatewayApprovals'
    | 'resolveGatewayApproval'
    | 'listGatewayArtifacts'
    | 'readGatewayArtifactDiff'
    | 'listGatewayCapabilities'
    | 'enableGatewayCapability'
    | 'disableGatewayCapability'
    | 'previewGatewaySelfmod'
    | 'applyGatewaySelfmod'
    | 'rollbackGatewaySelfmod'
    | 'abortCanonicalChat'
  >;
  gatewayRuntime: ZavorthGatewayRuntimeService;
  agentGateway?: ZavorthAgentGateway | null;
  webSecurity: SurfaceRuntime;
  accessReadiness: SurfaceDependency;
  accessManifest: SurfaceDependency;
  installJourney: SurfaceDependency;
  bootstrapRepair: SurfaceDependency;
  startupService: SurfaceDependency;
  officialRemoteAccess: SurfaceDependency;
  remoteAccess: SurfaceDependency;
  surfaceConsistency: SurfaceDependency;
  consoleAssets: SurfaceDependency;
  channelInstall: SurfaceDependency;
  channelProviderDoctor: SurfaceDependency;
  channelSetupAssistant: SurfaceDependency;
  skillCatalogApi: SurfaceDependency;
  skillMcpSidecar: SurfaceDependency;
  skillLibraryPresentation: SurfaceDependency;
  skillInstallPlanPresentation: SurfaceDependency;
  skillBridgeActivation: SurfaceDependency;
  permissionAuditService: SurfaceDependency;
  capabilityLifecycle: SurfaceDependency;
  selfModification: SurfaceDependency;
  mutationPlane: SurfaceDependency;
  trustDecision: SurfaceDependency;
  desktopResources: SurfaceRuntime;
  companions: SurfaceDependency;
  taskResourcePlanner: SurfaceDependency;
  modeEscalation: SurfaceDependency;
  workspaceOptimizer: SurfaceDependency;
  sessionV2: SurfaceDependency;
  swarmV2: SurfaceDependency;
  swarmScalePlane: SurfaceDependency;
  computerUseAgent: SurfaceDependency;
  watchMode: SurfaceDependency;
  engineeringCore: SurfaceDependency;
  systemOverlordControl: SurfaceDependency;
  workspaceRoot: string;
  runtimeContext: WebAppRuntimeContextBridge;
  publicApi: CanonicalPublicApiService;
  buildHubControlPlane: SurfaceFactory;
  buildHubActionService: SurfaceFactory;
  buildQaControlPlane: SurfaceFactory;
  buildGovernanceControlPlane: SurfaceFactory;
  buildReplayLearningControlPlane: SurfaceFactory;
  buildEcosystemControlPlane: SurfaceFactory;
  buildDistributedRuntimeControlPlane: SurfaceFactory;
  buildRuntimeStabilityControlPlane: SurfaceFactory;
  buildRolloutReadinessControlPlane: SurfaceFactory;
  buildNaturalSetupControlPlane: SurfaceFactory;
  buildAutomationControlPlane: SurfaceFactory;
  buildAutomationActionService: SurfaceFactory;
  buildWatchModeControlPlane: SurfaceFactory;
};

export class WebAppRouteDepsFactoryService {
  constructor(private readonly options: WebAppRouteDepsFactoryOptions) {}

  public buildSurfaceRouteDeps(): WebAppSurfaceRouteDeps {
    const runtime = this.options.getRuntime();
    const realtime = this.options.getRealtime();
    const evalControlPlane = this.options.operations.productObservability
      ? new ZavorthEvalControlPlaneService({
          productObservabilityService: this.options.operations.productObservability,
          operatorBriefService: this.options.operations.operatorBrief || undefined,
          operationsHealthService: this.options.operations.operationsHealth || undefined,
          telemetryLedgerService: new ZavorthTelemetryLedgerService(),
          evalHistoryService: new ZavorthEvalHistoryFileService(),
        })
      : null;
    const mcpToolPolicyFileService = new McpToolPolicyFileService();
    const skillTrustPolicyService = new SkillTrustPolicyService();
    const trustPlaneService = new ZavorthTrustPlaneService({
      securityMeshService: this.options.operations.securityMesh || undefined,
      systemOverlordControlService: this.options.systemOverlordControl,
      mcpToolPolicy: McpToolPolicy.fromEnv(),
      mcpCapabilityControlPlaneService: this.options.operations.mcpCapabilityControlPlane || undefined,
      skillTrustPolicyService,
      pluginRegistryService: this.options.operations.pluginRegistry || undefined,
      workspaceExtensionsService: this.options.operations.workspaceExtensions || undefined,
      nodeMeshService: this.options.operations.nodeMesh || undefined,
    });

    return {
      operatorBrief: this.options.operations.operatorBrief,
      productObservability: this.options.operations.productObservability,
      evalControlPlane: evalControlPlane || undefined,
      qaControlPlane: this.options.buildQaControlPlane(),
      governanceControlPlane: this.options.buildGovernanceControlPlane(),
      replayLearningControlPlane: this.options.buildReplayLearningControlPlane(),
      ecosystemControlPlane: this.options.buildEcosystemControlPlane(),
      distributedRuntimeControlPlane: this.options.buildDistributedRuntimeControlPlane(),
      runtimeStabilityControlPlane: this.options.buildRuntimeStabilityControlPlane(),
      rolloutReadinessControlPlane: this.options.buildRolloutReadinessControlPlane(),
      naturalSetupControlPlane: this.options.buildNaturalSetupControlPlane(),
      automationControlPlane: this.options.buildAutomationControlPlane(),
      automationActions: this.options.buildAutomationActionService(),
      watchModeControlPlane: this.options.buildWatchModeControlPlane(),
      hubControlPlane: this.options.buildHubControlPlane(),
      hubActions: this.options.buildHubActionService(),
      capabilityCatalog: this.options.operations.capabilityCatalog,
      gatewayRuntime: this.options.gatewayRuntime,
      runtimeGateway: this.options.runtimeServices.gateway,
      gateway: this.options.operations.gateway,
      gatewayChannelRouter: this.options.runtimeServices.gatewayChannelRouter,
      runtime,
      realtime,
      buildMemoryPlaneSnapshot: buildRouteRecord(
        this.options.runtimeContext.buildMemoryPlaneSnapshot.bind(this.options.runtimeContext),
      ),
      resolveSessionId: this.options.runtimeContext.resolveSessionId.bind(this.options.runtimeContext),
      channelMesh: this.options.operations.channelMesh,
      channelActions: this.options.operations.channelActions,
      channelInstall: this.options.channelInstall,
      channelProviderDoctor: this.options.channelProviderDoctor,
      channelSetupAssistant: this.options.channelSetupAssistant,
      naturalChannelSetupTurn: new NaturalChannelSetupTurnService({
        assistant: this.options.channelSetupAssistant,
        channelActions: this.options.operations.channelActions || undefined,
      }),
      remoteTransports: this.options.operations.remoteTransports,
      remoteTransportActions: this.options.operations.remoteTransportActions,
      remoteTransportDoctor: this.options.operations.remoteTransportDoctor,
      runtimeToolSurface: this.options.runtimeServices.toolSurface,
      toolSurface: this.options.operations.toolSurface,
      pluginRegistry: this.options.operations.pluginRegistry,
      platformRegistry: this.options.operations.platformRegistry,
      pluginActions: this.options.operations.pluginActions,
      platformActions: this.options.operations.platformActions,
      platformCatalogSync: this.options.operations.platformCatalogSync,
      platformPublisher: this.options.operations.platformPublisher,
      hookPipeline: this.options.operations.hookPipeline,
      hookPlane: this.options.operations.hookPlane,
      workspaceExtensions: this.options.operations.workspaceExtensions,
      runtimeModes: this.options.operations.runtimeModes,
      securityMesh: this.options.operations.securityMesh,
      trustPlane: trustPlaneService,
      trustPlaneActions: new ZavorthTrustPlaneActionService({
        trustPlaneService,
        mcpToolPolicyFileService,
        skillTrustPolicyService,
      }),
      teamCatalog: this.options.operations.teamCatalog,
      tenantGovernance: this.options.operations.tenantGovernance,
      tenantGovernanceActions: this.options.operations.tenantGovernanceActions,
      codexRemote: this.options.operations.codexRemote,
      codexRemoteActions: this.options.operations.codexRemoteActions,
      agentOperatingSystem: this.options.operations.agentOperatingSystem,
      agentOperatingSystemActions: this.options.operations.agentOperatingSystemActions,
      operationsActions: this.options.operations.operationsActions,
      integrationHub: this.options.operations.integrationHub,
      skillCatalogApi: this.options.skillCatalogApi,
      skillMcpSidecar: this.options.skillMcpSidecar,
      skillLibraryPresentation: this.options.skillLibraryPresentation,
      skillInstallPlanPresentation: this.options.skillInstallPlanPresentation,
      skillBridgeActivation: this.options.skillBridgeActivation,
      mcpCapabilityControlPlane: this.options.operations.mcpCapabilityControlPlane,
      mcpRuntime: this.options.operations.mcpRuntime,
      mcpBrowserDoctor: this.options.operations.mcpBrowserDoctor,
      providerControlPlane: this.options.operations.providerControlPlane,
      zavorthBridgeMobileAccess: this.options.operations.zavorthBridgeMobileAccess,
      AIGatewayGateway: this.options.operations.AIGatewayGateway,
      AIGatewayGatewayLauncher: this.options.operations.AIGatewayGatewayLauncher,
      AIGatewayCompatibilityDoctor: this.options.operations.AIGatewayCompatibilityDoctor,
      AIGatewayUpstreamSync: this.options.operations.AIGatewayUpstreamSync,
      writeJson: this.options.runtimeContext.writeJson.bind(this.options.runtimeContext),
      readJsonBody: this.options.runtimeContext.readJsonBody.bind(this.options.runtimeContext),
      workspaceRoot: this.options.workspaceRoot,
    };
  }

  public buildNodeRouteDeps(): WebAppNodeRouteDeps {
    return {
      nodeMesh: this.options.operations.nodeMesh,
      nodeInvoke: this.options.operations.nodeInvoke,
      nodePairing: this.options.operations.nodePairing,
      nodeHeartbeat: this.options.operations.nodeHeartbeat,
      runtime: this.options.getRuntime(),
      writeJson: this.options.runtimeContext.writeJson.bind(this.options.runtimeContext),
      readJsonBody: this.options.runtimeContext.readJsonBody.bind(this.options.runtimeContext),
    };
  }

  public buildRuntimeRouteDeps(): WebAppRuntimeRouteDeps {
    const conversation = this.options.getConversationService();
    return {
      auth: this.options.auth,
      accessReadiness: this.options.accessReadiness,
      accessManifest: this.options.accessManifest,
      installJourney: this.options.installJourney,
      bootstrapRepair: this.options.bootstrapRepair,
      startupService: this.options.startupService,
      officialRemoteAccess: this.options.officialRemoteAccess,
      remoteAccess: this.options.remoteAccess,
      surfaceConsistency: this.options.surfaceConsistency,
      consoleAssets: this.options.consoleAssets,
      runtime: this.options.getRuntime()!,
      realtime: this.options.getRealtime()!,
      gatewayRuntime: this.options.gatewayRuntime,
      agentGateway: this.options.agentGateway || null,
      runtimeGateway: this.options.runtimeServices.gateway,
      runtimeSessionTools: this.options.runtimeServices.sessionTools,
      sessionTools: this.options.operations.sessionTools,
      runtimeGatewaySessionTools: this.options.runtimeServices.gatewaySessionTools,
      buildMemoryPlaneSnapshot: buildRouteRecord(
        this.options.runtimeContext.buildMemoryPlaneSnapshot.bind(this.options.runtimeContext),
      ),
      buildLayeredMemoryStatus: buildRouteRecord(
        this.options.runtimeContext.buildLayeredMemoryStatus.bind(this.options.runtimeContext),
      ),
      buildLearningPlaneStatus: buildRouteRecord(
        this.options.runtimeContext.buildLearningPlaneStatus.bind(this.options.runtimeContext),
      ),
      buildLearningPlaneSnapshot: buildRouteRecord(
        this.options.runtimeContext.buildLearningPlaneSnapshot.bind(this.options.runtimeContext),
      ),
      buildLearningPlaneMetrics: buildRouteRecord(
        this.options.runtimeContext.buildLearningPlaneMetrics.bind(this.options.runtimeContext),
      ),
      executeLearningAction: this.options.runtimeContext.executeLearningPlaneAction.bind(this.options.runtimeContext),
      searchLayeredMemory: this.options.runtimeContext.searchLayeredMemory.bind(this.options.runtimeContext),
      readLayeredMemoryProcedures: this.options.runtimeContext.readLayeredMemoryProcedures.bind(this.options.runtimeContext),
      readLayeredMemoryMetrics: buildRouteRecord(
        this.options.runtimeContext.readLayeredMemoryMetrics.bind(this.options.runtimeContext),
      ),
      hybridMemory: {
        previewRecall: this.options.runtimeContext.previewHybridMemoryRecall.bind(this.options.runtimeContext),
        listSources: this.options.runtimeContext.listHybridMemorySources.bind(this.options.runtimeContext),
      },
      buildOpsQuality: buildRouteRecord(
        this.options.runtimeContext.buildOpsQuality.bind(this.options.runtimeContext),
      ),
      buildSessionPlaneSnapshot: buildRouteRecord(
        this.options.runtimeContext.buildSessionPlaneSnapshot.bind(this.options.runtimeContext),
      ),
      buildSessionPlaneStatusSummary: buildRouteRecord(
        this.options.runtimeContext.buildSessionPlaneStatusSummary.bind(this.options.runtimeContext),
      ),
      processChatSend: conversation.processChatSend.bind(conversation),
      resolveSessionId: this.options.runtimeContext.resolveSessionId.bind(this.options.runtimeContext),
      resolveSessionIdFromPermission: this.options.runtimeContext.resolveSessionIdFromPermission.bind(this.options.runtimeContext),
      resolveSessionIdFromTask: this.options.runtimeContext.resolveSessionIdFromTask.bind(this.options.runtimeContext),
      createWebContext: conversation.createWebContext.bind(conversation),
      openEventStream: this.options.runtimeContext.openEventStream.bind(this.options.runtimeContext),
      writeJson: this.options.runtimeContext.writeJson.bind(this.options.runtimeContext),
      readJsonBody: this.options.runtimeContext.readJsonBody.bind(this.options.runtimeContext),
      getComposerCatalog: conversation.getComposerCatalog.bind(conversation),
      publicApi: this.options.publicApi,
      getGatewaySessionTools: this.options.runtimeContext.getGatewaySessionTools.bind(this.options.runtimeContext),
      gatewaySessionReadModel: this.options.runtimeServices.gatewaySessionReadModel,
      permissionAuditService: this.options.permissionAuditService,
      capabilityLifecycle: this.options.capabilityLifecycle,
      selfModification: this.options.selfModification,
      mutationPlane: this.options.mutationPlane,
      trustDecision: this.options.trustDecision,
      desktopResources: this.options.desktopResources,
      companions: this.options.companions,
      taskResourcePlanner: this.options.taskResourcePlanner,
      modeEscalation: this.options.modeEscalation,
      workspaceOptimizer: this.options.workspaceOptimizer,
      sessionV2: this.options.sessionV2,
      swarmV2: this.options.swarmV2,
      swarmScalePlane: this.options.swarmScalePlane,
      computerUseAgent: this.options.computerUseAgent,
      watchMode: this.options.watchMode,
      engineeringCore: this.options.engineeringCore,
      systemOverlordControl: this.options.systemOverlordControl,
    };
  }

  public buildGatewayControlSocketDeps(): GatewayControlSocketDeps {
    const runtimeReady = Boolean(this.options.getRuntime() && this.options.getRealtime());
    return {
      path: '/api/web/gateway/ws',
      authorize: (request: http.IncomingMessage, requestUrl: URL) =>
        this.options.webSecurity.isAuthorizedUpgrade(request, requestUrl),
      unavailableReason: runtimeReady
        ? null
        : 'Zavorth Gateway runtime unavailable for WebSocket upgrade on this host.',
      resolveSessionId: this.options.runtimeContext.resolveSessionId.bind(this.options.runtimeContext),
      createSession: () => this.options.getRealtime()?.createSession() || `web-${Date.now()}`,
      getChatId: (sessionId: string) => this.options.getRealtime()?.getChatId(sessionId) || `web:${sessionId}`,
      getUserId: () => this.options.getRuntime()?.webUserId || null,
      ensureSession: (sessionId: string) => {
        this.options.getRealtime()?.ensureSession(sessionId);
      },
      captureBaseline: async (sessionId: string) => {
        await this.options.getRealtime()?.captureBaseline(sessionId);
      },
      subscribeRealtime: (sessionId: string, listener: (event: RealtimeEvent) => void) =>
        this.options.getRealtime()?.subscribe(sessionId, listener) || (() => undefined),
      buildCanonicalState: async (sessionId: string) =>
        this.options.runtimeRoutes.buildCanonicalStatePayload(sessionId, this.buildRuntimeRouteDeps(), {
          includeSessionsList: true,
          historyMode: 'full',
          sessionPlaneMode: 'full',
          snapshotMode: 'cached',
          includeMemoryRecall: false,
          includeGateway: false,
        }),
      buildCanonicalHistory: async (sessionId: string) =>
        this.options.runtimeRoutes.buildCanonicalSessionBundle(sessionId, this.buildRuntimeRouteDeps(), {
          includeSessionsList: true,
          historyMode: 'full',
          includeGateway: false,
        }),
      patchSession: async (input: {
        sessionId: string;
        label?: string | null;
        workspaceHint?: string | null;
        pinned?: boolean;
        modelProfile?: string | null;
      }) => this.options.runtimeRoutes.patchCanonicalSession(input, this.buildRuntimeRouteDeps()),
      listApprovals: async (sessionId: string, limit?: number) =>
        this.options.gatewayControl.listGatewayApprovals(sessionId, this.buildRuntimeRouteDeps(), limit),
      resolveApproval: async (input: {
        approvalId: string;
        decision: 'approve' | 'reject';
        sessionId?: string | null;
        scope?: string | null;
        approvalCode?: string | null;
        requestedBy?: string | null;
      }) => this.options.gatewayControl.resolveGatewayApproval(input, this.buildRuntimeRouteDeps()),
      listArtifacts: async (input: {
        sessionId: string;
        toolRunId?: string | null;
      }) => this.options.gatewayControl.listGatewayArtifacts(input.sessionId, this.buildRuntimeRouteDeps(), input),
      readArtifactDiff: async (input: {
        sessionId: string;
        toolRunId: string;
        path?: string | null;
      }) => this.options.gatewayControl.readGatewayArtifactDiff(input, this.buildRuntimeRouteDeps()),
      previewMemoryRecall: async (input: {
        sessionId: string;
        query?: string | null;
        limit?: number | null;
      }) => this.options.gatewayControl.previewGatewayMemoryRecall(input, this.buildRuntimeRouteDeps()),
      listMemorySources: async (input: { sessionId: string }) =>
        this.options.gatewayControl.listGatewayMemorySources(input, this.buildRuntimeRouteDeps()),
      getProductMode: async () =>
        this.options.runtimeRoutes.getProductMode(this.buildRuntimeRouteDeps()),
      getModeEscalation: async (input: { sessionId: string }) =>
        this.options.runtimeRoutes.getModeEscalation(input.sessionId, this.buildRuntimeRouteDeps()),
      setProductMode: async (input: {
        mode: string;
        requestedBy?: string | null;
      }) => this.options.runtimeRoutes.setProductMode(input, this.buildRuntimeRouteDeps()),
      resolveModeEscalation: async (input: {
        requestId: string;
        decision: 'approve' | 'reject';
        scope?: string | null;
        requestedBy?: string | null;
      }) => this.options.runtimeRoutes.resolveModeEscalation(input, this.buildRuntimeRouteDeps()),
      listCapabilities: async () =>
        this.options.gatewayControl.listGatewayCapabilities(this.buildRuntimeRouteDeps()),
      enableCapability: async (input: {
        capabilityId: string;
        sessionId?: string | null;
        scope?: string | null;
        reason?: string | null;
        requestedBy?: string | null;
        sourceSurface?: string | null;
      }) => this.options.gatewayControl.enableGatewayCapability(input, this.buildRuntimeRouteDeps()),
      disableCapability: async (input: {
        capabilityId: string;
        requestedBy?: string | null;
      }) => this.options.gatewayControl.disableGatewayCapability(input, this.buildRuntimeRouteDeps()),
      previewSelfmod: async (input: {
        mode: 'file' | 'goal';
        filePath?: string | null;
        instruction?: string | null;
        goal?: string | null;
        requestedBy?: string | null;
      }) => this.options.gatewayControl.previewGatewaySelfmod(input, this.buildRuntimeRouteDeps()),
      applySelfmod: async (input: {
        previewId: string;
        sessionId?: string | null;
        requestedBy?: string | null;
      }) => this.options.gatewayControl.applyGatewaySelfmod(input, this.buildRuntimeRouteDeps()),
      rollbackSelfmod: async (input: {
        changeId: string;
        requestedBy?: string | null;
      }) => this.options.gatewayControl.rollbackGatewaySelfmod(input, this.buildRuntimeRouteDeps()),
      abortChat: async (input: {
        sessionId: string;
        requestedBy?: string | null;
      }) => this.options.gatewayControl.abortCanonicalChat(input, this.buildRuntimeRouteDeps()),
      readDesktopResources: async (input: {
        sessionId: string;
        preferCachedWithinMs?: number;
      }) => this.options.desktopResources.inspectLive({
        preferCachedWithinMs: Math.max(0, Number(input.preferCachedWithinMs || 15_000) || 15_000),
      }),
      buildRuntime: async (input: {
        sessionId: string | null;
        chatId: string | null;
        userId: string | null;
      }) => this.options.gatewayRuntime.buildCanonicalSnapshot({
        ...input,
        preferredTransport: 'ws',
      }),
      processChatSend: async (body: RequestBody) =>
        this.options.runtimeRoutes.executeCanonicalChatSend(body, this.buildRuntimeRouteDeps()),
      spawnSession: async (body: RequestBody) =>
        this.options.runtimeRoutes.executeCanonicalSpawn(body, this.buildRuntimeRouteDeps()),
      heartbeatIntervalMs: 15_000,
    };
  }
}


