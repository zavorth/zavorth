import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthMcpMarketplaceTool } from '../../src/tools/ZavorthMcpMarketplaceTool';
import { ZavorthAgentGovernanceTool } from '../../src/tools/ZavorthAgentGovernanceTool';
import { ZavorthRagBuilderTool } from '../../src/tools/ZavorthRagBuilderTool';
import { ZavorthAgentEvalTool } from '../../src/tools/ZavorthAgentEvalTool';
import { ZavorthPrivacyVaultTool } from '../../src/tools/ZavorthPrivacyVaultTool';

describe('ZavorthMcpMarketplaceTool', () => {
  const tool = new ZavorthMcpMarketplaceTool({ registryDir: fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-')) });

  it('exposes correct name', () => { expect(tool.name).toBe('zavorth_mcp_marketplace'); });
  it('returns error without action', async () => { expect(await tool.execute({})).toContain('Error'); });
  it('lists servers', async () => { expect(await tool.execute({ action: 'list' })).toContain('MCP Servers'); });
  it('searches servers', async () => { expect(await tool.execute({ action: 'search', query: 'github' })).toContain('GitHub'); });
  it('searches by category', async () => { expect(await tool.execute({ action: 'search', category: 'database' })).toContain('PostgreSQL'); });
  it('gets server info', async () => { expect(await tool.execute({ action: 'info', server_id: 'filesystem' })).toContain('Filesystem'); });
  it('returns error for non-existent server', async () => { expect(await tool.execute({ action: 'info', server_id: 'nonexistent' })).toContain('not found'); });
  it('lists categories', async () => { expect(await tool.execute({ action: 'categories' })).toContain('filesystem'); });
  it('installs a server', async () => {
    const result = await tool.execute({ action: 'install', server_id: 'github' });
    expect(result).toContain('installed');
  });
  it('lists installed servers', async () => {
    await tool.execute({ action: 'install', server_id: 'postgres' });
    const result = await tool.execute({ action: 'installed' });
    expect(result).toContain('postgres');
  });
  it('checks for updates', async () => {
    const result = await tool.execute({ action: 'check_updates' });
    expect(result).toBeTruthy();
  });
  it('uninstalls a server', async () => {
    await tool.execute({ action: 'install', server_id: 'slack' });
    const result = await tool.execute({ action: 'uninstall', server_id: 'slack' });
    expect(result).toContain('uninstalled');
  });
  it('returns error for invalid action', async () => { expect(await tool.execute({ action: 'dance' })).toContain('invalid'); });
});

describe('ZavorthAgentGovernanceTool', () => {
  let tool: ZavorthAgentGovernanceTool;
  let tempDir: string;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gov-')); tool = new ZavorthAgentGovernanceTool({ storageDir: tempDir }); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('exposes correct name', () => { expect(tool.name).toBe('zavorth_agent_governance'); });
  it('returns error without action', async () => { expect(await tool.execute({})).toContain('Error'); });
  it('lists policies', async () => { expect(await tool.execute({ action: 'policy_list' })).toContain('GOV-001'); });
  it('checks safe action', async () => {
    const result = await tool.execute({ action: 'check', action_to_check: 'read file', risk_level: 'low' });
    expect(result).toContain('PASS');
  });
  it('blocks destructive action', async () => {
    const result = await tool.execute({ action: 'check', action_to_check: 'delete all files', risk_level: 'high' });
    expect(result).toContain('BLOCKED');
  });
  it('checks EU AI Act compliance', async () => {
    const result = await tool.execute({ action: 'compliance', compliance_framework: 'eu-ai-act' });
    expect(result).toContain('EU-AI-ACT');
  });
  it('checks GDPR compliance', async () => {
    const result = await tool.execute({ action: 'compliance', compliance_framework: 'gdpr' });
    expect(result).toContain('GDPR');
  });
  it('generates safety report', async () => {
    const result = await tool.execute({ action: 'safety_report' });
    expect(result).toContain('Safety Report');
  });
  it('assesses risk', async () => {
    const result = await tool.execute({ action: 'risk_assess', action_to_check: 'rm -rf /' });
    expect(result).toContain('Risk Assessment');
  });
  it('adds custom policy', async () => {
    const result = await tool.execute({ action: 'policy_add', policy_name: 'Custom Policy', category: 'safety' });
    expect(result).toContain('added');
  });
  it('removes policy', async () => {
    const result = await tool.execute({ action: 'policy_remove', policy_id: 'GOV-001' });
    expect(result).toContain('removed');
  });
  it('logs behavior', async () => {
    const result = await tool.execute({ action: 'behavior_log', agent_id: 'test-agent', details: 'Test log' });
    expect(result).toContain('logged');
  });
  it('gets audit log', async () => {
    await tool.execute({ action: 'check', action_to_check: 'test action', risk_level: 'low' });
    const result = await tool.execute({ action: 'audit' });
    expect(result).toContain('Audit Log');
  });
});

describe('ZavorthRagBuilderTool', () => {
  let tool: ZavorthRagBuilderTool;
  let tempDir: string;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-')); tool = new ZavorthRagBuilderTool({ storageDir: tempDir }); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('exposes correct name', () => { expect(tool.name).toBe('zavorth_rag_builder'); });
  it('returns error without action', async () => { expect(await tool.execute({})).toContain('Error'); });
  it('ingests a file', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    fs.writeFileSync(filePath, 'TypeScript is a typed superset of JavaScript. It compiles to plain JavaScript.');
    const result = await tool.execute({ action: 'ingest', source_path: filePath });
    expect(result).toContain('Ingested');
  });
  it('queries after ingest', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    fs.writeFileSync(filePath, 'TypeScript is a typed superset of JavaScript. It compiles to plain JavaScript.');
    await tool.execute({ action: 'ingest', source_path: filePath });
    const result = await tool.execute({ action: 'query', query: 'TypeScript' });
    expect(result).toContain('RAG Query');
  });
  it('lists sources', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    fs.writeFileSync(filePath, 'Test content for RAG.');
    await tool.execute({ action: 'ingest', source_path: filePath });
    const result = await tool.execute({ action: 'list_sources' });
    expect(result).toContain('RAG Sources');
  });
  it('gets stats', async () => {
    const result = await tool.execute({ action: 'stats' });
    expect(result).toContain('RAG Pipeline Stats');
  });
  it('configures chunk size', async () => {
    const result = await tool.execute({ action: 'configure', chunk_size: 256 });
    expect(result).toContain('256');
  });
  it('deletes a source', async () => {
    const filePath = path.join(tempDir, 'delete_me.txt');
    fs.writeFileSync(filePath, 'Delete this content.');
    await tool.execute({ action: 'ingest', source_path: filePath });
    const result = await tool.execute({ action: 'delete_source', source_path: 'delete_me' });
    expect(result).toContain('Deleted');
  });
  it('returns error for query without ingest', async () => {
    const result = await tool.execute({ action: 'query', query: 'nothing' });
    expect(result).toContain('No results');
  });
});

