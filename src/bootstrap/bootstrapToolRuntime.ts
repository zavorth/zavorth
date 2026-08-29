import { McpRuntimeService } from '../mcp/McpRuntimeService.js';
import { TelemetryRuntimeService } from '../observability/telemetry/TelemetryRuntimeService.js';
import { McpCapabilityControlPlaneService } from '../services/McpCapabilityControlPlaneService.js';
import { RuntimeCompositionService } from '../services/RuntimeCompositionService.js';
import type { LogRepository } from '../storage/LogRepository.js';
import { ToolHookPipelineService } from '../services/ToolHookPipelineService.js';
import { ZavorthMemoryConsolidator } from '../services/ZavorthMemoryConsolidator.js';
import { ServiceRegistry } from './ServiceRegistry.js';
import { ServiceTokens } from './ServiceTokens.js';
import { initializeBuiltinCommands, globalCommandRegistry } from '../domain/commands/index.js';
import { CommandBackedTool, buildCommandSecurityDefinition } from '../domain/commands/CommandBackedTool.js';
import { logger } from '../logger.js';

import { ToolRegistry } from '../tools/ToolRegistry.js';
import { ToolExecutor } from '../execution/ToolExecutor.js';
import { ToolCatalogService } from '../services/tools/ToolCatalogService.js';
import { UnifiedSearchTool } from '../tools/UnifiedSearchTool.js';
import { DeepSearchTool } from '../tools/DeepSearchTool.js';
import { CreateFileTool } from '../tools/CreateFileTool.js';
import { ReadFileTool } from '../tools/ReadFileTool.js';
import { ListDirectoryTool } from '../tools/ListDirectoryTool.js';
import {
  HashlineFileEditorTool,
  HostCommandProposeTool,
  HostCommandRunTool,
  PtySessionProposeTool,
  PtyTerminateTool,
  PtyWriteTool,
  WorkspaceApplyPatchTool,
  WorkspaceCommandProposeTool,
  WorkspaceCommandRunTool,
  WorkspaceEditTool,
  WorkspaceListTool,
  WorkspaceReadTool,
  WorkspaceTaskMandateProposeTool,
  WorkspaceWriteTool,
} from '../tools/workspace/index.js';
import { DateTimeTool } from '../tools/DateTimeTool.js';
import { RemoteShellTool } from '../tools/RemoteShellTool.js';
import { QueryExternalAiTool } from '../tools/QueryExternalAiTool.js';
import { SandboxExecutionTool } from '../tools/SandboxExecutionTool.js';
import { AgentCodeModeTool } from '../tools/AgentCodeModeTool.js';
import { Mem0Tool } from '../tools/Mem0Tool.js';
import { DesktopAutomationTool } from '../tools/DesktopAutomationTool.js';
import { PlanMnemosScopeTool } from '../tools/PlanMnemosScopeTool.js';
import { EnableMnemosTool } from '../tools/EnableMnemosTool.js';
import {
  ToolRuntimeHandsTool as EchoHandsTool,
} from '../tools/ToolRuntimeHandsTool.js';
import { ConfigureLlmProfileTool } from '../tools/ConfigureLlmProfileTool.js';
import { ZavorthActionTool } from '../tools/ZavorthActionTool.js';
import { AutoSkillCreatorTool } from '../tools/AutoSkillCreatorTool.js';
import { UseLearnedSkillTool } from '../tools/UseLearnedSkillTool.js';
import { ConversationRecallTool } from '../tools/ConversationRecallTool.js';
import { KnowledgeRecallTool } from '../tools/KnowledgeRecallTool.js';
import { ImageGenerationTool } from '../tools/ImageGenerationTool.js';
import { MediaAnalysisTool } from '../tools/MediaAnalysisTool.js';
import { NodeMeshTool } from '../tools/NodeMeshTool.js';
import { VideoGenerationTool } from '../tools/VideoGenerationTool.js';
import { KanbanTool } from '../tools/KanbanTool.js';
import { ZavorthToolAdapter } from '../tools/ZavorthToolAdapter.js';
import { ConnectionManageTool } from '../tool-runtime/tools/connection/ConnectionManageTool.js';
import { SkillFeedbackCollectorTool } from '../tools/SkillFeedbackCollectorTool.js';
import { BatchTrajectoryTool } from '../tools/BatchTrajectoryTool.js';
import { MultiBackendTerminalTool } from '../tools/MultiBackendTerminalTool.js';
import { EmailTool } from '../tools/EmailTool.js';
import { CalendarTool } from '../tools/CalendarTool.js';
import { PluginRecommendTool } from '../tools/PluginRecommendTool.js';
import { PluginSuggestTool } from '../tools/PluginSuggestTool.js';
import { CodeReviewTool } from '../tools/CodeReviewTool.js';
import { DatabaseQueryTool } from '../tools/DatabaseQueryTool.js';
import { ZavorthCronSchedulerTool } from '../tools/ZavorthCronSchedulerTool.js';
import { ZavorthDelegateTool } from '../tools/ZavorthDelegateTool.js';
import { ZavorthComputerUseTool } from '../tools/ZavorthComputerUseTool.js';
import { ZavorthVoiceModeTool } from '../tools/ZavorthVoiceModeTool.js';
import { ZavorthSessionSearchTool } from '../tools/ZavorthSessionSearchTool.js';
import { SessionSearchFts5Tool } from '../tools/SessionSearchFts5Tool.js';
import {
  SessionContinuumService,
  resolveSessionContinuumStorePath,
} from '../services/SessionContinuumService.js';
import {
  config as runtimeConfig,
} from '../config/index.js';
import path from 'node:path';
import { ZavorthChannelSendTool } from '../tools/ZavorthChannelSendTool.js';
import { ZavorthDocumentExtractorTool } from '../tools/ZavorthDocumentExtractorTool.js';
import { ZavorthTtsTool } from '../tools/ZavorthTtsTool.js';
import { ZavorthSttTool } from '../tools/ZavorthSttTool.js';
import { SttBackendRegistry } from '../adapters/speech/stt/SttBackendRegistry.js';
import { SttProviderPackLoader } from '../adapters/speech/stt/SttProviderPackLoader.js';
import { builtinSttProviderConfigs } from '../adapters/speech/stt/builtinSttProviderConfigs.js';
import { TtsBackendRegistry } from '../adapters/speech/tts/TtsBackendRegistry.js';
import { TtsProviderPackLoader } from '../adapters/speech/tts/TtsProviderPackLoader.js';
import { builtinTtsProviderConfigs } from '../adapters/speech/tts/builtinTtsProviderConfigs.js';
import { ZavorthReceiptSearchTool } from '../tools/ZavorthReceiptSearchTool.js';
import { ZavorthPolicyEnforcerTool } from '../tools/ZavorthPolicyEnforcerTool.js';
import { ZavorthApiClientTool } from '../tools/ZavorthApiClientTool.js';
import { ZavorthTrajectoryExportTool } from '../tools/ZavorthTrajectoryExportTool.js';
import { ZavorthMacroTool } from '../tools/ZavorthMacroTool.js';
import { ZavorthCheckpointTool } from '../tools/ZavorthCheckpointTool.js';
import { ZavorthBm25SearchTool } from '../tools/ZavorthBm25SearchTool.js';
import { ZavorthLspDiagnosticsTool } from '../tools/ZavorthLspDiagnosticsTool.js';
import { ZavorthPowerLockTool } from '../tools/ZavorthPowerLockTool.js';
import { ZavorthCodebaseGraphTool } from '../tools/ZavorthCodebaseGraphTool.js';
import { ZavorthSnapshotRollbackTool } from '../tools/ZavorthSnapshotRollbackTool.js';
import { ZavorthTrajectoryCompressorTool } from '../tools/ZavorthTrajectoryCompressorTool.js';
import { ZavorthAutoRepairTool } from '../tools/ZavorthAutoRepairTool.js';
import { ZavorthBenchmarkTool } from '../tools/ZavorthBenchmarkTool.js';
import { ZavorthBlueprintTool } from '../tools/ZavorthBlueprintTool.js';
import { ZavorthContextMeterTool } from '../tools/ZavorthContextMeterTool.js';
import { ZavorthMcpDoctorTool } from '../tools/ZavorthMcpDoctorTool.js';
import { ZavorthStealthBrowseTool } from '../tools/ZavorthStealthBrowseTool.js';
import { ZavorthSchedulerTool } from '../tools/ZavorthSchedulerTool.js';
import { ZavorthPluginSdkTool } from '../tools/ZavorthPluginSdkTool.js';
import { ZavorthWorktreeTool } from '../tools/ZavorthWorktreeTool.js';
import { ZavorthMemoryGraphTool } from '../tools/ZavorthMemoryGraphTool.js';
import { ZavorthSelfRepairTool } from '../tools/ZavorthSelfRepairTool.js';
import { SecurityGuidanceService } from '../services/plugins/SecurityGuidanceService.js';
import { ProviderNovitaTool } from '../services/plugins/ProviderNovitaTool.js';
import { ProviderReplicateTool } from '../services/plugins/ProviderReplicateTool.js';
import { ProviderHuggingFaceTool } from '../services/plugins/ProviderHuggingFaceTool.js';
import { WebFirecrawlTool } from '../services/plugins/WebFirecrawlTool.js';
import { ImageGenFalTool } from '../services/plugins/ImageGenFalTool.js';
import { ImageGenComfyUITool } from '../services/plugins/ImageGenComfyUITool.js';
import { SearchSearXNGTool } from '../services/plugins/SearchSearXNGTool.js';
import { VideoGenRunwayTool } from '../services/plugins/VideoGenRunwayTool.js';
import { SpotifyPlayerTool } from '../services/plugins/SpotifyPlayerTool.js';
import { ZavorthDockerComposeTool } from '../tools/ZavorthDockerComposeTool.js';
import { ZavorthCodeIntelligenceTool } from '../tools/ZavorthCodeIntelligenceTool.js';
import { ZavorthSshTunnelTool } from '../tools/ZavorthSshTunnelTool.js';
import { ZavorthChartGeneratorTool } from '../tools/ZavorthChartGeneratorTool.js';
import { ZavorthFileWatcherTool } from '../tools/ZavorthFileWatcherTool.js';
import { ZavorthNetworkTool } from '../tools/ZavorthNetworkTool.js';
import { ZavorthWebhookReceiverTool } from '../tools/ZavorthWebhookReceiverTool.js';
import { ZavorthMcpMarketplaceTool } from '../tools/ZavorthMcpMarketplaceTool.js';
import { ZavorthSkillMarketplaceTool } from '../tools/ZavorthSkillMarketplaceTool.js';
import { ZavorthAgentGovernanceTool } from '../tools/ZavorthAgentGovernanceTool.js';
import { ZavorthRagBuilderTool } from '../tools/ZavorthRagBuilderTool.js';
import { ZavorthAgentEvalTool } from '../tools/ZavorthAgentEvalTool.js';
import { ZavorthPrivacyVaultTool } from '../tools/ZavorthPrivacyVaultTool.js';
import { ZavorthGitLockTool } from '../tools/ZavorthGitLockTool.js';
import { ZavorthMultiRepoTool } from '../tools/ZavorthMultiRepoTool.js';
import { ZavorthDocProviderTool } from '../tools/ZavorthDocProviderTool.js';
import { ZavorthPromptLibraryTool } from '../tools/ZavorthPromptLibraryTool.js';
import { ZavorthTokenBudgetTool } from '../tools/ZavorthTokenBudgetTool.js';
import { ZavorthSandboxCloudTool } from '../tools/ZavorthSandboxCloudTool.js';
import { ZavorthWorkflowBuilderTool } from '../tools/ZavorthWorkflowBuilderTool.js';
import { ZavorthEdgeComputingTool } from '../tools/ZavorthEdgeComputingTool.js';
import { ZavorthBrowserAutomationTool } from '../tools/ZavorthBrowserAutomationTool.js';
import { ZavorthCodeFormatterTool } from '../tools/ZavorthCodeFormatterTool.js';
import { ZavorthDependencyAnalyzerTool } from '../tools/ZavorthDependencyAnalyzerTool.js';
import { ZavorthGitAdvancedTool } from '../tools/ZavorthGitAdvancedTool.js';
import { ZavorthDataScienceTool } from '../tools/ZavorthDataScienceTool.js';
import { ZavorthMlOpsTool } from '../tools/ZavorthMlOpsTool.js';
import { ZavorthContainerManagerTool } from '../tools/ZavorthContainerManagerTool.js';
import { ZavorthDatabaseAdminTool } from '../tools/ZavorthDatabaseAdminTool.js';
import { ZavorthFileSystemAdvancedTool } from '../tools/ZavorthFileSystemAdvancedTool.js';
import { ZavorthNetworkDiagnosticsTool } from '../tools/ZavorthNetworkDiagnosticsTool.js';
import { ZavorthSecurityScannerTool } from '../tools/ZavorthSecurityScannerTool.js';
import { ZavorthCloudStorageTool } from '../tools/ZavorthCloudStorageTool.js';
import { ZavorthEmailAdvancedTool } from '../tools/ZavorthEmailAdvancedTool.js';
import { ZavorthCalendarAdvancedTool } from '../tools/ZavorthCalendarAdvancedTool.js';
import { ZavorthNotificationTool } from '../tools/ZavorthNotificationTool.js';
import { ZavorthApiBuilderTool } from '../tools/ZavorthApiBuilderTool.js';
import { ZavorthTerminalBackendsTool } from '../tools/ZavorthTerminalBackendsTool.js';
import { AgentManagerTool } from '../tools/AgentManagerTool.js';
import { CapabilityDiscoveryTool } from '../tools/CapabilityDiscoveryTool.js';
import {
  AgentConsensusTool,
  ConsensusWithFallbackTool,
} from '../tools/AgentConsensusTool.js';
import { LlmRuntimeService } from '../services/llm/LlmRuntimeService.js';
import { LLMRouterService } from '../services/plugins/LLMRouterService.js';
import { ContextCompressorService } from '../services/plugins/ContextCompressorService.js';
import { ReasoningEffortService } from '../services/plugins/ReasoningEffortService.js';
import { PromptCacheService } from '../services/plugins/PromptCacheService.js';
import { LLMSelfEditContextService } from '../services/plugins/LLMSelfEditContextService.js';
import { LLMModelSwitcherService } from '../services/plugins/LLMModelSwitcherService.js';
import { LLMDriftDetectorService } from '../services/plugins/LLMDriftDetectorService.js';
import { StreamingLLMService } from '../services/plugins/StreamingLLMService.js';
import { AutoSkillGeneratorService } from '../services/plugins/AutoSkillGeneratorService.js';
import { ZavorthVisionService } from '../services/plugins/ZavorthVisionService.js';
import { ZavorthAudioAnalyzerService } from '../services/plugins/ZavorthAudioAnalyzerService.js';
import { ZavorthVideoAnalyzerService } from '../services/plugins/ZavorthVideoAnalyzerService.js';
import { UsageAnalyticsService } from '../services/plugins/UsageAnalyticsService.js';
import { CostAnalyticsService } from '../services/plugins/CostAnalyticsService.js';
import { QualityMetricsService } from '../services/plugins/QualityMetricsService.js';
import { MultiUserService } from '../services/plugins/MultiUserService.js';
import { SharedWorkspaceService } from '../services/plugins/SharedWorkspaceService.js';
import { RoleBasedAccessService } from '../services/plugins/RoleBasedAccessService.js';
import { CircuitBreakerService } from '../services/plugins/CircuitBreakerService.js';
import { RetryService } from '../services/plugins/RetryService.js';
import { HealthCheckService } from '../services/plugins/HealthCheckService.js';
import { BackupService } from '../services/plugins/BackupService.js';
import { ZavorthPluginMarketplaceService } from '../services/plugins/ZavorthPluginMarketplaceService.js';
import { DocumentIntelligenceService } from '../services/plugins/DocumentIntelligenceService.js';
import { CodeIntelligenceService } from '../services/plugins/CodeIntelligenceService.js';
import { DataPipelineService } from '../services/plugins/DataPipelineService.js';
import { NotificationCenterService } from '../services/plugins/NotificationCenterService.js';
import { VersionControlService } from '../services/plugins/VersionControlService.js';
import { MemorySupermemoryService } from '../services/plugins/MemorySupermemoryService.js';
import { MemoryByteroverService } from '../services/plugins/MemoryByteroverService.js';
import { MemoryHindsightService } from '../services/plugins/MemoryHindsightService.js';
import { MemoryHolographicService } from '../services/plugins/MemoryHolographicService.js';
import { MemoryRetainDBService } from '../services/plugins/MemoryRetainDBService.js';
import { MemorySemanticCacheService } from '../services/plugins/MemorySemanticCacheService.js';
import { CompanionIOSService } from '../services/plugins/CompanionIOSService.js';
import { CompanionAndroidService } from '../services/plugins/CompanionAndroidService.js';
import { ActiveMemoryService } from '../services/plugins/ActiveMemoryService.js';
import { DiagnosticsPrometheusService } from '../services/plugins/DiagnosticsPrometheusService.js';
import { KanbanSQLiteDispatcherService } from '../services/plugins/KanbanSQLiteDispatcherService.js';
import { MemoryLanceDBService } from '../services/plugins/MemoryLanceDBService.js';
import { MemoryHonchoService } from '../services/plugins/MemoryHonchoService.js';
import { DiagnosticsOtelService } from '../services/plugins/DiagnosticsOtelService.js';
import { AchievementsService } from '../services/plugins/AchievementsService.js';
import { SkinEngineService } from '../services/plugins/SkinEngineService.js';
import { TrajectoryResearchService } from '../services/plugins/TrajectoryResearchService.js';
import { DiskCleanupService } from '../services/plugins/DiskCleanupService.js';
import { CodexSupervisorService } from '../services/plugins/CodexSupervisorService.js';
import { BrowserPlaywrightService } from '../services/plugins/BrowserPlaywrightService.js';
import { SearchExaService } from '../services/plugins/SearchExaService.js';
import { MemoryQdrantService } from '../services/plugins/MemoryQdrantService.js';
import { TaskPlaneService } from '../services/TaskPlaneService.js';
import { bindAutonomySchedulePlane } from '../services/AutonomySchedulePlane.js';
import {
  runPluginOsHook,
  setPluginOsHookPipeline,
} from '../services/PluginOsHookPipelineAccess.js';
import { PluginRuntimeService } from '../services/PluginRuntimeService.js';
import { PluginRegistryService } from '../services/PluginRegistryService.js';
import { PluginStateBridgeService } from '../services/PluginStateBridgeService.js';
import { PluginOsBootstrapCatalogService } from '../services/PluginOsBootstrapCatalogService.js';
import {
  setPluginOsMcpRuntime,
  setPluginOsMcpRuntime as clearMcp,
} from '../services/PluginOsMcpRuntimeAccess.js';
import { createPluginOsWireAdapterStores } from '../services/PluginOsWireAdapterStores.js';
import {
  setPluginOsReadyPromise,
  waitForPluginOsReady,
} from '../services/PluginOsAgentReadiness.js';
import { PluginOsObservabilityService } from '../services/PluginOsObservabilityService.js';
import { PluginOsRuntimeWatchService } from '../services/PluginOsRuntimeWatchService.js';
import { PluginOsTelemetryService } from '../services/PluginOsTelemetryService.js';
import * as bridge from '../services/SkillToolRegistryBridge.js';

