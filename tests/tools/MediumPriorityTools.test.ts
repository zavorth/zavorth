import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthMultiRepoTool } from '../../src/tools/ZavorthMultiRepoTool';
import { ZavorthDocProviderTool } from '../../src/tools/ZavorthDocProviderTool';
import { ZavorthPromptLibraryTool } from '../../src/tools/ZavorthPromptLibraryTool';
import { ZavorthTokenBudgetTool } from '../../src/tools/ZavorthTokenBudgetTool';
import { ZavorthMemoryGraphTool } from '../../src/tools/ZavorthMemoryGraphTool';

describe('ZavorthMultiRepoTool', () => {
  let tool: ZavorthMultiRepoTool;
  let tempDir: string;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-')); tool = new ZavorthMultiRepoTool({ storageDir: tempDir }); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('exposes correct name', () => { expect(tool.name).toBe('zavorth_multi_repo'); });
  it('returns error without action', async () => { expect(await tool.execute({})).toContain('Error'); });
  it('registers a repo', async () => {
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitrepo-'));
    fs.writeFileSync(path.join(repoDir, 'test.txt'), 'hello');
    const result = await tool.execute({ action: 'register', repo_name: 'myrepo', repo_path: repoDir });
    expect(result).toContain('registered');
    fs.rmSync(repoDir, { recursive: true, force: true });
  });
  it('lists repos', async () => {
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitrepo-'));
    fs.writeFileSync(path.join(repoDir, 'test.txt'), 'hello');
    await tool.execute({ action: 'register', repo_name: 'repo1', repo_path: repoDir });
    const result = await tool.execute({ action: 'list' });
    expect(result).toContain('repo1');
    fs.rmSync(repoDir, { recursive: true, force: true });
  });
  it('removes a repo', async () => {
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitrepo-'));
    fs.writeFileSync(path.join(repoDir, 'test.txt'), 'hello');
    await tool.execute({ action: 'register', repo_name: 'removeme', repo_path: repoDir });
    const result = await tool.execute({ action: 'remove', repo_name: 'removeme' });
    expect(result).toContain('removed');
    fs.rmSync(repoDir, { recursive: true, force: true });
  });
  it('returns error for non-existent repo', async () => {
    expect(await tool.execute({ action: 'status', repo_name: 'nonexistent' })).toContain('not found');
  });
});

describe('ZavorthDocProviderTool', () => {
  const tool = new ZavorthDocProviderTool({ cacheDir: fs.mkdtempSync(path.join(os.tmpdir(), 'docs-')) });

  it('exposes correct name', () => { expect(tool.name).toBe('zavorth_doc_provider'); });
  it('returns error without action', async () => { expect(await tool.execute({})).toContain('Error'); });
  it('searches for libraries', async () => {
    const result = await tool.execute({ action: 'search', query: 'react' });
    expect(result).toContain('React');
  });
  it('searches by partial name', async () => {
    const result = await tool.execute({ action: 'search', query: 'prisma' });
    expect(result).toContain('Prisma');
  });
  it('lists cached docs', async () => {
    const result = await tool.execute({ action: 'list_cached' });
    expect(result).toBeTruthy();
  });
  it('clears cache', async () => {
    const result = await tool.execute({ action: 'clear_cache' });
    expect(result).toContain('Cleared');
  });
  it('registers custom library', async () => {
    const result = await tool.execute({ action: 'register_library', library: 'mylib', url: 'https://docs.mylib.dev' });
    expect(result).toContain('registered');
  });
  it('returns error for unknown library lookup', async () => {
    const result = await tool.execute({ action: 'lookup', library: 'nonexistent_lib_xyz' });
    expect(result).toContain('not known');
  });
});

describe('ZavorthPromptLibraryTool', () => {
  let tool: ZavorthPromptLibraryTool;
  let tempDir: string;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-lib-')); tool = new ZavorthPromptLibraryTool({ storageDir: tempDir }); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('exposes correct name', () => { expect(tool.name).toBe('zavorth_prompt_library'); });
  it('returns error without action', async () => { expect(await tool.execute({})).toContain('Error'); });
  it('lists default templates', async () => {
    const result = await tool.execute({ action: 'list' });
    expect(result).toContain('PROMPT-');
  });
  it('gets a template', async () => {
    const result = await tool.execute({ action: 'get', template_id: 'PROMPT-001' });
    expect(result).toContain('Code Generation');
  });
  it('lists by category', async () => {
    const result = await tool.execute({ action: 'list', category: 'code_gen' });
    expect(result).toContain('code_gen');
  });
  it('adds a custom template', async () => {
    const result = await tool.execute({ action: 'add', name: 'Custom', template: 'Do {task} with {tool}', category: 'custom' });
    expect(result).toContain('added');
    expect(result).toContain('task');
  });
  it('uses a template', async () => {
    const result = await tool.execute({ action: 'use', template_id: 'PROMPT-001' });
    expect(result).toContain('used');
  });
  it('gets stats', async () => {
    const result = await tool.execute({ action: 'stats' });
    expect(result).toContain('Templates');
  });
  it('gets categories', async () => {
    const result = await tool.execute({ action: 'categories' });
    expect(result).toContain('code_gen');
  });
  it('compares templates', async () => {
    const result = await tool.execute({ action: 'compare', template_id: 'PROMPT-001', template_b: 'PROMPT-002' });
    expect(result).toContain('Comparison');
  });
});

