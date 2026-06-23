import fs from 'fs';
import path from 'path';
import os from 'os';

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
import { BaseTool } from '../../src/tools/BaseTool';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-test-'));
}

function isValidJsonSchema(schema: unknown): boolean {
  if (!schema || typeof schema !== 'object') return false;
  const s = schema as Record<string, unknown>;
  if (s.type !== 'object') return false;
  if (!s.properties || typeof s.properties !== 'object') return false;
  return true;
}

const TOOLS_TO_TEST: Array<{ name: string; Factory: new (...args: any[]) => BaseTool; hasAction: boolean }> = [
  { name: 'ZavorthCronSchedulerTool', Factory: ZavorthCronSchedulerTool as any, hasAction: true },
  { name: 'ZavorthDelegateTool', Factory: ZavorthDelegateTool as any, hasAction: true },
  { name: 'ZavorthComputerUseTool', Factory: ZavorthComputerUseTool as any, hasAction: true },
  { name: 'ZavorthVoiceModeTool', Factory: ZavorthVoiceModeTool as any, hasAction: true },
  { name: 'ZavorthSessionSearchTool', Factory: ZavorthSessionSearchTool as any, hasAction: true },
  { name: 'ZavorthChannelSendTool', Factory: ZavorthChannelSendTool as any, hasAction: true },
  { name: 'ZavorthDocumentExtractorTool', Factory: ZavorthDocumentExtractorTool as any, hasAction: true },
  { name: 'ZavorthTtsTool', Factory: ZavorthTtsTool as any, hasAction: true },
  { name: 'ZavorthSttTool', Factory: ZavorthSttTool as any, hasAction: true },
  { name: 'ZavorthReceiptSearchTool', Factory: ZavorthReceiptSearchTool as any, hasAction: true },
  { name: 'ZavorthPolicyEnforcerTool', Factory: ZavorthPolicyEnforcerTool as any, hasAction: true },
  { name: 'ZavorthApiClientTool', Factory: ZavorthApiClientTool as any, hasAction: true },
  { name: 'ZavorthTrajectoryExportTool', Factory: ZavorthTrajectoryExportTool as any, hasAction: true },
  { name: 'ZavorthDockerComposeTool', Factory: ZavorthDockerComposeTool as any, hasAction: true },
  { name: 'ZavorthCodeIntelligenceTool', Factory: ZavorthCodeIntelligenceTool as any, hasAction: true },
  { name: 'ZavorthSshTunnelTool', Factory: ZavorthSshTunnelTool as any, hasAction: true },
  { name: 'ZavorthChartGeneratorTool', Factory: ZavorthChartGeneratorTool as any, hasAction: true },
  { name: 'ZavorthFileWatcherTool', Factory: ZavorthFileWatcherTool as any, hasAction: true },
  { name: 'ZavorthNetworkTool', Factory: ZavorthNetworkTool as any, hasAction: true },
  { name: 'ZavorthWebhookReceiverTool', Factory: ZavorthWebhookReceiverTool as any, hasAction: true },
  { name: 'ZavorthMcpMarketplaceTool', Factory: ZavorthMcpMarketplaceTool as any, hasAction: true },
  { name: 'ZavorthAgentGovernanceTool', Factory: ZavorthAgentGovernanceTool as any, hasAction: true },
  { name: 'ZavorthRagBuilderTool', Factory: ZavorthRagBuilderTool as any, hasAction: true },
  { name: 'ZavorthAgentEvalTool', Factory: ZavorthAgentEvalTool as any, hasAction: true },
  { name: 'ZavorthPrivacyVaultTool', Factory: ZavorthPrivacyVaultTool as any, hasAction: true },
  { name: 'ZavorthMultiRepoTool', Factory: ZavorthMultiRepoTool as any, hasAction: true },
  { name: 'ZavorthDocProviderTool', Factory: ZavorthDocProviderTool as any, hasAction: true },
  { name: 'ZavorthPromptLibraryTool', Factory: ZavorthPromptLibraryTool as any, hasAction: true },
  { name: 'ZavorthTokenBudgetTool', Factory: ZavorthTokenBudgetTool as any, hasAction: true },
  { name: 'ZavorthMemoryGraphTool', Factory: ZavorthMemoryGraphTool as any, hasAction: true },
  { name: 'ZavorthSandboxCloudTool', Factory: ZavorthSandboxCloudTool as any, hasAction: true },
  { name: 'ZavorthWorkflowBuilderTool', Factory: ZavorthWorkflowBuilderTool as any, hasAction: true },
  { name: 'ZavorthEdgeComputingTool', Factory: ZavorthEdgeComputingTool as any, hasAction: true },
];

