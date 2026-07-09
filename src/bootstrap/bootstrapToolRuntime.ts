import { McpRuntimeService } from '../mcp/McpRuntimeService.js';
import { TelemetryRuntimeService } from '../observability/telemetry/TelemetryRuntimeService.js';
import { McpCapabilityControlPlaneService } from '../services/McpCapabilityControlPlaneService.js';
import { RuntimeCompositionService } from '../services/RuntimeCompositionService.js';
import type { LogRepository } from '../storage/LogRepository.js';
import { ToolHookPipelineService } from '../services/ToolHookPipelineService.js';
import { ZavorthMemoryConsolidator } from '../services/ZavorthMemoryConsolidator.js';
import { logger } from '../logger.js';export function createBootstrapToolRuntime(logRepo: LogRepository) {
  const { ToolRegistry } = require('../tools/ToolRegistry.js');

  const { ToolExecutor } = require('../execution/ToolExecutor.js');
  const { ToolCatalogService } = require('../services/tools/ToolCatalogService.js');
  const { UnifiedSearchTool } = require('../tools/UnifiedSearchTool.js');
  const { CreateFileTool } = require('../tools/CreateFileTool.js');
  const { ReadFileTool } = require('../tools/ReadFileTool.js');
  const { ListDirectoryTool } = require('../tools/ListDirectoryTool.js');
  const {
    WorkspaceApplyPatchTool,
    WorkspaceEditTool,
    WorkspaceListTool,
    WorkspaceReadTool,
    WorkspaceWriteTool,
    WorkspaceCommandProposeTool,
    WorkspaceCommandRunTool,
    WorkspaceTaskMandateProposeTool,
    HostCommandProposeTool,
    HostCommandRunTool,
    PtySessionProposeTool,
    PtyWriteTool,
    PtyTerminateTool,
  } = require('../tools/workspace/index.js');
  const { DateTimeTool } = require('../tools/DateTimeTool.js');
  const { RemoteShellTool } = require('../tools/RemoteShellTool.js');
  const { QueryExternalAiTool } = require('../tools/QueryExternalAiTool.js');
  const { SandboxExecutionTool } = require('../tools/SandboxExecutionTool.js');
  const { Mem0Tool } = require('../tools/Mem0Tool.js');
  const { DesktopAutomationTool } = require('../tools/DesktopAutomationTool.js');
  const { PlanMnemosScopeTool } = require('../tools/PlanMnemosScopeTool.js');
  const { EnableMnemosTool } = require('../tools/EnableMnemosTool.js');
  const { EchoHandsTool } = require('../tools/EchoHandsTool.js');
  const { ConfigureLlmProfileTool } = require('../tools/ConfigureLlmProfileTool.js');
  const { ZavorthActionTool } = require('../tools/ZavorthActionTool.js');
  const { AutoSkillCreatorTool } = require('../tools/AutoSkillCreatorTool.js');
  const { ImageGenerationTool } = require('../tools/ImageGenerationTool.js');
  const { MediaAnalysisTool } = require('../tools/MediaAnalysisTool.js');
  const { NodeMeshTool } = require('../tools/NodeMeshTool.js');
  const { VideoGenerationTool } = require('../tools/VideoGenerationTool.js');
  const { KanbanTool } = require('../tools/KanbanTool.js');
  const { SkillFeedbackCollectorTool } = require('../tools/SkillFeedbackCollectorTool.js');
  const { BatchTrajectoryTool } = require('../tools/BatchTrajectoryTool.js');
  const { MultiBackendTerminalTool } = require('../tools/MultiBackendTerminalTool.js');
  const { EmailTool } = require('../tools/EmailTool.js');
  const { CalendarTool } = require('../tools/CalendarTool.js');
  const { CodeReviewTool } = require('../tools/CodeReviewTool.js');
  const { DatabaseQueryTool } = require('../tools/DatabaseQueryTool.js');
  const { ZavorthCronSchedulerTool } = require('../tools/ZavorthCronSchedulerTool.js');
  const { ZavorthDelegateTool } = require('../tools/ZavorthDelegateTool.js');
  const { ZavorthComputerUseTool } = require('../tools/ZavorthComputerUseTool.js');
  const { ZavorthVoiceModeTool } = require('../tools/ZavorthVoiceModeTool.js');
  const { ZavorthSessionSearchTool } = require('../tools/ZavorthSessionSearchTool.js');
  const { ZavorthChannelSendTool } = require('../tools/ZavorthChannelSendTool.js');
  const { ZavorthDocumentExtractorTool } = require('../tools/ZavorthDocumentExtractorTool.js');
  const { ZavorthTtsTool } = require('../tools/ZavorthTtsTool.js');
  const { ZavorthSttTool } = require('../tools/ZavorthSttTool.js');
  const { ZavorthReceiptSearchTool } = require('../tools/ZavorthReceiptSearchTool.js');
  const { ZavorthPolicyEnforcerTool } = require('../tools/ZavorthPolicyEnforcerTool.js');
  const { ZavorthApiClientTool } = require('../tools/ZavorthApiClientTool.js');
  const { ZavorthTrajectoryExportTool } = require('../tools/ZavorthTrajectoryExportTool.js');

  // ── Plugin tools (BaseTool) ──
  const { SecurityGuidanceService } = require('../services/plugins/SecurityGuidanceService.js');
  const { ProviderNovitaTool } = require('../services/plugins/ProviderNovitaTool.js');
  const { ProviderReplicateTool } = require('../services/plugins/ProviderReplicateTool.js');
  const { ProviderHuggingFaceTool } = require('../services/plugins/ProviderHuggingFaceTool.js');
  const { WebFirecrawlTool } = require('../services/plugins/WebFirecrawlTool.js');
  const { ImageGenFalTool } = require('../services/plugins/ImageGenFalTool.js');
  const { ImageGenComfyUITool } = require('../services/plugins/ImageGenComfyUITool.js');
  const { SearchSearXNGTool } = require('../services/plugins/SearchSearXNGTool.js');
  const { VideoGenRunwayTool } = require('../services/plugins/VideoGenRunwayTool.js');
  const { SpotifyPlayerTool } = require('../services/plugins/SpotifyPlayerTool.js');

  const { ZavorthDockerComposeTool } = require('../tools/ZavorthDockerComposeTool.js');
  const { ZavorthCodeIntelligenceTool } = require('../tools/ZavorthCodeIntelligenceTool.js');
  const { ZavorthSshTunnelTool } = require('../tools/ZavorthSshTunnelTool.js');
  const { ZavorthChartGeneratorTool } = require('../tools/ZavorthChartGeneratorTool.js');
  const { ZavorthFileWatcherTool } = require('../tools/ZavorthFileWatcherTool.js');
  const { ZavorthNetworkTool } = require('../tools/ZavorthNetworkTool.js');
  const { ZavorthWebhookReceiverTool } = require('../tools/ZavorthWebhookReceiverTool.js');

  // ── Innovative tools ──
  const { ZavorthMcpMarketplaceTool } = require('../tools/ZavorthMcpMarketplaceTool.js');
  const { ZavorthSkillMarketplaceTool } = require('../tools/ZavorthSkillMarketplaceTool.js');
  const { ZavorthAgentGovernanceTool } = require('../tools/ZavorthAgentGovernanceTool.js');
  const { ZavorthRagBuilderTool } = require('../tools/ZavorthRagBuilderTool.js');
  const { ZavorthAgentEvalTool } = require('../tools/ZavorthAgentEvalTool.js');
  const { ZavorthPrivacyVaultTool } = require('../tools/ZavorthPrivacyVaultTool.js');
  const { ZavorthGitLockTool } = require('../tools/ZavorthGitLockTool.js');

  // ── Medium priority tools ──
  const { ZavorthMultiRepoTool } = require('../tools/ZavorthMultiRepoTool.js');
  const { ZavorthDocProviderTool } = require('../tools/ZavorthDocProviderTool.js');
  const { ZavorthPromptLibraryTool } = require('../tools/ZavorthPromptLibraryTool.js');
  const { ZavorthTokenBudgetTool } = require('../tools/ZavorthTokenBudgetTool.js');
  const { ZavorthMemoryGraphTool } = require('../tools/ZavorthMemoryGraphTool.js');

  // ── Low priority tools ──
  const { ZavorthSandboxCloudTool } = require('../tools/ZavorthSandboxCloudTool.js');
  const { ZavorthWorkflowBuilderTool } = require('../tools/ZavorthWorkflowBuilderTool.js');
  const { ZavorthEdgeComputingTool } = require('../tools/ZavorthEdgeComputingTool.js');

  // ── Gap-closing tools ──
  const { ZavorthBrowserAutomationTool } = require('../tools/ZavorthBrowserAutomationTool.js');
  const { ZavorthCodeFormatterTool } = require('../tools/ZavorthCodeFormatterTool.js');
  const { ZavorthDependencyAnalyzerTool } = require('../tools/ZavorthDependencyAnalyzerTool.js');
  const { ZavorthGitAdvancedTool } = require('../tools/ZavorthGitAdvancedTool.js');
  const { ZavorthDataScienceTool } = require('../tools/ZavorthDataScienceTool.js');
  const { ZavorthMlOpsTool } = require('../tools/ZavorthMlOpsTool.js');
  const { ZavorthContainerManagerTool } = require('../tools/ZavorthContainerManagerTool.js');
  const { ZavorthDatabaseAdminTool } = require('../tools/ZavorthDatabaseAdminTool.js');
  const { ZavorthFileSystemAdvancedTool } = require('../tools/ZavorthFileSystemAdvancedTool.js');
  const { ZavorthNetworkDiagnosticsTool } = require('../tools/ZavorthNetworkDiagnosticsTool.js');
  const { ZavorthSecurityScannerTool } = require('../tools/ZavorthSecurityScannerTool.js');
  const { ZavorthCloudStorageTool } = require('../tools/ZavorthCloudStorageTool.js');
  const { ZavorthEmailAdvancedTool } = require('../tools/ZavorthEmailAdvancedTool.js');
  const { ZavorthCalendarAdvancedTool } = require('../tools/ZavorthCalendarAdvancedTool.js');
  const { ZavorthNotificationTool } = require('../tools/ZavorthNotificationTool.js');
  const { ZavorthApiBuilderTool } = require('../tools/ZavorthApiBuilderTool.js');
  const { ZavorthTerminalBackendsTool } = require('../tools/ZavorthTerminalBackendsTool.js');
  const { AgentManagerTool } = require('../tools/AgentManagerTool.js');
  const { CapabilityDiscoveryTool } = require('../tools/CapabilityDiscoveryTool.js');

  const { LLMRouterService } = require('../services/plugins/LLMRouterService.js');
  const { ContextCompressorService } = require('../services/plugins/ContextCompressorService.js');
  const { ReasoningEffortService } = require('../services/plugins/ReasoningEffortService.js');
  const { PromptCacheService } = require('../services/plugins/PromptCacheService.js');
  const { LLMSelfEditContextService } = require('../services/plugins/LLMSelfEditContextService.js');
  const { LLMModelSwitcherService } = require('../services/plugins/LLMModelSwitcherService.js');
  const { LLMDriftDetectorService } = require('../services/plugins/LLMDriftDetectorService.js');
  const { StreamingLLMService } = require('../services/plugins/StreamingLLMService.js');
  const { AutoSkillGeneratorService } = require('../services/plugins/AutoSkillGeneratorService.js');
  const { ZavorthVisionService } = require('../services/plugins/ZavorthVisionService.js');
  const { ZavorthAudioAnalyzerService } = require('../services/plugins/ZavorthAudioAnalyzerService.js');
  const { ZavorthVideoAnalyzerService } = require('../services/plugins/ZavorthVideoAnalyzerService.js');
  const { UsageAnalyticsService } = require('../services/plugins/UsageAnalyticsService.js');
  const { CostAnalyticsService } = require('../services/plugins/CostAnalyticsService.js');
  const { QualityMetricsService } = require('../services/plugins/QualityMetricsService.js');
  const { MultiUserService } = require('../services/plugins/MultiUserService.js');
  const { SharedWorkspaceService } = require('../services/plugins/SharedWorkspaceService.js');
  const { RoleBasedAccessService } = require('../services/plugins/RoleBasedAccessService.js');
  const { CircuitBreakerService } = require('../services/plugins/CircuitBreakerService.js');
  const { RetryService } = require('../services/plugins/RetryService.js');
  const { HealthCheckService } = require('../services/plugins/HealthCheckService.js');
  const { BackupService } = require('../services/plugins/BackupService.js');
  const { ZavorthPluginMarketplaceService } = require('../services/plugins/ZavorthPluginMarketplaceService.js');
  const { DocumentIntelligenceService } = require('../services/plugins/DocumentIntelligenceService.js');
  const { CodeIntelligenceService } = require('../services/plugins/CodeIntelligenceService.js');
  const { DataPipelineService } = require('../services/plugins/DataPipelineService.js');
  const { NotificationCenterService } = require('../services/plugins/NotificationCenterService.js');
  const { VersionControlService } = require('../services/plugins/VersionControlService.js');
  const { MemorySupermemoryService } = require('../services/plugins/MemorySupermemoryService.js');
  const { MemoryByteroverService } = require('../services/plugins/MemoryByteroverService.js');
  const { MemoryHindsightService } = require('../services/plugins/MemoryHindsightService.js');
  const { MemoryHolographicService } = require('../services/plugins/MemoryHolographicService.js');
  const { MemoryRetainDBService } = require('../services/plugins/MemoryRetainDBService.js');
  const { MemorySemanticCacheService } = require('../services/plugins/MemorySemanticCacheService.js');
  const { CompanionIOSService } = require('../services/plugins/CompanionIOSService.js');
  const { CompanionAndroidService } = require('../services/plugins/CompanionAndroidService.js');

  // ── Plugin services (runtime dependencies) ──
  const { ActiveMemoryService } = require('../services/plugins/ActiveMemoryService.js');
  const { DiagnosticsPrometheusService } = require('../services/plugins/DiagnosticsPrometheusService.js');
  const { KanbanSQLiteDispatcherService } = require('../services/plugins/KanbanSQLiteDispatcherService.js');
  const { MemoryLanceDBService } = require('../services/plugins/MemoryLanceDBService.js');
  const { MemoryHonchoService } = require('../services/plugins/MemoryHonchoService.js');
  const { DiagnosticsOtelService } = require('../services/plugins/DiagnosticsOtelService.js');
  const { AchievementsService } = require('../services/plugins/AchievementsService.js');
  const { SkinEngineService } = require('../services/plugins/SkinEngineService.js');
  const { TrajectoryResearchService } = require('../services/plugins/TrajectoryResearchService.js');
  const { DiskCleanupService } = require('../services/plugins/DiskCleanupService.js');
  const { CodexSupervisorService } = require('../services/plugins/CodexSupervisorService.js');
  const { BrowserPlaywrightService } = require('../services/plugins/BrowserPlaywrightService.js');
  const { SearchExaService } = require('../services/plugins/SearchExaService.js');
  const { MemoryQdrantService } = require('../services/plugins/MemoryQdrantService.js');

  const toolRegistry = new ToolRegistry();
  toolRegistry.register(new UnifiedSearchTool());
  toolRegistry.register(new CreateFileTool());
  toolRegistry.register(new ReadFileTool());
  toolRegistry.register(new ListDirectoryTool());
  toolRegistry.register(new WorkspaceReadTool());
  toolRegistry.register(new WorkspaceListTool());
  toolRegistry.register(new WorkspaceWriteTool());
  toolRegistry.register(new WorkspaceEditTool());
  toolRegistry.register(new WorkspaceApplyPatchTool());
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
  toolRegistry.register(new Mem0Tool());
  toolRegistry.register(new DesktopAutomationTool());
  toolRegistry.register(new PlanMnemosScopeTool());
  toolRegistry.register(new EnableMnemosTool());
  toolRegistry.register(new EchoHandsTool());
  toolRegistry.register(new ConfigureLlmProfileTool());
  toolRegistry.register(new ZavorthActionTool());
  toolRegistry.register(new AutoSkillCreatorTool());
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
  toolRegistry.register(new CodeReviewTool());
  toolRegistry.register(new DatabaseQueryTool());
  toolRegistry.register(new ZavorthCronSchedulerTool());
  toolRegistry.register(new ZavorthDelegateTool());
  toolRegistry.register(new ZavorthComputerUseTool());
  toolRegistry.register(new ZavorthVoiceModeTool());
  toolRegistry.register(new ZavorthSessionSearchTool());
  toolRegistry.register(new ZavorthChannelSendTool());
  toolRegistry.register(new ZavorthDocumentExtractorTool());
  toolRegistry.register(new ZavorthTtsTool());
  toolRegistry.register(new ZavorthSttTool());
  toolRegistry.register(new ZavorthReceiptSearchTool());
  toolRegistry.register(new ZavorthPolicyEnforcerTool());
  toolRegistry.register(new ZavorthApiClientTool());
  toolRegistry.register(new ZavorthTrajectoryExportTool());

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

  toolRegistry.assertNoFallbackSecurityDefinitions();

  logger.info('[BOOT] tools-ready (' + toolRegistry.size + ' tools registered)');
  const telemetryRuntime = new TelemetryRuntimeService();
  const hookPipelineService = new ToolHookPipelineService();
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

  const dispose = () => {
    try { kanbanDispatcher.close(); } catch (error: unknown) {/* ignore */ }
  };

  return {
    runtimeComposition,
    toolRuntime: runtimeComposition.getToolRuntime(),
    runtimeToolCatalogService: new ToolCatalogService(toolRegistry),
    mcpRuntime: new McpRuntimeService(toolRegistry, logRepo),
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
    dispose,
  };
}


