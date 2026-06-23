import fs from 'fs';
import path from 'path';

import { ToolRegistry } from '../../src/tools/ToolRegistry';
import { BaseTool } from '../../src/tools/BaseTool';

import { ZavorthCronSchedulerTool } from '../../src/tools/ZavorthCronSchedulerTool';
import { ZavorthDelegateTool } from '../../src/tools/ZavorthDelegateTool';
import { ZavorthComputerUseTool } from '../../src/tools/ZavorthComputerUseTool';
import { ZavorthVoiceModeTool } from '../../src/tools/ZavorthVoiceModeTool';
import { ZavorthSessionSearchTool } from '../../src/tools/ZavorthSessionSearchTool';
import { ZavorthChannelSendTool } from '../../src/tools/ZavorthChannelSendTool';
import { ZavorthDocumentExtractorTool } from '../../src/tools/ZavorthDocumentExtractorTool';
import { ZavorthTtsTool } from '../../src/tools/ZavorthTtsTool';
import { ZavorthSttTool } from '../../src/tools/ZavorthSttTool';
import { ZavorthReceiptSearchTool } from '../../src/tools/ZavorthReceiptSearchTool';
import { ZavorthPolicyEnforcerTool } from '../../src/tools/ZavorthPolicyEnforcerTool';
import { ZavorthApiClientTool } from '../../src/tools/ZavorthApiClientTool';
import { ZavorthTrajectoryExportTool } from '../../src/tools/ZavorthTrajectoryExportTool';
import { ZavorthDockerComposeTool } from '../../src/tools/ZavorthDockerComposeTool';
import { ZavorthCodeIntelligenceTool } from '../../src/tools/ZavorthCodeIntelligenceTool';
import { ZavorthSshTunnelTool } from '../../src/tools/ZavorthSshTunnelTool';
import { ZavorthChartGeneratorTool } from '../../src/tools/ZavorthChartGeneratorTool';
import { ZavorthFileWatcherTool } from '../../src/tools/ZavorthFileWatcherTool';
import { ZavorthNetworkTool } from '../../src/tools/ZavorthNetworkTool';
import { ZavorthWebhookReceiverTool } from '../../src/tools/ZavorthWebhookReceiverTool';
import { ZavorthMcpMarketplaceTool } from '../../src/tools/ZavorthMcpMarketplaceTool';
import { ZavorthAgentGovernanceTool } from '../../src/tools/ZavorthAgentGovernanceTool';
import { ZavorthRagBuilderTool } from '../../src/tools/ZavorthRagBuilderTool';
import { ZavorthAgentEvalTool } from '../../src/tools/ZavorthAgentEvalTool';
import { ZavorthPrivacyVaultTool } from '../../src/tools/ZavorthPrivacyVaultTool';
import { ZavorthMultiRepoTool } from '../../src/tools/ZavorthMultiRepoTool';
import { ZavorthDocProviderTool } from '../../src/tools/ZavorthDocProviderTool';
import { ZavorthPromptLibraryTool } from '../../src/tools/ZavorthPromptLibraryTool';
import { ZavorthTokenBudgetTool } from '../../src/tools/ZavorthTokenBudgetTool';
import { ZavorthMemoryGraphTool } from '../../src/tools/ZavorthMemoryGraphTool';
import { ZavorthSandboxCloudTool } from '../../src/tools/ZavorthSandboxCloudTool';
import { ZavorthWorkflowBuilderTool } from '../../src/tools/ZavorthWorkflowBuilderTool';
import { ZavorthEdgeComputingTool } from '../../src/tools/ZavorthEdgeComputingTool';

