import { config } from "../../../../../config/index.js";
import { RuntimeDiagnosticsService } from "../../../../../services/RuntimeDiagnosticsService.js";
import { SupervisedRuntimeService } from "../../../../../services/SupervisedRuntimeService.js";
import { AutoRepairService } from "../../../../../services/AutoRepairService.js";
import { ZavorthBridgePreferenceStore } from "../../../../../agents/ZavorthBridgePreferenceStore.js";
import { ZavorthChannelActionService } from "../../../../../services/ZavorthChannelActionService.js";
import { ZavorthChannelMeshService } from "../../../../../services/ZavorthChannelMeshService.js";
import { ZavorthGatewayService } from "../../../../../services/ZavorthGatewayService.js";
import { AIGatewayProxyService } from "../../../../../services/AIGatewayProxyService.js";
import { ZavorthMemoryPlaneService } from "../../../../../services/ZavorthMemoryPlaneService.js";
import { ZavorthLayeredMemoryService } from "../../../../../services/ZavorthLayeredMemoryService.js";
import { ZavorthLearningPlaneService } from "../../../../../services/ZavorthLearningPlaneService.js";
import { ZavorthSessionPlaneService } from "../../../../../services/ZavorthSessionPlaneService.js";
import { ZavorthSessionToolsService } from "../../../../../runtime/sessions/ZavorthSessionToolsService.js";
import { ZavorthHookPlaneService } from "../../../../../services/ZavorthHookPlaneService.js";
import { ZavorthPluginActionService } from "../../../../../services/ZavorthPluginActionService.js";
import { ZavorthPluginRegistryService } from "../../../../../services/ZavorthPluginRegistryService.js";
import { ZavorthPlatformRegistryService } from "../../../../../services/ZavorthPlatformRegistryService.js";
import { ZavorthPlatformCatalogSyncService } from "../../../../../services/ZavorthPlatformCatalogSyncService.js";
import { ZavorthPlatformActionService } from "../../../../../services/ZavorthPlatformActionService.js";
import { ZavorthPackagePublisher } from "../../../../../platform/publish/ZavorthPackagePublisher.js";
import { ZavorthRemoteTransportActionService } from "../../../../../services/ZavorthRemoteTransportActionService.js";
import { ZavorthRemoteTransportService } from "../../../../../services/ZavorthRemoteTransportService.js";
import { ZavorthSecurityMeshService } from "../../../../../services/ZavorthSecurityMeshService.js";
import { ZavorthToolSurfaceService } from "../../../../../services/ZavorthToolSurfaceService.js";
import { ZavorthTeamCatalogService } from "../../../../../services/ZavorthTeamCatalogService.js";
import { ZavorthTenantGovernanceActionService } from "../../../../../services/ZavorthTenantGovernanceActionService.js";
import { ZavorthTenantGovernanceService } from "../../../../../services/ZavorthTenantGovernanceService.js";
import { IntegrationHubService } from "../../../../../services/IntegrationHubService.js";
import { CommandParser } from "../../../../../telegram/CommandParser.js";
import { DiscordSurfacePolicyService } from "../../../../../services/DiscordSurfacePolicyService.js";
import { ZavorthNodeMeshService } from "../../../../../services/ZavorthNodeMeshService.js";
import { NodeCapabilityService } from "../../../../../services/NodeCapabilityService.js";
import { NodeDeviceProfileService } from "../../../../../services/NodeDeviceProfileService.js";
import { NodeInvokeService } from "../../../../../services/NodeInvokeService.js";
import { NodePairingService } from "../../../../../services/NodePairingService.js";
import { NodeRegistryService } from "../../../../../services/NodeRegistryService.js";
import { ProviderControlPlaneService } from "../../../../../services/ProviderControlPlaneService.js";
import { ProviderDoctorService } from "../../../../../services/ProviderDoctorService.js";
import { CodexRemoteControlPlaneService } from "../../../../../services/CodexRemoteControlPlaneService.js";
import { CodexRemoteActionService } from "../../../../../services/CodexRemoteActionService.js";
import { CodexRemoteReadModelService } from "../../../../../services/CodexRemoteReadModelService.js";
import { ZavorthBridgeMobileAccessService } from "../../../../../services/ZavorthBridgeMobileAccessService.js";
import { RuntimeAccessManifestService } from "../../../../../runtime/access/RuntimeAccessManifestService.js";
import { RuntimeBootstrapService } from "../../../../../runtime/access/RuntimeBootstrapService.js";
import { RuntimeInstallJourneyService } from "../../../../../runtime/access/RuntimeInstallJourneyService.js";
import { RuntimeOfficialRemoteAccessService } from "../../../../../runtime/access/RuntimeOfficialRemoteAccessService.js";
import { GatewayCompatibilityDoctorService } from "../../../../../services/GatewayCompatibilityDoctorService.js";
import { GatewayUpstreamSyncService } from "../../../../../services/GatewayUpstreamSyncService.js";
import { ZavorthGatewayLauncherService } from "../../../../../services/ZavorthGatewayLauncherService.js";
import { SharedSurfaceConsistencyService } from "../../../../../services/SharedSurfaceConsistencyService.js";
import { SkillCatalogApiService } from "../../../../../services/SkillCatalogApiService.js";
import { SkillMcpSidecarService } from "../../../../../services/SkillMcpSidecarService.js";
import { SkillLibraryPresentationService } from "../../../../../services/SkillLibraryPresentationService.js";
import { SkillInstallPlanPresentationService } from "../../../../../services/SkillInstallPlanPresentationService.js";
import { UniversalSkillBridgeActivationService } from "../../../../../services/UniversalSkillBridgeActivationService.js";
import { ZavorthNaturalInvocationRouter } from "../../../../../services/ZavorthNaturalInvocationRouter.js";
import { ZavorthSubagentInvocationGatewayService } from "../../../../../services/ZavorthSubagentInvocationGatewayService.js";
import type { PermissionRequest } from "../../../../../contracts/PermissionRequest.js";
import type { Task } from "../../../../../contracts/TaskContract.js";
import type { SurfaceTaskDispatcherLike } from "../../../../../services/SurfaceRuntime.js";
import { PermissionService } from "../../../../../services/PermissionService.js";
import { SelfModificationCommandService } from "../../../../../services/SelfModificationCommandService.js";
import { EngineeringCoreService } from "../../../../../services/EngineeringCoreService.js";
import { SupervisedExecutionGatewayService } from "../../../../../services/SupervisedExecutionGatewayService.js";
import { ChannelInstallScaffoldService } from "../../../../../services/ChannelInstallScaffoldService.js";
import { ChannelSetupAssistantService } from "../../../../../services/ChannelSetupAssistantService.js";
import { NaturalChannelSetupTurnService } from "../../../../../services/NaturalChannelSetupTurnService.js";
import { ZavorthGovernanceControlPlaneService } from "../../../../../services/ZavorthGovernanceControlPlaneService.js";
import { ZavorthHubActionService } from "../../../../../services/ZavorthHubActionService.js";
import { ZavorthHubControlPlaneService } from "../../../../../services/ZavorthHubControlPlaneService.js";
import { ZavorthQaControlPlaneService } from "../../../../../services/ZavorthQaControlPlaneService.js";
import { ZavorthReplayLearningControlPlaneService } from "../../../../../services/ZavorthReplayLearningControlPlaneService.js";
import { ZavorthEcosystemControlPlaneService } from "../../../../../services/ZavorthEcosystemControlPlaneService.js";
import { ZavorthDistributedRuntimeControlPlaneService } from "../../../../../services/ZavorthDistributedRuntimeControlPlaneService.js";
import { ZavorthRuntimeStabilityControlPlaneService } from "../../../../../services/ZavorthRuntimeStabilityControlPlaneService.js";
import { ZavorthRolloutReadinessControlPlaneService } from "../../../../../services/ZavorthRolloutReadinessControlPlaneService.js";
import { ZavorthNaturalSetupControlPlaneService } from "../../../../../services/ZavorthNaturalSetupControlPlaneService.js";
import { ZavorthAutomationControlPlaneService } from "../../../../../services/ZavorthAutomationControlPlaneService.js";
import { ZavorthAutomationActionService } from "../../../../../services/ZavorthAutomationActionService.js";
import { ZavorthEvalControlPlaneService } from "../../../../../services/ZavorthEvalControlPlaneService.js";
import { ZavorthEvalHistoryFileService } from "../../../../../services/ZavorthEvalHistoryFileService.js";
import { ZavorthTelemetryLedgerService } from "../../../../../services/ZavorthTelemetryLedgerService.js";
import { ZavorthWatchModeControlPlaneService } from "../../../../../services/ZavorthWatchModeControlPlaneService.js";
import { ZavorthTrustPlaneService } from "../../../../../services/ZavorthTrustPlaneService.js";
import { ZavorthTrustPlaneActionService } from "../../../../../services/ZavorthTrustPlaneActionService.js";
import { AutomaticBrowserDoctorService } from "../../../../../mcp/AutomaticBrowserDoctorService.js";
import { McpToolPolicy } from "../../../../../mcp/McpToolPolicy.js";
import { SkillTrustPolicyService } from "../../../../../services/SkillTrustPolicyService.js";
import { McpToolPolicyFileService } from "../../../../../services/McpToolPolicyFileService.js";
import { ComputerUseWatchModePolicyFileService } from "../../../../../services/ComputerUseWatchModePolicyFileService.js";
import { ProductObservabilityService } from "../../../../../services/ProductObservabilityService.js";
import { CapabilityLifecycleService } from "../../../../../services/CapabilityLifecycleService.js";
import type { DesktopResourcePlaneService } from "../../../../../services/DesktopResourcePlaneService.js";
import type { CompanionControlService } from "../../../../../services/CompanionControlService.js";
import { TaskResourcePlannerService } from "../../../../../services/TaskResourcePlannerService.js";
import type { CompanionWorkspaceOptimizerService } from "../../../../../services/CompanionWorkspaceOptimizerService.js";
import type { ModeEscalationService } from "../../../../../services/ModeEscalationService.js";
import { buildSharedSurfaceCommandServiceAssembly } from "./SharedSurfaceCommandServiceAssembly.js";
import type {
  SharedSurfaceCommandServiceDeps,
  SharedSurfaceTaskVariationHelpers,
} from "./SharedSurfaceCommandServiceDeps.js";

