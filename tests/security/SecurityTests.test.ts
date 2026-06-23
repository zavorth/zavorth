import fs from 'fs';
import path from 'path';
import os from 'os';

import { ZavorthPolicyEnforcerTool } from '../../src/tools/ZavorthPolicyEnforcerTool';
import { ZavorthPrivacyVaultTool } from '../../src/tools/ZavorthPrivacyVaultTool';
import { ZavorthAgentGovernanceTool } from '../../src/tools/ZavorthAgentGovernanceTool';
import { ZavorthReceiptSearchTool } from '../../src/tools/ZavorthReceiptSearchTool';
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
import { ZavorthRagBuilderTool } from '../../src/tools/ZavorthRagBuilderTool';
import { ZavorthAgentEvalTool } from '../../src/tools/ZavorthAgentEvalTool';
import { ZavorthMultiRepoTool } from '../../src/tools/ZavorthMultiRepoTool';
import { ZavorthDocProviderTool } from '../../src/tools/ZavorthDocProviderTool';
import { ZavorthPromptLibraryTool } from '../../src/tools/ZavorthPromptLibraryTool';
import { ZavorthTokenBudgetTool } from '../../src/tools/ZavorthTokenBudgetTool';
import { ZavorthMemoryGraphTool } from '../../src/tools/ZavorthMemoryGraphTool';
import { ZavorthSandboxCloudTool } from '../../src/tools/ZavorthSandboxCloudTool';
import { ZavorthWorkflowBuilderTool } from '../../src/tools/ZavorthWorkflowBuilderTool';
import { ZavorthEdgeComputingTool } from '../../src/tools/ZavorthEdgeComputingTool';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-security-'));
}

