import { SharedSurfaceAccessCommandPack } from '../SharedSurfaceAccessCommandPack.js';
import { SharedSurfaceZavorthBridgeMobileCommandPack } from '../SharedSurfaceZavorthBridgeMobileCommandPack.js';
import { SharedSurfaceCapabilityCommandPack } from '../SharedSurfaceCapabilityCommandPack.js';
import { SharedSurfaceCodexRemoteCommandPack } from '../SharedSurfaceCodexRemoteCommandPack.js';
import { SharedSurfaceControlPlaneCommandPack } from '../SharedSurfaceControlPlaneCommandPack.js';
import { SharedSurfaceDesktopCommandPack } from '../SharedSurfaceDesktopCommandPack.js';
import { SharedSurfaceEcosystemCommandPack } from '../SharedSurfaceEcosystemCommandPack.js';
import { SharedSurfaceGatewayToolingCommandPack } from '../SharedSurfaceGatewayToolingCommandPack.js';
import { SharedSurfaceIntegrationHubCommandPack } from '../SharedSurfaceIntegrationHubCommandPack.js';
import { SharedSurfaceIntegrationCommandPack } from '../SharedSurfaceIntegrationCommandPack.js';
import { SharedSurfaceLearningCommandPack } from '../SharedSurfaceLearningCommandPack.js';
import { SharedSurfaceMemoryCommandPack } from '../SharedSurfaceMemoryCommandPack.js';
import { SharedSurfaceNaturalMeshCommandPack } from '../SharedSurfaceNaturalMeshCommandPack.js';
import { SharedSurfaceOperationsCommandPack } from '../SharedSurfaceOperationsCommandPack.js';
import { SharedSurfacePresentationCommandPack } from '../SharedSurfacePresentationCommandPack.js';
import { SharedSurfaceRuntimeMaintenanceCommandPack } from '../SharedSurfaceRuntimeMaintenanceCommandPack.js';
import { SharedSurfaceSessionCommandPack } from '../SharedSurfaceSessionCommandPack.js';
import { SharedSurfaceSessionNodeCommandPack } from '../SharedSurfaceSessionNodeCommandPack.js';
import { SharedSurfaceTaskControlCommandPack } from '../SharedSurfaceTaskControlCommandPack.js';
import { SharedSurfaceTaskVariationCommandPack } from '../SharedSurfaceTaskVariationCommandPack.js';
import { SharedSurfaceTenantGovernanceCommandPack } from '../SharedSurfaceTenantGovernanceCommandPack.js';
import { SharedSurfaceWatchModeCommandPack } from '../SharedSurfaceWatchModeCommandPack.js';
import { SharedSurfaceWorkflowGovernanceCommandPack } from '../SharedSurfaceWorkflowGovernanceCommandPack.js';

type SharedSurfaceTaskVariationHelpers = {
  normalizeNaturalText?: (value: string | null | undefined) => string;
  extractNaturalChannelId?: (normalized: string) => string | null;
  formatNaturalChannelLabel?: (channelId: string) => string;
};

