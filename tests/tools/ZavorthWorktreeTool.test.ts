import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ZavorthWorktreeTool } from '../../src/tools/ZavorthWorktreeTool.js';
import { GitWorktreeManager } from '../../src/agents/worktree/GitWorktreeManager.js';

jest.setTimeout(120000);

describe('ZavorthWorktreeTool', () => {
  const testRepoDir = path.join(process.cwd(), '.zavorth', 'test_tool_git_repo');

  beforeAll(() => {
    if (fs.existsSync(testRepoDir)) {
      try {
        fs.rmSync(testRepoDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
    fs.mkdirSync(testRepoDir, { recursive: true });
    execFileSync('git', ['init', '-b', 'main'], { cwd: testRepoDir });
    execFileSync('git', ['config', 'user.email', 'tool@zavorth.agent'], { cwd: testRepoDir });
    execFileSync('git', ['config', 'user.name', 'Tool Agent'], { cwd: testRepoDir });
    fs.writeFileSync(path.join(testRepoDir, 'README.md'), '# Tool Test Repo\n', 'utf-8');
    execFileSync('git', ['add', 'README.md'], { cwd: testRepoDir });
    execFileSync('git', ['commit', '-m', 'initial commit'], { cwd: testRepoDir });

    const manager = new GitWorktreeManager(testRepoDir);
    (ZavorthWorktreeTool as any).globalManager = manager;
  });

  afterAll(() => {
    if (fs.existsSync(testRepoDir)) {
      try {
        fs.rmSync(testRepoDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('should create, list, inspect diff, and cleanup an isolated worktree via tool execute', async () => {
    const testId = `tool_wt_${Date.now()}`;

    // 1. Create
    const createRaw = await ZavorthWorktreeTool.execute({
      action: 'create',
      worktreeId: testId,
    });
    const createParsed = JSON.parse(createRaw);
    expect(createParsed.status).toBe('success');
    expect(createParsed.worktree).toBeDefined();
    expect(createParsed.worktree.id).toBe(testId);

    // 2. List
    const listRaw = await ZavorthWorktreeTool.execute({
      action: 'list',
    });
    const listParsed = JSON.parse(listRaw);
    expect(listParsed.status).toBe('success');
    expect(listParsed.total).toBeGreaterThanOrEqual(1);
    expect(listParsed.worktrees.some((w: any) => w.id === testId)).toBe(true);

    // 3. Diff
    const diffRaw = await ZavorthWorktreeTool.execute({
      action: 'diff',
      worktreeId: testId,
    });
    const diffParsed = JSON.parse(diffRaw);
    expect(diffParsed.status).toBe('success');
    expect(diffParsed.action).toBe('diff');

    // 4. Cleanup
    const cleanupRaw = await ZavorthWorktreeTool.execute({
      action: 'cleanup',
      worktreeId: testId,
    });
    const cleanupParsed = JSON.parse(cleanupRaw);
    expect(cleanupParsed.status).toBe('success');
  });
});
