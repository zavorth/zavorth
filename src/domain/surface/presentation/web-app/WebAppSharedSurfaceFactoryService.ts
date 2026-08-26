import type { SharedSurfaceRuntime, SurfaceControllerContext, PermissionControllerLike } from '../../../../orchestrator/SurfaceRuntime.js';
import type { SharedSurfaceCommandServiceDeps } from '../shared-surface/factory/SharedSurfaceCommandServiceDeps.js';
import type { RuntimeDiagnosticsService } from '../../../../services/RuntimeDiagnosticsService.js';
import type { PermissionService } from '../../../../services/PermissionService.js';
import type { TaskManager } from '../../../../orchestrator/TaskManager.js';
import { SharedSurfaceCommandService } from '../../../../services/SharedSurfaceCommandService.js';
import { NaturalChannelSetupTurnService } from '../../../../services/NaturalChannelSetupTurnService.js';
import { ZavorthTrustPlaneService } from '../../../../services/ZavorthTrustPlaneService.js';
import { McpToolPolicy } from '../../../../mcp/McpToolPolicy.js';
import { SkillTrustPolicyService } from '../../../../services/SkillTrustPolicyService.js';
import { ZavorthHubControlPlaneService } from '../../../../services/ZavorthHubControlPlaneService.js';
import { ZavorthHubActionService } from '../../../../services/ZavorthHubActionService.js';
import { ZavorthQaControlPlaneService } from '../../../../services/ZavorthQaControlPlaneService.js';
import { ZavorthGovernanceControlPlaneService } from '../../../../services/ZavorthGovernanceControlPlaneService.js';
import { ZavorthReplayLearningControlPlaneService } from '../../../../services/ZavorthReplayLearningControlPlaneService.js';
import { ZavorthEcosystemControlPlaneService } from '../../../../services/ZavorthEcosystemControlPlaneService.js';
import { ZavorthDistributedRuntimeControlPlaneService } from '../../../../services/ZavorthDistributedRuntimeControlPlaneService.js';
import { ZavorthRuntimeStabilityControlPlaneService } from '../../../../services/ZavorthRuntimeStabilityControlPlaneService.js';
import { ZavorthRolloutReadinessControlPlaneService } from '../../../../services/ZavorthRolloutReadinessControlPlaneService.js';
import { ZavorthNaturalSetupControlPlaneService } from '../../../../services/ZavorthNaturalSetupControlPlaneService.js';
import { ZavorthAutomationControlPlaneService } from '../../../../services/ZavorthAutomationControlPlaneService.js';
import { ZavorthAutomationActionService } from '../../../../services/ZavorthAutomationActionService.js';
import { ZavorthWatchModeControlPlaneService } from '../../../../services/ZavorthWatchModeControlPlaneService.js';
import type { ZavorthChannelActionService } from '../../../../services/ZavorthChannelActionService.js';
import type { ZavorthChannelMeshService } from '../../../../services/ZavorthChannelMeshService.js';
import type { ZavorthSecurityMeshService } from '../../../../services/ZavorthSecurityMeshService.js';
import type { IntegrationHubService } from '../../../../services/IntegrationHubService.js';
import type { McpCapabilityControlPlaneService } from '../../../../services/McpCapabilityControlPlaneService.js';
import type { ZavorthPluginRegistryService } from '../../../../services/ZavorthPluginRegistryService.js';
import type { WorkspaceExtensionRegistryService } from '../../../../services/WorkspaceExtensionRegistryService.js';
import type { ZavorthNodeMeshService } from '../../../../services/ZavorthNodeMeshService.js';
import type { ZavorthPluginActionService } from '../../../../services/ZavorthPluginActionService.js';
import type { ZavorthPlatformActionService } from '../../../../services/ZavorthPlatformActionService.js';
import type { ZavorthPlatformRegistryService } from '../../../../services/ZavorthPlatformRegistryService.js';
import type { ZavorthPlatformCatalogSyncService } from '../../../../services/ZavorthPlatformCatalogSyncService.js';
import type { ZavorthPackagePublisher } from '../../../../platform/publish/ZavorthPackagePublisher.js';
import type { ZavorthRemoteTransportActionService } from '../../../../services/ZavorthRemoteTransportActionService.js';
import type { ZavorthRemoteTransportService } from '../../../../services/ZavorthRemoteTransportService.js';
import type { ZavorthMemoryPlaneService } from '../../../../services/ZavorthMemoryPlaneService.js';
import type { ZavorthLayeredMemoryService } from '../../../../services/ZavorthLayeredMemoryService.js';
import type { ZavorthLearningPlaneService } from '../../../../services/ZavorthLearningPlaneService.js';
import type { ZavorthSessionPlaneService } from '../../../../services/ZavorthSessionPlaneService.js';
import type { ZavorthHookPlaneService } from '../../../../services/ZavorthHookPlaneService.js';
import type { ZavorthToolSurfaceService } from '../../../../services/ZavorthToolSurfaceService.js';
import type { NodePairingService } from '../../../../services/NodePairingService.js';
import type { NodeInvokeService } from '../../../../services/NodeInvokeService.js';
import type { ProviderControlPlaneService } from '../../../../services/ProviderControlPlaneService.js';
import type { ZavorthBridgeMobileAccessService } from '../../../../services/ZavorthBridgeMobileAccessService.js';
import type { RuntimeAccessManifestService } from '../../../../runtime/access/RuntimeAccessManifestService.js';
import type { RuntimeInstallJourneyService } from '../../../../runtime/access/RuntimeInstallJourneyService.js';
import type { RuntimeOfficialRemoteAccessService } from '../../../../runtime/access/RuntimeOfficialRemoteAccessService.js';
import type { DesktopResourcePlaneService } from '../../../../services/DesktopResourcePlaneService.js';
import type { CompanionControlService } from '../../../../services/CompanionControlService.js';
import type { TaskResourcePlannerService } from '../../../../services/TaskResourcePlannerService.js';
import type { ModeEscalationService } from '../../../../services/ModeEscalationService.js';
import type { CompanionWorkspaceOptimizerService } from '../../../../services/CompanionWorkspaceOptimizerService.js';
import type { AIGatewayProxyService } from '../../../../services/AIGatewayProxyService.js';
import type { ZavorthGatewayLauncherService } from '../../../../services/ZavorthGatewayLauncherService.js';
import type { GatewayCompatibilityDoctorService } from '../../../../services/GatewayCompatibilityDoctorService.js';
import type { GatewayUpstreamSyncService } from '../../../../services/GatewayUpstreamSyncService.js';
import type { SkillCatalogApiService } from '../../../../services/SkillCatalogApiService.js';
import type { SkillMcpSidecarService } from '../../../../services/SkillMcpSidecarService.js';
import type { SkillLibraryPresentationService } from '../../../../services/SkillLibraryPresentationService.js';
import type { SkillInstallPlanPresentationService } from '../../../../services/SkillInstallPlanPresentationService.js';
import type { UniversalSkillBridgeActivationService } from '../../../../services/UniversalSkillBridgeActivationService.js';
import type { AutomaticBrowserDoctorService } from '../../../../mcp/AutomaticBrowserDoctorService.js';
import type { McpRuntimeService } from '../../../../mcp/McpRuntimeService.js';
import type { ZavorthTeamCatalogService } from '../../../../services/ZavorthTeamCatalogService.js';
import type { ZavorthTenantGovernanceService } from '../../../../services/ZavorthTenantGovernanceService.js';
import type { ZavorthTenantGovernanceActionService } from '../../../../services/ZavorthTenantGovernanceActionService.js';
import type { CodexRemoteControlPlaneService } from '../../../../services/CodexRemoteControlPlaneService.js';
import type { CodexRemoteActionService } from '../../../../services/CodexRemoteActionService.js';
import type { ComputerUseWatchModePolicyFileService } from '../../../../services/ComputerUseWatchModePolicyFileService.js';
import type { ComputerUseWatchModeStateFileService } from '../../../../services/ComputerUseWatchModeStateFileService.js';
import type { ComputerUseWatchModeService } from '../../../../services/ComputerUseWatchModeService.js';
import type { ChannelSetupAssistantService } from '../../../../services/ChannelSetupAssistantService.js';
import type { SelfModificationCommandService } from '../../../../services/SelfModificationCommandService.js';
import type { SystemOverlordControlService } from '../../../../services/SystemSupervisorControlService.js';
import type { EngineeringCoreService } from '../../../../services/EngineeringCoreService.js';
import type { SharedSurfaceConsistencyService } from '../../../../services/SharedSurfaceConsistencyService.js';