export function buildSharedSurfaceCommandServiceAssembly(
  deps: Record<string, any>,
  helpers: SharedSurfaceTaskVariationHelpers = {},
) {
  const codexRemoteCommandPack = new SharedSurfaceCodexRemoteCommandPack({
    controlPlaneService: deps.codexRemoteControlPlaneService,
    actionService: deps.codexRemoteActionService,
    sessionPlaneService: deps.sessionPlaneService,
    formatPermissionCreatedMessage: deps.formatPermissionCreatedMessage,
    buildPermissionKeyboard: deps.buildPermissionKeyboard,
  });
  const zavorthBridgeMobileCommandPack = new SharedSurfaceZavorthBridgeMobileCommandPack({
    accessService: deps.zavorthBridgeMobileAccessService,
  });
  const presentationCommandPack = new SharedSurfacePresentationCommandPack({
    securityMeshService: deps.securityMeshService,
    trustPlaneService: deps.trustPlaneService,
    discordSurfacePolicyService: deps.discordSurfacePolicyService,
  });
  const accessCommandPack = new SharedSurfaceAccessCommandPack({
    runtimeAccessManifestService: deps.runtimeAccessManifestService,
    runtimeBootstrapService: deps.runtimeBootstrapService,
    runtimeInstallJourneyService: deps.runtimeInstallJourneyService,
    runtimeOfficialRemoteAccessService: deps.runtimeOfficialRemoteAccessService,
    sharedSurfaceConsistencyService: deps.sharedSurfaceConsistencyService,
  });
  const capabilityCommandPack = new SharedSurfaceCapabilityCommandPack({
    capabilityLifecycleService: deps.capabilityLifecycleService,
    taskResourcePlannerService: deps.taskResourcePlannerService,
    permissionService: deps.permissionService,
  });
  const gatewayToolingCommandPack = new SharedSurfaceGatewayToolingCommandPack({
    AIGatewayGatewayService: deps.AIGatewayGatewayService,
    AIGatewayGatewayLauncherService: deps.AIGatewayGatewayLauncherService,
    GatewayCompatibilityDoctorService: deps.GatewayCompatibilityDoctorService,
    GatewayUpstreamSyncService: deps.GatewayUpstreamSyncService,
    gatewayService: deps.gatewayService,
    toolSurfaceService: deps.toolSurfaceService,
    hookPlaneService: deps.hookPlaneService,
    zavorthBridgePreferenceStore: deps.zavorthBridgePreferenceStore,
    discordSurfacePolicyService: deps.discordSurfacePolicyService,
    providerDoctorService: deps.providerDoctorService,
    providerControlPlaneService: deps.providerControlPlaneService,
  });
  const ecosystemCommandPack = new SharedSurfaceEcosystemCommandPack({
    platformActionService: deps.platformActionService,
    platformRegistryService: deps.platformRegistryService,
    platformCatalogSyncService: deps.platformCatalogSyncService,
    platformPublisherService: deps.platformPublisherService,
    skillMcpSidecarService: deps.skillMcpSidecarService,
    skillLibraryPresentationService: deps.skillLibraryPresentationService,
    skillInstallPlanPresentationService: deps.skillInstallPlanPresentationService,
    skillBridgeActivationService: deps.skillBridgeActivationService,
    naturalInvocationRouterService: deps.naturalInvocationRouterService,
    subagentInvocationGatewayService: deps.subagentInvocationGatewayService,
  });
  const integrationHubCommandPack = new SharedSurfaceIntegrationHubCommandPack({
    integrationHubService: deps.integrationHubService,
  });
  const integrationCommandPack = new SharedSurfaceIntegrationCommandPack({
    channelActionService: deps.channelActionService,
    channelMeshService: deps.channelMeshService,
    pluginActionService: deps.pluginActionService,
    pluginRegistryService: deps.pluginRegistryService,
    remoteTransportActionService: deps.remoteTransportActionService,
    remoteTransportService: deps.remoteTransportService,
  });
  const learningCommandPack = new SharedSurfaceLearningCommandPack({
    learningPlaneService: deps.learningPlaneService,
  });
  const memoryCommandPack = new SharedSurfaceMemoryCommandPack({
    memoryPlaneService: deps.memoryPlaneService,
    layeredMemoryService: deps.layeredMemoryService,
  });
  const runtimeMaintenanceCommandPack = new SharedSurfaceRuntimeMaintenanceCommandPack({
    supervisedRuntimeService: deps.supervisedRuntimeService,
    autoRepairService: deps.autoRepairService,
    renderHelp: (context) => presentationCommandPack.renderHelp(context),
  });
  const watchModeCommandPack = new SharedSurfaceWatchModeCommandPack({
    watchModeControlPlaneService: deps.watchModeControlPlaneService,
    watchModePolicyFileService: deps.watchModePolicyFileService,
    permissionService: deps.permissionService,
  });
  const sessionNodeCommandPack = new SharedSurfaceSessionNodeCommandPack({
    sessionPlaneService: deps.sessionPlaneService,
    nodeMeshService: deps.nodeMeshService,
    nodeDeviceProfiles: deps.nodeDeviceProfiles,
    nodeCapabilities: deps.nodeCapabilities,
    nodePairingService: deps.nodePairingService,
    nodeInvokeService: deps.nodeInvokeService,
  });
  const sessionCommandPack = new SharedSurfaceSessionCommandPack({
    sessionNodeCommandPack,
  });
  const naturalMeshCommandPack = new SharedSurfaceNaturalMeshCommandPack({
    channelInstallService: deps.channelInstallService,
    channelSetupAssistantService: deps.channelSetupAssistantService,
    naturalChannelSetupTurnService: deps.naturalChannelSetupTurnService,
    integrationHubService: deps.integrationHubService,
    integrationCommandPack,
    sessionNodeCommandPack,
    pluginRegistryService: deps.pluginRegistryService,
    remoteTransportService: deps.remoteTransportService,
    nodeMeshService: deps.nodeMeshService,
    nodeDeviceProfiles: deps.nodeDeviceProfiles,
    nodePairingService: deps.nodePairingService,
  });
  const workflowGovernanceCommandPack = new SharedSurfaceWorkflowGovernanceCommandPack({
    permissionService: deps.permissionService,
    selfModificationCommandService: deps.selfModificationCommandService,
    workflowController: deps.workflowController,
    taskManager: deps.taskManager,
  });
  const taskControlCommandPack = new SharedSurfaceTaskControlCommandPack({
    workflowGovernanceCommandPack,
    taskApprovalController: deps.taskApprovalController,
    taskExecutionController: deps.taskExecutionController,
    surfaceTaskDispatcher: deps.surfaceTaskDispatcher,
    taskManager: deps.taskManager,
  });
  const taskVariationCommandPack = new SharedSurfaceTaskVariationCommandPack({
    surfaceTaskDispatcher: deps.surfaceTaskDispatcher,
    resolveTaskReference: (ref, ctx) => taskControlCommandPack.resolveTaskReference(ref, ctx),
    resolveRecentTaskReference: (ctx, keywords) =>
      taskControlCommandPack.resolveRecentTaskReference(ctx, keywords),
    extractRecentTaskContextKeywords: (rawText) =>
      taskControlCommandPack.extractRecentTaskContextKeywords(rawText),
    normalizeNaturalText:
      helpers.normalizeNaturalText || ((value) => String(value || '').trim().toLowerCase()),
    extractNaturalChannelId:
      helpers.extractNaturalChannelId ||
      ((normalized) => {
        const channelMatch =
          normalized.match(/\b(?:canal|channel|chat)\s+(?:do|da|de|#)?\s*([a-z0-9_-]+)/i) ||
          normalized.match(/\b#([a-z0-9_-]+)/i) ||
          normalized.match(/\b([a-z0-9_-]+)\s+(?:canal|channel|chat)\b/i);
        return channelMatch?.[1]?.trim() || null;
      }),
    formatNaturalChannelLabel:
      helpers.formatNaturalChannelLabel || ((channelId) => `canal ${channelId}`),
  });
  const tenantGovernanceCommandPack = new SharedSurfaceTenantGovernanceCommandPack({
    teamCatalogService: deps.teamCatalogService,
    tenantGovernanceService: deps.tenantGovernanceService,
    tenantGovernanceActionService: deps.tenantGovernanceActionService,
    channelMeshService: deps.channelMeshService,
    formatSecurityMeshReply: () => presentationCommandPack.formatSecurityMeshReply(),
  });
  const controlPlaneCommandPack = new SharedSurfaceControlPlaneCommandPack({
    evalControlPlaneService: deps.evalControlPlaneService,
    qaControlPlaneService: deps.qaControlPlaneService,
    governanceControlPlaneService: deps.governanceControlPlaneService,
    replayLearningControlPlaneService: deps.replayLearningControlPlaneService,
    ecosystemControlPlaneService: deps.ecosystemControlPlaneService,
    distributedRuntimeControlPlaneService: deps.distributedRuntimeControlPlaneService,
    runtimeStabilityControlPlaneService: deps.runtimeStabilityControlPlaneService,
    rolloutReadinessControlPlaneService: deps.rolloutReadinessControlPlaneService,
    naturalSetupControlPlaneService: deps.naturalSetupControlPlaneService,
  });
  const desktopCommandPack = new SharedSurfaceDesktopCommandPack({
    desktopResourcePlaneService: deps.desktopResourcePlaneService,
    capabilityLifecycleService: deps.capabilityLifecycleService,
    companionControlService: deps.companionControlService,
    workspaceOptimizerService: deps.workspaceOptimizerService,
    modeEscalationService: deps.modeEscalationService,
  });
  const ecosystemControlPlaneService = deps.ecosystemControlPlaneService;
  const distributedRuntimeControlPlaneService = deps.distributedRuntimeControlPlaneService;
  const runtimeStabilityControlPlaneService = deps.runtimeStabilityControlPlaneService;
  const rolloutReadinessControlPlaneService = deps.rolloutReadinessControlPlaneService;
  const naturalSetupControlPlaneService = deps.naturalSetupControlPlaneService;
  const automationControlPlaneService = deps.automationControlPlaneService;
  const automationActionService = deps.automationActionService;
  const operationsCommandPack = new SharedSurfaceOperationsCommandPack({
    hubControlPlaneService: deps.hubControlPlaneService,
    hubActionService: deps.hubActionService,
    automationControlPlaneService,
    automationActionService,
    trustPlaneService: deps.trustPlaneService,
    trustPlaneActionService: deps.trustPlaneActionService,
  });
  return {
    ...deps,
    accessCommandPack,
    zavorthBridgeMobileCommandPack,
    capabilityCommandPack,
    codexRemoteCommandPack,
    tenantGovernanceCommandPack,
    controlPlaneCommandPack,
    desktopCommandPack,
    ecosystemCommandPack,
    gatewayToolingCommandPack,
    integrationHubCommandPack,
    integrationCommandPack,
    learningCommandPack,
    memoryCommandPack,
    naturalMeshCommandPack,
    operationsCommandPack,
    runtimeMaintenanceCommandPack,
    watchModeCommandPack,
    sessionCommandPack,
    sessionNodeCommandPack,
    taskControlCommandPack,
    taskVariationCommandPack,
    workflowGovernanceCommandPack,
    presentationCommandPack,
    ecosystemControlPlaneService,
    distributedRuntimeControlPlaneService,
    runtimeStabilityControlPlaneService,
    rolloutReadinessControlPlaneService,
    naturalSetupControlPlaneService,
    automationControlPlaneService,
    automationActionService,
  };
}