const ALL_TOOL_FACTORIES: Array<{ name: string; Factory: new (...args: any[]) => BaseTool }> = [
  { name: 'ZavorthCronSchedulerTool', Factory: ZavorthCronSchedulerTool as any },
  { name: 'ZavorthDelegateTool', Factory: ZavorthDelegateTool as any },
  { name: 'ZavorthComputerUseTool', Factory: ZavorthComputerUseTool as any },
  { name: 'ZavorthVoiceModeTool', Factory: ZavorthVoiceModeTool as any },
  { name: 'ZavorthSessionSearchTool', Factory: ZavorthSessionSearchTool as any },
  { name: 'ZavorthChannelSendTool', Factory: ZavorthChannelSendTool as any },
  { name: 'ZavorthDocumentExtractorTool', Factory: ZavorthDocumentExtractorTool as any },
  { name: 'ZavorthTtsTool', Factory: ZavorthTtsTool as any },
  { name: 'ZavorthSttTool', Factory: ZavorthSttTool as any },
  { name: 'ZavorthReceiptSearchTool', Factory: ZavorthReceiptSearchTool as any },
  { name: 'ZavorthPolicyEnforcerTool', Factory: ZavorthPolicyEnforcerTool as any },
  { name: 'ZavorthApiClientTool', Factory: ZavorthApiClientTool as any },
  { name: 'ZavorthTrajectoryExportTool', Factory: ZavorthTrajectoryExportTool as any },
  { name: 'ZavorthDockerComposeTool', Factory: ZavorthDockerComposeTool as any },
  { name: 'ZavorthCodeIntelligenceTool', Factory: ZavorthCodeIntelligenceTool as any },
  { name: 'ZavorthSshTunnelTool', Factory: ZavorthSshTunnelTool as any },
  { name: 'ZavorthChartGeneratorTool', Factory: ZavorthChartGeneratorTool as any },
  { name: 'ZavorthFileWatcherTool', Factory: ZavorthFileWatcherTool as any },
  { name: 'ZavorthNetworkTool', Factory: ZavorthNetworkTool as any },
  { name: 'ZavorthWebhookReceiverTool', Factory: ZavorthWebhookReceiverTool as any },
  { name: 'ZavorthMcpMarketplaceTool', Factory: ZavorthMcpMarketplaceTool as any },
  { name: 'ZavorthAgentGovernanceTool', Factory: ZavorthAgentGovernanceTool as any },
  { name: 'ZavorthRagBuilderTool', Factory: ZavorthRagBuilderTool as any },
  { name: 'ZavorthAgentEvalTool', Factory: ZavorthAgentEvalTool as any },
  { name: 'ZavorthPrivacyVaultTool', Factory: ZavorthPrivacyVaultTool as any },
  { name: 'ZavorthMultiRepoTool', Factory: ZavorthMultiRepoTool as any },
  { name: 'ZavorthDocProviderTool', Factory: ZavorthDocProviderTool as any },
  { name: 'ZavorthPromptLibraryTool', Factory: ZavorthPromptLibraryTool as any },
  { name: 'ZavorthTokenBudgetTool', Factory: ZavorthTokenBudgetTool as any },
  { name: 'ZavorthMemoryGraphTool', Factory: ZavorthMemoryGraphTool as any },
  { name: 'ZavorthSandboxCloudTool', Factory: ZavorthSandboxCloudTool as any },
  { name: 'ZavorthWorkflowBuilderTool', Factory: ZavorthWorkflowBuilderTool as any },
  { name: 'ZavorthEdgeComputingTool', Factory: ZavorthEdgeComputingTool as any },
];