describe('ZavorthAgentEvalTool', () => {
  let tool: ZavorthAgentEvalTool;
  let tempDir: string;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-')); tool = new ZavorthAgentEvalTool({ storageDir: tempDir }); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('exposes correct name', () => { expect(tool.name).toBe('zavorth_agent_eval'); });
  it('returns error without action', async () => { expect(await tool.execute({})).toContain('Error'); });
  it('lists tasks', async () => { expect(await tool.execute({ action: 'list_tasks' })).toContain('EVAL-'); });
  it('lists tasks by category', async () => {
    const result = await tool.execute({ action: 'list_tasks', category: 'coding' });
    expect(result).toContain('coding');
  });
  it('adds a custom task', async () => {
    const result = await tool.execute({ action: 'add_task', name: 'Custom Test', input: 'test input', expected_output: 'test output', category: 'custom' });
    expect(result).toContain('added');
  });
  it('runs evaluation', async () => {
    const result = await tool.execute({ action: 'run', eval_name: 'Test Eval', max_tasks: 3 });
    expect(result).toContain('completed');
    expect(result).toContain('Passed');
    expect(result).toContain('simulated=true');
    expect(result).toContain('liveLlmEval=false');
    expect(result).toContain('claimsLiveIntelligence=false');
  });
  it('generates report', async () => {
    await tool.execute({ action: 'run', eval_name: 'Report Test', max_tasks: 2 });
    const result = await tool.execute({ action: 'report' });
    expect(result).toContain('Evaluation Report');
    expect(result).toContain('simulated=true');
  });
  it('compares reports', async () => {
    await tool.execute({ action: 'run', eval_name: 'Run 1', max_tasks: 2 });
    await tool.execute({ action: 'run', eval_name: 'Run 2', max_tasks: 2 });
    const result = await tool.execute({ action: 'compare' });
    expect(result).toContain('Comparison');
    expect(result).toContain('simulated=true');
  });
  it('exports report', async () => {
    await tool.execute({ action: 'run', eval_name: 'Export Test', max_tasks: 1 });
    const result = await tool.execute({ action: 'export' });
    expect(result).toContain('exported');
    expect(result).toContain('simulated=true');
    const exported = fs.readdirSync(tempDir).find((name) => name.startsWith('report_') && name.endsWith('.json'));
    expect(exported).toBeTruthy();
    const payload = JSON.parse(fs.readFileSync(path.join(tempDir, exported!), 'utf8'));
    expect(payload.simulated).toBe(true);
    expect(payload.liveLlmEval).toBe(false);
    expect(payload.claimsLiveIntelligence).toBe(false);
  });
  it('imports tasks', async () => {
    const tasks = JSON.stringify([{ name: 'Imported', input: 'test', expected_output: 'result' }]);
    const result = await tool.execute({ action: 'import_tasks', tasks_json: tasks });
    expect(result).toContain('Imported 1');
  });
});

