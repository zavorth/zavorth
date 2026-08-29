import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'node:module';

const requireFromTest = createRequire(__filename);
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tool-batch2-'));

type ToolModuleSpec = {
  toolName: string;
  modulePath: string;
  exportName: string;
  expectedId?: string;
};

const TOOL_SPECS: ToolModuleSpec[] = [
  { toolName: 'ZavorthEdgeComputingTool', modulePath: '../../src/tools/ZavorthEdgeComputingTool', exportName: 'ZavorthEdgeComputingTool', expectedId: 'zavorth_edge_computing' },
  { toolName: 'ZavorthEmailAdvancedTool', modulePath: '../../src/tools/ZavorthEmailAdvancedTool', exportName: 'ZavorthEmailAdvancedTool', expectedId: 'zavorth_email_advanced' },
  { toolName: 'ZavorthFileSystemAdvancedTool', modulePath: '../../src/tools/ZavorthFileSystemAdvancedTool', exportName: 'ZavorthFileSystemAdvancedTool', expectedId: 'zavorth_file_system_advanced' },
  { toolName: 'ZavorthGitAdvancedTool', modulePath: '../../src/tools/ZavorthGitAdvancedTool', exportName: 'ZavorthGitAdvancedTool', expectedId: 'zavorth_git_advanced' },
  { toolName: 'ZavorthMcpMarketplaceTool', modulePath: '../../src/tools/ZavorthMcpMarketplaceTool', exportName: 'ZavorthMcpMarketplaceTool', expectedId: 'zavorth_mcp_marketplace' },
  { toolName: 'ZavorthMemoryGraphTool', modulePath: '../../src/tools/ZavorthMemoryGraphTool', exportName: 'ZavorthMemoryGraphTool', expectedId: 'zavorth_memory_graph' },
  { toolName: 'ZavorthMlOpsTool', modulePath: '../../src/tools/ZavorthMlOpsTool', exportName: 'ZavorthMlOpsTool', expectedId: 'zavorth_ml_ops' },
  { toolName: 'ZavorthMultiRepoTool', modulePath: '../../src/tools/ZavorthMultiRepoTool', exportName: 'ZavorthMultiRepoTool', expectedId: 'zavorth_multi_repo' },
  { toolName: 'ZavorthNetworkDiagnosticsTool', modulePath: '../../src/tools/ZavorthNetworkDiagnosticsTool', exportName: 'ZavorthNetworkDiagnosticsTool', expectedId: 'zavorth_network_diagnostics' },
  { toolName: 'ZavorthNotificationTool', modulePath: '../../src/tools/ZavorthNotificationTool', exportName: 'ZavorthNotificationTool', expectedId: 'zavorth_notification' },
  { toolName: 'ZavorthPrivacyVaultTool', modulePath: '../../src/tools/ZavorthPrivacyVaultTool', exportName: 'ZavorthPrivacyVaultTool', expectedId: 'zavorth_privacy_vault' },
  { toolName: 'ZavorthPromptLibraryTool', modulePath: '../../src/tools/ZavorthPromptLibraryTool', exportName: 'ZavorthPromptLibraryTool', expectedId: 'zavorth_prompt_library' },
  { toolName: 'ZavorthRagBuilderTool', modulePath: '../../src/tools/ZavorthRagBuilderTool', exportName: 'ZavorthRagBuilderTool', expectedId: 'zavorth_rag_builder' },
  { toolName: 'ZavorthSandboxCloudTool', modulePath: '../../src/tools/ZavorthSandboxCloudTool', exportName: 'ZavorthSandboxCloudTool', expectedId: 'zavorth_sandbox_cloud' },
  { toolName: 'ZavorthSecurityScannerTool', modulePath: '../../src/tools/ZavorthSecurityScannerTool', exportName: 'ZavorthSecurityScannerTool', expectedId: 'zavorth_security_scanner' },
  { toolName: 'ZavorthTokenBudgetTool', modulePath: '../../src/tools/ZavorthTokenBudgetTool', exportName: 'ZavorthTokenBudgetTool', expectedId: 'zavorth_token_budget' },
  { toolName: 'ZavorthWorkflowBuilderTool', modulePath: '../../src/tools/ZavorthWorkflowBuilderTool', exportName: 'ZavorthWorkflowBuilderTool', expectedId: 'zavorth_workflow_builder' },
  { toolName: 'ZavorthActionTool', modulePath: '../../src/tools/ZavorthActionTool', exportName: 'ZavorthActionTool' },
  { toolName: 'EchoHandsTool', modulePath: '../../src/tools/ToolRuntimeHandsTool', exportName: 'EchoHandsTool' },
  { toolName: 'ConfigureLlmProfileTool', modulePath: '../../src/tools/ConfigureLlmProfileTool', exportName: 'ConfigureLlmProfileTool' },
  { toolName: 'MediaAnalysisTool', modulePath: '../../src/tools/MediaAnalysisTool', exportName: 'MediaAnalysisTool' },
  { toolName: 'NodeMeshTool', modulePath: '../../src/tools/NodeMeshTool', exportName: 'NodeMeshTool' },
  { toolName: 'KanbanTool', modulePath: '../../src/tools/KanbanTool', exportName: 'KanbanTool' },
  { toolName: 'RemoteShellTool', modulePath: '../../src/tools/RemoteShellTool', exportName: 'RemoteShellTool' },
  { toolName: 'SandboxExecutionTool', modulePath: '../../src/tools/SandboxExecutionTool', exportName: 'SandboxExecutionTool' },
  { toolName: 'CreateFileTool', modulePath: '../../src/tools/CreateFileTool', exportName: 'CreateFileTool', expectedId: 'create_file' },
  { toolName: 'ReadFileTool', modulePath: '../../src/tools/ReadFileTool', exportName: 'ReadFileTool', expectedId: 'read_file' },
  { toolName: 'ListDirectoryTool', modulePath: '../../src/tools/ListDirectoryTool', exportName: 'ListDirectoryTool', expectedId: 'list_directory' },
];

describe('Tool Tests - Batch 2 (Tools E-Z)', () => {
  let dir: string;
  beforeEach(() => { dir = tmpDir(); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  for (const spec of TOOL_SPECS) {
    describe(spec.toolName, () => {
      it('loads and creates instance', () => {
        const mod = requireFromTest(spec.modulePath);
        const ToolConstructor = mod[spec.exportName];
        expect(ToolConstructor).toEqual(expect.any(Function));
        const tool = new ToolConstructor();
        expect(tool).toBeDefined();
        if (spec.expectedId) {
          expect(tool.name).toBe(spec.expectedId);
        }
      });
    });
  }
});
