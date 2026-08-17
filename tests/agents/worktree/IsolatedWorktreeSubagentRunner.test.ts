import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { GitWorktreeManager } from '../../../src/agents/worktree/GitWorktreeManager.js';
import { IsolatedWorktreeSubagentRunner } from '../../../src/agents/worktree/IsolatedWorktreeSubagentRunner.js';

describe('IsolatedWorktreeSubagentRunner', () => {
  const testRepoDir = path.join(process.cwd(), '.zavorth', 'test_runner_git_repo');
  let runner: IsolatedWorktreeSubagentRunner;

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
    execFileSync('git', ['config', 'user.email', 'runner@zavorth.agent'], { cwd: testRepoDir });
    execFileSync('git', ['config', 'user.name', 'Runner Agent'], { cwd: testRepoDir });
    fs.writeFileSync(path.join(testRepoDir, 'README.md'), '# Runner Test Repo\n', 'utf-8');
    execFileSync('git', ['add', 'README.md'], { cwd: testRepoDir });
    execFileSync('git', ['commit', '-m', 'initial commit'], { cwd: testRepoDir });

    const manager = new GitWorktreeManager(testRepoDir);
    runner = new IsolatedWorktreeSubagentRunner(manager);
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

  it('should run a subagent task in isolated worktree and generate diff & commit', async () => {
    const taskId = `task_iso_${Date.now()}`;
    const result = await runner.runTask({
      taskId,
      taskName: 'Refactor Utility Function',
      prompt: 'Modify a temporary test file in worktree',
      autoCommit: true,
      commitMessage: 'test(worktree): isolated agent file edit',
      cleanupOnSuccess: true,
      executor: async (worktreePath) => {
        const dummyFile = path.join(worktreePath, 'WORKTREE_TEST_TEMP.md');
        fs.writeFileSync(dummyFile, '# Isolated Subagent Run\nGenerated successfully.\n', 'utf-8');
        return 'Wrote temporary file inside isolated worktree.';
      },
    });

    expect(result.status).toBe('success');
    expect(result.taskId).toBe(taskId);
    expect(result.diff).toContain('WORKTREE_TEST_TEMP.md');
    expect(result.commitHash).toBeDefined();
    expect(result.durationMs).toBeGreaterThan(0);
  });
});
