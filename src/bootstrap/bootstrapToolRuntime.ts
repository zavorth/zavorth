import { McpRuntimeService } from '../mcp/McpRuntimeService.js';
import { TelemetryRuntimeService } from '../observability/telemetry/TelemetryRuntimeService.js';
import { McpCapabilityControlPlaneService } from '../services/McpCapabilityControlPlaneService.js';
import { RuntimeCompositionService } from '../services/RuntimeCompositionService.js';
import type { LogRepository } from '../storage/LogRepository.js';

export function createBootstrapToolRuntime(logRepo: LogRepository) {
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
  toolRegistry.assertNoFallbackSecurityDefinitions();

  console.log('[BOOT] tools-ready');
  const telemetryRuntime = new TelemetryRuntimeService();
  const toolExecutor = new ToolExecutor(toolRegistry, logRepo, telemetryRuntime);
  const runtimeComposition = new RuntimeCompositionService({
    toolRegistry,
    toolExecutor,
    telemetryRuntime,
  });

  return {
    runtimeComposition,
    toolRuntime: runtimeComposition.getToolRuntime(),
    runtimeToolCatalogService: new ToolCatalogService(toolRegistry),
    mcpRuntime: new McpRuntimeService(toolRegistry, logRepo),
    mcpCapabilityControlPlaneService: new McpCapabilityControlPlaneService(),
  };
}

