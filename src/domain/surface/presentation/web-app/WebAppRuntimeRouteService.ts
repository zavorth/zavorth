import * as http from 'http';
import type { PermissionRequest } from '../../../../contracts/PermissionRequest.js';
import type { SharedSurfaceRuntime } from '../../../../services/SurfaceRuntime.js';
import { DashboardAuthService } from '../../../../services/DashboardAuthService.js';
import { RuntimeAccessManifestService } from '../../../../runtime/access/RuntimeAccessManifestService.js';
import { RuntimeAccessReadinessService } from '../../../../runtime/access/RuntimeAccessReadinessService.js';
import { RuntimeInstallJourneyService } from '../../../../runtime/access/RuntimeInstallJourneyService.js';
import type { RuntimeBootstrapRepairService } from '../../../../services/RuntimeBootstrapRepairService.js';
import type { RuntimeStartupService } from '../../../../services/RuntimeStartupService.js';
import type { RuntimeOfficialRemoteAccessService } from '../../../../runtime/access/RuntimeOfficialRemoteAccessService.js';
import type { RuntimeRemoteAccessService } from '../../../../runtime/access/RuntimeRemoteAccessService.js';
import { SharedSurfaceParityService } from '../../../../services/SharedSurfaceParityService.js';
import { WebConsoleAssetService } from '../web-console/WebConsoleAssetService.js';
import { WebRealtimeService } from '../../../../services/WebRealtimeService.js';
import type { SessionV2Service } from '../../../../services/SessionV2Service.js';
import type { SwarmV2Service } from '../../../../services/SwarmV2Service.js';
import type { EngineeringCoreService } from '../../../../services/EngineeringCoreService.js';
import type { SystemOverlordControlService } from '../../../../services/SystemOverlordControlService.js';
import type { ComputerUseWatchModeService } from '../../../../services/ComputerUseWatchModeService.js';
import type { GatewaySessionReadModelService } from '../../../../runtime/sessions/GatewaySessionReadModelService.js';
import { GatewaySessionToolsService } from '../../../../runtime/sessions/GatewaySessionToolsService.js';
import { ZavorthSessionToolsService } from '../../../../runtime/sessions/ZavorthSessionToolsService.js';
import type { ZavorthAgentGateway } from '../../../../runtime/agent/index.js';
import type { ZavorthGatewayService } from '../../../../services/ZavorthGatewayService.js';
import type { ZavorthGatewayRuntimeService } from '../../../../services/ZavorthGatewayRuntimeService.js';
import type { PermissionService } from '../../../../services/PermissionService.js';
import type { CanonicalPublicApiService } from '../../../../api/public/CanonicalPublicApiService.js';
import type { CapabilityLifecycleService } from '../../../../services/CapabilityLifecycleService.js';
import type { SelfModificationCommandService } from '../../../../services/SelfModificationCommandService.js';
import type { ZavorthMutationPlaneService } from '../../../../services/ZavorthMutationPlaneService.js';
import type { TrustDecisionService } from '../../../../services/TrustDecisionService.js';
import type { DesktopResourcePlaneService } from '../../../../services/DesktopResourcePlaneService.js';
import type { CompanionControlService } from '../../../../services/CompanionControlService.js';
import type { TaskResourceImpact } from '../../../../contracts/TaskResourcePlannerContract.js';
import type { TaskResourcePlannerService } from '../../../../services/TaskResourcePlannerService.js';
import type { CompanionWorkspaceOptimizerService } from '../../../../services/CompanionWorkspaceOptimizerService.js';
import type {
  ModeEscalationResolution,
  ModeEscalationSnapshot,
} from '../../../../contracts/ModeEscalationContract.js';
import type { ModeEscalationService } from '../../../../services/ModeEscalationService.js';
import type {
  GatewayCanonicalSessionBundle,
  GatewayCanonicalSessionContext,
  GatewayCanonicalStatePayload,
} from '../../../../contracts/GatewayContract.js';
import type { HybridMemoryService } from '../../../../services/HybridMemoryService.js';
import { WebAppRuntimeCanonicalStateService } from './WebAppRuntimeCanonicalStateService.js';
import { WebAppGatewayControlService } from './WebAppGatewayControlService.js';
import { WebAppHostRouteService } from './WebAppHostRouteService.js';
import {
  WebAppRuntimeInteractionRouteService,
  type WebAppRuntimeInteractionRouteHelpers,
} from './WebAppRuntimeInteractionRouteService.js';
import { WebAppRuntimeOperationsRouteService } from './WebAppRuntimeOperationsRouteService.js';
import {
  WebAppRuntimeSessionMutationService,
  type WebAppRuntimeSessionMutationHelpers,
} from '../../../../services/WebAppRuntimeSessionMutationService.js';
import {
  WebAppRuntimeStateRouteService,
  type WebAppRuntimeStateRouteHelpers,
} from './WebAppRuntimeStateRouteService.js';
import { WebAppSupervisionRouteService } from './WebAppSupervisionRouteService.js';
import {
  buildWebAppRuntimeLightweightStateResponse,
  buildWebAppRuntimeProductMode,
  buildWebAppRuntimeRecallQueryFromSnapshot,
  buildWebAppRuntimeUiSurfaceHints,
  isWebAppRuntimeCanonicalSessionPlaneRoute,
  isWebAppRuntimeFullDetailRequested,
} from './web-app-runtime-route/WebAppRuntimeRouteHelpers.js';