type WebAppSharedSurfaceOperations = {
  channelActions: ZavorthChannelActionService | null;
  channelMesh: ZavorthChannelMeshService | null;
  securityMesh: ZavorthSecurityMeshService | null;
  integrationHub: IntegrationHubService | null;
  mcpCapabilityControlPlane: McpCapabilityControlPlaneService | null;
  mcpRuntime: Pick<McpRuntimeService, 'readSnapshot' | 'reloadServer' | 'stopServer'> | null;
  pluginRegistry: ZavorthPluginRegistryService | null;
  workspaceExtensions: WorkspaceExtensionRegistryService | null;
  nodeMesh: ZavorthNodeMeshService | null;
  pluginActions: ZavorthPluginActionService | null;
  platformActions: ZavorthPlatformActionService | null;
  platformRegistry: ZavorthPlatformRegistryService | null;
  platformCatalogSync: ZavorthPlatformCatalogSyncService | null;
  platformPublisher: ZavorthPackagePublisher | null;
  remoteTransportActions: ZavorthRemoteTransportActionService | null;
  remoteTransports: ZavorthRemoteTransportService | null;
  memoryPlane: ZavorthMemoryPlaneService | null;
  layeredMemory: ZavorthLayeredMemoryService | null;
  learningPlane: ZavorthLearningPlaneService | null;
  sessionPlane: ZavorthSessionPlaneService | null;
  hookPlane: ZavorthHookPlaneService | null;
  toolSurface: ZavorthToolSurfaceService | null;
  nodePairing: NodePairingService | null;
  nodeInvoke: NodeInvokeService | null;
  providerControlPlane: ProviderControlPlaneService | null;
  zavorthBridgeMobileAccess: ZavorthBridgeMobileAccessService | null;
  AIGatewayGateway: AIGatewayProxyService | null;
  AIGatewayGatewayLauncher: ZavorthGatewayLauncherService | null;
  AIGatewayCompatibilityDoctor: GatewayCompatibilityDoctorService | null;
  AIGatewayUpstreamSync: GatewayUpstreamSyncService | null;
  mcpBrowserDoctor: AutomaticBrowserDoctorService | null;
  teamCatalog: ZavorthTeamCatalogService | null;
  tenantGovernance: ZavorthTenantGovernanceService | null;
  tenantGovernanceActions: ZavorthTenantGovernanceActionService | null;
  codexRemote: CodexRemoteControlPlaneService | null;
  codexRemoteActions: CodexRemoteActionService | null;
};