export type {
  SharedSurfaceCommandServiceDeps,
  SharedSurfaceTaskVariationHelpers,
};

export function buildSharedSurfaceCommandServiceComposition(
  deps: SharedSurfaceCommandServiceDeps,
  helpers: SharedSurfaceTaskVariationHelpers = {},
) {
  const parser = deps.parser || new CommandParser();
  const supervisedRuntimeService =
    deps.supervisedRuntimeService || new SupervisedRuntimeService();
  const autoRepairService = deps.autoRepairService || new AutoRepairService();
  const zavorthBridgePreferenceStore =
    deps.zavorthBridgePreferenceStore || new ZavorthBridgePreferenceStore();
  const integrationHubService =
    deps.integrationHubService || new IntegrationHubService();
  const gatewayService = deps.gatewayService || new ZavorthGatewayService();
  const channelMeshService =
    deps.channelMeshService || new ZavorthChannelMeshService();
  const channelActionService =
    deps.channelActionService ||
    new ZavorthChannelActionService({
      channelMeshService,
    });
  const securityMeshService =
    deps.securityMeshService || new ZavorthSecurityMeshService();
  const pluginActionService =
    deps.pluginActionService ||
    new ZavorthPluginActionService({
      integrationHubService,
    });
  const pluginRegistryService =
    deps.pluginRegistryService ||
    new ZavorthPluginRegistryService({
      integrationHubService,
    });
  const learningPlaneService =
    deps.learningPlaneService || new ZavorthLearningPlaneService();
  const platformCatalogSyncService =
    deps.platformCatalogSyncService || new ZavorthPlatformCatalogSyncService();
  const platformRegistryService =
    deps.platformRegistryService ||
    new ZavorthPlatformRegistryService({
      pluginRegistryService,
      learningPlaneService,
    });
  const platformActionService =
    deps.platformActionService ||
    new ZavorthPlatformActionService({
      platformRegistryService,
      pluginActionService,
      learningPlaneService,
    });
  const platformPublisherService =
    deps.platformPublisherService || new ZavorthPackagePublisher();
  const remoteTransportActionService =
    deps.remoteTransportActionService ||
    new ZavorthRemoteTransportActionService({
      remoteTransportService: deps.remoteTransportService,
    });
  const remoteTransportService =
    deps.remoteTransportService || new ZavorthRemoteTransportService();
  const memoryPlaneService = deps.memoryPlaneService || null;
  const layeredMemoryService =
    deps.layeredMemoryService ||
    new ZavorthLayeredMemoryService({
      memoryPlaneService: memoryPlaneService || undefined,
      learningPlaneService,
    });
  const sessionPlaneService = deps.sessionPlaneService || null;
  const hookPlaneService =
    deps.hookPlaneService || new ZavorthHookPlaneService();
  const toolSurfaceService =
    deps.toolSurfaceService ||
    new ZavorthToolSurfaceService({
      integrationHubService,
      sessionToolsService: new ZavorthSessionToolsService(),
      pluginRegistryService,
    });
  const nodeRegistry = new NodeRegistryService();
  const nodeCapabilities =
    deps.nodeCapabilityService || new NodeCapabilityService();
  const nodeDeviceProfiles =
    deps.nodeDeviceProfileService || new NodeDeviceProfileService();
  const nodePairingService =
    deps.nodePairingService ||
    new NodePairingService({
      registryService: nodeRegistry,
      capabilityService: nodeCapabilities,
      deviceProfileService: nodeDeviceProfiles,
    });
  const nodeInvokeService =
    deps.nodeInvokeService ||
    new NodeInvokeService({
      registryService: nodeRegistry,
      capabilityService: nodeCapabilities,
    });
  const nodeMeshService =
    deps.nodeMeshService ||
    new ZavorthNodeMeshService({
      registryService: nodeRegistry,
      capabilityService: nodeCapabilities,
      invokeService: nodeInvokeService,
      deviceProfileService: nodeDeviceProfiles,
    });
  const skillTrustPolicyService = new SkillTrustPolicyService();
  const trustPlaneService =
    deps.trustPlaneService ||
    new ZavorthTrustPlaneService({
      securityMeshService,
      mcpToolPolicy: McpToolPolicy.fromEnv(),
      skillTrustPolicyService,
      pluginRegistryService,
      nodeMeshService,
    });
  const trustPlaneActionService =
    deps.trustPlaneActionService ||
    new ZavorthTrustPlaneActionService({
      trustPlaneService,
      mcpToolPolicyFileService: new McpToolPolicyFileService(),
      skillTrustPolicyService,
    });
  const discordSurfacePolicyService =
    deps.discordSurfacePolicyService || new DiscordSurfacePolicyService();
  const providerControlPlaneService =
    deps.providerControlPlaneService || new ProviderControlPlaneService();
  const providerDoctorService =
    deps.providerDoctorService ||
    new ProviderDoctorService({
      providerControlPlane: providerControlPlaneService,
    });
  const codexRemoteControlPlaneService =
    deps.codexRemoteControlPlaneService || new CodexRemoteControlPlaneService();
  const codexRemoteActionService =
    deps.codexRemoteActionService ||
    new CodexRemoteActionService({
      controlPlaneService: codexRemoteControlPlaneService,
    });
  const codexRemoteReadModelService =
    deps.codexRemoteReadModelService || new CodexRemoteReadModelService();
  const permissionService = deps.permissionService || null;
  const selfModificationCommandService =
    deps.selfModificationCommandService || null;
  const taskApprovalController = deps.taskApprovalController || null;
  const taskExecutionController = deps.taskExecutionController || null;
  const surfaceTaskDispatcher = deps.surfaceTaskDispatcher || null;
  const taskManager = deps.taskManager || null;
  const workflowController = deps.workflowController || null;
  const engineeringCoreService =
    deps.engineeringCoreService ||
    new EngineeringCoreService({
      selfModificationCommandService:
        selfModificationCommandService || undefined,
      executionGatewayService: new SupervisedExecutionGatewayService(),
    });
  const channelInstallService =
    deps.channelInstallService || new ChannelInstallScaffoldService();
  const channelSetupAssistantService =
    deps.channelSetupAssistantService ||
    (typeof (channelInstallService as any)?.buildReport === "function"
      ? new ChannelSetupAssistantService({
          installService: channelInstallService as any,
          channelMeshService,
        })
      : null);
  const naturalChannelSetupTurnService =
    deps.naturalChannelSetupTurnService ||
    (channelSetupAssistantService
      ? new NaturalChannelSetupTurnService({
          assistant: channelSetupAssistantService as any,
          channelActions: channelActionService,
        })
      : null);
  const hubControlPlaneService =
    deps.hubControlPlaneService ||
    new ZavorthHubControlPlaneService({
      integrationHubService,
      pluginRegistryService,
      platformRegistryService,
      skillLibraryPresentationService:
        deps.skillLibraryPresentationService || undefined,
      skillInstallPlanPresentationService:
        deps.skillInstallPlanPresentationService || undefined,
    });
  const hubActionService =
    deps.hubActionService ||
    new ZavorthHubActionService({
      hubControlPlaneService,
      integrationHubService,
      pluginActionService,
      platformActionService,
      platformCatalogSyncService,
      mcpBrowserDoctorService: deps.mcpBrowserDoctorService || undefined,
    });
  const evalControlPlaneService =
    deps.evalControlPlaneService ||
    new ZavorthEvalControlPlaneService({
      productObservabilityService: new ProductObservabilityService(
        (taskManager && typeof taskManager.getRecentTasks === "function"
          ? taskManager
          : undefined) as any,
        permissionService || undefined,
      ),
      telemetryLedgerService: new ZavorthTelemetryLedgerService(),
      evalHistoryService: new ZavorthEvalHistoryFileService(),
    });
  const qaControlPlaneService =
    deps.qaControlPlaneService || new ZavorthQaControlPlaneService();
  const replayLearningControlPlaneService =
    deps.replayLearningControlPlaneService ||
    new ZavorthReplayLearningControlPlaneService({
      memoryPlaneService: memoryPlaneService || undefined,
      layeredMemoryService,
      learningPlaneService,
    });
  const ecosystemControlPlaneService =
    deps.ecosystemControlPlaneService ||
    new ZavorthEcosystemControlPlaneService({
      platformRegistryService,
    });
  const distributedRuntimeControlPlaneService =
    deps.distributedRuntimeControlPlaneService ||
    new ZavorthDistributedRuntimeControlPlaneService({
      channelMeshService,
      nodeMeshService,
      remoteTransportService,
    });
  const runtimeStabilityControlPlaneService =
    deps.runtimeStabilityControlPlaneService ||
    new ZavorthRuntimeStabilityControlPlaneService({
      nodeMeshService,
      remoteTransportService,
    });
  const rolloutReadinessControlPlaneService =
    deps.rolloutReadinessControlPlaneService ||
    new ZavorthRolloutReadinessControlPlaneService({
      qaControlPlaneService,
      distributedRuntimeControlPlaneService,
    });
  const naturalSetupControlPlaneService =
    deps.naturalSetupControlPlaneService ||
    new ZavorthNaturalSetupControlPlaneService({
      channelSetupAssistantService: channelSetupAssistantService || undefined,
      naturalChannelSetupTurnService:
        naturalChannelSetupTurnService || undefined,
      channelMeshService,
    });
  const automationControlPlaneService =
    deps.automationControlPlaneService ||
    new ZavorthAutomationControlPlaneService();
  const automationActionService =
    deps.automationActionService ||
    new ZavorthAutomationActionService({
      controlPlaneService: automationControlPlaneService,
    });
  const watchModeControlPlaneService =
    deps.watchModeControlPlaneService ||
    new ZavorthWatchModeControlPlaneService();
  const watchModePolicyFileService =
    deps.watchModePolicyFileService ||
    new ComputerUseWatchModePolicyFileService();
  const formatPermissionCreatedMessage =
    deps.formatPermissionCreatedMessage || null;
  const buildPermissionKeyboard = deps.buildPermissionKeyboard || null;
  const zavorthBridgeMobileAccessService =
    deps.zavorthBridgeMobileAccessService || new ZavorthBridgeMobileAccessService();
  const runtimeAccessManifestService =
    deps.runtimeAccessManifestService || new RuntimeAccessManifestService();
  const runtimeBootstrapService =
    deps.runtimeBootstrapService || new RuntimeBootstrapService();
  const runtimeInstallJourneyService =
    deps.runtimeInstallJourneyService || new RuntimeInstallJourneyService();
  const runtimeOfficialRemoteAccessService =
    deps.runtimeOfficialRemoteAccessService ||
    new RuntimeOfficialRemoteAccessService();
  const capabilityLifecycleService =
    deps.capabilityLifecycleService || new CapabilityLifecycleService();
  const desktopResourcePlaneService = deps.desktopResourcePlaneService || null;
  const companionControlService = deps.companionControlService || null;
  const workspaceOptimizerService = deps.workspaceOptimizerService || null;
  const taskResourcePlannerService =
    deps.taskResourcePlannerService ||
    new TaskResourcePlannerService({
      capabilityLifecycle: capabilityLifecycleService as any,
      desktopResources: desktopResourcePlaneService as any,
    });
  const modeEscalationService = deps.modeEscalationService || null;
  const sharedSurfaceConsistencyService =
    deps.sharedSurfaceConsistencyService || new SharedSurfaceConsistencyService();
  const AIGatewayGatewayService =
    deps.AIGatewayGatewayService || new AIGatewayProxyService();
  const AIGatewayGatewayLauncherService =
    deps.AIGatewayGatewayLauncherService ||
    new ZavorthGatewayLauncherService({
      gatewayService: AIGatewayGatewayService,
    });
  const gatewayCompatibilityDoctorService =
    deps.GatewayCompatibilityDoctorService ||
    new GatewayCompatibilityDoctorService({
      gatewayService: AIGatewayGatewayService,
    });
  const gatewayUpstreamSyncService =
    deps.GatewayUpstreamSyncService ||
    new GatewayUpstreamSyncService({
      compatibilityDoctorService: gatewayCompatibilityDoctorService,
    });
  const skillCatalogApiService =
    deps.skillCatalogApiService || new SkillCatalogApiService();
  const skillMcpSidecarService =
    deps.skillMcpSidecarService ||
    new SkillMcpSidecarService({
      skillCatalogApiService,
    });
  const skillLibraryPresentationService =
    deps.skillLibraryPresentationService ||
    new SkillLibraryPresentationService({
      skillCatalogApiService,
      skillMcpSidecarService,
    });
  const skillInstallPlanPresentationService =
    deps.skillInstallPlanPresentationService ||
    new SkillInstallPlanPresentationService({
      skillLibraryPresentationService,
    });
  const skillBridgeActivationService =
    deps.skillBridgeActivationService || new UniversalSkillBridgeActivationService();
  const naturalInvocationRouterService =
    deps.naturalInvocationRouterService || new ZavorthNaturalInvocationRouter();
  const subagentInvocationGatewayService =
    deps.subagentInvocationGatewayService || new ZavorthSubagentInvocationGatewayService();
  const teamCatalogService =
    deps.teamCatalogService ||
    new ZavorthTeamCatalogService({
      discordSurfacePolicyService,
    });
  const tenantGovernanceService =
    deps.tenantGovernanceService || new ZavorthTenantGovernanceService();
  const tenantGovernanceActionService =
    deps.tenantGovernanceActionService ||
    new ZavorthTenantGovernanceActionService({
      tenantGovernanceService,
      teamCatalogService,
      channelMeshService,
      memoryPlaneService: memoryPlaneService || undefined,
      securityMeshService,
      sessionPlaneService: sessionPlaneService || undefined,
      workflowController: deps.workflowController || null,
      runtimeUserId: config.allowedUserIds[0] || null,
    });
  const governanceControlPlaneService =
    deps.governanceControlPlaneService ||
    new ZavorthGovernanceControlPlaneService({
      tenantGovernanceService,
      trustPlaneService,
      channelMeshService,
      nodeMeshService,
      remoteTransportService,
      pluginRegistryService,
      platformRegistryService,
      teamCatalogService,
    });
  return buildSharedSurfaceCommandServiceAssembly(
    {
      parser,
      supervisedRuntimeService,
      autoRepairService,
      zavorthBridgePreferenceStore,
      integrationHubService,
      gatewayService,
      channelActionService,
      channelMeshService,
      securityMeshService,
      pluginActionService,
      pluginRegistryService,
      platformActionService,
      platformRegistryService,
      platformCatalogSyncService,
      platformPublisherService,
      remoteTransportActionService,
      remoteTransportService,
      memoryPlaneService,
      layeredMemoryService,
      learningPlaneService,
      sessionPlaneService,
      hookPlaneService,
      toolSurfaceService,
      nodeMeshService,
      nodeDeviceProfiles,
      nodeCapabilities,
      nodePairingService,
      nodeInvokeService,
      discordSurfacePolicyService,
      providerControlPlaneService,
      providerDoctorService,
      codexRemoteControlPlaneService,
      codexRemoteActionService,
      codexRemoteReadModelService,
      permissionService,
      selfModificationCommandService,
      taskApprovalController,
      taskExecutionController,
      surfaceTaskDispatcher,
      taskManager,
      workflowController,
      engineeringCoreService,
      channelInstallService,
      channelSetupAssistantService,
      naturalChannelSetupTurnService,
      hubControlPlaneService,
      hubActionService,
      evalControlPlaneService,
      qaControlPlaneService,
      governanceControlPlaneService,
      replayLearningControlPlaneService,
      ecosystemControlPlaneService,
      distributedRuntimeControlPlaneService,
      runtimeStabilityControlPlaneService,
      rolloutReadinessControlPlaneService,
      naturalSetupControlPlaneService,
      automationControlPlaneService,
      automationActionService,
      watchModeControlPlaneService,
      watchModePolicyFileService,
      formatPermissionCreatedMessage,
      buildPermissionKeyboard,
      zavorthBridgeMobileAccessService,
      runtimeAccessManifestService,
      runtimeBootstrapService,
      runtimeInstallJourneyService,
      runtimeOfficialRemoteAccessService,
      capabilityLifecycleService,
      desktopResourcePlaneService,
      companionControlService,
      workspaceOptimizerService,
      taskResourcePlannerService,
      modeEscalationService,
      sharedSurfaceConsistencyService,
      AIGatewayGatewayService,
      AIGatewayGatewayLauncherService,
      GatewayCompatibilityDoctorService: gatewayCompatibilityDoctorService,
      GatewayUpstreamSyncService: gatewayUpstreamSyncService,
      skillCatalogApiService,
      skillMcpSidecarService,
      skillLibraryPresentationService,
      skillInstallPlanPresentationService,
      skillBridgeActivationService,
      naturalInvocationRouterService,
      subagentInvocationGatewayService,
      teamCatalogService,
      tenantGovernanceService,
      tenantGovernanceActionService,
      trustPlaneService,
      trustPlaneActionService,
    },
    {
      normalizeNaturalText: helpers.normalizeNaturalText,
      extractNaturalChannelId: helpers.extractNaturalChannelId,
      formatNaturalChannelLabel: helpers.formatNaturalChannelLabel,
    },
  );
}

export type SharedSurfaceCommandServiceComposition = ReturnType<
  typeof buildSharedSurfaceCommandServiceComposition
> & {
  parser: CommandParser;
  channelActionService: ZavorthChannelActionService;
  channelMeshService: ZavorthChannelMeshService;
  discordSurfacePolicyService: DiscordSurfacePolicyService;
  engineeringCoreService: EngineeringCoreService;
  surfaceTaskDispatcher: SharedSurfaceCommandServiceDeps['surfaceTaskDispatcher'] | null;
};

