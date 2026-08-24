import fs from 'fs';
import os from 'os';
import path from 'path';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tool-batch1-'));

type ToolModuleSpec = {
  toolName: string;
  modulePath: string;
  exportName: string;
  expectedId?: string;
  /** Abstract base classes whose public contract rejects direct construction. */
  throwsOnConstruct?: boolean;
};

const TOOL_SPECS: ToolModuleSpec[] = [
  { toolName: 'AutoSkillCreatorTool', modulePath: '../../src/tools/AutoSkillCreatorTool', exportName: 'AutoSkillCreatorTool' },
  { toolName: 'BaseTool', modulePath: '../../src/tools/BaseTool', exportName: 'BaseTool', throwsOnConstruct: true },
  { toolName: 'DateTimeTool', modulePath: '../../src/tools/DateTimeTool', exportName: 'DateTimeTool', expectedId: 'get_datetime' },
  { toolName: 'DesktopAutomationTool', modulePath: '../../src/tools/DesktopAutomationTool', exportName: 'DesktopAutomationTool' },
  { toolName: 'EnableMnemosTool', modulePath: '../../src/tools/EnableMnemosTool', exportName: 'EnableMnemosTool' },
  { toolName: 'ImageGenerationTool', modulePath: '../../src/tools/ImageGenerationTool', exportName: 'ImageGenerationTool' },
  { toolName: 'Mem0Tool', modulePath: '../../src/tools/Mem0Tool', exportName: 'Mem0Tool' },
  { toolName: 'PlanMnemosScopeTool', modulePath: '../../src/tools/PlanMnemosScopeTool', exportName: 'PlanMnemosScopeTool' },
  { toolName: 'QueryExternalAiTool', modulePath: '../../src/tools/QueryExternalAiTool', exportName: 'QueryExternalAiTool' },
  { toolName: 'ToolRegistry', modulePath: '../../src/tools/ToolRegistry', exportName: 'ToolRegistry' },
  { toolName: 'UnifiedSearchTool', modulePath: '../../src/tools/UnifiedSearchTool', exportName: 'UnifiedSearchTool', expectedId: 'web_search' },
  { toolName: 'ZavorthAgentEvalTool', modulePath: '../../src/tools/ZavorthAgentEvalTool', exportName: 'ZavorthAgentEvalTool', expectedId: 'zavorth_agent_eval' },
  { toolName: 'ZavorthAgentGovernanceTool', modulePath: '../../src/tools/ZavorthAgentGovernanceTool', exportName: 'ZavorthAgentGovernanceTool', expectedId: 'zavorth_agent_governance' },
  { toolName: 'ZavorthApiBuilderTool', modulePath: '../../src/tools/ZavorthApiBuilderTool', exportName: 'ZavorthApiBuilderTool', expectedId: 'zavorth_api_builder' },
  { toolName: 'ZavorthBrowserAutomationTool', modulePath: '../../src/tools/ZavorthBrowserAutomationTool', exportName: 'ZavorthBrowserAutomationTool', expectedId: 'zavorth_browser_automation' },
  { toolName: 'ZavorthCalendarAdvancedTool', modulePath: '../../src/tools/ZavorthCalendarAdvancedTool', exportName: 'ZavorthCalendarAdvancedTool', expectedId: 'zavorth_calendar_advanced' },
  { toolName: 'ZavorthCloudStorageTool', modulePath: '../../src/tools/ZavorthCloudStorageTool', exportName: 'ZavorthCloudStorageTool', expectedId: 'zavorth_cloud_storage' },
  { toolName: 'ZavorthCodeFormatterTool', modulePath: '../../src/tools/ZavorthCodeFormatterTool', exportName: 'ZavorthCodeFormatterTool', expectedId: 'zavorth_code_formatter' },
  { toolName: 'ZavorthContainerManagerTool', modulePath: '../../src/tools/ZavorthContainerManagerTool', exportName: 'ZavorthContainerManagerTool', expectedId: 'zavorth_container_manager' },
  { toolName: 'ZavorthDatabaseAdminTool', modulePath: '../../src/tools/ZavorthDatabaseAdminTool', exportName: 'ZavorthDatabaseAdminTool', expectedId: 'zavorth_database_admin' },
  { toolName: 'ZavorthDataScienceTool', modulePath: '../../src/tools/ZavorthDataScienceTool', exportName: 'ZavorthDataScienceTool', expectedId: 'zavorth_data_science' },
  { toolName: 'ZavorthDependencyAnalyzerTool', modulePath: '../../src/tools/ZavorthDependencyAnalyzerTool', exportName: 'ZavorthDependencyAnalyzerTool', expectedId: 'zavorth_dependency_analyzer' },
  { toolName: 'ZavorthDocProviderTool', modulePath: '../../src/tools/ZavorthDocProviderTool', exportName: 'ZavorthDocProviderTool', expectedId: 'zavorth_doc_provider' },
];

describe('Tool Tests - Batch 1 (Tools A-D)', () => {
  let dir: string;
  beforeEach(() => { dir = tmpDir(); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  for (const spec of TOOL_SPECS) {
    describe(spec.toolName, () => {
      it('loads and exports the tool class', async () => {
        const mod = await import(spec.modulePath);
        expect(mod[spec.exportName]).toEqual(expect.any(Function));
      });

      it('creates instance with the declared tool id', async () => {
        const mod = await import(spec.modulePath);
        const ToolConstructor = mod[spec.exportName];
        if (spec.throwsOnConstruct) {
          expect(() => new ToolConstructor()).toThrow(/abstract/i);
          return;
        }
        const instance = new ToolConstructor();
        expect(instance).toBeDefined();
        if (spec.expectedId) {
          expect(instance.name).toBe(spec.expectedId);
        }
      });
    });
  }
});
