import { SharedSurfaceAccessCommandPack } from '../SharedSurfaceAccessCommandPack.js';
import { SharedSurfaceZavorthBridgeMobileCommandPack } from '../SharedSurfaceZavorthBridgeMobileCommandPack.js';
import { SharedSurfaceCapabilityCommandPack } from '../SharedSurfaceCapabilityCommandPack.js';
import { SharedSurfaceCodexRemoteCommandPack } from '../SharedSurfaceCodexRemoteCommandPack.js';
import { SharedSurfaceControlPlaneCommandPack } from '../SharedSurfaceControlPlaneCommandPack.js';
import { SharedSurfaceDecisionCommandPack } from '../SharedSurfaceDecisionCommandPack.js';
import { SharedSurfaceDesktopCommandPack } from '../SharedSurfaceDesktopCommandPack.js';
import { SharedSurfaceEcosystemCommandPack } from '../SharedSurfaceEcosystemCommandPack.js';
import { SharedSurfaceGatewayToolingCommandPack } from '../SharedSurfaceGatewayToolingCommandPack.js';
import { SharedSurfaceIntegrationHubCommandPack } from '../SharedSurfaceIntegrationHubCommandPack.js';
import { SharedSurfaceIntegrationCommandPack } from '../SharedSurfaceIntegrationCommandPack.js';
import { SharedSurfaceLearningCommandPack } from '../SharedSurfaceLearningCommandPack.js';
import { SharedSurfaceMemoryCommandPack } from '../SharedSurfaceMemoryCommandPack.js';
import { SharedSurfaceOperationsCommandPack } from '../SharedSurfaceOperationsCommandPack.js';
import { SharedSurfaceOpsCommandPack } from '../SharedSurfaceOpsCommandPack.js';
import { SharedSurfacePresentationCommandPack } from '../SharedSurfacePresentationCommandPack.js';
import { SharedSurfaceRuntimeMaintenanceCommandPack } from '../SharedSurfaceRuntimeMaintenanceCommandPack.js';
import { SharedSurfaceSessionNodeCommandPack } from '../SharedSurfaceSessionNodeCommandPack.js';
import { SharedSurfaceTaskControlCommandPack } from '../SharedSurfaceTaskControlCommandPack.js';
import { SharedSurfaceTenantGovernanceCommandPack } from '../SharedSurfaceTenantGovernanceCommandPack.js';
import { SharedSurfaceWatchModeCommandPack } from '../SharedSurfaceWatchModeCommandPack.js';
import { SharedSurfaceWorkflowGovernanceCommandPack } from '../SharedSurfaceWorkflowGovernanceCommandPack.js';
import { SharedSurfaceBotCommandPack } from '../SharedSurfaceBotCommandPack.js';
import { SharedSurfaceConnectCommandPack } from '../SharedSurfaceConnectCommandPack.js';
import { ConnectionTargetResolver } from '../../../../../services/connection/ConnectionTargetResolver.js';
import { ConnectionTokenRefreshService } from '../../../../../services/connection/ConnectionTokenRefreshService.js';
import { ConnectionSemanticIntrospectionService } from '../../../../../services/connection/ConnectionSemanticIntrospectionService.js';
import { PersonaRegistryService } from '../../../../../runtime/agent/roster/PersonaRegistryService.js';
import { DynamicPersonaCompilerService } from '../../../../../runtime/agent/roster/DynamicPersonaCompilerService.js';
import { EnsemblePersonaTaskRunner } from '../../../../../runtime/agent/roster/EnsemblePersonaTaskRunner.js';
import { LlmRuntimeService } from '../../../../../services/llm/LlmRuntimeService.js';
import { PeerReviewAdvisoryService } from '../../../../../runtime/agent/advisory/PeerReviewAdvisoryService.js';
import type { IMessageContext } from '../../../../../contracts/IMessageBroker.js';
import type { SurfaceControllerContext } from '../../../../../orchestrator/SurfaceRuntime.js';
import type { SharedSurfaceCommandServiceDeps } from './SharedSurfaceCommandServiceDeps.js';