export function createBootstrapToolRuntime(logRepo: LogRepository) {


  // ── Plugin tools (BaseTool) ──


  // ── Innovative tools ──

  // ── Medium priority tools ──

  // ── Low priority tools ──

  // ── Gap-closing tools ──


  // ── Plugin services (runtime dependencies) ──

  const toolRegistry = new ToolRegistry();
  toolRegistry.register(new UnifiedSearchTool());
  toolRegistry.register(new DeepSearchTool());
  toolRegistry.register(new CreateFileTool());
  toolRegistry.register(new ReadFileTool());
  toolRegistry.register(new ListDirectoryTool());
  toolRegistry.register(new WorkspaceReadTool());
  toolRegistry.register(new WorkspaceListTool());
  toolRegistry.register(new WorkspaceWriteTool());
  toolRegistry.register(new WorkspaceEditTool());
  toolRegistry.register(new WorkspaceApplyPatchTool());
  toolRegistry.register(new HashlineFileEditorTool());
  toolRegistry.register(new WorkspaceCommandProposeTool());
  toolRegistry.register(new WorkspaceCommandRunTool());
  toolRegistry.register(new WorkspaceTaskMandateProposeTool());
  toolRegistry.register(new HostCommandProposeTool());
  toolRegistry.register(new HostCommandRunTool());
  toolRegistry.register(new PtySessionProposeTool());
  toolRegistry.register(new PtyWriteTool());
  toolRegistry.register(new PtyTerminateTool());
  toolRegistry.register(new DateTimeTool());
  toolRegistry.register(new RemoteShellTool());
  toolRegistry.register(new QueryExternalAiTool());
  toolRegistry.register(new SandboxExecutionTool());
  toolRegistry.register(new AgentCodeModeTool());
  toolRegistry.register(new Mem0Tool());
  toolRegistry.register(new DesktopAutomationTool());
  toolRegistry.register(new PlanMnemosScopeTool());
  toolRegistry.register(new EnableMnemosTool());
  toolRegistry.register(new EchoHandsTool());
  toolRegistry.register(new ConfigureLlmProfileTool());
  toolRegistry.register(new ZavorthActionTool());
  toolRegistry.register(new AutoSkillCreatorTool());
  toolRegistry.register(new UseLearnedSkillTool());
  {
    const projectRoot = runtimeConfig.projectRoot || process.cwd();
    const runtimeDir = runtimeConfig.runtimeDir || path.join(projectRoot, 'data', 'runtime');
    toolRegistry.register(
      new ConversationRecallTool({
        projectRoot,
        runtimeDir,
        dbPath: runtimeConfig.dbPath || null,
      }),
    );
    toolRegistry.register(new KnowledgeRecallTool({ projectRoot }));
  }
  toolRegistry.register(new ImageGenerationTool());
  toolRegistry.register(new MediaAnalysisTool());
  toolRegistry.register(new NodeMeshTool());
  toolRegistry.register(new VideoGenerationTool());
  toolRegistry.register(new KanbanTool());
  toolRegistry.register(new SkillFeedbackCollectorTool());
  toolRegistry.register(new BatchTrajectoryTool());
  toolRegistry.register(new MultiBackendTerminalTool());
  toolRegistry.register(new EmailTool());
  toolRegistry.register(new CalendarTool());
  toolRegistry.register(
    new PluginRecommendTool({
      projectRoot: runtimeConfig?.projectRoot || process.env.ZAVORTH_PROJECT_ROOT || process.cwd(),
    }),
  );
  toolRegistry.register(
    new PluginSuggestTool({
      projectRoot: runtimeConfig?.projectRoot || process.env.ZAVORTH_PROJECT_ROOT || process.cwd(),
    }),
  );
  toolRegistry.register(new CodeReviewTool());
  toolRegistry.register(new DatabaseQueryTool());
  toolRegistry.register(new ZavorthMacroTool());
  toolRegistry.register(new ZavorthCheckpointTool());
  toolRegistry.register(new ZavorthBm25SearchTool());
  toolRegistry.register(new ZavorthLspDiagnosticsTool());
  toolRegistry.register(new ZavorthPowerLockTool());
  toolRegistry.register(new ZavorthBlueprintTool());
  toolRegistry.register(new ZavorthContextMeterTool());
  toolRegistry.register(new ZavorthMcpDoctorTool());
  toolRegistry.register(new ZavorthStealthBrowseTool());
  toolRegistry.register(new ZavorthSchedulerTool());
  toolRegistry.register(new ZavorthPluginSdkTool());
  toolRegistry.register(new ZavorthWorktreeTool());
  toolRegistry.register(new ZavorthMemoryGraphTool());
  toolRegistry.register(new ZavorthSelfRepairTool());
  {
    const runtimeDir =
      runtimeConfig.runtimeDir || path.join(runtimeConfig.projectRoot || process.cwd(), 'data', 'runtime');
    const taskPlane = new TaskPlaneService({
      storePath: path.join(runtimeDir, 'task-plane.json'),
      stateDbPath: runtimeConfig.dbPath || null,
    });
    const schedulePlane = bindAutonomySchedulePlane({
      runtimeDir,
      taskPlane,
    });
    toolRegistry.register(
      new ZavorthCronSchedulerTool({
        plane: schedulePlane,
        taskPlane,
        runtimeDir,
      }),
    );
  }
  toolRegistry.register(new ZavorthDelegateTool());
  toolRegistry.register(new ZavorthComputerUseTool());
  toolRegistry.register(new ZavorthVoiceModeTool());
  const sessionContinuum = new SessionContinuumService({
    storePath: resolveSessionContinuumStorePath(
      runtimeConfig.runtimeDir || path.join(runtimeConfig.projectRoot || process.cwd(), 'data', 'runtime'),
    ),
    stateDbPath: runtimeConfig.dbPath || null,
  });
  // Preferred product tool is conversation_recall (registered above). These remain aliases.
  toolRegistry.register(new SessionSearchFts5Tool({ continuum: sessionContinuum }));
  toolRegistry.register(new ZavorthSessionSearchTool({ continuum: sessionContinuum }));
  toolRegistry.register(new ZavorthChannelSendTool());
  toolRegistry.register(new ZavorthDocumentExtractorTool());
  const ttsRegistry = new TtsBackendRegistry();
  for (const ttsConfig of builtinTtsProviderConfigs()) {
    ttsRegistry.registerConfig(ttsConfig);
  }
  const ttsPackLoader = new TtsProviderPackLoader(
    runtimeConfig.ttsProvidersDir || path.join(runtimeConfig.projectRoot || process.cwd(), 'tts-providers'),
  );
  for (const ttsConfig of ttsPackLoader.loadAll()) {
    ttsRegistry.registerConfig(ttsConfig);
  }
  toolRegistry.register(new ZavorthTtsTool({ registry: ttsRegistry }));
  const sttRegistry = new SttBackendRegistry();
  for (const sttConfig of builtinSttProviderConfigs()) {
    sttRegistry.registerConfig(sttConfig);
  }
  const sttPackLoader = new SttProviderPackLoader(
    runtimeConfig.sttProvidersDir || path.join(runtimeConfig.projectRoot || process.cwd(), 'stt-providers'),
  );
  for (const sttConfig of sttPackLoader.loadAll()) {
    sttRegistry.registerConfig(sttConfig);
  }
  toolRegistry.register(new ZavorthSttTool({ registry: sttRegistry }));
  toolRegistry.register(new ZavorthReceiptSearchTool());
  toolRegistry.register(new ZavorthPolicyEnforcerTool());
  toolRegistry.register(new ZavorthApiClientTool());
  toolRegistry.register(new ZavorthTrajectoryExportTool());
  toolRegistry.register(new ZavorthCodebaseGraphTool());
  toolRegistry.register(new ZavorthSnapshotRollbackTool());
  toolRegistry.register(new ZavorthTrajectoryCompressorTool());
  toolRegistry.register(new ZavorthLspDiagnosticsTool());
  toolRegistry.register(new ZavorthPowerLockTool());
  toolRegistry.register(new ZavorthAutoRepairTool());
  toolRegistry.register(new ZavorthBenchmarkTool());

  // ── Plugin tools ──
  toolRegistry.register(new SecurityGuidanceService());
  toolRegistry.register(new ProviderNovitaTool());
  toolRegistry.register(new ProviderReplicateTool());
  toolRegistry.register(new ProviderHuggingFaceTool());
  toolRegistry.register(new WebFirecrawlTool());
  toolRegistry.register(new ImageGenFalTool());
  toolRegistry.register(new ImageGenComfyUITool());
  toolRegistry.register(new SearchSearXNGTool());
  toolRegistry.register(new VideoGenRunwayTool());
  toolRegistry.register(new SpotifyPlayerTool());

  toolRegistry.register(new ZavorthDockerComposeTool());
  toolRegistry.register(new ZavorthCodeIntelligenceTool());
  toolRegistry.register(new ZavorthSshTunnelTool());
  toolRegistry.register(new ZavorthChartGeneratorTool());
  toolRegistry.register(new ZavorthFileWatcherTool());
  toolRegistry.register(new ZavorthNetworkTool());
  toolRegistry.register(new ZavorthWebhookReceiverTool());

  toolRegistry.register(new ZavorthMcpMarketplaceTool());
  toolRegistry.register(new ZavorthSkillMarketplaceTool());
  toolRegistry.register(new ZavorthAgentGovernanceTool());
  toolRegistry.register(new ZavorthRagBuilderTool());
  toolRegistry.register(new ZavorthAgentEvalTool());
  toolRegistry.register(new ZavorthPrivacyVaultTool());
  toolRegistry.register(new ZavorthGitLockTool());
  toolRegistry.register(new ZavorthMultiRepoTool());
  toolRegistry.register(new ZavorthDocProviderTool());
  toolRegistry.register(new ZavorthPromptLibraryTool());
  toolRegistry.register(new ZavorthTokenBudgetTool());
  toolRegistry.register(new ZavorthMemoryGraphTool());
  toolRegistry.register(new ZavorthSandboxCloudTool());
  toolRegistry.register(new ZavorthWorkflowBuilderTool());
  toolRegistry.register(new ZavorthEdgeComputingTool());
  toolRegistry.register(new ZavorthBrowserAutomationTool());
  toolRegistry.register(new ZavorthCodeFormatterTool());
  toolRegistry.register(new ZavorthDependencyAnalyzerTool());
  toolRegistry.register(new ZavorthGitAdvancedTool());
  toolRegistry.register(new ZavorthDataScienceTool());
  toolRegistry.register(new ZavorthMlOpsTool());
  toolRegistry.register(new ZavorthContainerManagerTool());
  toolRegistry.register(new ZavorthDatabaseAdminTool());
  toolRegistry.register(new ZavorthFileSystemAdvancedTool());
  toolRegistry.register(new ZavorthNetworkDiagnosticsTool());
  toolRegistry.register(new ZavorthSecurityScannerTool());
  toolRegistry.register(new ZavorthCloudStorageTool());
  toolRegistry.register(new ZavorthEmailAdvancedTool());
  toolRegistry.register(new ZavorthCalendarAdvancedTool());
  toolRegistry.register(new ZavorthNotificationTool());
  toolRegistry.register(new ZavorthApiBuilderTool());
  toolRegistry.register(new ZavorthTerminalBackendsTool());
  toolRegistry.register(new AgentManagerTool());
  toolRegistry.register(new CapabilityDiscoveryTool());

  // Multi-model consensus — user-owned panel (no product-default models)
  const consensusLlmRuntime = new LlmRuntimeService();
  toolRegistry.register(
    new AgentConsensusTool({
      llmRuntime: consensusLlmRuntime,
      projectRoot: runtimeConfig.projectRoot || process.cwd(),
    }),
  );
  toolRegistry.register(
    new ConsensusWithFallbackTool({
      llmRuntime: consensusLlmRuntime,
      projectRoot: runtimeConfig.projectRoot || process.cwd(),
    }),
  );

  // Exposes the Echo connection tool to the conversational agent with explicit credential/network governance.
  toolRegistry.register(
    new ZavorthToolAdapter(new ConnectionManageTool()),
    {
      toolName: 'connection_manage',
      surface: 'native-tool',
      capabilities: ['credential', 'network'],
      defaultRisk: 'dangerous',
      requiresConfirmation: true,
      canExfiltrateData: true,
      description: 'Manages external service connections, credentials, and OAuth flows.',
      source: 'explicit',
    },
  );

  initializeBuiltinCommands();
  let commandToolsRegistered = 0;
  for (const descriptor of globalCommandRegistry.listAll()) {
    if (toolRegistry.getTool(descriptor.toolName)) {
      logger.warn(`[BOOT] command tool name collision, skipping: ${descriptor.toolName}`);
      continue;
    }
    toolRegistry.register(
      new CommandBackedTool(descriptor),
      buildCommandSecurityDefinition(descriptor),
    );
    commandToolsRegistered += 1;
  }

  toolRegistry.assertNoFallbackSecurityDefinitions();

  logger.info('[BOOT] tools-ready (' + toolRegistry.size + ' tools registered)');
  if (commandToolsRegistered > 0) {
    logger.info(`[BOOT] commands-ready (${commandToolsRegistered} universal command tools registered)`);
  }
  const telemetryRuntime = new TelemetryRuntimeService();
  const hookPipelineService = new ToolHookPipelineService();
  const spineDisposers: Array<() => void> = [];
  if (!ServiceRegistry.has(ServiceTokens.TelemetryRuntimeService)) {
    spineDisposers.push(
      ServiceRegistry.registerDisposable(ServiceTokens.TelemetryRuntimeService, telemetryRuntime),
    );
  }
  if (!ServiceRegistry.has(ServiceTokens.ToolHookPipelineService)) {
    spineDisposers.push(
      ServiceRegistry.registerDisposable(ServiceTokens.ToolHookPipelineService, hookPipelineService),
    );
  }
  try {
    setPluginOsHookPipeline(hookPipelineService);
  } catch {
    /* optional plugin OS hook surface */
  }
  const memoryConsolidator = new ZavorthMemoryConsolidator(hookPipelineService);
  memoryConsolidator.register();

  const toolExecutor = new ToolExecutor(toolRegistry, logRepo, telemetryRuntime, {
    hookPipelineService,
  });
  const runtimeComposition = new RuntimeCompositionService({
    toolRegistry,
    toolExecutor,
    telemetryRuntime,
  });

  // ── Plugin services (runtime) ──
  const activeMemory = new ActiveMemoryService();
  const prometheusMetrics = new DiagnosticsPrometheusService();
  const kanbanDispatcher = new KanbanSQLiteDispatcherService();
  const lanceDbMemory = new MemoryLanceDBService();
  const honchoMemory = new MemoryHonchoService();
  const otelDiagnostics = new DiagnosticsOtelService();
  const achievements = new AchievementsService();
  const skinEngine = new SkinEngineService();
  const trajectoryResearch = new TrajectoryResearchService();
  const diskCleanup = new DiskCleanupService();
  const codexSupervisor = new CodexSupervisorService();
  const playwrightBrowser = new BrowserPlaywrightService();
  const exaSearch = new SearchExaService();
  const qdrantMemory = new MemoryQdrantService();
  const llmRouter = new LLMRouterService();
  const contextCompressor = new ContextCompressorService();
  const reasoningEffort = new ReasoningEffortService();
  const promptCache = new PromptCacheService();
  const llmSelfEditContext = new LLMSelfEditContextService();
  const llmModelSwitcher = new LLMModelSwitcherService();
  const llmDriftDetector = new LLMDriftDetectorService();
  const streamingLLM = new StreamingLLMService();
  const autoSkillGenerator = new AutoSkillGeneratorService();
  const zavorthVision = new ZavorthVisionService();
  const zavorthAudioAnalyzer = new ZavorthAudioAnalyzerService();
  const zavorthVideoAnalyzer = new ZavorthVideoAnalyzerService();
  const usageAnalytics = new UsageAnalyticsService();
  const costAnalytics = new CostAnalyticsService();
  const qualityMetrics = new QualityMetricsService();
  const multiUser = new MultiUserService();
  const sharedWorkspace = new SharedWorkspaceService();
  const roleBasedAccess = new RoleBasedAccessService();
  const circuitBreaker = new CircuitBreakerService();
  const retryService = new RetryService();
  const healthCheck = new HealthCheckService();
  const backupService = new BackupService();
  const pluginMarketplace = new ZavorthPluginMarketplaceService();
  const documentIntelligence = new DocumentIntelligenceService();
  const codeIntelligence = new CodeIntelligenceService();
  const dataPipeline = new DataPipelineService();
  const notificationCenter = new NotificationCenterService();
  const versionControl = new VersionControlService();
  const memorySupermemory = new MemorySupermemoryService();
  const memoryByterover = new MemoryByteroverService();
  const memoryHindsight = new MemoryHindsightService();
  const memoryHolographic = new MemoryHolographicService();
  const memoryRetainDB = new MemoryRetainDBService();
  const memorySemanticCache = new MemorySemanticCacheService();
  const companionIOS = new CompanionIOSService();
  const companionAndroid = new CompanionAndroidService();

  logger.info('[BOOT] plugins-ready (55 services + 10 tools)');


  const pluginOsProjectRoot = runtimeConfig?.projectRoot || process.env.ZAVORTH_PROJECT_ROOT || process.cwd();
  const pluginOsRegistry = new PluginRegistryService();
  const pluginOsBridge = new PluginStateBridgeService({ projectRoot: pluginOsProjectRoot });
  const mcpRuntime = new McpRuntimeService(toolRegistry, logRepo);
  try {
    setPluginOsMcpRuntime(mcpRuntime);
  } catch {
    /* soft-fail */
  }

  const pluginOsWireAdapters = createPluginOsWireAdapterStores();

  const pluginOsRuntime = new PluginRuntimeService({
    projectRoot: pluginOsProjectRoot,
    pluginRegistry: pluginOsRegistry,
    stateBridge: pluginOsBridge,
    wireTargets: {
      pluginRegistry: pluginOsRegistry,
      toolRegistry,
      hookPipeline: hookPipelineService,
      // Capture channel/memory/provider plugin bindings (soft host stores)
      channelAdapters: pluginOsWireAdapters.channelAdapters,
      memoryBackends: pluginOsWireAdapters.memoryBackends,
      providers: pluginOsWireAdapters.providers,
    },
  });

  const pluginOsBootstrapCatalog = new PluginOsBootstrapCatalogService({
    projectRoot: pluginOsProjectRoot,
    stateBridge: pluginOsBridge,
  });
  const pluginOsObservability = new PluginOsObservabilityService({
    projectRoot: pluginOsProjectRoot,
    stateBridge: pluginOsBridge,
  });
  let pluginOsBootstrapCatalogResult = null;
  try {
    pluginOsBootstrapCatalogResult = pluginOsBootstrapCatalog.apply({ root: pluginOsProjectRoot });
    try {
      pluginOsObservability.recordBootstrapResult(pluginOsBootstrapCatalogResult, pluginOsProjectRoot);
    } catch {
      /* soft-fail metrics */
    }
    if (pluginOsBootstrapCatalogResult?.enabled?.length) {
      logger.info(`[BOOT] plugin-os-catalog enabled=${pluginOsBootstrapCatalogResult.enabled.length}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[BOOT] plugin-os catalog apply failed: ${message}`);
  }

  let pluginOsDiscovery = null;
  try {
    pluginOsDiscovery = pluginOsRuntime.discover();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[BOOT] plugin-os discovery failed: ${message}`);
  }

  const pluginOsWatch = new PluginOsRuntimeWatchService({
    projectRoot: pluginOsProjectRoot,
    runtime: pluginOsRuntime,
  });
  // Avoid late async BOOT logs / requires after tests or dispose tear down.
  let toolRuntimeDisposed = false;
  let pluginOsBootstrapPromise: Promise<{ summary?: { loaded?: number; wired?: number; failed?: number } } | null> = Promise.resolve(null);
  if (process.env.ZAVORTH_PLUGIN_OS_RUNTIME !== '0') {
    pluginOsBootstrapPromise = pluginOsRuntime
      .bootstrap({
        targets: {
          pluginRegistry: pluginOsRegistry,
          toolRegistry,
          hookPipeline: hookPipelineService,
          channelAdapters: pluginOsWireAdapters.channelAdapters,
          memoryBackends: pluginOsWireAdapters.memoryBackends,
          providers: pluginOsWireAdapters.providers,
        },
      })
      .then((snap: { summary?: { loaded?: number; wired?: number } }) => {
        if (toolRuntimeDisposed) return snap;
        logger.info(`[BOOT] plugin-os-ready (loaded=${snap?.summary?.loaded ?? 0} wired=${snap?.summary?.wired ?? 0})`);
        try {
          const adapterSnap = pluginOsWireAdapters.snapshot();
          if (!toolRuntimeDisposed) {
            logger.info(
              `[BOOT] plugin-os-adapters channels=${adapterSnap.channels.length} memory=${adapterSnap.memoryBackends.length} providers=${adapterSnap.providers.length}`,
            );
          }
        } catch {
          /* soft */
        }
        return snap;
      })
      .catch((error: unknown) => {
        if (toolRuntimeDisposed) return null;
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`[BOOT] plugin-os bootstrap failed: ${message}`);
        return null;
      });
  }
  try {
    setPluginOsReadyPromise(pluginOsBootstrapPromise);
  } catch {
    /* soft */
  }

  // After Plugin OS wires tools, drop phantom skill tool names from firewall maps.
  void pluginOsBootstrapPromise.then(() => {
    if (toolRuntimeDisposed) return;
    try {
      const reconcile = bridge?.reconcileSkillToolsWithRegistry;
      if (typeof reconcile !== 'function') return;
      const result = reconcile(toolRegistry);
      if (!toolRuntimeDisposed && result?.dropped?.length) {
        logger.info(`[BOOT] skill-tool-reconcile dropped=${result.dropped.length} kept=${result.kept?.length ?? 0}`);
      }
    } catch (error: unknown) {
      if (toolRuntimeDisposed) return;
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`[BOOT] skill-tool-reconcile soft-failed: ${message}`);
    }
  });

  // Non-blocking: after bootstrap settles, optionally start package dir watches + persist metrics.
  void pluginOsBootstrapPromise.then(
    (snap: { summary?: { loaded?: number; wired?: number; failed?: number } } | null) => {
      if (toolRuntimeDisposed) return;
      try {
        const watchResult = pluginOsWatch.start();
        if (watchResult.started) {
          logger.info(`[BOOT] plugin-os-watch started (watching=${watchResult.watching})`);
        }
      } catch (error: unknown) {
        if (toolRuntimeDisposed) return;
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`[BOOT] plugin-os-watch failed: ${message}`);
      }
      if (toolRuntimeDisposed) return;
      try {
        const persisted = pluginOsObservability.persistSnapshot(pluginOsProjectRoot);
        if (!toolRuntimeDisposed && persisted.ok) {
          logger.info(
            `[BOOT] plugin-os-metrics health=${persisted.snapshot.health} loaded=${snap?.summary?.loaded ?? 'n/a'} path=${persisted.path}`,
          );
        }
        if (toolRuntimeDisposed) return;
        try {
          const telemetry = new PluginOsTelemetryService({
            projectRoot: pluginOsProjectRoot,
            observability: pluginOsObservability,
          });
          telemetry.recordSample({ root: pluginOsProjectRoot, snapshot: persisted.snapshot });
          telemetry.recordEvent('bootstrap', {
            root: pluginOsProjectRoot,
            health: persisted.snapshot.health,
            counts: {
              loaded: Number(snap?.summary?.loaded || 0),
              wired: Number(snap?.summary?.wired || 0),
              enabled: persisted.snapshot.funnel.enabled,
            },
          });
        } catch {
          /* soft-fail telemetry */
        }
      } catch (error: unknown) {
        if (toolRuntimeDisposed) return;
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`[BOOT] plugin-os-metrics failed: ${message}`);
      }
    },
  );
  const dispose = () => {
    toolRuntimeDisposed = true;
    for (const spineDisposer of spineDisposers.reverse()) {
      try {
        spineDisposer();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`[BOOT] spine service disposer failed: ${message}`);
      }
    }
    try {
      void runPluginOsHook({ event: 'shutdown.before', context: { source: 'bootstrapToolRuntime.dispose' } });
      setPluginOsHookPipeline(null);
    } catch {
      /* ignore */
    }
    try {
      clearMcp(null);
    } catch {
      /* ignore */
    }
    try {
      pluginOsWatch.dispose();
    } catch (error: unknown) {
      /* ignore */
    }
    try {
      kanbanDispatcher.close();
    } catch (error: unknown) {
      /* ignore */
    }
    try {
      pluginOsRuntime.dispose();
    } catch (error: unknown) {
      /* ignore */
    }
  };

  return {
    runtimeComposition,
    toolRegistry,
    toolRuntime: runtimeComposition.getToolRuntime(),
    runtimeToolCatalogService: new ToolCatalogService(toolRegistry),
    mcpRuntime,
    mcpCapabilityControlPlaneService: new McpCapabilityControlPlaneService(),
    plugins: {
      activeMemory,
      prometheusMetrics,
      kanbanDispatcher,
      lanceDbMemory,
      honchoMemory,
      otelDiagnostics,
      achievements,
      skinEngine,
      trajectoryResearch,
      diskCleanup,
      codexSupervisor,
      playwrightBrowser,
      exaSearch,
      qdrantMemory,
      llmRouter,
      contextCompressor,
      reasoningEffort,
      promptCache,
      llmSelfEditContext,
      llmModelSwitcher,
      llmDriftDetector,
      streamingLLM,
      autoSkillGenerator,
      zavorthVision,
      zavorthAudioAnalyzer,
      zavorthVideoAnalyzer,
      usageAnalytics,
      costAnalytics,
      qualityMetrics,
      multiUser,
      sharedWorkspace,
      roleBasedAccess,
      circuitBreaker,
      retryService,
      healthCheck,
      backupService,
      pluginMarketplace,
      documentIntelligence,
      codeIntelligence,
      dataPipeline,
      notificationCenter,
      versionControl,
      memorySupermemory,
      memoryByterover,
      memoryHindsight,
      memoryHolographic,
      memoryRetainDB,
      memorySemanticCache,
      companionIOS,
      companionAndroid,
    },
    pluginOs: {
      registry: pluginOsRegistry,
      runtime: pluginOsRuntime,
      discovery: pluginOsDiscovery,
      bridge: pluginOsBridge,
      ready: pluginOsBootstrapPromise,
      waitUntilReady: (timeoutMs?: number) => {
        return waitForPluginOsReady({ timeoutMs });
      },
      wireAdapters: pluginOsWireAdapters,
      watch: pluginOsWatch,
      bootstrapCatalog: pluginOsBootstrapCatalog,
      bootstrapCatalogResult: pluginOsBootstrapCatalogResult,
      observability: pluginOsObservability,
    },
    dispose,
  };
}
