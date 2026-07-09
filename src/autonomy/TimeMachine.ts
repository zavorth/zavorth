import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { asErrorLike } from '../utils/errorLike';

function copyRecursive(src: string, dest: string, exclude: Set<string>): void {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      if (exclude.has(entry)) {
        continue;
      }
      copyRecursive(path.join(src, entry), path.join(dest, entry), exclude);
    }
  } else if (stats.isFile()) {
    const parentDir = path.dirname(dest);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

function deleteRecursive(dir: string, exclude: Set<string>): void {
  if (!fs.existsSync(dir)) {
    return;
  }
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    if (exclude.has(entry)) {
      continue;
    }
    const entryPath = path.join(dir, entry);
    const stats = fs.statSync(entryPath);
    if (stats.isDirectory()) {
      deleteRecursive(entryPath, new Set());
      try {
        fs.rmdirSync(entryPath);
      } catch (error: unknown) {// Best effort
      }
    } else {
      try {
        fs.unlinkSync(entryPath);
      } catch (error: unknown) {// Best effort
      }
    }
  }
}

export class TimeMachine {
  /**
   * Creates a workspace snapshot before changes are made.
   * Uses git stash for repositories, or local file backups as fallback.
   */
  public static async createSnapshot(workspacePath: string): Promise<string> {
    if (!workspacePath || typeof workspacePath !== 'string' || workspacePath.trim() === '') {
      throw new Error('Invalid workspace path');
    }
    if (!fs.existsSync(workspacePath) || !fs.statSync(workspacePath).isDirectory()) {
      throw new Error('Workspace path does not exist or is not a directory');
    }

    const snapshotId = `tm-${Date.now()}`;
    let isGit = false;

    const hasGitDir = fs.existsSync(path.join(workspacePath, '.git'));
    if (hasGitDir) {
      try {
        // Check if git repository
        isGit = execSync('git rev-parse --is-inside-work-tree', { cwd: workspacePath, stdio: 'pipe' })
          .toString()
          .trim() === 'true';
      } catch (error: unknown) {// Git command failed or not a repo
      }
    }

    if (isGit) {
      try {
        // Save current changes to stash
        execSync(`git stash push -m "zavorth-snapshot-${snapshotId}" --include-untracked`, { cwd: workspacePath, stdio: 'pipe' });
        // Keep a copy in current state by popping it back so the user doesn't lose progress during run,
        // but now we have a record in the stash history.
        execSync('git stash apply stash@{0}', { cwd: workspacePath, stdio: 'pipe' });
        return snapshotId;
      } catch (error: unknown) {
        const err = asErrorLike(error);
        console.warn('Git stash failed, trying fallback local snapshot:', err);
      }
    }

    // Fallback: copy files to .zavorth/snapshots/ if not a Git repo or Git stash failed
    try {
      const snapshotDir = path.join(workspacePath, '.zavorth', 'snapshots', snapshotId);
      const exclude = new Set(['.git', 'node_modules', '.zavorth']);
      copyRecursive(workspacePath, snapshotDir, exclude);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      console.error('Local backup snapshot creation failed:', err);
      throw new Error(`Failed to create local snapshot: ${err instanceof Error ? err.message : String(err)}`);
    }

    return snapshotId;
  }

  /**
   * Restores the workspace to the snapshot.
   */
  public static async rollback(workspacePath: string, snapshotId: string): Promise<boolean> {
    if (!workspacePath || typeof workspacePath !== 'string' || workspacePath.trim() === '') {
      throw new Error('Invalid workspace path');
    }
    if (!fs.existsSync(workspacePath) || !fs.statSync(workspacePath).isDirectory()) {
      throw new Error('Workspace path does not exist or is not a directory');
    }
    if (!snapshotId || typeof snapshotId !== 'string' || snapshotId.trim() === '') {
      throw new Error('Invalid snapshot ID');
    }

    let isGit = false;

    const hasGitDir = fs.existsSync(path.join(workspacePath, '.git'));
    if (hasGitDir) {
      try {
        isGit = execSync('git rev-parse --is-inside-work-tree', { cwd: workspacePath, stdio: 'pipe' })
          .toString()
          .trim() === 'true';
      } catch (error: unknown) {// Git command failed or not a repo
      }
    }

    if (isGit) {
      try {
        // Reset hard to HEAD, discard untracked files
        execSync('git reset --hard HEAD', { cwd: workspacePath, stdio: 'pipe' });
        execSync('git clean -fd', { cwd: workspacePath, stdio: 'pipe' });
        
        // Find stash index that matches the snapshotId
        const list = execSync('git stash list', { cwd: workspacePath }).toString();
        const lines = list.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(`zavorth-snapshot-${snapshotId}`)) {
            // Apply this stash and drop it
            execSync(`git stash apply stash@{${i}}`, { cwd: workspacePath, stdio: 'pipe' });
            execSync(`git stash drop stash@{${i}}`, { cwd: workspacePath, stdio: 'pipe' });
            return true;
          }
        }
      } catch (error: unknown) {
        const err = asErrorLike(error);
        console.error('Git rollback failed, trying fallback local restore:', err);
      }
    }

    // Fallback rollback: restore from local backup
    const backupDir = path.join(workspacePath, '.zavorth', 'snapshots', snapshotId);
    if (fs.existsSync(backupDir)) {
      try {
        const exclude = new Set(['.git', 'node_modules', '.zavorth']);
        deleteRecursive(workspacePath, exclude);
        copyRecursive(backupDir, workspacePath, exclude);
        return true;
      } catch (error: unknown) {
        const err = asErrorLike(error);
        console.error('Fallback rollback failed:', err);
      }
    }
    return false;
  }
}