type WebAppSharedSurfaceRuntimeServices = {
  sessionPlane: ZavorthSessionPlaneService | null;
  toolSurface: ZavorthToolSurfaceService | null;
};

export type WebAppSharedSurfaceFactorySource = {
  runtime: SharedSurfaceRuntime | null;
  operations: WebAppSharedSurfaceOperations;
  runtimeServices: WebAppSharedSurfaceRuntimeServices;
  channelSetupAssistant: ChannelSetupAssistantService;
  computerUseWatchModePolicy: ComputerUseWatchModePolicyFileService;
  computerUseWatchModeState: ComputerUseWatchModeStateFileService;
  computerUseWatchMode: ComputerUseWatchModeService;
  accessManifest: RuntimeAccessManifestService;
  installJourney: RuntimeInstallJourneyService;
  officialRemoteAccess: RuntimeOfficialRemoteAccessService;
  desktopResources: DesktopResourcePlaneService;
  companions: CompanionControlService;
  taskResourcePlanner: TaskResourcePlannerService;
  modeEscalation: ModeEscalationService;
  workspaceOptimizer: CompanionWorkspaceOptimizerService;
  surfaceConsistency: SharedSurfaceConsistencyService;
  skillCatalogApi: SkillCatalogApiService;
  skillMcpSidecar: SkillMcpSidecarService;
  skillLibraryPresentation: SkillLibraryPresentationService;
  skillInstallPlanPresentation: SkillInstallPlanPresentationService;
  skillBridgeActivation: UniversalSkillBridgeActivationService;
  selfModificationCommandService: SelfModificationCommandService;
  systemOverlordControl: SystemOverlordControlService;
  engineeringCore: EngineeringCoreService;
};