describe('ZavorthPrivacyVaultTool', () => {
  let tool: ZavorthPrivacyVaultTool;
  let tempDir: string;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-')); tool = new ZavorthPrivacyVaultTool({ storageDir: tempDir }); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('exposes correct name', () => { expect(tool.name).toBe('zavorth_privacy_vault'); });
  it('returns error without action', async () => { expect(await tool.execute({})).toContain('Error'); });
  it('stores a secret', async () => {
    const result = await tool.execute({ action: 'store', name: 'GitHub Token', value: 'ghp_xxx', category: 'api_key' });
    expect(result).toContain('stored');
  });
  it('retrieves a secret', async () => {
    await tool.execute({ action: 'store', name: 'Test Key', value: 'secret123', category: 'api_key' });
    const list = await tool.execute({ action: 'list' });
    const idMatch = list.match(/vault_\w+/);
    expect(idMatch).toBeTruthy();
    const result = await tool.execute({ action: 'retrieve', secret_id: idMatch![0] });
    expect(result).toContain('secret123');
  });
  it('lists vault entries', async () => {
    await tool.execute({ action: 'store', name: 'Key 1', value: 'val1' });
    await tool.execute({ action: 'store', name: 'Key 2', value: 'val2' });
    const result = await tool.execute({ action: 'list' });
    expect(result).toContain('2');
  });
  it('deletes a secret', async () => {
    await tool.execute({ action: 'store', name: 'Delete Me', value: 'temp' });
    const list = await tool.execute({ action: 'list' });
    const idMatch = list.match(/vault_\w+/);
    const result = await tool.execute({ action: 'delete', secret_id: idMatch![0] });
    expect(result).toContain('deleted');
  });
  it('rotates a secret', async () => {
    await tool.execute({ action: 'store', name: 'Rotate Me', value: 'old_pass' });
    const list = await tool.execute({ action: 'list' });
    const idMatch = list.match(/vault_\w+/);
    const result = await tool.execute({ action: 'rotate', secret_id: idMatch![0], new_value: 'new_pass' });
    expect(result).toContain('rotated');
  });
  it('searches vault', async () => {
    await tool.execute({ action: 'store', name: 'GitHub Token', value: 'ghp_xxx' });
    const result = await tool.execute({ action: 'search', query: 'github' });
    expect(result).toContain('GitHub');
  });
  it('gets audit log', async () => {
    await tool.execute({ action: 'store', name: 'Audit Test', value: 'test' });
    const result = await tool.execute({ action: 'audit_log' });
    expect(result).toContain('Audit Log');
  });
  it('exports vault metadata', async () => {
    await tool.execute({ action: 'store', name: 'Export Test', value: 'test' });
    const result = await tool.execute({ action: 'export' });
    expect(result).toContain('exported');
  });
  it('handles expiration', async () => {
    const result = await tool.execute({ action: 'store', name: 'Expiring', value: 'temp', expires_in_days: 0 });
    expect(result).toContain('expires');
  });
  it('returns error for non-existent retrieve', async () => {
    const result = await tool.execute({ action: 'retrieve', secret_id: 'nonexistent' });
    expect(result).toContain('not found');
  });
});