describe('ZavorthTokenBudgetTool', () => {
  let tool: ZavorthTokenBudgetTool;
  let tempDir: string;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-')); tool = new ZavorthTokenBudgetTool({ storageDir: tempDir }); });
  afterEach(() => { tool.close(); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('exposes correct name', () => { expect(tool.name).toBe('zavorth_token_budget'); });
  it('returns error without action', async () => { expect(await tool.execute({})).toContain('Error'); });
  it('lists default budgets', async () => {
    const result = await tool.execute({ action: 'list_budgets' });
    expect(result).toContain('BUDGET-');
  });
  it('records usage', async () => {
    const result = await tool.execute({ action: 'record', model: 'gpt-4o', input_tokens: 100, output_tokens: 200, cost_usd: 0.01, task_type: 'chat' });
    expect(result).toContain('recorded');
  });
  it('checks budget status', async () => {
    await tool.execute({ action: 'record', model: 'gpt-4o', input_tokens: 1000, output_tokens: 2000, cost_usd: 0.05 });
    const result = await tool.execute({ action: 'check', scope: 'global', input_tokens: 100, cost_usd: 0.01 });
    expect(result).toContain('OK');
  });
  it('gets status', async () => {
    const result = await tool.execute({ action: 'status', scope: 'global' });
    expect(result).toContain('Budget Status');
  });
  it('generates report', async () => {
    await tool.execute({ action: 'record', model: 'test', input_tokens: 100, output_tokens: 200, cost_usd: 0.01 });
    const result = await tool.execute({ action: 'report' });
    expect(result).toContain('Token Budget Report');
  });
  it('gets optimization suggestions', async () => {
    const result = await tool.execute({ action: 'optimize' });
    expect(result).toContain('Suggestions');
  });
  it('sets custom budget', async () => {
    const result = await tool.execute({ action: 'set_budget', scope: 'task', limit_tokens: 10000, limit_cost_usd: 0.5 });
    expect(result).toBeTruthy();
  });
  it('resets usage', async () => {
    await tool.execute({ action: 'record', model: 'test', input_tokens: 100, output_tokens: 200, cost_usd: 0.01 });
    const result = await tool.execute({ action: 'reset' });
    expect(result).toContain('Reset');
  });
});

describe('ZavorthMemoryGraphTool', () => {
  let tool: ZavorthMemoryGraphTool;
  let tempDir: string;
  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-')); tool = new ZavorthMemoryGraphTool({ storageDir: tempDir }); });
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('exposes correct name', () => { expect(tool.name).toBe('zavorth_memory_graph'); });
  it('returns error without action', async () => { expect(await tool.execute({})).toContain('Unknown action'); });
  it('adds a fact', async () => {
    const result = await tool.execute({ action: 'add_fact', subject: 'TypeScript', object: 'Typed superset of JavaScript', relation: 'is_a' });
    expect(result).toContain('Consolidated fact');
  });
  it('queries facts', async () => {
    await tool.execute({ action: 'add_fact', subject: 'TypeScript', object: 'Typed JavaScript', relation: 'is_a' });
    const result = await tool.execute({ action: 'query', keyword: 'typescript' });
    expect(result).toContain('TypeScript');
  });
  it('gets stats', async () => {
    await tool.execute({ action: 'add_fact', subject: 'Test', object: 'data', relation: 'has' });
    const result = await tool.execute({ action: 'stats' });
    expect(result).toContain('totalNodes');
  });
  it('gets subgraph', async () => {
    await tool.execute({ action: 'add_fact', subject: 'Test', object: 'data', relation: 'has' });
    const result = await tool.execute({ action: 'get_subgraph', nodeId: 'test' });
    expect(result).toContain('subgraph');
  });
  it('clears the graph', async () => {
    await tool.execute({ action: 'add_fact', subject: 'Delete Me', object: 'data', relation: 'has' });
    const stats = await tool.execute({ action: 'stats' });
    const result = await tool.execute({ action: 'clear' });
    expect(result).toContain('cleared');
  });
  it('returns error for unknown action', async () => {
    expect(await tool.execute({ action: 'unknown_action' })).toContain('Unknown action');
  });
});