type RequiredAssemblyDepKeys =
  | 'supervisedRuntimeService'
  | 'autoRepairService'
  | 'zavorthBridgePreferenceStore'
  | 'integrationHubService'
  | 'gatewayService'
  | 'channelActionService'
  | 'channelMeshService'
  | 'securityMeshService'
  | 'pluginActionService'
  | 'pluginRegistryService'
  | 'platformActionService'
  | 'platformRegistryService'
  | 'platformCatalogSyncService'
  | 'platformPublisherService'
  | 'remoteTransportActionService'
  | 'remoteTransportService'
  | 'layeredMemoryService'
  | 'learningPlaneService'
  | 'hookPlaneService'
  | 'toolSurfaceService'
  | 'nodeMeshService'
  | 'nodePairingService'
  | 'nodeInvokeService'
  | 'discordSurfacePolicyService'
  | 'providerControlPlaneService'
  | 'providerDoctorService'
  | 'zavorthBridgeMobileAccessService'
  | 'runtimeAccessManifestService'
  | 'runtimeBootstrapService'
  | 'runtimeInstallJourneyService'
  | 'runtimeOfficialRemoteAccessService'
  | 'sharedSurfaceConsistencyService'
  | 'AIGatewayGatewayService'
  | 'AIGatewayGatewayLauncherService'
  | 'GatewayCompatibilityDoctorService'
  | 'GatewayUpstreamSyncService'
  | 'skillCatalogApiService'
  | 'skillMcpSidecarService'
  | 'skillLibraryPresentationService'
  | 'skillInstallPlanPresentationService'
  | 'skillBridgeActivationService'
  | 'teamCatalogService'
  | 'tenantGovernanceService'
  | 'tenantGovernanceActionService'
  | 'codexRemoteControlPlaneService'
  | 'codexRemoteActionService'
  | 'codexRemoteReadModelService'
  | 'hubControlPlaneService'
  | 'hubActionService'
  | 'evalControlPlaneService'
  | 'qaControlPlaneService'
  | 'governanceControlPlaneService'
  | 'replayLearningControlPlaneService'
  | 'ecosystemControlPlaneService'
  | 'distributedRuntimeControlPlaneService'
  | 'runtimeStabilityControlPlaneService'
  | 'rolloutReadinessControlPlaneService'
  | 'naturalSetupControlPlaneService'
  | 'automationControlPlaneService'
  | 'automationActionService'
  | 'watchModeControlPlaneService'
  | 'watchModePolicyFileService'
  | 'trustPlaneService'
  | 'trustPlaneActionService';

type NullableAssemblyDepKeys =
  | 'memoryPlaneService'
  | 'sessionPlaneService'
  | 'capabilityLifecycleService'
  | 'desktopResourcePlaneService'
  | 'companionControlService'
  | 'workspaceOptimizerService'
  | 'taskResourcePlannerService'
  | 'modeEscalationService'
  | 'permissionService'
  | 'selfModificationCommandService'
  | 'surfaceTaskDispatcher'
  | 'taskManager'
  | 'workflowController'
  | 'channelInstallService'
  | 'channelSetupAssistantService'
  | 'naturalChannelSetupTurnService';

type RequiredAssemblyDeps = {
  [Key in RequiredAssemblyDepKeys]-?: NonNullable<SharedSurfaceCommandServiceDeps[Key]>;
};

type NullableAssemblyDeps = {
  [Key in NullableAssemblyDepKeys]-?: Exclude<SharedSurfaceCommandServiceDeps[Key], undefined> | null;
};

type SharedSurfaceCommandServiceAssemblyDeps = Omit<
  SharedSurfaceCommandServiceDeps,
  RequiredAssemblyDepKeys | NullableAssemblyDepKeys | 'nodeCapabilityService' | 'nodeDeviceProfileService'
> &
  RequiredAssemblyDeps &
  NullableAssemblyDeps & {
    nodeCapabilities: NonNullable<SharedSurfaceCommandServiceDeps['nodeCapabilityService']>;
    nodeDeviceProfiles: NonNullable<SharedSurfaceCommandServiceDeps['nodeDeviceProfileService']>;
  };

