/**
 * Git Worktree Manager.
 * Creates and manages isolated Git worktrees for subagents and background swarm workers.
 * Guarantees that agent modifications and tests run in isolated directory trees without
 * clobbering the developer's active working tree or uncommitted files.
 * Strictly typed (Zero any) and EN-First.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from '../../logger.js';

const execFileAsync = promisify(execFile);

export interface WorktreeInfo {
  id: string;
  path: string;
  branch: string;
  baseBranch: string;
  createdAt: string;
}

export interface WorktreeCommitResult {
  commitHash: string;
  branch: string;
  filesChanged: number;
}

export class GitWorktreeManager {
  private readonly projectRoot: string;
  private readonly worktreesDir: string;
  private readonly activeWorktrees = new Map<string, WorktreeInfo>();

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
    this.worktreesDir = path.join(this.projectRoot, '.zavorth', 'worktrees');
  }

  private async execGit(args: string[], cwd: string = this.projectRoot): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', args, { cwd });
      return stdout.trim();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.debug(`[GitWorktree] git ${args.join(' ')}: ${errorMsg}`);
      throw new Error(`Git error: ${errorMsg}`);
    }
  }

  public async isGitRepository(): Promise<boolean> {
    try {
      const result = await this.execGit(['rev-parse', '--is-inside-work-tree']);
      return result === 'true';
    } catch {
      return false;
    }
  }

  public async getCurrentBranch(): Promise<string> {
    try {
      return await this.execGit(['rev-parse', '--abbrev-ref', 'HEAD']);
    } catch {
      return 'main';
    }
  }

  /**
   * Creates an isolated Git worktree linked to the main repository.
   */
  public async createWorktree(worktreeId: string, baseBranch?: string): Promise<WorktreeInfo> {
    const isRepo = await this.isGitRepository();
    if (!isRepo) {
      throw new Error(`[GitWorktree] Project root "${this.projectRoot}" is not a valid Git repository.`);
    }

    const safeId = worktreeId.replace(/[^a-zA-Z0-9-_]/g, '_');
    const targetDir = path.join(this.worktreesDir, safeId);
    const branchName = `agent/worktree-${safeId}`;
    const base = baseBranch || (await this.getCurrentBranch());

    if (!fs.existsSync(this.worktreesDir)) {
      fs.mkdirSync(this.worktreesDir, { recursive: true });
    }

    // Clean up if branch or directory exists
    try {
      if (fs.existsSync(targetDir)) {
        await this.cleanupWorktree(safeId);
      }
      await this.execGit(['branch', '-D', branchName]);
    } catch {
      // ignore if branch didn't exist
    }

    logger.info(`[GitWorktree] Creating isolated worktree at "${targetDir}" on branch "${branchName}".`);
    await this.execGit(['worktree', 'add', '-b', branchName, targetDir, base]);

    const info: WorktreeInfo = {
      id: safeId,
      path: targetDir,
      branch: branchName,
      baseBranch: base,
      createdAt: new Date().toISOString(),
    };

    this.activeWorktrees.set(safeId, info);
    return info;
  }

  /**
   * Gets diff of changes made inside the isolated worktree compared to base.
   */
  public async getWorktreeDiff(worktreeId: string): Promise<string> {
    const info = this.activeWorktrees.get(worktreeId);
    const worktreePath = info ? info.path : path.join(this.worktreesDir, worktreeId);

    if (!fs.existsSync(worktreePath)) {
      throw new Error(`[GitWorktree] Worktree directory "${worktreePath}" does not exist.`);
    }

    // Include new untracked files into diff via intent-to-add
    try {
      await this.execGit(['add', '-N', '.'], worktreePath);
    } catch {
      // ignore
    }

    return await this.execGit(['diff', 'HEAD'], worktreePath);
  }

  /**
   * Commits all changes made inside the isolated worktree.
   */
  public async commitWorktree(worktreeId: string, message: string): Promise<WorktreeCommitResult> {
    const info = this.activeWorktrees.get(worktreeId);
    const worktreePath = info ? info.path : path.join(this.worktreesDir, worktreeId);

    if (!fs.existsSync(worktreePath)) {
      throw new Error(`[GitWorktree] Worktree directory "${worktreePath}" does not exist.`);
    }

    await this.execGit(['add', '-A'], worktreePath);
    await this.execGit(['commit', '-m', message], worktreePath);

    const commitHash = await this.execGit(['rev-parse', 'HEAD'], worktreePath);
    const branch = await this.execGit(['rev-parse', '--abbrev-ref', 'HEAD'], worktreePath);

    return {
      commitHash,
      branch,
      filesChanged: 1,
    };
  }

  /**
   * Removes and prunes an isolated worktree safely.
   */
  public async cleanupWorktree(worktreeId: string): Promise<boolean> {
    const safeId = worktreeId.replace(/[^a-zA-Z0-9-_]/g, '_');
    const targetDir = path.join(this.worktreesDir, safeId);
    const branchName = `agent/worktree-${safeId}`;

    try {
      if (fs.existsSync(targetDir)) {
        await this.execGit(['worktree', 'remove', '--force', targetDir]);
      }
    } catch {
      // Fallback: directory deletion if git command failed on Windows
      if (fs.existsSync(targetDir)) {
        try {
          fs.rmSync(targetDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        } catch {
          // ignore
        }
      }
    }

    try {
      await this.execGit(['worktree', 'prune']);
      await this.execGit(['branch', '-D', branchName]);
    } catch {
      // ignore
    }

    this.activeWorktrees.delete(safeId);
    logger.info(`[GitWorktree] Cleaned up worktree "${safeId}".`);
    return true;
  }

  public listActiveWorktrees(): WorktreeInfo[] {
    return Array.from(this.activeWorktrees.values());
  }
}
