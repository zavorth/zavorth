import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthSandboxCloudTool } from '../../src/tools/ZavorthSandboxCloudTool';
import { ZavorthWorkflowBuilderTool } from '../../src/tools/ZavorthWorkflowBuilderTool';
import { ZavorthEdgeComputingTool } from '../../src/tools/ZavorthEdgeComputingTool';

describe('ZavorthSandboxCloudTool', () => {
  const tool = new ZavorthSandboxCloudTool({ storageDir: fs.mkdtempSync(path.join(os.tmpdir(), 'sandbox-')) });

  it('exposes correct name', () => { expect(tool.name).toBe('zavorth_sandbox_cloud'); });
  it('returns error without action', async () => { expect(await tool.execute({})).toContain('Error'); });
  it('lists providers', async () => { expect(await tool.execute({ action: 'list_providers' })).toContain('local-docker'); });
  it('lists sandboxes when empty', async () => { expect(await tool.execute({ action: 'list' })).toContain('No sandboxes'); });
  it('returns error for non-existent sandbox', async () => { expect(await tool.execute({ action: 'status', sandbox_id: 'nonexistent' })).toContain('not found'); });
  it('returns error for invalid action', async () => { expect(await tool.execute({ action: 'there isck' })).toContain('invalid'); });
});

describe('ZavorthWorkflowBuilderTool', () => {
  let tool: ZavorthWorkflowBuilderTool;
  let tempDir: string;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-')); tool = new ZavorthWorkflowBuilderTool({ storageDir: tempDir }); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('exposes correct name', () => { expect(tool.name).toBe('zavorth_workflow_builder'); });
  it('returns error without action', async () => { expect(await tool.execute({})).toContain('Error'); });
  it('creates a workflow', async () => {
    const result = await tool.execute({ action: 'create', name: 'Test Workflow', description: 'A test' });
    expect(result).toContain('created');
  });
  it('lists workflows', async () => {
    await tool.execute({ action: 'create', name: 'WF1' });
    const result = await tool.execute({ action: 'list' });
    expect(result).toContain('WF1');
  });
  it('gets workflow details', async () => {
    const create = await tool.execute({ action: 'create', name: 'Detail Test' });
    const id = create.match(/ID (wf_\w+)/)?.[1] || '';
    const result = await tool.execute({ action: 'get', workflow_id: id });
    expect(result).toContain('Detail Test');
  });
  it('adds a trigger node', async () => {
    const create = await tool.execute({ action: 'create', name: 'Node Test' });
    const id = create.match(/ID (wf_\w+)/)?.[1] || '';
    const result = await tool.execute({ action: 'add_node', workflow_id: id, node_name: 'On Start', node_type: 'trigger' });
    expect(result).toContain('added');
  });
  it('adds an action node', async () => {
    const create = await tool.execute({ action: 'create', name: 'Action Test' });
    const id = create.match(/ID (wf_\w+)/)?.[1] || '';
    const result = await tool.execute({ action: 'add_node', workflow_id: id, node_name: 'Send Email', node_type: 'action' });
    expect(result).toContain('added');
  });
  it('adds an edge between nodes', async () => {
    const create = await tool.execute({ action: 'create', name: 'Edge Test' });
    const id = create.match(/ID (wf_\w+)/)?.[1] || '';
    await tool.execute({ action: 'add_node', workflow_id: id, node_name: 'A', node_type: 'trigger' });
    await tool.execute({ action: 'add_node', workflow_id: id, node_name: 'B', node_type: 'action' });
    const get = await tool.execute({ action: 'get', workflow_id: id });
    const nodes = get.match(/node_\w+/g) || [];
    if (nodes.length >= 2) {
      const result = await tool.execute({ action: 'add_edge', workflow_id: id, source_node: nodes[0], target_node: nodes[1] });
      expect(result).toContain('Edge created');
    }
  });
  it('runs a workflow', async () => {
    const create = await tool.execute({ action: 'create', name: 'Run Test' });
    const id = create.match(/ID (wf_\w+)/)?.[1] || '';
    await tool.execute({ action: 'add_node', workflow_id: id, node_name: 'Start', node_type: 'trigger' });
    const result = await tool.execute({ action: 'run', workflow_id: id });
    expect(result).toContain('executed');
  });
  it('enables and disables workflow', async () => {
    const create = await tool.execute({ action: 'create', name: 'Toggle Test' });
    const id = create.match(/ID (wf_\w+)/)?.[1] || '';
    const disable = await tool.execute({ action: 'disable', workflow_id: id });
    expect(disable).toContain('disabled');
    const enable = await tool.execute({ action: 'enable', workflow_id: id });
    expect(enable).toContain('enabled');
  });
  it('deletes a workflow', async () => {
    const create = await tool.execute({ action: 'create', name: 'Delete Test' });
    const id = create.match(/ID (wf_\w+)/)?.[1] || '';
    const result = await tool.execute({ action: 'delete', workflow_id: id });
    expect(result).toContain('deleted');
  });
  it('exports and imports workflow', async () => {
    const create = await tool.execute({ action: 'create', name: 'Export Test' });
    const id = create.match(/ID (wf_\w+)/)?.[1] || '';
    const exported = await tool.execute({ action: 'export', workflow_id: id });
    expect(exported).toContain('Export Test');
    const imported = await tool.execute({ action: 'import', workflow_json: exported });
    expect(imported).toContain('imported');
  });
  it('returns error for non-existent workflow', async () => {
    expect(await tool.execute({ action: 'get', workflow_id: 'nonexistent' })).toContain('not found');
  });
});

describe('ZavorthEdgeComputingTool', () => {
  it('exposes correct name', () => {
    const tool = new ZavorthEdgeComputingTool();
    expect(tool.name).toBe('zavorth_edge_computing');
  });

  it('returns error without action', async () => {
    const tool = new ZavorthEdgeComputingTool();
    expect(await tool.execute({})).toContain('Error');
  });

  it('lists providers', async () => {
    const tool = new ZavorthEdgeComputingTool();
    expect(await tool.execute({ action: 'list_providers' })).toContain('cloudflare-workers');
  });

  it('lists workers', async () => {
    const tool = new ZavorthEdgeComputingTool();
    const result = await tool.execute({ action: 'list' });
    expect(result).toBeTruthy();
  });

  it('returns error for invalid action', async () => {
    const tool = new ZavorthEdgeComputingTool();
    expect(await tool.execute({ action: 'there isck' })).toContain('invalid');
  });
});
