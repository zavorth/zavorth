import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { ZavorthGitConflictResolverService } from '../../src/services/ZavorthGitConflictResolverService.js';

describe('ZavorthGitConflictResolverService', () => {
  let tempRepoDir = '';
  let resolver: ZavorthGitConflictResolverService;

  beforeEach(() => {
    // 1. Create temporary directory for Git repo
    tempRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-git-test-'));
    resolver = new ZavorthGitConflictResolverService({ cwd: tempRepoDir });

    try {
      // 2. Initialize Git repo and configure dummy user
      execFileSync('git', ['init'], { cwd: tempRepoDir, stdio: 'ignore' });
      execFileSync('git', ['checkout', '-b', 'main'], { cwd: tempRepoDir, stdio: 'ignore' });
      execFileSync('git', ['config', 'user.email', 'test@zavorth.com'], { cwd: tempRepoDir, stdio: 'ignore' });
      execFileSync('git', ['config', 'user.name', 'Zavorth Test'], { cwd: tempRepoDir, stdio: 'ignore' });
    } catch (err) {
      // If git is not installed in the environment, skip tests
      tempRepoDir = '';
    }
  });

  afterEach(() => {
    if (tempRepoDir && fs.existsSync(tempRepoDir)) {
      fs.rmSync(tempRepoDir, { recursive: true, force: true });
    }
  });

  it('detects conflict and resolves it using ours strategy', () => {
    if (!tempRepoDir) return; // skip if git not available

    const filePath = path.join(tempRepoDir, 'conflict.txt');
    const relativePath = 'conflict.txt';

    // 1. Commit initial file on main
    fs.writeFileSync(filePath, 'Initial base line\n', 'utf-8');
    execFileSync('git', ['add', 'conflict.txt'], { cwd: tempRepoDir, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', 'initial commit'], { cwd: tempRepoDir, stdio: 'ignore' });

    // 2. Create branch-a and commit change
    execFileSync('git', ['checkout', '-b', 'branch-a'], { cwd: tempRepoDir, stdio: 'ignore' });
    fs.writeFileSync(filePath, 'Line changed on branch A\n', 'utf-8');
    execFileSync('git', ['commit', '-am', 'change on branch a'], { cwd: tempRepoDir, stdio: 'ignore' });

    // 3. Return to main and commit different change to trigger conflict
    execFileSync('git', ['checkout', 'main'], { cwd: tempRepoDir, stdio: 'ignore' });
    fs.writeFileSync(filePath, 'Line changed on main branch\n', 'utf-8');
    execFileSync('git', ['commit', '-am', 'change on main'], { cwd: tempRepoDir, stdio: 'ignore' });

    // 4. Try autoMerge from branch-a (should fail due to conflicts)
    const mergeResult = resolver.autoMerge('branch-a');
    expect(mergeResult.success).toBe(false);
    expect(mergeResult.conflictFiles).toContain(relativePath);

    // 5. Resolve conflict using 'ours' (keeps main changes)
    const resolved = resolver.resolveConflict(filePath, 'ours');
    expect(resolved).toBe(true);

    // 6. Commit resolved state
    const finalized = resolver.finalizeMerge();
    expect(finalized).toBe(true);

    // 7. Verify file contains main's content
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    expect(fileContent).toContain('Line changed on main branch');
    expect(fileContent).not.toContain('Line changed on branch A');
  });

  it('detects conflict and resolves it using theirs strategy', () => {
    if (!tempRepoDir) return;

    const filePath = path.join(tempRepoDir, 'conflict.txt');
    const relativePath = 'conflict.txt';

    fs.writeFileSync(filePath, 'Initial base line\n', 'utf-8');
    execFileSync('git', ['add', 'conflict.txt'], { cwd: tempRepoDir, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', 'initial commit'], { cwd: tempRepoDir, stdio: 'ignore' });

    execFileSync('git', ['checkout', '-b', 'branch-a'], { cwd: tempRepoDir, stdio: 'ignore' });
    fs.writeFileSync(filePath, 'Line changed on branch A\n', 'utf-8');
    execFileSync('git', ['commit', '-am', 'change on branch a'], { cwd: tempRepoDir, stdio: 'ignore' });

    execFileSync('git', ['checkout', 'main'], { cwd: tempRepoDir, stdio: 'ignore' });
    fs.writeFileSync(filePath, 'Line changed on main branch\n', 'utf-8');
    execFileSync('git', ['commit', '-am', 'change on main'], { cwd: tempRepoDir, stdio: 'ignore' });

    const mergeResult = resolver.autoMerge('branch-a');
    expect(mergeResult.success).toBe(false);

    // Resolve conflict using 'theirs' (keeps branch-a changes)
    const resolved = resolver.resolveConflict(filePath, 'theirs');
    expect(resolved).toBe(true);

    const finalized = resolver.finalizeMerge();
    expect(finalized).toBe(true);

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    expect(fileContent).toContain('Line changed on branch A');
    expect(fileContent).not.toContain('Line changed on main branch');
  });
});