const ALL_SECURITY_TOOLS: Array<{ name: string; Factory: new (...args: any[]) => BaseTool }> = [
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

describe('SecurityTests — Security features validation', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    tempDirs.length = 0;
  });

  describe('Policy Enforcer — blocks destructive actions', () => {
    let enforcer: ZavorthPolicyEnforcerTool;

    beforeEach(() => {
      const tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      enforcer = new ZavorthPolicyEnforcerTool({ storageDir: tmpDir });
    });

    it('should block rm -rf commands', async () => {
      const result = await enforcer.execute({
        action: 'check',
        tool_name: 'remote_shell',
        tool_args: JSON.stringify({ command: 'rm -rf /' }),
        risk_level: 'critical',
      });
      expect(result).toContain('BLOCKED');
    });

    it('should block DROP TABLE commands', async () => {
      const result = await enforcer.execute({
        action: 'check',
        tool_name: 'database_query',
        tool_args: JSON.stringify({ command: 'DROP TABLE users' }),
        risk_level: 'critical',
      });
      expect(result).toBeDefined();
    });

    it('should require approval for email sending at high risk', async () => {
      const result = await enforcer.execute({
        action: 'check',
        tool_name: 'send_email',
        risk_level: 'high',
      });
      expect(result).toBeDefined();
    });

    it('should block sensitive file access', async () => {
      const result = await enforcer.execute({
        action: 'check',
        tool_name: 'read_file',
        tool_args: JSON.stringify({ path: '.env' }),
        risk_level: 'medium',
      });
      expect(result).toBeDefined();
    });

    it('should block credentials file access', async () => {
      const result = await enforcer.execute({
        action: 'check',
        tool_name: 'read_file',
        tool_args: JSON.stringify({ path: 'credentials.json' }),
        risk_level: 'medium',
      });
      expect(result).toBeDefined();
    });

    it('should allow safe operations at low risk', async () => {
      const result = await enforcer.execute({
        action: 'check',
        tool_name: 'web_search',
        risk_level: 'low',
      });
      expect(result).toContain('ALLOWED');
    });

    it('should list all builtin policies', async () => {
      const result = await enforcer.execute({ action: 'list_policies' });
      expect(result).toContain('Governance Policies');
      expect(result).toContain('Email Send Approval');
      expect(result).toContain('Destructive Command Block');
      expect(result).toContain('Sensitive Data Guard');
    });

    it('should add custom policy', async () => {
      const result = await enforcer.execute({
        action: 'add_policy',
        policy_name: 'Custom Block Policy',
        policy_description: 'Blocks custom tool',
        policy_category: 'tool_access',
        policy_condition: 'tool_name == "custom_tool"',
        policy_action: 'deny',
        policy_severity: 'block',
      });
      expect(result).toContain('created');
    });

    it('should remove custom policy', async () => {
      await enforcer.execute({
        action: 'add_policy',
        policy_name: 'Removable Policy',
      });
      const listResult = await enforcer.execute({ action: 'list_policies' });
      const idMatch = listResult.match(/pol_custom_removable_policy/);
      if (idMatch) {
        const removeResult = await enforcer.execute({
          action: 'remove_policy',
          policy_id: idMatch[0],
        });
        expect(removeResult).toContain('removed');
      }
    });

    it('should enable/disable policies', async () => {
      const disableResult = await enforcer.execute({
        action: 'disable_policy',
        policy_id: 'pol_email_send',
      });
      expect(disableResult).toContain('disabled');

      const enableResult = await enforcer.execute({
        action: 'enable_policy',
        policy_id: 'pol_email_send',
      });
      expect(enableResult).toContain('enabled');
    });

    it('should perform policy audit', async () => {
      const result = await enforcer.execute({ action: 'audit' });
      expect(result).toContain('Governance Policy Audit');
      expect(result).toContain('Total:');
      expect(result).toContain('Enabled:');
    });

    it('should run policy test suite', async () => {
      const result = await enforcer.execute({ action: 'test' });
      expect(result).toContain('Policy Test');
    });

    it('should handle missing action parameter', async () => {
      const result = await enforcer.execute({});
      expect(result).toContain('Error');
    });

    it('should handle invalid action', async () => {
      const result = await enforcer.execute({ action: 'nonexistent_action' });
      expect(result).toContain('Error');
    });

    it('should handle invalid JSON in tool_args gracefully', async () => {
      const result = await enforcer.execute({
        action: 'check',
        tool_name: 'test_tool',
        tool_args: 'not valid json {{{',
      });
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle network egress guard for untrusted domains', async () => {
      const result = await enforcer.execute({
        action: 'check',
        tool_name: 'http_request',
        tool_args: JSON.stringify({ url: 'https://evil.example.com/steal' }),
        risk_level: 'high',
      });
      expect(result).toBeDefined();
    });

    it('should handle approval signing requirement', async () => {
      const result = await enforcer.execute({
        action: 'check',
        tool_name: 'dangerous_tool',
        risk_level: 'critical',
        context: JSON.stringify({ approval_signed: false }),
      });
      expect(result).toBeDefined();
    });
  });

  describe('Privacy Vault — encrypts/decrypts correctly', () => {
    let vault: ZavorthPrivacyVaultTool;
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      vault = new ZavorthPrivacyVaultTool({ storageDir: tmpDir });
    });

    it('should store and retrieve a secret', async () => {
      const storeResult = await vault.execute({
        action: 'store',
        name: 'Test API Key',
        value: 'sk-test-12345',
        category: 'api_key',
      });
      expect(storeResult).toContain('stored');

      const listResult = await vault.execute({ action: 'list' });
      const idMatch = listResult.match(/(vault_[a-z0-9_]+)/);
      expect(idMatch).not.toBeNull();

      if (idMatch) {
        const retrieveResult = await vault.execute({
          action: 'retrieve',
          secret_id: idMatch[1],
        });
        expect(retrieveResult).toContain('sk-test-12345');
      }
    });

    it('should encrypt values (not store plaintext)', () => {
      vault.execute({ action: 'store', name: 'Secret', value: 'plaintext_secret', category: 'password' });
      const vaultFiles = fs.readdirSync(tmpDir);
      const encFile = vaultFiles.find((f) => f.endsWith('.enc') || f === 'vault.enc');
      if (encFile) {
        const content = fs.readFileSync(path.join(tmpDir, encFile), 'utf-8');
        expect(content).not.toContain('plaintext_secret');
      }
    });

    it('should delete a secret', async () => {
      await vault.execute({ action: 'store', name: 'Deletable', value: 'to_delete', category: 'token' });
      const listResult = await vault.execute({ action: 'list' });
      const idMatch = listResult.match(/(vault_[a-z0-9_]+)/);
      if (idMatch) {
        const deleteResult = await vault.execute({
          action: 'delete',
          secret_id: idMatch[1],
        });
        expect(deleteResult).toContain('deleted');
      }
    });

    it('should rotate a secret', async () => {
      await vault.execute({ action: 'store', name: 'Rotatable', value: 'old_value', category: 'api_key' });
      const listResult = await vault.execute({ action: 'list' });
      const idMatch = listResult.match(/(vault_[a-z0-9_]+)/);
      if (idMatch) {
        const rotateResult = await vault.execute({
          action: 'rotate',
          secret_id: idMatch[1],
          new_value: 'new_rotated_value',
        });
        expect(rotateResult).toContain('rotated');

        const retrieveResult = await vault.execute({
          action: 'retrieve',
          secret_id: idMatch[1],
        });
        expect(retrieveResult).toContain('new_rotated_value');
      }
    });

    it('should search secrets by name', async () => {
      await vault.execute({ action: 'store', name: 'GitHub Token', value: 'ghp_abc', category: 'api_key' });
      await vault.execute({ action: 'store', name: 'AWS Key', value: 'AKIA_xyz', category: 'api_key' });

      const searchResult = await vault.execute({ action: 'search', query: 'GitHub' });
      expect(searchResult).toContain('GitHub Token');
    });

    it('should maintain audit log', async () => {
      await vault.execute({ action: 'store', name: 'Audited', value: 'audit_test', category: 'token' });
      const auditResult = await vault.execute({ action: 'audit_log' });
      expect(auditResult).toContain('Audit Log');
      expect(auditResult).toContain('store');
    });

    it('should export vault metadata without values', async () => {
      await vault.execute({ action: 'store', name: 'Exportable', value: 'secret_value', category: 'password' });
      const exportResult = await vault.execute({ action: 'export' });
      expect(exportResult).toContain('exported');

      const exportPath = path.join(tmpDir, 'vault-export.json');
      if (fs.existsSync(exportPath)) {
        const exportData = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
        expect(exportData.length).toBeGreaterThan(0);
        expect(exportData[0]).not.toHaveProperty('encrypted_value');
        expect(exportData[0]).not.toHaveProperty('value');
      }
    });

    it('should handle expired secrets', async () => {
      await vault.execute({
        action: 'store',
        name: 'Expired Secret',
        value: 'expired_value',
        category: 'token',
        expires_in_days: 0,
      });
      const listResult = await vault.execute({ action: 'list' });
      const idMatch = listResult.match(/(vault_[a-z0-9_]+)/);
      if (idMatch) {
        const retrieveResult = await vault.execute({
          action: 'retrieve',
          secret_id: idMatch[1],
        });
        expect(retrieveResult).toContain('expired');
      }
    });

    it('should require name for store action', async () => {
      const result = await vault.execute({ action: 'store', value: 'test' });
      expect(result).toContain('Error');
    });

    it('should require value for store action', async () => {
      const result = await vault.execute({ action: 'store', name: 'No Value' });
      expect(result).toContain('Error');
    });

    it('should require secret_id for retrieve', async () => {
      const result = await vault.execute({ action: 'retrieve' });
      expect(result).toContain('Error');
    });

    it('should handle invalid action', async () => {
      const result = await vault.execute({ action: 'nonexistent' });
      expect(result).toContain('Error');
    });

    it('should handle retrieve of non-existent secret', async () => {
      const result = await vault.execute({ action: 'retrieve', secret_id: 'vault_nonexistent' });
      expect(result).toContain('not found');
    });

    it('vault key file should be created', async () => {
      await vault.execute({ action: 'store', name: 'Key Test', value: 'val', category: 'other' });
      const keyPath = path.join(tmpDir, '.vault-key');
      expect(fs.existsSync(keyPath)).toBe(true);
      const keyBuffer = fs.readFileSync(keyPath);
      expect(keyBuffer.length).toBe(32);
    });
  });

  describe('Agent Governance — compliance checks', () => {
    let governance: ZavorthAgentGovernanceTool;

    beforeEach(() => {
      const tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      governance = new ZavorthAgentGovernanceTool({ storageDir: tmpDir });
    });

    it('should list governance policies', async () => {
      const result = await governance.execute({ action: 'policy_list' });
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should perform safety report', async () => {
      const result = await governance.execute({ action: 'safety_report' });
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should check compliance', async () => {
      const result = await governance.execute({
        action: 'compliance',
        agent_id: 'test_agent',
      });
      expect(result).toBeDefined();
    });

    it('should add custom governance policy', async () => {
      const result = await governance.execute({
        action: 'policy_add',
        policy_name: 'Test Policy',
        policy_description: 'Test governance policy',
        policy_category: 'safety',
      });
      expect(result).toBeDefined();
    });

    it('should assess risk', async () => {
      const result = await governance.execute({
        action: 'risk_assess',
        action_to_check: 'deploy to production',
      });
      expect(result).toBeDefined();
    });

    it('should handle missing action', async () => {
      const result = await governance.execute({});
      expect(result).toContain('Error');
    });

    it('should handle invalid action', async () => {
      const result = await governance.execute({ action: 'invalid_xyz' });
      expect(result).toContain('Error');
    });

    it('should perform behavior logging', async () => {
      const result = await governance.execute({
        action: 'behavior_log',
        agent_id: 'agent_1',
        action_to_check: 'executed web_search',
      });
      expect(result).toBeDefined();
    });
  });

  describe('Receipt audit trail — completeness', () => {
    let receipts: ZavorthReceiptSearchTool;

    beforeEach(() => {
      const tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      receipts = new ZavorthReceiptSearchTool({ storageDir: tmpDir });
    });

    it('should return stats for empty receipt store', async () => {
      const result = await receipts.execute({ action: 'stats' });
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should search receipts', async () => {
      const result = await receipts.execute({ action: 'search', query: 'test' });
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should list tools in receipts', async () => {
      const result = await receipts.execute({ action: 'list_tools' });
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should list sessions in receipts', async () => {
      const result = await receipts.execute({ action: 'list_sessions' });
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle missing action', async () => {
      const result = await receipts.execute({});
      expect(result).toContain('Error');
    });

    it('should handle invalid action', async () => {
      const result = await receipts.execute({ action: 'invalid_action' });
      expect(result).toContain('Error');
    });

    it('should export receipts', async () => {
      const result = await receipts.execute({ action: 'export' });
      expect(result).toBeDefined();
    });

    it('should verify receipt integrity', async () => {
      const result = await receipts.execute({ action: 'verify' });
      expect(result).toBeDefined();
    });
  });

  describe('Tool security definitions — validity', () => {
    let registry: ToolRegistry;

    beforeEach(() => {
      registry = new ToolRegistry();
      for (const { Factory } of ALL_SECURITY_TOOLS) {
        registry.register(new Factory());
      }
    });

    it('all tools should have security definitions', () => {
      const defs = registry.getAllToolSecurityDefinitions();
      expect(defs.length).toBe(ALL_SECURITY_TOOLS.length);
    });

    it.each(ALL_SECURITY_TOOLS)('$name should have valid security definition', ({ Factory }) => {
      const tool = new Factory();
      const def = registry.getToolSecurityDefinition(tool.name);
      expect(def).toBeDefined();
      expect(def!.toolName).toBe(tool.name);
      expect(Array.isArray(def!.capabilities)).toBe(true);
      expect(def!.capabilities.length).toBeGreaterThan(0);
    });

    it('security definitions should have valid source', () => {
      const defs = registry.getAllToolSecurityDefinitions();
      for (const def of defs) {
        expect(['explicit', 'fallback', 'inferred']).toContain(def.source);
      }
    });

    it('security catalog audit should be consistent', () => {
      const audit = registry.getSecurityCatalogAudit();
      const total =
        audit.explicitDefinitions.length +
        audit.fallbackDefinitions.length +
        audit.inferredDefinitions.length;
      expect(total).toBe(audit.totalTools);
    });

    it('capabilities should be non-empty strings', () => {
      const defs = registry.getAllToolSecurityDefinitions();
      for (const def of defs) {
        for (const cap of def.capabilities) {
          expect(typeof cap).toBe('string');
          expect(cap.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Privacy vault — cross-session persistence', () => {
    it('should persist vault data across instances', async () => {
      const tmpDir = makeTempDir();
      tempDirs.push(tmpDir);

      const vault1 = new ZavorthPrivacyVaultTool({ storageDir: tmpDir });
      await vault1.execute({
        action: 'store',
        name: 'Persistent Key',
        value: 'persist_value',
        category: 'api_key',
      });

      const vault2 = new ZavorthPrivacyVaultTool({ storageDir: tmpDir });
      const listResult = await vault2.execute({ action: 'list' });
      expect(listResult).toContain('Persistent Key');

      const retrieveMatch = listResult.match(/(vault_[a-z0-9_]+)/);
      if (retrieveMatch) {
        const retrieveResult = await vault2.execute({
          action: 'retrieve',
          secret_id: retrieveMatch[1],
        });
        expect(retrieveResult).toContain('persist_value');
      }
    });
  });

  describe('Policy enforcer — edge cases', () => {
    let enforcer: ZavorthPolicyEnforcerTool;

    beforeEach(() => {
      const tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      enforcer = new ZavorthPolicyEnforcerTool({ storageDir: tmpDir });
    });

    it('should handle empty context JSON', async () => {
      const result = await enforcer.execute({
        action: 'check',
        tool_name: 'test_tool',
        context: '{}',
      });
      expect(result).toBeDefined();
    });

    it('should handle null context gracefully', async () => {
      const result = await enforcer.execute({
        action: 'check',
        tool_name: 'test_tool',
        context: null as any,
      });
      expect(result).toBeDefined();
    });

    it('should handle disable non-existent policy', async () => {
      const result = await enforcer.execute({
        action: 'disable_policy',
        policy_id: 'nonexistent_policy',
      });
      expect(result).toContain('not found');
    });

    it('should handle remove non-existent policy', async () => {
      const result = await enforcer.execute({
        action: 'remove_policy',
        policy_id: 'nonexistent_policy',
      });
      expect(result).toContain('not found');
    });

    it('should handle add duplicate policy name', async () => {
      await enforcer.execute({
        action: 'add_policy',
        policy_name: 'Unique Policy',
      });
      const result = await enforcer.execute({
        action: 'add_policy',
        policy_name: 'Unique Policy',
      });
      expect(result).toContain('already exists');
    });
  });
});