type WriteJson = (res: http.ServerResponse, body: unknown, statusCode?: number) => void;
type ReadJsonBody = (req: http.IncomingMessage) => Promise<Record<string, any>>;
type BuildSnapshot = (sessionId: string) => Promise<any>;
type BuildStatusSnapshot = (sessionId: string) => Promise<any>;
type BuildMetricsSnapshot = (sessionId: string) => Promise<any>;
type ExecuteLearningAction = (input: {
  candidateId: string;
  actionId: 'approve' | 'reject' | 'promote';
}) => Promise<any> | any;
type SearchLayeredMemory = (input: {
  sessionId: string;
  query: string;
  limit?: number;
}) => Promise<any>;
type ReadLayeredMemoryProcedures = (sessionId: string) => Promise<any>;
type ProcessChatSend = (body: Record<string, any>) => Promise<{
  sessionId: string;
  taskId: string | null;
  snapshot: any;
  resourceImpact?: TaskResourceImpact | null;
  modeEscalation?: ModeEscalationSnapshot | null;
}>;
type ResolveSessionId = (url: URL) => string;
type ResolveSessionIdFromPermission = (permission: PermissionRequest, requestedSessionId: string) => Promise<string>;
type ResolveSessionIdFromTask = (task: any, requestedSessionId: string) => string;
type CreateWebContext = (sessionId: string) => any;
type OpenEventStream = (req: http.IncomingMessage, res: http.ServerResponse, sessionId: string) => void;
type GetComposerCatalog = () => {
  getCatalog: (chatId: string | null) => Promise<any>;
};

