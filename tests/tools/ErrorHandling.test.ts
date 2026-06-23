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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-error-'));
}

const ALL_TOOLS: Array<{ name: string; Factory: new (...args: any[]) => BaseTool }> = [
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

describe('ErrorHandling — Error handling across all tools', () => {
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

  describe('Null inputs', () => {
    it.each(ALL_TOOLS)('$name should handle null args gracefully', async ({ Factory }) => {
      const tool = createTool(Factory);
      const result = await tool.execute(null as any);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it.each(ALL_TOOLS)('$name should handle null action gracefully', async ({ Factory }) => {
      const tool = createTool(Factory);
      const result = await tool.execute({ action: null } as any);
      expect(typeof result).toBe('string');
    });

    it.each(ALL_TOOLS)('$name should handle null values in properties', async ({ Factory }) => {
      const tool = createTool(Factory);
      const result = await tool.execute({
        action: 'list',
        name: null,
        value: null,
        query: null,
      } as any);
      expect(typeof result).toBe('string');
    });
  });

  describe('Undefined inputs', () => {
    it.each(ALL_TOOLS)('$name should handle undefined args gracefully', async ({ Factory }) => {
      const tool = createTool(Factory);
      const result = await tool.execute(undefined as any);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it.each(ALL_TOOLS)('$name should handle empty object', async ({ Factory }) => {
      const tool = createTool(Factory);
      const result = await tool.execute({});
      expect(typeof result).toBe('string');
    });
  });

  describe('Empty strings', () => {
    it.each(ALL_TOOLS)('$name should handle empty action string', async ({ Factory }) => {
      const tool = createTool(Factory);
      const result = await tool.execute({ action: '' });
      expect(typeof result).toBe('string');
    });

    it.each(ALL_TOOLS)('$name should handle empty string values', async ({ Factory }) => {
      const tool = createTool(Factory);
      const result = await tool.execute({
        action: '',
        name: '',
        value: '',
        query: '',
        job_id: '',
        task_id: '',
      });
      expect(typeof result).toBe('string');
    });
  });

  describe('Invalid action values', () => {
    it.each(ALL_TOOLS)('$name should handle completely invalid action', async ({ Factory }) => {
      const tool = createTool(Factory);
      const result = await tool.execute({ action: 'this_action_does_not_exist_at_all' });
      expect(typeof result).toBe('string');
      expect(result.toLowerCase()).toMatch(/error|invalid/);
    });

    it.each(ALL_TOOLS)('$name should handle numeric action', async ({ Factory }) => {
      const tool = createTool(Factory);
      const result = await tool.execute({ action: 12345 } as any);
      expect(typeof result).toBe('string');
    });

    it.each(ALL_TOOLS)('$name should handle boolean action', async ({ Factory }) => {
      const tool = createTool(Factory);
      const result = await tool.execute({ action: true } as any);
      expect(typeof result).toBe('string');
    });
  });

  describe('Invalid JSON strings', () => {
    it('PolicyEnforcer should handle invalid JSON in tool_args', async () => {
      const tool = createTool(ZavorthPolicyEnforcerTool);
      const result = await tool.execute({
        action: 'check',
        tool_name: 'test',
        tool_args: '{invalid json[',
      });
      expect(typeof result).toBe('string');
    });

    it('PolicyEnforcer should handle invalid JSON in context', async () => {
      const tool = createTool(ZavorthPolicyEnforcerTool);
      const result = await tool.execute({
        action: 'check',
        tool_name: 'test',
        context: 'not json at all',
      });
      expect(typeof result).toBe('string');
    });

    it('PrivacyVault should handle invalid tags JSON', async () => {
      const tool = createTool(ZavorthPrivacyVaultTool);
      const result = await tool.execute({
        action: 'store',
        name: 'test',
        value: 'test_val',
        tags: 'not-a-json-array',
      });
      expect(typeof result).toBe('string');
    });
  });

  describe('Non-existent IDs', () => {
    it('CronScheduler should handle non-existent job_id', async () => {
      const tool = createTool(ZavorthCronSchedulerTool);
      const result = await tool.execute({ action: 'status', job_id: 'nonexistent_job_xyz' });
      expect(result).toContain('not found');
    });

    it('DelegateTool should handle non-existent task_id', async () => {
      const tool = createTool(ZavorthDelegateTool);
      const result = await tool.execute({ action: 'status', task_id: 'nonexistent_task_xyz' });
      expect(typeof result).toBe('string');
    });

    it('PrivacyVault should handle non-existent secret_id', async () => {
      const tool = createTool(ZavorthPrivacyVaultTool);
      const result = await tool.execute({ action: 'retrieve', secret_id: 'vault_nonexistent_xyz' });
      expect(result).toContain('not found');
    });

    it('PolicyEnforcer should handle non-existent policy_id for remove', async () => {
      const tool = createTool(ZavorthPolicyEnforcerTool);
      const result = await tool.execute({ action: 'remove_policy', policy_id: 'pol_nonexistent_xyz' });
      expect(result).toContain('not found');
    });

    it('PolicyEnforcer should handle non-existent policy_id for toggle', async () => {
      const tool = createTool(ZavorthPolicyEnforcerTool);
      const result = await tool.execute({ action: 'disable_policy', policy_id: 'pol_nonexistent_xyz' });
      expect(result).toContain('not found');
    });

    it('WorkflowBuilder should handle non-existent workflow_id', async () => {
      const tool = createTool(ZavorthWorkflowBuilderTool);
      const result = await tool.execute({ action: 'get', workflow_id: 'wf_nonexistent_xyz' });
      expect(typeof result).toBe('string');
    });

    it('MultiRepo should handle non-existent repo_id', async () => {
      const tool = createTool(ZavorthMultiRepoTool);
      const result = await tool.execute({ action: 'status', repo_id: 'repo_nonexistent_xyz' });
      expect(typeof result).toBe('string');
    });
  });

  describe('Missing required parameters', () => {
    it('CronScheduler create without schedule should error', async () => {
      const tool = createTool(ZavorthCronSchedulerTool);
      const result = await tool.execute({ action: 'create', task_description: 'test' });
      expect(result).toContain('Error');
    });

    it('CronScheduler create without task_description should error', async () => {
      const tool = createTool(ZavorthCronSchedulerTool);
      const result = await tool.execute({ action: 'create', schedule: '0 9 * * *' });
      expect(result).toContain('Error');
    });

    it('PrivacyVault store without name should error', async () => {
      const tool = createTool(ZavorthPrivacyVaultTool);
      const result = await tool.execute({ action: 'store', value: 'test' });
      expect(result).toContain('Error');
    });

    it('PrivacyVault store without value should error', async () => {
      const tool = createTool(ZavorthPrivacyVaultTool);
      const result = await tool.execute({ action: 'store', name: 'test' });
      expect(result).toContain('Error');
    });

    it('PrivacyVault rotate without secret_id should error', async () => {
      const tool = createTool(ZavorthPrivacyVaultTool);
      const result = await tool.execute({ action: 'rotate', new_value: 'new' });
      expect(result).toContain('Error');
    });

    it('PrivacyVault rotate without new_value should error', async () => {
      const tool = createTool(ZavorthPrivacyVaultTool);
      const result = await tool.execute({ action: 'rotate', secret_id: 'vault_test' });
      expect(result).toContain('Error');
    });

    it('PrivacyVault search without query should error', async () => {
      const tool = createTool(ZavorthPrivacyVaultTool);
      const result = await tool.execute({ action: 'search' });
      expect(result).toContain('Error');
    });

    it('PolicyEnforcer check without tool_name should error', async () => {
      const tool = createTool(ZavorthPolicyEnforcerTool);
      const result = await tool.execute({ action: 'check' });
      expect(result).toContain('Error');
    });

    it('PolicyEnforcer add_policy without policy_name should error', async () => {
      const tool = createTool(ZavorthPolicyEnforcerTool);
      const result = await tool.execute({ action: 'add_policy' });
      expect(result).toContain('Error');
    });
  });

  describe('Out of range values', () => {
    it('CronScheduler should handle very long job name', async () => {
      const tool = createTool(ZavorthCronSchedulerTool);
      const longName = 'a'.repeat(1000);
      const result = await tool.execute({
        action: 'create',
        name: longName,
        schedule: '0 9 * * *',
        task_description: 'test task',
      });
      expect(typeof result).toBe('string');
    });

    it('PrivacyVault should handle expires_in_days of 0', async () => {
      const tool = createTool(ZavorthPrivacyVaultTool);
      const result = await tool.execute({
        action: 'store',
        name: 'Expiring',
        value: 'test',
        expires_in_days: 0,
      });
      expect(result).toContain('stored');
    });

    it('PrivacyVault should handle negative expires_in_days', async () => {
      const tool = createTool(ZavorthPrivacyVaultTool);
      const result = await tool.execute({
        action: 'store',
        name: 'Negative',
        value: 'test',
        expires_in_days: -30,
      });
      expect(typeof result).toBe('string');
    });

    it('CronScheduler should handle interval_ms of 0', async () => {
      const tool = createTool(ZavorthCronSchedulerTool);
      const result = await tool.execute({
        action: 'create',
        name: 'Zero Interval',
        schedule: '0',
        interval_ms: 0,
        task_description: 'test',
      });
      expect(typeof result).toBe('string');
    });

    it('CronScheduler should handle negative interval_ms', async () => {
      const tool = createTool(ZavorthCronSchedulerTool);
      const result = await tool.execute({
        action: 'create',
        name: 'Negative Interval',
        schedule: '-1',
        interval_ms: -1000,
        task_description: 'test',
      });
      expect(typeof result).toBe('string');
    });
  });

  describe('Type coercion edge cases', () => {
    it('CronScheduler should handle numeric name', async () => {
      const tool = createTool(ZavorthCronSchedulerTool);
      const result = await tool.execute({
        action: 'create',
        name: 12345,
        schedule: '0 9 * * *',
        task_description: 'test',
      } as any);
      expect(typeof result).toBe('string');
    });

    it('CronScheduler should handle array schedule', async () => {
      const tool = createTool(ZavorthCronSchedulerTool);
      const result = await tool.execute({
        action: 'create',
        name: 'Array Test',
        schedule: ['0', '9', '*'],
        task_description: 'test',
      } as any);
      expect(typeof result).toBe('string');
    });

    it('PolicyEnforcer should handle numeric risk_level', async () => {
      const tool = createTool(ZavorthPolicyEnforcerTool);
      const result = await tool.execute({
        action: 'check',
        tool_name: 'test',
        risk_level: 999,
      } as any);
      expect(typeof result).toBe('string');
    });

    it('PrivacyVault should handle boolean name', async () => {
      const tool = createTool(ZavorthPrivacyVaultTool);
      const result = await tool.execute({
        action: 'store',
        name: true,
        value: 'test',
      } as any);
      expect(typeof result).toBe('string');
    });
  });

  describe('Concurrent access patterns', () => {
    it('CronScheduler should handle concurrent create operations', async () => {
      const tool = createTool(ZavorthCronSchedulerTool);
      const promises = Array.from({ length: 5 }, (_, i) =>
        tool.execute({
          action: 'create',
          name: `Concurrent Job ${i}`,
          schedule: '0 9 * * *',
          task_description: `Task ${i}`,
        })
      );
      const results = await Promise.all(promises);
      expect(results.length).toBe(5);
      for (const result of results) {
        expect(typeof result).toBe('string');
      }
    });

    it('PrivacyVault should handle concurrent store operations', async () => {
      const tool = createTool(ZavorthPrivacyVaultTool);
      const promises = Array.from({ length: 5 }, (_, i) =>
        tool.execute({
          action: 'store',
          name: `Concurrent Secret ${i}`,
          value: `value_${i}`,
          category: 'api_key',
        })
      );
      const results = await Promise.all(promises);
      expect(results.length).toBe(5);
      for (const result of results) {
        expect(typeof result).toBe('string');
      }
    });

    it('PolicyEnforcer should handle concurrent check operations', async () => {
      const tool = createTool(ZavorthPolicyEnforcerTool);
      const promises = Array.from({ length: 10 }, (_, i) =>
        tool.execute({
          action: 'check',
          tool_name: `tool_${i}`,
          risk_level: 'medium',
        })
      );
      const results = await Promise.all(promises);
      expect(results.length).toBe(10);
    });

    it('PrivacyVault should handle concurrent read/write', async () => {
      const tool = createTool(ZavorthPrivacyVaultTool);
      await tool.execute({
        action: 'store',
        name: 'Shared Secret',
        value: 'shared_value',
        category: 'token',
      });

      const readPromises = Array.from({ length: 5 }, () =>
        tool.execute({ action: 'list' })
      );
      const results = await Promise.all(readPromises);
      for (const result of results) {
        expect(result).toContain('Shared Secret');
      }
    });
  });

  describe('File system edge cases', () => {
    it('CronScheduler should handle missing storage directory gracefully', async () => {
      const tool = new ZavorthCronSchedulerTool({
        storageDir: path.join(os.tmpdir(), 'nonexistent_dir_xyz', 'cron'),
      });
      const result = await tool.execute({ action: 'list' });
      expect(typeof result).toBe('string');
    });

    it('PrivacyVault should handle missing storage directory gracefully', async () => {
      const tool = new ZavorthPrivacyVaultTool({
        storageDir: path.join(os.tmpdir(), 'nonexistent_dir_xyz', 'vault'),
      });
      const result = await tool.execute({ action: 'list' });
      expect(typeof result).toBe('string');
    });

    it('ReceiptSearch should handle missing storage directory gracefully', async () => {
      const tool = new ZavorthReceiptSearchTool({
        storageDir: path.join(os.tmpdir(), 'nonexistent_dir_xyz', 'receipts'),
      });
      const result = await tool.execute({ action: 'stats' });
      expect(typeof result).toBe('string');
    });
  });

  describe('Special characters in inputs', () => {
    it('CronScheduler should handle unicode in job name', async () => {
      const tool = createTool(ZavorthCronSchedulerTool);
      const result = await tool.execute({
        action: 'create',
        name: '测试任务 🔥 Ñoño',
        schedule: '0 9 * * *',
        task_description: 'Unicode test 任务',
      });
      expect(typeof result).toBe('string');
    });

    it('PrivacyVault should handle special chars in secret value', async () => {
      const tool = createTool(ZavorthPrivacyVaultTool);
      const result = await tool.execute({
        action: 'store',
        name: 'Special Chars',
        value: '!@#$%^&*()_+{}|:"<>?~`',
        category: 'password',
      });
      expect(result).toContain('stored');
    });

    it('PolicyEnforcer should handle SQL injection in tool_name', async () => {
      const tool = createTool(ZavorthPolicyEnforcerTool);
      const result = await tool.execute({
        action: 'check',
        tool_name: "'; DROP TABLE users; --",
      });
      expect(typeof result).toBe('string');
    });

    it('CronScheduler should handle XSS in task description', async () => {
      const tool = createTool(ZavorthCronSchedulerTool);
      const result = await tool.execute({
        action: 'create',
        name: 'XSS Test',
        schedule: '0 9 * * *',
        task_description: '<script>alert("xss")</script>',
      });
      expect(typeof result).toBe('string');
    });
  });

  describe('Boundary conditions for getDefinition', () => {
    it.each(ALL_TOOLS)('$name getDefinition should always return valid object', ({ Factory }) => {
      const tool = createTool(Factory);
      const def = tool.getDefinition();
      expect(def).toBeDefined();
      expect(typeof def.name).toBe('string');
      expect(typeof def.description).toBe('string');
      expect(def.parameters).toBeDefined();
    });
  });
});