describe('AllToolsDeep — Deep coverage for all Zavorth tools', () => {
  const tempDirs: string[] = [];

  function createTool(Factory: new (...args: any[]) => BaseTool): BaseTool {
    const tmpDir = makeTempDir();
    tempDirs.push(tmpDir);
    try {
      return new Factory({ storageDir: tmpDir });
    } catch {
      return new Factory();
    }
  }

  afterEach(() => {
    for (const dir of tempDirs) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    tempDirs.length = 0;
  });

  describe.each(TOOLS_TO_TEST)('$name', ({ name, Factory, hasAction }) => {
    let tool: BaseTool;

    beforeEach(() => {
      tool = createTool(Factory);
    });

    it('should have a non-empty string name', () => {
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
    });

    it('should have a non-empty string description', () => {
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
    });

    it('should have valid JSON schema parameters', () => {
      expect(isValidJsonSchema(tool.parameters)).toBe(true);
    });

    it('should have parameters with type object', () => {
      const params = tool.parameters as Record<string, unknown>;
      expect(params.type).toBe('object');
    });

    it('should have parameters.properties as an object', () => {
      const params = tool.parameters as Record<string, unknown>;
      expect(typeof params.properties).toBe('object');
      expect(params.properties).not.toBeNull();
    });

    it('execute({}) should return an error string, not throw', async () => {
      const result = await tool.execute({});
      expect(typeof result).toBe('string');
      if (hasAction) {
        expect(result.toLowerCase()).toMatch(/error|required|invalid/);
      }
    });

    it('execute({ action: "invalid" }) should return error for tools with action param', async () => {
      if (!hasAction) return;
      const result = await tool.execute({ action: 'invalid_nonexistent_action_xyz' });
      expect(typeof result).toBe('string');
      expect(result.toLowerCase()).toMatch(/error|invalid/);
    });

    it('getDefinition() should return valid definition object', () => {
      const def = tool.getDefinition();
      expect(def).toBeDefined();
      expect(typeof def.name).toBe('string');
      expect(typeof def.description).toBe('string');
      expect(def.parameters).toBeDefined();
    });

    it('getDefinition().name should match tool.name', () => {
      const def = tool.getDefinition();
      expect(def.name).toBe(tool.name);
    });

    it('getDefinition().description should match tool.description', () => {
      const def = tool.getDefinition();
      expect(def.description).toBe(tool.description);
    });

    it('should extend BaseTool', () => {
      expect(tool).toBeInstanceOf(BaseTool);
    });
  });

  describe('Tool name uniqueness', () => {
    it('all tool names should be unique', () => {
      const names = TOOLS_TO_TEST.map(({ Factory }) => {
        const tool = createTool(Factory);
        return tool.name;
      });
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe('Tool parameter schemas have required fields', () => {
    it.each(TOOLS_TO_TEST)('$name parameters should have valid structure', ({ Factory }) => {
      const tool = createTool(Factory);
      const params = tool.parameters as Record<string, unknown>;
      expect(params.type).toBe('object');
      expect(typeof params.properties).toBe('object');
      if (params.required) {
        expect(Array.isArray(params.required)).toBe(true);
        for (const req of params.required as string[]) {
          expect(typeof req).toBe('string');
          expect((params.properties as Record<string, unknown>)[req]).toBeDefined();
        }
      }
    });
  });

  describe('execute with null/undefined edge cases', () => {
    it.each(TOOLS_TO_TEST)('$name execute(null) should not throw', async ({ Factory }) => {
      const tool = createTool(Factory);
      const result = await tool.execute(null as any);
      expect(typeof result).toBe('string');
    });

    it.each(TOOLS_TO_TEST)('$name execute(undefined) should not throw', async ({ Factory }) => {
      const tool = createTool(Factory);
      const result = await tool.execute(undefined as any);
      expect(typeof result).toBe('string');
    });
  });
});