export type WebAppRuntimeRouteDeps = {
  auth: DashboardAuthService;
  accessReadiness: RuntimeAccessReadinessService;
  accessManifest: RuntimeAccessManifestService;
  installJourney: RuntimeInstallJourneyService;
  bootstrapRepair?: Pick<RuntimeBootstrapRepairService, 'repairLive'> | null;
  startupService?: Pick<RuntimeStartupService, 'startAndWait'> | null;
  officialRemoteAccess: Pick<RuntimeOfficialRemoteAccessService, 'inspect' | 'runAction'>;
  remoteAccess: Pick<RuntimeRemoteAccessService, 'inspect'>;
  surfaceParity: SharedSurfaceParityService;
  consoleAssets: WebConsoleAssetService;
  runtime: SharedSurfaceRuntime;
  realtime: WebRealtimeService;
  gatewayRuntime?: ZavorthGatewayRuntimeService | null;
  agentGateway?: Pick<ZavorthAgentGateway, 'buildSnapshot' | 'approve' | 'reject' | 'handle'> & Partial<Pick<ZavorthAgentGateway, 'resolveApprovalIntent'>> | null;
  runtimeGateway: ZavorthGatewayService | null;
  runtimeSessionTools: ZavorthSessionToolsService | null;
  sessionTools: ZavorthSessionToolsService | null;
  runtimeGatewaySessionTools: Pick<
    GatewaySessionToolsService,
    'buildDescriptors' | 'listSessions' | 'listSessionsSummary' | 'readHistory' | 'readHistoryFast' | 'spawnSession'
  > | null;
  buildMemoryPlaneSnapshot: BuildSnapshot;
  buildLayeredMemoryStatus: BuildStatusSnapshot;
  buildLearningPlaneStatus: BuildStatusSnapshot;
  buildLearningPlaneSnapshot: BuildSnapshot;
  buildLearningPlaneMetrics: BuildMetricsSnapshot;
  executeLearningAction: ExecuteLearningAction;
  searchLayeredMemory: SearchLayeredMemory;
  readLayeredMemoryProcedures: ReadLayeredMemoryProcedures;
  readLayeredMemoryMetrics: BuildMetricsSnapshot;
  hybridMemory?: Pick<HybridMemoryService, 'previewRecall' | 'listSources'> | null;
  buildOpsQuality: BuildMetricsSnapshot;
  buildSessionPlaneSnapshot: BuildSnapshot;
  buildSessionPlaneStatusSummary: BuildSnapshot;
  processChatSend: ProcessChatSend;
  resolveSessionId: ResolveSessionId;
  resolveSessionIdFromPermission: ResolveSessionIdFromPermission;
  resolveSessionIdFromTask: ResolveSessionIdFromTask;
  createWebContext: CreateWebContext;
  openEventStream: OpenEventStream;
  writeJson: WriteJson;
  readJsonBody: ReadJsonBody;
  getComposerCatalog: GetComposerCatalog;
  publicApi?: CanonicalPublicApiService | null;
  getGatewaySessionTools: () => GatewaySessionToolsService;
  gatewaySessionReadModel?: Pick<
    GatewaySessionReadModelService,
    'buildSnapshot' | 'listSessions' | 'listSessionsSummary' | 'patchSessionMetadata' | 'readSessionMetadata'
  > | null;
  permissionAuditService?: Pick<
    PermissionService,
    'listRequests' | 'getRequest' | 'approveRequest' | 'rejectRequest'
  > | null;
  capabilityLifecycle?: Pick<
    CapabilityLifecycleService,
    'buildSnapshot'
    | 'buildProductModeSnapshot'
    | 'getManifest'
    | 'buildApprovalRequest'
    | 'registerCapabilityDemand'
    | 'enableCapability'
    | 'disableCapability'
    | 'markCapabilityState'
    | 'registerCapabilityUsage'
    | 'setProductMode'
  > | null;
  selfModification?: Pick<
    SelfModificationCommandService,
    'createPreview' | 'createGoalPreview' | 'applyPreview' | 'rollbackChangeSet'
  > | null;
  mutationPlane?: Pick<
    ZavorthMutationPlaneService,
    'createPlan' | 'listPlans' | 'readPlan' | 'approvePlan' | 'attachApproval' | 'markApplied' | 'markBlocked'
  > | null;
  trustDecision?: Pick<TrustDecisionService, 'evaluate'> | null;
  desktopResources?: Pick<DesktopResourcePlaneService, 'inspectLive' | 'readLatest' | 'renderReport'> | null;
  companions?: Pick<
    CompanionControlService,
    'buildSnapshot' | 'inspectCompanion' | 'executeAction' | 'renderSnapshot' | 'renderCompanion' | 'renderActionResult'
  > | null;
  workspaceOptimizer?: Pick<
    CompanionWorkspaceOptimizerService,
    'buildLoadProfile' | 'previewOptimization' | 'applyOptimization' | 'renderLoadProfile' | 'renderPreview' | 'renderApplyResult'
  > | null;
  taskResourcePlanner?: Pick<
    TaskResourcePlannerService,
    'planCapabilityEnable' | 'renderImpactSummary' | 'toMutationResourceImpact'
  > | null;
  modeEscalation?: Pick<
    ModeEscalationService,
    'buildSnapshot' | 'resolveRequest'
  > | null;
  sessionV2?: Pick<
    SessionV2Service,
    'createSession' | 'listSessions' | 'getSession' | 'writeSession' | 'killSession' | 'listRecordings' | 'getRecording' | 'queryMemory'
  > | null;
  experimentalSessionV2?: Pick<
    SessionV2Service,
    'createSession' | 'listSessions' | 'getSession' | 'writeSession' | 'killSession' | 'listRecordings' | 'getRecording' | 'queryMemory'
  > | null;
  swarmV2?: Pick<
    SwarmV2Service,
    'launchSwarm' | 'listSwarms' | 'getSwarm' | 'cancelSwarm'
  > | null;
  experimentalSwarmV2?: Pick<
    SwarmV2Service,
    'launchSwarm' | 'listSwarms' | 'getSwarm' | 'cancelSwarm'
  > | null;
  watchMode?: Pick<
    ComputerUseWatchModeService,
    'buildSnapshot'
    | 'listRuns'
    | 'getRun'
    | 'getActiveRun'
    | 'startRun'
    | 'setStrictApprovalDefault'
    | 'allowApp'
    | 'allowSite'
    | 'previewMutation'
    | 'applyMutationPlan'
    | 'pauseRun'
    | 'resumeRun'
    | 'stopRun'
    | 'decideApproval'
    | 'resolveScreenshotPath'
  > | null;
  computerUseAgent?: {
    run(config: any): Promise<any>;
    stop(): void;
    getSnapshot(): any;
  } | null;
  engineeringCore?: Pick<
    EngineeringCoreService,
    'startRun' | 'listRuns' | 'getRun' | 'continueRun' | 'approveRun' | 'proposePatch' | 'applyPatch' | 'rollbackRun' | 'runCommand' | 'executeRun' | 'getReplay'
  > | null;
  systemOverlordControl?: Pick<
    SystemOverlordControlService,
    'buildSnapshot' | 'executeAction' | 'listApprovals' | 'decideApproval' | 'setKillSwitch' | 'cancelAction' | 'rollbackAction'
  > | null;
};