export class WebAppSharedSurfaceFactoryService {
  public build(source: WebAppSharedSurfaceFactorySource): SharedSurfaceCommandService {
    const runtime = source.runtime;
    if (!runtime) {
      throw new Error('Web runtime not yet connected to the main gateway.');
    }
    const hubControlPlane = this.buildHubControlPlane(source);
    const qaControlPlane = this.buildQaControlPlane();
    const governanceControlPlane = this.buildGovernanceControlPlane(source);
    const replayLearningControlPlane = this.buildReplayLearningControlPlane(source);
    const ecosystemControlPlane = this.buildEcosystemControlPlane(source);
    const distributedRuntimeControlPlane = this.buildDistributedRuntimeControlPlane(source);
    const runtimeStabilityControlPlane = this.buildRuntimeStabilityControlPlane(source);
    const rolloutReadinessControlPlane = this.buildRolloutReadinessControlPlane(source);
    const naturalSetupControlPlane = this.buildNaturalSetupControlPlane(source);
    const automationControlPlane = this.buildAutomationControlPlane();
    const watchModeControlPlane = this.buildWatchModeControlPlane(source);

    return new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: () => ({}) } as unknown as RuntimeDiagnosticsService,
      channelActionService: source.operations.channelActions || undefined,
      channelMeshService: source.operations.channelMesh || undefined,
      channelSetupAssistantService: source.channelSetupAssistant,
      naturalChannelSetupTurnService: this.buildNaturalChannelSetupTurn(source),
      trustPlaneService: this.buildTrustPlane(source),
      integrationHubService: source.operations.integrationHub || undefined,
      hubControlPlaneService: hubControlPlane,
      qaControlPlaneService: qaControlPlane,
      governanceControlPlaneService: governanceControlPlane,
      replayLearningControlPlaneService: replayLearningControlPlane,
      ecosystemControlPlaneService: ecosystemControlPlane,
      distributedRuntimeControlPlaneService: distributedRuntimeControlPlane,
      runtimeStabilityControlPlaneService: runtimeStabilityControlPlane,
      rolloutReadinessControlPlaneService: rolloutReadinessControlPlane,
      naturalSetupControlPlaneService: naturalSetupControlPlane,
      automationControlPlaneService: automationControlPlane,
      automationActionService: this.buildAutomationActionService(),
      watchModeControlPlaneService: watchModeControlPlane,
      watchModePolicyFileService: source.computerUseWatchModePolicy,
      hubActionService: this.buildHubActionService(source),
      pluginActionService: source.operations.pluginActions || undefined,
      pluginRegistryService: source.operations.pluginRegistry || undefined,
      platformActionService: source.operations.platformActions || undefined,
      platformRegistryService: source.operations.platformRegistry || undefined,
      platformCatalogSyncService: source.operations.platformCatalogSync || undefined,
      platformPublisherService: source.operations.platformPublisher || undefined,
      remoteTransportActionService: source.operations.remoteTransportActions || undefined,
      remoteTransportService: source.operations.remoteTransports || undefined,
      memoryPlaneService: source.operations.memoryPlane || undefined,
      layeredMemoryService: source.operations.layeredMemory || undefined,
      learningPlaneService: source.operations.learningPlane || undefined,
      sessionPlaneService: source.runtimeServices.sessionPlane || source.operations.sessionPlane || undefined,
      hookPlaneService: source.operations.hookPlane || undefined,
      toolSurfaceService: source.runtimeServices.toolSurface || source.operations.toolSurface || undefined,
      nodeMeshService: source.operations.nodeMesh || undefined,
      nodePairingService: source.operations.nodePairing || undefined,
      nodeInvokeService: source.operations.nodeInvoke || undefined,
      providerControlPlaneService: source.operations.providerControlPlane || undefined,
      zavorthBridgeMobileAccessService: source.operations.zavorthBridgeMobileAccess || undefined,
      runtimeAccessManifestService: source.accessManifest,
      runtimeInstallJourneyService: source.installJourney,
      runtimeOfficialRemoteAccessService: source.officialRemoteAccess,
      desktopResourcePlaneService: source.desktopResources,
      companionControlService: source.companions,
      taskResourcePlannerService: source.taskResourcePlanner,
      modeEscalationService: source.modeEscalation,
      workspaceOptimizerService: source.workspaceOptimizer,
      sharedSurfaceConsistencyService: source.surfaceConsistency,
      AIGatewayGatewayService: source.operations.AIGatewayGateway || undefined,
      AIGatewayGatewayLauncherService: source.operations.AIGatewayGatewayLauncher || undefined,
      GatewayCompatibilityDoctorService: source.operations.AIGatewayCompatibilityDoctor || undefined,
      GatewayUpstreamSyncService: source.operations.AIGatewayUpstreamSync || undefined,
      skillCatalogApiService: source.skillCatalogApi,
      skillMcpSidecarService: source.skillMcpSidecar,
      skillLibraryPresentationService: source.skillLibraryPresentation,
      skillInstallPlanPresentationService: source.skillInstallPlanPresentation,
      skillBridgeActivationService: source.skillBridgeActivation,
      mcpBrowserDoctorService: source.operations.mcpBrowserDoctor || undefined,
      teamCatalogService: source.operations.teamCatalog || undefined,
      tenantGovernanceService: source.operations.tenantGovernance || undefined,
      tenantGovernanceActionService: source.operations.tenantGovernanceActions || undefined,
      codexRemoteControlPlaneService: source.operations.codexRemote || undefined,
      codexRemoteActionService: source.operations.codexRemoteActions || undefined,
      permissionService: runtime.permissionService as unknown as PermissionService,
      selfModificationCommandService: source.selfModificationCommandService,
      surfaceTaskDispatcher: runtime.surfaceTaskDispatcher || null,
      taskManager: this.buildTaskManagerAdapter(runtime.taskManager as unknown as TaskManager),
      taskApprovalController: this.buildTaskApprovalController(source),
      workflowController: runtime.workflowController || null,
      engineeringCoreService: source.engineeringCore,
    });
  }

  public buildHubControlPlane(source: WebAppSharedSurfaceFactorySource): ZavorthHubControlPlaneService {
    return new ZavorthHubControlPlaneService({
      integrationHubService: source.operations.integrationHub || undefined,
      pluginRegistryService: source.operations.pluginRegistry || undefined,
      platformRegistryService: source.operations.platformRegistry || undefined,
      skillLibraryPresentationService: source.skillLibraryPresentation,
      skillInstallPlanPresentationService: source.skillInstallPlanPresentation,
      mcpCapabilityControlPlaneService: source.operations.mcpCapabilityControlPlane || undefined,
      mcpRuntimeService: source.operations.mcpRuntime || undefined,
    });
  }

  private buildTaskManagerAdapter(taskManager: TaskManager): NonNullable<SharedSurfaceCommandServiceDeps['taskManager']> {
    return {
      getRecentTasks: taskManager.getRecentTasks.bind(taskManager),
      getTask: taskManager.getTask.bind(taskManager),
      advanceState: (task, nextStatus, options) => {
        taskManager.advanceState(
          task as Parameters<TaskManager['advanceState']>[0],
          nextStatus as Parameters<TaskManager['advanceState']>[1],
          {
            ...options,
            actor: options?.actor ?? undefined,
          },
        );
      },
    };
  }

  public buildHubActionService(source: WebAppSharedSurfaceFactorySource): ZavorthHubActionService {
    return new ZavorthHubActionService({
      workspaceRoot: process.cwd(),
      hubControlPlaneService: this.buildHubControlPlane(source),
      integrationHubService: source.operations.integrationHub || undefined,
      pluginActionService: source.operations.pluginActions || undefined,
      platformActionService: source.operations.platformActions || undefined,
      platformCatalogSyncService: source.operations.platformCatalogSync || undefined,
      mcpBrowserDoctorService: source.operations.mcpBrowserDoctor || undefined,
    });
  }

  public buildQaControlPlane(): ZavorthQaControlPlaneService {
    return new ZavorthQaControlPlaneService();
  }

  public buildGovernanceControlPlane(source: WebAppSharedSurfaceFactorySource): ZavorthGovernanceControlPlaneService {
    return new ZavorthGovernanceControlPlaneService({
      workspaceRoot: process.cwd(),
      tenantGovernanceService: source.operations.tenantGovernance || undefined,
      trustPlaneService: this.buildTrustPlane(source),
      channelMeshService: source.operations.channelMesh || undefined,
      nodeMeshService: source.operations.nodeMesh || undefined,
      remoteTransportService: source.operations.remoteTransports || undefined,
      pluginRegistryService: source.operations.pluginRegistry || undefined,
      platformRegistryService: source.operations.platformRegistry || undefined,
      teamCatalogService: source.operations.teamCatalog || undefined,
    });
  }

  public buildReplayLearningControlPlane(source: WebAppSharedSurfaceFactorySource): ZavorthReplayLearningControlPlaneService {
    return new ZavorthReplayLearningControlPlaneService({
      workspaceRoot: process.cwd(),
      memoryPlaneService: source.operations.memoryPlane || undefined,
      layeredMemoryService: source.operations.layeredMemory || undefined,
      learningPlaneService: source.operations.learningPlane || undefined,
    });
  }

  public buildEcosystemControlPlane(source: WebAppSharedSurfaceFactorySource): ZavorthEcosystemControlPlaneService {
    return new ZavorthEcosystemControlPlaneService({
      workspaceRoot: process.cwd(),
      platformRegistryService: source.operations.platformRegistry || undefined,
    });
  }

  public buildDistributedRuntimeControlPlane(
    source: WebAppSharedSurfaceFactorySource,
  ): ZavorthDistributedRuntimeControlPlaneService {
    return new ZavorthDistributedRuntimeControlPlaneService({
      workspaceRoot: process.cwd(),
      channelMeshService: source.operations.channelMesh || undefined,
      nodeMeshService: source.operations.nodeMesh || undefined,
      remoteTransportService: source.operations.remoteTransports || undefined,
      runtimeAccessManifestService: source.accessManifest,
    });
  }

  public buildRuntimeStabilityControlPlane(
    source: WebAppSharedSurfaceFactorySource,
  ): ZavorthRuntimeStabilityControlPlaneService {
    return new ZavorthRuntimeStabilityControlPlaneService({
      workspaceRoot: process.cwd(),
      nodeMeshService: source.operations.nodeMesh || undefined,
      remoteTransportService: source.operations.remoteTransports || undefined,
    });
  }

  public buildRolloutReadinessControlPlane(
    source: WebAppSharedSurfaceFactorySource,
  ): ZavorthRolloutReadinessControlPlaneService {
    return new ZavorthRolloutReadinessControlPlaneService({
      workspaceRoot: process.cwd(),
      qaControlPlaneService: this.buildQaControlPlane(),
      distributedRuntimeControlPlaneService: this.buildDistributedRuntimeControlPlane(source),
    });
  }

  public buildNaturalSetupControlPlane(
    source: WebAppSharedSurfaceFactorySource,
  ): ZavorthNaturalSetupControlPlaneService {
    return new ZavorthNaturalSetupControlPlaneService({
      workspaceRoot: process.cwd(),
      channelSetupAssistantService: source.channelSetupAssistant,
      naturalChannelSetupTurnService: this.buildNaturalChannelSetupTurn(source),
      channelMeshService: source.operations.channelMesh || undefined,
    });
  }

  public buildAutomationControlPlane(): ZavorthAutomationControlPlaneService {
    return new ZavorthAutomationControlPlaneService({
      workspaceRoot: process.cwd(),
    });
  }

  public buildAutomationActionService(): ZavorthAutomationActionService {
    return new ZavorthAutomationActionService({
      controlPlaneService: this.buildAutomationControlPlane(),
    });
  }

  public buildWatchModeControlPlane(source: WebAppSharedSurfaceFactorySource): ZavorthWatchModeControlPlaneService {
    return new ZavorthWatchModeControlPlaneService({
      workspaceRoot: process.cwd(),
      watchModeService: source.computerUseWatchMode,
      policyFileService: source.computerUseWatchModePolicy,
      stateFileService: source.computerUseWatchModeState,
    });
  }

  private buildNaturalChannelSetupTurn(source: WebAppSharedSurfaceFactorySource): NaturalChannelSetupTurnService {
    return new NaturalChannelSetupTurnService({
      assistant: source.channelSetupAssistant,
      channelActions: source.operations.channelActions || undefined,
    });
  }

  private buildTrustPlane(source: WebAppSharedSurfaceFactorySource): ZavorthTrustPlaneService {
    return new ZavorthTrustPlaneService({
      securityMeshService: source.operations.securityMesh || undefined,
      systemOverlordControlService: source.systemOverlordControl,
      mcpToolPolicy: McpToolPolicy.fromEnv(),
      mcpCapabilityControlPlaneService: source.operations.mcpCapabilityControlPlane || undefined,
      skillTrustPolicyService: new SkillTrustPolicyService(),
      pluginRegistryService: source.operations.pluginRegistry || undefined,
      workspaceExtensionsService: source.operations.workspaceExtensions || undefined,
      nodeMeshService: source.operations.nodeMesh || undefined,
    });
  }

  private buildTaskApprovalController(source: WebAppSharedSurfaceFactorySource): {
    handleApproval: (ctx: SurfaceControllerContext, args: string) => Promise<void>;
    handleRejection: (ctx: SurfaceControllerContext, taskId: string) => Promise<void>;
  } | null {
    const permissionController = source.runtime?.permissionController as unknown as PermissionControllerLike;
    if (
      permissionController
      && typeof permissionController.handleApproval === 'function'
      && typeof permissionController.handleRejection === 'function'
    ) {
      return {
        handleApproval: permissionController.handleApproval.bind(permissionController) as (
          ctx: SurfaceControllerContext,
          args: string,
        ) => Promise<void>,
        handleRejection: permissionController.handleRejection.bind(permissionController) as (
          ctx: SurfaceControllerContext,
          taskId: string,
        ) => Promise<void>,
      };
    }
    return null;
  }
}