export function buildSharedSurfaceCommandServiceAssembly(
  deps: SharedSurfaceCommandServiceAssemblyDeps,
) {
  const workflowController = deps.workflowController;
  const toSurfaceControllerContext = (ctx: IMessageContext): SurfaceControllerContext => ({
    userId: ctx.userId,
    chatId: ctx.chatId,
    platform: ctx.platform,
    threadId: ctx.threadId,
    messageId: ctx.messageId,
    channelId: ctx.channelId,
    transport: ctx.transport,
    attachments: ctx.attachments,
    inlineData: ctx.inlineData,
    composerPayload: ctx.composerPayload,
  });
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
  // Free-text natural mesh / session / task-variation packs are not wired
  // (agent-first + slash/callback only). Slash packs below remain.
  const workflowGovernanceCommandPack = new SharedSurfaceWorkflowGovernanceCommandPack({
    permissionService: deps.permissionService,
    selfModificationCommandService: deps.selfModificationCommandService,
    workflowController: workflowController
      ? {
          handleWorkflow: (ctx: IMessageContext, args: string) =>
            workflowController.handleWorkflow(toSurfaceControllerContext(ctx), args),
        }
      : null,
    taskManager: deps.taskManager,
  });
  const taskControlCommandPack = new SharedSurfaceTaskControlCommandPack({
    workflowGovernanceCommandPack,
    taskApprovalController: deps.taskApprovalController,
    taskExecutionController: deps.taskExecutionController,
    surfaceTaskDispatcher: deps.surfaceTaskDispatcher,
    taskManager: deps.taskManager,
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
  const opsCommandPack = new SharedSurfaceOpsCommandPack({
    opsController: deps.opsController || null,
  });
  const decisionCommandPack = new SharedSurfaceDecisionCommandPack({
    decisionSpine: deps.surfaceDecisionSpine || null,
  });
  const botCommandPack = new SharedSurfaceBotCommandPack({
    personaRegistryService: deps.personaRegistryService || new PersonaRegistryService(),
    dynamicCompilerService: deps.dynamicPersonaCompilerService || new DynamicPersonaCompilerService(),
    peerReviewService: new PeerReviewAdvisoryService(),
    personaRunner: new EnsemblePersonaTaskRunner(null, new LlmRuntimeService()),
  });
  const resolver = new ConnectionTargetResolver({
    pluginRegistry: {
      listEntries: () => {
        if (!deps.pluginRegistryService) {
          return [];
        }
        const snapshot = deps.pluginRegistryService.buildSnapshot();
        return snapshot.entries.map((entry) => ({
          manifest: {
            id: entry.id,
            label: entry.label,
            description: entry.summary,
            connection: (entry as unknown as { manifest?: { connection?: any } }).manifest?.connection,
          },
        }));
      },
    },
    mcpClient: {
      listServers: () => {
        try {
          const gw = deps.gatewayService as unknown as { listMcpServers?: () => Array<{ id: string; name: string }> };
          if (typeof gw?.listMcpServers === 'function') {
            return gw.listMcpServers();
          }
        } catch {
          // MCP fallback
        }
        return [];
      },
    },
  });

  const llmRuntimeForIntrospection = new LlmRuntimeService();
  const introspectionService = new ConnectionSemanticIntrospectionService({
    enabled: true,
    llmInferencePort: {
      classifyService: async (target: string) => {
        try {
          const prompt = `Classify external software service "${target}". Return ONLY a JSON object: {"category": string, "authType": "api_key" | "oauth2" | "local_path", "summary": string, "guidance": string}.`;
          const runRes = await llmRuntimeForIntrospection.chat([
            { role: 'user', content: prompt },
          ]);
          const text = runRes?.content?.trim() || '';
          const firstBrace = text.indexOf('{');
          const lastBrace = text.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            const parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1)) as {
              category: string;
              authType: 'api_key' | 'oauth2' | 'local_path';
              summary?: string;
              guidance?: string;
            };
            return parsed;
          }
        } catch {
          // LLM classification fallback
        }
        return null;
      },
    },
  });

  const tokenRefreshService = new ConnectionTokenRefreshService({ resolver });
  tokenRefreshService.startProactiveRefreshLoop(60000);

  const connectCommandPack = new SharedSurfaceConnectCommandPack({
    resolver,
    introspectionService,
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
    operationsCommandPack,
    opsCommandPack,
    decisionCommandPack,
    botCommandPack,
    connectCommandPack,
    runtimeMaintenanceCommandPack,
    watchModeCommandPack,
    sessionNodeCommandPack,
    taskControlCommandPack,
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
