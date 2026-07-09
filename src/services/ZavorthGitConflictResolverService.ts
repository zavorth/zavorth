import { execFileSync } from 'child_process';
import fs from 'fs';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike';

export interface MergeResult {
  success: boolean;
  conflictFiles: string[];
  output: string;
}

export class ZavorthGitConflictResolverService {
  private readonly gitPath: string;
  private readonly cwd: string;

  constructor(options?: { gitPath?: string; cwd?: string }) {
    this.gitPath = options?.gitPath || 'git';
    this.cwd = options?.cwd || process.cwd();
  }

  /**
   * Attempts to merge a branch into the current HEAD.
   *
   * @param branchName - The branch to merge from
   * @returns MergeResult with status, conflicts, and output logs
   */
  public autoMerge(branchName: string): MergeResult {
    logger.info(`[Git Conflict Resolver] Attempting to merge branch: ${branchName}...`);
    try {
      // 1. Run git merge
      const stdout = execFileSync(this.gitPath, ['merge', branchName], {
        cwd: this.cwd,
        encoding: 'utf8',
        timeout: 15000,
      });

      logger.info(`[Git Conflict Resolver] Merge completed successfully (no conflicts).`);
      return { success: true, conflictFiles: [], output: stdout };
    } catch (error: unknown) {
      const output = error.stdout?.toString() || error.message || '';
      logger.warn(`[Git Conflict Resolver] Merge failed or encountered conflicts: ${output}`);

      // 2. Identify unmerged (conflicting) files
      const conflictFiles = this.getConflictFiles();
      
      return {
        success: false,
        conflictFiles,
        output,
      };
    }
  }

  /**
   * Gets list of unmerged files that have conflicts.
   */
  public getConflictFiles(): string[] {
    try {
      const stdout = execFileSync(this.gitPath, ['diff', '--name-only', '--diff-filter=U'], {
        cwd: this.cwd,
        encoding: 'utf8',
      });
      return stdout.split('\n').map((f) => f.trim()).filter(Boolean);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.error(`[Git Conflict Resolver] Failed to check conflict files: ${err}`);
      return [];
    }
  }

  /**
   * Resolves conflict on a specific file using ours or theirs strategy.
   *
   * @param filePath - Path to conflicting file
   * @param strategy - 'ours' (keep current HEAD) or 'theirs' (keep incoming branch)
   */
  public resolveConflict(filePath: string, strategy: 'ours' | 'theirs'): boolean {
    if (!fs.existsSync(filePath)) {
      logger.error(`[Git Conflict Resolver] File not found: ${filePath}`);
      return false;
    }

    try {
      logger.info(`[Git Conflict Resolver] Resolving conflict in ${filePath} using strategy: ${strategy}...`);
      
      // Checkout ours or theirs version
      const option = strategy === 'ours' ? '--ours' : '--theirs';
      execFileSync(this.gitPath, ['checkout', option, '--', filePath], {
        cwd: this.cwd,
        stdio: 'ignore',
      });

      // Stage the resolved file
      execFileSync(this.gitPath, ['add', '--', filePath], {
        cwd: this.cwd,
        stdio: 'ignore',
      });

      logger.info(`[Git Conflict Resolver] Resolved and staged ${filePath}.`);
      return true;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.error(`[Git Conflict Resolver] Failed to resolve conflict for ${filePath}: ${err}`);
      return false;
    }
  }

  /**
   * Finalizes the merge commit after all conflicts are staged.
   */
  public finalizeMerge(commitMessage: string = 'Auto-resolved merge conflicts'): boolean {
    try {
      logger.info('[Git Conflict Resolver] Finalizing merge commit...');
      execFileSync(this.gitPath, ['commit', '-m', commitMessage], {
        cwd: this.cwd,
        stdio: 'ignore',
      });
      logger.info('[Git Conflict Resolver] Merge commit finalized.');
      return true;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.error(`[Git Conflict Resolver] Failed to finalize merge commit: ${err}`);
      return false;
    }
  }

  /**
   * Aborts the current merge and restores the workspace HEAD.
   */
  public abortMerge(): boolean {
    try {
      logger.info('[Git Conflict Resolver] Aborting merge...');
      execFileSync(this.gitPath, ['merge', '--abort'], {
        cwd: this.cwd,
        stdio: 'ignore',
      });
      return true;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.error(`[Git Conflict Resolver] Failed to abort merge: ${err}`);
      return false;
    }
  }
}
