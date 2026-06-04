import type { PermissionRequest } from "../../../../../contracts/PermissionRequest.js";
import type { Task } from "../../../../../contracts/TaskContract.js";
import type { SurfaceTaskDispatcherLike } from "../../../../../services/SurfaceRuntime.js";
import type { DesktopResourcePlaneService } from "../../../../../services/DesktopResourcePlaneService.js";
import type { CompanionControlService } from "../../../../../services/CompanionControlService.js";
import type { CompanionWorkspaceOptimizerService } from "../../../../../services/CompanionWorkspaceOptimizerService.js";
import type { ModeEscalationService } from "../../../../../services/ModeEscalationService.js";
import type { RuntimeDiagnosticsService } from "../../../../../services/RuntimeDiagnosticsService.js";
import type { SupervisedRuntimeService } from "../../../../../services/SupervisedRuntimeService.js";
import type { AutoRepairService } from "../../../../../services/AutoRepairService.js";
import type { ZavorthBridgePreferenceStore } from "../../../../../agents/ZavorthBridgePreferenceStore.js";
import type { ZavorthChannelActionService } from "../../../../../services/ZavorthChannelActionService.js";
import type { ZavorthChannelMeshService } from "../../../../../services/ZavorthChannelMeshService.js";
import type { ZavorthGatewayService } from "../../../../../services/ZavorthGatewayService.js";
import type { AIGatewayProxyService } from "../../../../../services/AIGatewayProxyService.js";
import type { ZavorthMemoryPlaneService } from "../../../../../services/ZavorthMemoryPlaneService.js";
import type { ZavorthLayeredMemoryService } from "../../../../../services/ZavorthLayeredMemoryService.js";
import type { ZavorthLearningPlaneService } from "../../../../../services/ZavorthLearningPlaneService.js";
import type { ZavorthSessionPlaneService } from "../../../../../services/ZavorthSessionPlaneService.js";
import type { ZavorthHookPlaneService } from "../../../../../services/ZavorthHookPlaneService.js";
import type { ZavorthPluginActionService } from "../../../../../services/ZavorthPluginActionService.js";
import type { ZavorthPluginRegistryService } from "../../../../../services/ZavorthPluginRegistryService.js";
import type { ZavorthPlatformRegistryService } from "../../../../../services/ZavorthPlatformRegistryService.js";
import type { ZavorthPlatformCatalogSyncService } from "../../../../../services/ZavorthPlatformCatalogSyncService.js";
import type { ZavorthPlatformActionService } from "../../../../../services/ZavorthPlatformActionService.js";
import type { ZavorthPackagePublisher } from "../../../../../platform/publish/ZavorthPackagePublisher.js";
import type { ZavorthRemoteTransportActionService } from "../../../../../services/ZavorthRemoteTransportActionService.js";
import type { ZavorthRemoteTransportService } from "../../../../../services/ZavorthRemoteTransportService.js";
import type { ZavorthSecurityMeshService } from "../../../../../services/ZavorthSecurityMeshService.js";
import type { ZavorthToolSurfaceService } from "../../../../../services/ZavorthToolSurfaceService.js";
import type { ZavorthTeamCatalogService } from "../../../../../services/ZavorthTeamCatalogService.js";
import type { ZavorthTenantGovernanceActionService } from "../../../../../services/ZavorthTenantGovernanceActionService.js";
import type { ZavorthTenantGovernanceService } from "../../../../../services/ZavorthTenantGovernanceService.js";
import type { IntegrationHubService } from "../../../../../services/IntegrationHubService.js";
import type { CommandParser } from "../../../../../telegram/CommandParser.js";
import type { DiscordSurfacePolicyService } from "../../../../../services/DiscordSurfacePolicyService.js";
import type { ZavorthNodeMeshService } from "../../../../../services/ZavorthNodeMeshService.js";
import type { NodeCapabilityService } from "../../../../../services/NodeCapabilityService.js";
import type { NodeDeviceProfileService } from "../../../../../services/NodeDeviceProfileService.js";
import type { NodeInvokeService } from "../../../../../services/NodeInvokeService.js";
import type { NodePairingService } from "../../../../../services/NodePairingService.js";
import type { ProviderControlPlaneService } from "../../../../../services/ProviderControlPlaneService.js";
import type { ProviderDoctorService } from "../../../../../services/ProviderDoctorService.js";
import type { CodexRemoteControlPlaneService } from "../../../../../services/CodexRemoteControlPlaneService.js";
import type { CodexRemoteActionService } from "../../../../../services/CodexRemoteActionService.js";
import type { CodexRemoteReadModelService } from "../../../../../services/CodexRemoteReadModelService.js";
import type { ZavorthBridgeMobileAccessService } from "../../../../../services/ZavorthBridgeMobileAccessService.js";
import type { RuntimeAccessManifestService } from "../../../../../runtime/access/RuntimeAccessManifestService.js";
import type { RuntimeBootstrapService } from "../../../../../runtime/access/RuntimeBootstrapService.js";
import type { RuntimeInstallJourneyService } from "../../../../../runtime/access/RuntimeInstallJourneyService.js";
import type { RuntimeOfficialRemoteAccessService } from "../../../../../runtime/access/RuntimeOfficialRemoteAccessService.js";
import type { GatewayCompatibilityDoctorService } from "../../../../../services/GatewayCompatibilityDoctorService.js";
import type { GatewayUpstreamSyncService } from "../../../../../services/GatewayUpstreamSyncService.js";
import type { ZavorthGatewayLauncherService } from "../../../../../services/ZavorthGatewayLauncherService.js";
import type { SharedSurfaceConsistencyService } from "../../../../../services/SharedSurfaceConsistencyService.js";
import type { SkillCatalogApiService } from "../../../../../services/SkillCatalogApiService.js";
import type { SkillMcpSidecarService } from "../../../../../services/SkillMcpSidecarService.js";
import type { SkillLibraryPresentationService } from "../../../../../services/SkillLibraryPresentationService.js";
import type { SkillInstallPlanPresentationService } from "../../../../../services/SkillInstallPlanPresentationService.js";
import type { UniversalSkillBridgeActivationService } from "../../../../../services/UniversalSkillBridgeActivationService.js";
import type { ZavorthNaturalInvocationRouter } from "../../../../../services/ZavorthNaturalInvocationRouter.js";
import type { ZavorthSubagentInvocationGatewayService } from "../../../../../services/ZavorthSubagentInvocationGatewayService.js";
import type { PermissionService } from "../../../../../services/PermissionService.js";
import type { SelfModificationCommandService } from "../../../../../services/SelfModificationCommandService.js";
import type { EngineeringCoreService } from "../../../../../services/EngineeringCoreService.js";
import type { ChannelInstallScaffoldService } from "../../../../../services/ChannelInstallScaffoldService.js";
import type { ChannelSetupAssistantService } from "../../../../../services/ChannelSetupAssistantService.js";
import type { NaturalChannelSetupTurnService } from "../../../../../services/NaturalChannelSetupTurnService.js";
import type { ZavorthGovernanceControlPlaneService } from "../../../../../services/ZavorthGovernanceControlPlaneService.js";
import type { ZavorthHubActionService } from "../../../../../services/ZavorthHubActionService.js";
import type { ZavorthHubControlPlaneService } from "../../../../../services/ZavorthHubControlPlaneService.js";
import type { ZavorthQaControlPlaneService } from "../../../../../services/ZavorthQaControlPlaneService.js";
import type { ZavorthReplayLearningControlPlaneService } from "../../../../../services/ZavorthReplayLearningControlPlaneService.js";
import type { ZavorthEcosystemControlPlaneService } from "../../../../../services/ZavorthEcosystemControlPlaneService.js";
import type { ZavorthDistributedRuntimeControlPlaneService } from "../../../../../services/ZavorthDistributedRuntimeControlPlaneService.js";
import type { ZavorthRuntimeStabilityControlPlaneService } from "../../../../../services/ZavorthRuntimeStabilityControlPlaneService.js";
import type { ZavorthRolloutReadinessControlPlaneService } from "../../../../../services/ZavorthRolloutReadinessControlPlaneService.js";
import type { ZavorthNaturalSetupControlPlaneService } from "../../../../../services/ZavorthNaturalSetupControlPlaneService.js";
import type { ZavorthAutomationControlPlaneService } from "../../../../../services/ZavorthAutomationControlPlaneService.js";
import type { ZavorthAutomationActionService } from "../../../../../services/ZavorthAutomationActionService.js";
import type { ZavorthEvalControlPlaneService } from "../../../../../services/ZavorthEvalControlPlaneService.js";
import type { ZavorthWatchModeControlPlaneService } from "../../../../../services/ZavorthWatchModeControlPlaneService.js";
import type { ZavorthTrustPlaneService } from "../../../../../services/ZavorthTrustPlaneService.js";
import type { ZavorthTrustPlaneActionService } from "../../../../../services/ZavorthTrustPlaneActionService.js";
import type { AutomaticBrowserDoctorService } from "../../../../../mcp/AutomaticBrowserDoctorService.js";
import type { ComputerUseWatchModePolicyFileService } from "../../../../../services/ComputerUseWatchModePolicyFileService.js";
import type { CapabilityLifecycleService } from "../../../../../services/CapabilityLifecycleService.js";
import type { TaskResourcePlannerService } from "../../../../../services/TaskResourcePlannerService.js";

