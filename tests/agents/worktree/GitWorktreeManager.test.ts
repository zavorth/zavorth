import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { GitWorktreeManager } from '../../../src/agents/worktree/GitWorktreeManager.js';

describe('GitWorktreeManager', () => {
  const testRepoDir = path.join(process.cwd(), '.zavorth', 'test_git_repo');
  let manager: GitWorktreeManager;

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
    execFileSync('git', ['config', 'user.email', 'test@zavorth.agent'], { cwd: testRepoDir });
    execFileSync('git', ['config', 'user.name', 'Zavorth Agent'], { cwd: testRepoDir });
    fs.writeFileSync(path.join(testRepoDir, 'README.md'), '# Test Repository\n', 'utf-8');
    execFileSync('git', ['add', 'README.md'], { cwd: testRepoDir });
    execFileSync('git', ['commit', '-m', 'initial commit'], { cwd: testRepoDir });

    manager = new GitWorktreeManager(testRepoDir);
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

  it('should detect valid git repository root', async () => {
    const isRepo = await manager.isGitRepository();
    expect(isRepo).toBe(true);
  });

  it('should detect current branch name', async () => {
    const branch = await manager.getCurrentBranch();
    expect(branch).toBe('main');
  });

  it('should create an isolated worktree, inspect diff, and cleanup cleanly', async () => {
    const worktreeId = `wt_test_${Date.now()}`;
    const info = await manager.createWorktree(worktreeId);

    expect(info.id).toBe(worktreeId);
    expect(info.path).toContain(worktreeId);
    expect(info.branch).toContain(worktreeId);

    const activeList = manager.listActiveWorktrees();
    expect(activeList.some((w) => w.id === worktreeId)).toBe(true);

    const diff = await manager.getWorktreeDiff(worktreeId);
    expect(typeof diff).toBe('string');

    const cleaned = await manager.cleanupWorktree(worktreeId);
    expect(cleaned).toBe(true);
    expect(manager.listActiveWorktrees().some((w) => w.id === worktreeId)).toBe(false);
  });
});