export class WebAppRuntimeRouteService {
  private readonly gatewayControl = new WebAppGatewayControlService();
  private readonly canonicalState = new WebAppRuntimeCanonicalStateService(this.gatewayControl);
  private readonly hostRoutes = new WebAppHostRouteService();
  private readonly interactionRoutes = new WebAppRuntimeInteractionRouteService();
  private readonly runtimeOperationsRoutes = new WebAppRuntimeOperationsRouteService();
  private readonly sessionMutations = new WebAppRuntimeSessionMutationService();
  private readonly stateRoutes = new WebAppRuntimeStateRouteService();
  private readonly supervisionRoutes = new WebAppSupervisionRouteService();

  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    pathname: string,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<boolean> {
    if (await this.supervisionRoutes.handleRequest(req, res, url, pathname, deps)) {
      return true;
    }

    if (await this.stateRoutes.handleRequest(req, res, url, pathname, deps, this.buildStateRouteHelpers(deps))) {
      return true;
    }

    if (await this.runtimeOperationsRoutes.handleRequest(req, res, url, pathname, deps)) {
      return true;
    }

    if (await this.hostRoutes.handleRequest(req, res, url, pathname, deps)) {
      return true;
    }

    if (await this.interactionRoutes.handleRequest(req, res, url, pathname, deps, this.buildInteractionRouteHelpers(deps))) {
      return true;
    }

    return false;
  }

  public buildSessionContext(
    sessionId: string,
    deps: WebAppRuntimeRouteDeps,
  ): GatewayCanonicalSessionContext {
    return this.canonicalState.buildSessionContext(sessionId, deps);
  }

  public async buildCanonicalSessionBundle(
    sessionId: string,
    deps: WebAppRuntimeRouteDeps,
    options: {
      includeSessionsList?: boolean;
      historyMode?: 'none' | 'fast' | 'full';
      includeGateway?: boolean;
    } = {},
  ): Promise<GatewayCanonicalSessionBundle> {
    return this.canonicalState.buildCanonicalSessionBundle(sessionId, deps, options);
  }

  public async buildCanonicalStatePayload(
    sessionId: string,
    deps: WebAppRuntimeRouteDeps,
    options: {
      includeSessionsList?: boolean;
      historyMode?: 'none' | 'fast' | 'full';
      sessionPlaneMode?: 'none' | 'summary' | 'full';
      snapshotMode?: 'cached' | 'resolved';
      includeMemoryRecall?: boolean;
      includeGateway?: boolean;
      includeApprovalPlane?: boolean;
      includeCapabilityPlane?: boolean;
      includeArtifactPlane?: boolean;
      includeSelfmodPlane?: boolean;
      includeResourcePlane?: boolean;
      includeCompanionPlane?: boolean;
      includeModeEscalation?: boolean;
    } = {},
  ): Promise<GatewayCanonicalStatePayload> {
    return this.canonicalState.buildCanonicalStatePayload(sessionId, deps, options);
  }

  public getGatewayControl(): WebAppGatewayControlService {
    return this.gatewayControl;
  }

  public async readDesktopResources(
    deps: WebAppRuntimeRouteDeps,
    options: {
      preferCachedWithinMs?: number;
    } = {},
  ): Promise<Record<string, any> | null> {
    return this.runtimeOperationsRoutes.readDesktopResources(deps, options);
  }