export type SharedSurfaceCommandServiceDeps = {
  runtimeDiagnostics: RuntimeDiagnosticsService;
  supervisedRuntimeService?: SupervisedRuntimeService;
  autoRepairService?: AutoRepairService;
  zavorthBridgePreferenceStore?: ZavorthBridgePreferenceStore;
  integrationHubService?: IntegrationHubService;
  gatewayService?: ZavorthGatewayService;
  channelActionService?: ZavorthChannelActionService;
  channelMeshService?: ZavorthChannelMeshService;
  securityMeshService?: ZavorthSecurityMeshService;
  pluginActionService?: ZavorthPluginActionService;
  pluginRegistryService?: ZavorthPluginRegistryService;
  platformActionService?: ZavorthPlatformActionService;
  platformRegistryService?: ZavorthPlatformRegistryService;
  platformCatalogSyncService?: ZavorthPlatformCatalogSyncService;
  platformPublisherService?: ZavorthPackagePublisher;
  remoteTransportActionService?: ZavorthRemoteTransportActionService;
  remoteTransportService?: ZavorthRemoteTransportService;
  memoryPlaneService?: ZavorthMemoryPlaneService;
  layeredMemoryService?: ZavorthLayeredMemoryService;
  learningPlaneService?: ZavorthLearningPlaneService;
  sessionPlaneService?: ZavorthSessionPlaneService;
  hookPlaneService?: ZavorthHookPlaneService;
  toolSurfaceService?: ZavorthToolSurfaceService;
  nodeMeshService?: ZavorthNodeMeshService;
  nodePairingService?: NodePairingService;
  nodeInvokeService?: NodeInvokeService;
  nodeCapabilityService?: NodeCapabilityService;
  nodeDeviceProfileService?: NodeDeviceProfileService;
  parser?: CommandParser;
  discordSurfacePolicyService?: DiscordSurfacePolicyService;
  providerControlPlaneService?: ProviderControlPlaneService;
  providerDoctorService?: ProviderDoctorService;
  zavorthBridgeMobileAccessService?: ZavorthBridgeMobileAccessService;
  runtimeAccessManifestService?: RuntimeAccessManifestService;
  runtimeBootstrapService?: RuntimeBootstrapService;
  runtimeInstallJourneyService?: RuntimeInstallJourneyService;
  runtimeOfficialRemoteAccessService?: RuntimeOfficialRemoteAccessService;
  capabilityLifecycleService?: Pick<
    CapabilityLifecycleService,
    | "buildSnapshot"
    | "buildProductModeSnapshot"
    | "getManifest"
    | "buildApprovalRequest"
    | "registerCapabilityDemand"
    | "enableCapability"
    | "disableCapability"
    | "markCapabilityState"
    | "registerCapabilityUsage"
    | "setProductMode"
  > | null;
  desktopResourcePlaneService?: Pick<
    DesktopResourcePlaneService,
    "inspectLive" | "readLatest" | "renderReport"
  > | null;
  companionControlService?: Pick<
    CompanionControlService,
    | "buildSnapshot"
    | "inspectCompanion"
    | "executeAction"
    | "renderSnapshot"
    | "renderCompanion"
    | "renderActionResult"
  > | null;
  workspaceOptimizerService?: Pick<
    CompanionWorkspaceOptimizerService,
    | "buildLoadProfile"
    | "previewOptimization"
    | "applyOptimization"
    | "renderLoadProfile"
    | "renderPreview"
    | "renderApplyResult"
  > | null;
  taskResourcePlannerService?: Pick<
    TaskResourcePlannerService,
    "planCapabilityEnable" | "renderImpactSummary" | "toMutationResourceImpact"
  > | null;
  modeEscalationService?: Pick<
    ModeEscalationService,
    "buildSnapshot" | "resolveRequest"
  > | null;
  sharedSurfaceConsistencyService?: SharedSurfaceConsistencyService;
  AIGatewayGatewayService?: AIGatewayProxyService;
  AIGatewayGatewayLauncherService?: ZavorthGatewayLauncherService;
  GatewayCompatibilityDoctorService?: GatewayCompatibilityDoctorService;
  GatewayUpstreamSyncService?: GatewayUpstreamSyncService;
  skillCatalogApiService?: SkillCatalogApiService;
  skillMcpSidecarService?: SkillMcpSidecarService;
  skillLibraryPresentationService?: SkillLibraryPresentationService;
  skillInstallPlanPresentationService?: SkillInstallPlanPresentationService;
  skillBridgeActivationService?: UniversalSkillBridgeActivationService;
  naturalInvocationRouterService?: Pick<ZavorthNaturalInvocationRouter, 'plan' | 'renderPlan'> | null;
  subagentInvocationGatewayService?: Pick<ZavorthSubagentInvocationGatewayService, 'invoke' | 'executeCommand' | 'renderReport'> | null;
  teamCatalogService?: ZavorthTeamCatalogService;
  tenantGovernanceService?: ZavorthTenantGovernanceService;
  tenantGovernanceActionService?: ZavorthTenantGovernanceActionService;
  codexRemoteControlPlaneService?: CodexRemoteControlPlaneService;
  codexRemoteActionService?: CodexRemoteActionService;
  codexRemoteReadModelService?: CodexRemoteReadModelService;
  permissionService?: PermissionService | null;
  selfModificationCommandService?: SelfModificationCommandService | null;
  taskApprovalController?: {
    handleApproval: (ctx: any, args: string) => Promise<void>;
    handleRejection: (ctx: any, taskId: string) => Promise<void>;
  } | null;
  taskExecutionController?: {
    handleUndo: (ctx: any, taskId: string) => Promise<void>;
    resumeTaskExecution: (ctx: any, task: Task) => Promise<void>;
  } | null;
  surfaceTaskDispatcher?: SurfaceTaskDispatcherLike | null;
  taskManager?: {
    getRecentTasks?: (limit?: number, userId?: string) => Task[];
    getTask?: (taskId: string) => Task | undefined;
    advanceState?: (
      task: Task,
      nextStatus: Task["status"],
      options?: Record<string, any>,
    ) => void;
  } | null;
  formatPermissionCreatedMessage?:
    | ((permission: PermissionRequest) => string)
    | null;
  buildPermissionKeyboard?: ((permission: PermissionRequest) => any) | null;
  workflowController?: {
    handleWorkflow: (ctx: any, args: string) => Promise<void>;
  } | null;
  engineeringCoreService?: EngineeringCoreService | null;
  channelInstallService?: Pick<
    ChannelInstallScaffoldService,
    "buildPlanForChannel" | "applyScaffold"
  > | null;
  channelSetupAssistantService?: Pick<
    ChannelSetupAssistantService,
    "buildSession" | "apply"
  > | null;
  naturalChannelSetupTurnService?: Pick<
    NaturalChannelSetupTurnService,
    "buildTurn"
  > | null;
  hubControlPlaneService?: Pick<
    ZavorthHubControlPlaneService,
    "buildSnapshot" | "renderReport"
  > | null;
  hubActionService?: Pick<ZavorthHubActionService, "execute"> | null;
  evalControlPlaneService?: Pick<
    ZavorthEvalControlPlaneService,
    "buildSnapshot"
  > | null;
  qaControlPlaneService?: Pick<
    ZavorthQaControlPlaneService,
    "buildSnapshot" | "renderReport"
  > | null;
  governanceControlPlaneService?: Pick<
    ZavorthGovernanceControlPlaneService,
    "buildSnapshot" | "renderReport"
  > | null;
  replayLearningControlPlaneService?: Pick<
    ZavorthReplayLearningControlPlaneService,
    "buildSnapshot" | "renderReport"
  > | null;
  ecosystemControlPlaneService?: Pick<
    ZavorthEcosystemControlPlaneService,
    "buildSnapshot" | "renderReport"
  > | null;
  distributedRuntimeControlPlaneService?: Pick<
    ZavorthDistributedRuntimeControlPlaneService,
    "buildSnapshot" | "renderReport"
  > | null;
  runtimeStabilityControlPlaneService?: Pick<
    ZavorthRuntimeStabilityControlPlaneService,
    "buildSnapshot" | "renderReport"
  > | null;
  rolloutReadinessControlPlaneService?: Pick<
    ZavorthRolloutReadinessControlPlaneService,
    "buildSnapshot" | "renderReport"
  > | null;
  naturalSetupControlPlaneService?: Pick<
    ZavorthNaturalSetupControlPlaneService,
    "buildSnapshot" | "renderReport"
  > | null;
  automationControlPlaneService?: Pick<
    ZavorthAutomationControlPlaneService,
    "buildSnapshot" | "renderReport"
  > | null;
  automationActionService?: Pick<
    ZavorthAutomationActionService,
    "execute" | "apply"
  > | null;
  watchModeControlPlaneService?: Pick<
    ZavorthWatchModeControlPlaneService,
    "buildSnapshot" | "renderReport"
  > | null;
  watchModePolicyFileService?: Pick<
    ComputerUseWatchModePolicyFileService,
    "setStrictApprovalDefault" | "allowApp" | "allowSite"
  > | null;
  trustPlaneService?: Pick<
    ZavorthTrustPlaneService,
    "buildSnapshot" | "renderReport"
  > | null;
  trustPlaneActionService?: Pick<
    ZavorthTrustPlaneActionService,
    "execute" | "apply" | "rollback"
  > | null;
  mcpBrowserDoctorService?: Pick<AutomaticBrowserDoctorService, "run"> | null;
};

export type SharedSurfaceTaskVariationHelpers = {
  normalizeNaturalText?: (value: string | null | undefined) => string;
  extractNaturalChannelId?: (normalized: string) => string | null;
  formatNaturalChannelLabel?: (channelId: string) => string;
};