describe('BootstrapComplete — Bootstrap configuration validation', () => {
  describe('ToolRegistry — All tools register correctly', () => {
    let registry: ToolRegistry;

    beforeEach(() => {
      registry = new ToolRegistry();
    });

    it('ToolRegistry can be instantiated', () => {
      expect(registry).toBeDefined();
      expect(registry).toBeInstanceOf(ToolRegistry);
    });

    it('empty registry should have size 0', () => {
      expect(registry.size).toBe(0);
    });

    it.each(ALL_TOOL_FACTORIES)('$Factory name can be registered', ({ Factory }) => {
      const tool = new Factory();
      registry.register(tool);
      expect(registry.getTool(tool.name)).toBeDefined();
    });

    it('registering all tools should result in correct count', () => {
      for (const { Factory } of ALL_TOOL_FACTORIES) {
        registry.register(new Factory());
      }
      expect(registry.size).toBe(ALL_TOOL_FACTORIES.length);
    });

    it('all registered tools should be retrievable by name', () => {
      for (const { Factory } of ALL_TOOL_FACTORIES) {
        const tool = new Factory();
        registry.register(tool);
        const retrieved = registry.getTool(tool.name);
        expect(retrieved).toBeDefined();
        expect(retrieved!.name).toBe(tool.name);
      }
    });

    it('getToolDefinitions() should return all definitions', () => {
      for (const { Factory } of ALL_TOOL_FACTORIES) {
        registry.register(new Factory());
      }
      const defs = registry.getToolDefinitions();
      expect(defs.length).toBe(ALL_TOOL_FACTORIES.length);
      for (const def of defs) {
        expect(def.name).toBeDefined();
        expect(def.description).toBeDefined();
        expect(def.parameters).toBeDefined();
      }
    });

    it('getAllTools() should return all tools', () => {
      for (const { Factory } of ALL_TOOL_FACTORIES) {
        registry.register(new Factory());
      }
      const tools = registry.getAllTools();
      expect(tools.length).toBe(ALL_TOOL_FACTORIES.length);
    });

    it('duplicate registration should warn but replace', () => {
      const tool = new ZavorthCronSchedulerTool();
      registry.register(tool);
      registry.register(tool);
      expect(registry.size).toBe(1);
    });

    it('getTool() for non-existent should return undefined', () => {
      expect(registry.getTool('nonexistent_tool_xyz')).toBeUndefined();
    });

    it('security definitions should be populated for registered tools', () => {
      for (const { Factory } of ALL_TOOL_FACTORIES) {
        registry.register(new Factory());
      }
      const secDefs = registry.getAllToolSecurityDefinitions();
      expect(secDefs.length).toBe(ALL_TOOL_FACTORIES.length);
      for (const secDef of secDefs) {
        expect(secDef.toolName).toBeDefined();
        expect(secDef.capabilities).toBeDefined();
        expect(Array.isArray(secDef.capabilities)).toBe(true);
      }
    });

    it('getToolSecurityDefinition() should return definition for registered tool', () => {
      const tool = new ZavorthPolicyEnforcerTool();
      registry.register(tool);
      const secDef = registry.getToolSecurityDefinition(tool.name);
      expect(secDef).toBeDefined();
      expect(secDef!.toolName).toBe(tool.name);
    });

    it('getSecurityCatalogAudit() should return audit data', () => {
      for (const { Factory } of ALL_TOOL_FACTORIES) {
        registry.register(new Factory());
      }
      const audit = registry.getSecurityCatalogAudit();
      expect(audit.totalTools).toBe(ALL_TOOL_FACTORIES.length);
      expect(Array.isArray(audit.explicitDefinitions)).toBe(true);
      expect(Array.isArray(audit.fallbackDefinitions)).toBe(true);
      expect(Array.isArray(audit.inferredDefinitions)).toBe(true);
    });
  });

  describe('Source files exist and are importable', () => {
    const srcDir = path.resolve(__dirname, '../../src');
    const toolsDir = path.join(srcDir, 'tools');
    const pluginsDir = path.join(srcDir, 'services/plugins');

    it('src/tools directory should exist', () => {
      expect(fs.existsSync(toolsDir)).toBe(true);
    });

    it('src/services/plugins directory should exist', () => {
      expect(fs.existsSync(pluginsDir)).toBe(true);
    });

    it('BaseTool.ts should exist', () => {
      expect(fs.existsSync(path.join(toolsDir, 'BaseTool.ts'))).toBe(true);
    });

    it('ToolRegistry.ts should exist', () => {
      expect(fs.existsSync(path.join(toolsDir, 'ToolRegistry.ts'))).toBe(true);
    });

    it.each(ALL_TOOL_FACTORIES)('$Factory name source file should exist', ({ name }) => {
      const filePath = path.join(toolsDir, `${name}.ts`);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    const PLUGIN_FILES = [
      'ActiveMemoryService',
      'DiagnosticsPrometheusService',
      'KanbanSQLiteDispatcherService',
      'MemoryLanceDBService',
      'MemoryHonchoService',
      'DiagnosticsOtelService',
      'AchievementsService',
      'SkinEngineService',
      'TrajectoryResearchService',
      'DiskCleanupService',
      'CodexSupervisorService',
      'LLMRouterService',
      'ContextCompressorService',
      'ReasoningEffortService',
      'PromptCacheService',
    ];

    it.each(PLUGIN_FILES)('%s.ts plugin source file should exist', (name) => {
      const filePath = path.join(pluginsDir, `${name}.ts`);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Jest config validation', () => {
    let jestConfig: Record<string, unknown>;

    beforeAll(() => {
      const configPath = path.resolve(__dirname, '../../jest.config.js');
      jestConfig = require(configPath);
    });

    it('jest.config.js should exist and be valid', () => {
      expect(jestConfig).toBeDefined();
      expect(typeof jestConfig).toBe('object');
    });

    it('should have roots configured', () => {
      expect(jestConfig.roots).toBeDefined();
      expect(Array.isArray(jestConfig.roots)).toBe(true);
    });

    it('should have testMatch configured', () => {
      expect(jestConfig.testMatch).toBeDefined();
      expect(Array.isArray(jestConfig.testMatch)).toBe(true);
    });

    it('should have transform configured for TypeScript', () => {
      expect(jestConfig.transform).toBeDefined();
    });

    it('should have moduleNameMapper for @zavorth paths', () => {
      expect(jestConfig.moduleNameMapper).toBeDefined();
      const mapper = jestConfig.moduleNameMapper as Record<string, string>;
      const keys = Object.keys(mapper);
      expect(keys.some((k) => k.includes('zavorth'))).toBe(true);
    });

    it('should have coverage configuration', () => {
      expect(jestConfig.coverageDirectory).toBeDefined();
      expect(jestConfig.coverageReporters).toBeDefined();
    });

    it('should have testPathIgnorePatterns', () => {
      expect(jestConfig.testPathIgnorePatterns).toBeDefined();
      expect(Array.isArray(jestConfig.testPathIgnorePatterns)).toBe(true);
    });
  });

  describe('Package.json validation', () => {
    let pkgJson: Record<string, unknown>;

    beforeAll(() => {
      const pkgPath = path.resolve(__dirname, '../../package.json');
      pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    });

    it('package.json should exist', () => {
      expect(pkgJson).toBeDefined();
    });

    it('should have name field', () => {
      expect(pkgJson.name).toBeDefined();
    });

    it('should have scripts.test configured', () => {
      const scripts = pkgJson.scripts as Record<string, string>;
      expect(scripts.test).toBeDefined();
    });

    it('should have jest dependency or devDependency', () => {
      const deps = { ...(pkgJson.dependencies || {}), ...(pkgJson.devDependencies || {}) } as Record<string, string>;
      expect(deps.jest || deps['ts-jest']).toBeDefined();
    });
  });

  describe('Tool parameter schema completeness', () => {
    it.each(ALL_TOOL_FACTORIES)('$Factory name has complete schema', ({ Factory }) => {
      const tool = new Factory();
      const params = tool.parameters as Record<string, unknown>;
      expect(params.type).toBe('object');
      expect(typeof params.properties).toBe('object');
      const props = params.properties as Record<string, unknown>;
      expect(Object.keys(props).length).toBeGreaterThan(0);

      for (const [key, prop] of Object.entries(props)) {
        const p = prop as Record<string, unknown>;
        expect(p.type).toBeDefined();
        expect(typeof p.description).toBe('string');
      }
    });
  });

  describe('Tool execute returns string', () => {
    it.each(ALL_TOOL_FACTORIES)('$Factory name execute returns string', async ({ Factory }) => {
      const tool = new Factory();
      const result = await tool.execute({});
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Module resolution checks', () => {
    it('BaseTool should be importable', () => {
      expect(BaseTool).toBeDefined();
      expect(typeof BaseTool).toBe('function');
    });

    it('ToolRegistry should be importable', () => {
      expect(ToolRegistry).toBeDefined();
      expect(typeof ToolRegistry).toBe('function');
    });

    it('BaseTool should be abstract (cannot instantiate directly)', () => {
      expect(() => new (BaseTool as any)()).toThrow();
    });
  });

  describe('Tool name format validation', () => {
    it.each(ALL_TOOL_FACTORIES)('$Factory name should use snake_case naming', ({ Factory }) => {
      const tool = new Factory();
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
    });
  });
});