  private buildStateRouteHelpers(
    deps: WebAppRuntimeRouteDeps,
  ): WebAppRuntimeStateRouteHelpers {
    return {
      buildSessionContext: (sessionId) => this.buildSessionContext(sessionId, deps),
      isFullDetailRequested: (url) => isWebAppRuntimeFullDetailRequested(url),
      previewGatewayMemoryRecall: (input) => this.gatewayControl.previewGatewayMemoryRecall(input, deps),
      listGatewayMemorySources: (input) => this.gatewayControl.listGatewayMemorySources(input, deps),
      buildRecallQueryFromSnapshot: (snapshot) => buildWebAppRuntimeRecallQueryFromSnapshot(snapshot),
      buildLightweightStateResponse: (state) => buildWebAppRuntimeLightweightStateResponse(state as any),
      buildProductMode: () => buildWebAppRuntimeProductMode(deps),
      buildUiSurfaceHints: (productMode, input) => buildWebAppRuntimeUiSurfaceHints(productMode as any, input),
      buildCanonicalStatePayload: (sessionId, options) => this.buildCanonicalStatePayload(sessionId, deps, options as any),
      isCanonicalSessionPlaneRoute: (pathname) => isWebAppRuntimeCanonicalSessionPlaneRoute(pathname),
    };
  }

  private buildSessionMutationHelpers(
    deps: WebAppRuntimeRouteDeps,
  ): WebAppRuntimeSessionMutationHelpers {
    return {
      buildCanonicalStatePayload: (sessionId, options) => this.buildCanonicalStatePayload(sessionId, deps, options),
    };
  }

  private buildInteractionRouteHelpers(
    deps: WebAppRuntimeRouteDeps,
  ): WebAppRuntimeInteractionRouteHelpers {
    return {
      buildCanonicalSessionBundle: (sessionId, options) => this.buildCanonicalSessionBundle(sessionId, deps, options),
      handleChatSend: (req, res) => this.sessionMutations.handleChatSend(
        req,
        res,
        deps,
        this.buildSessionMutationHelpers(deps),
      ),
      handleSpawn: (req, res) => this.sessionMutations.handleSpawn(
        req,
        res,
        deps,
        this.buildSessionMutationHelpers(deps),
      ),
    };
  }

  public async patchCanonicalSession(
    input: {
      sessionId: string;
      label?: string | null;
      workspaceHint?: string | null;
      pinned?: boolean;
      modelProfile?: string | null;
    },
    deps: WebAppRuntimeRouteDeps,
  ): Promise<Record<string, any>> {
    const sessionId = String(input.sessionId || '').trim();
    if (!sessionId) {
      throw new Error('sessionId obrigatorio para session.patch.');
    }
    if (!deps.gatewaySessionReadModel) {
      throw new Error('Gateway session read model indisponivel.');
    }

    const metadata = deps.gatewaySessionReadModel.patchSessionMetadata({
      userId: deps.runtime.webUserId,
      platform: 'web',
      sessionId,
      chatId: deps.realtime.getChatId(sessionId),
      sourceUserId: sessionId,
      label: input.label,
      workspaceHint: input.workspaceHint,
      pinned: input.pinned,
      modelProfile: input.modelProfile,
    });
    await deps.realtime.captureBaseline(sessionId);
    const payload = await this.buildCanonicalStatePayload(sessionId, deps, {
      includeSessionsList: true,
      historyMode: 'full',
      sessionPlaneMode: 'full',
      snapshotMode: 'resolved',
      includeGateway: false,
    });
    return {
      ok: true,
      sessionId,
      metadata,
      ...payload,
    };
  }

  public async getProductMode(
    deps: WebAppRuntimeRouteDeps,
  ): Promise<Record<string, any>> {
    return this.runtimeOperationsRoutes.getProductMode(deps);
  }

  public async setProductMode(
    input: {
      mode: string;
      requestedBy?: string | null;
    },
    deps: WebAppRuntimeRouteDeps,
  ): Promise<Record<string, any>> {
    return this.runtimeOperationsRoutes.setProductMode(input, deps);
  }

  public async getModeEscalation(
    sessionId: string,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<Record<string, any>> {
    return this.runtimeOperationsRoutes.getModeEscalation(sessionId, deps);
  }

  public async resolveModeEscalation(
    input: {
      requestId: string;
      decision: 'approve' | 'reject';
      scope?: string | null;
      requestedBy?: string | null;
    },
    deps: WebAppRuntimeRouteDeps,
  ): Promise<Record<string, any>> {
    return this.runtimeOperationsRoutes.resolveModeEscalation(input, deps);
  }

  public async executeCanonicalChatSend(
    body: Record<string, any>,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<Record<string, any>> {
    return this.sessionMutations.executeCanonicalChatSend(body, deps, this.buildSessionMutationHelpers(deps));
  }

  public async executeCanonicalSpawn(
    body: Record<string, any>,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<Record<string, any>> {
    return this.sessionMutations.executeCanonicalSpawn(body, deps, this.buildSessionMutationHelpers(deps));
  }

}

