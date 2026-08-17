/**
 * Isolated Worktree Subagent Runner.
 * Executes autonomous subagent tasks in a dedicated Git worktree branch,
 * generating structured diff receipts and persistable commits.
 */

import { logger } from '../../logger.js';
import { GitWorktreeManager, type WorktreeInfo } from './GitWorktreeManager.js';

export interface WorktreeTaskInput {
  taskId: string;
  taskName: string;
  prompt: string;
  autoCommit?: boolean;
  commitMessage?: string;
  cleanupOnSuccess?: boolean;
  executor?: (worktreePath: string) => Promise<string>;
}

export interface WorktreeTaskResult {
  taskId: string;
  worktree: WorktreeInfo;
  status: 'success' | 'failed';
  diff: string;
  output: string;
  commitHash?: string;
  durationMs: number;
  error?: string;
}

export class IsolatedWorktreeSubagentRunner {
  private readonly manager: GitWorktreeManager;

  constructor(manager: GitWorktreeManager = new GitWorktreeManager()) {
    this.manager = manager;
  }

  public async runTask(input: WorktreeTaskInput): Promise<WorktreeTaskResult> {
    const startTime = Date.now();
    logger.info(`[WorktreeRunner] Starting task "${input.taskName}" (${input.taskId}) in isolated worktree.`);

    let worktree: WorktreeInfo;
    try {
      worktree = await this.manager.createWorktree(input.taskId);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        taskId: input.taskId,
        worktree: { id: input.taskId, path: '', branch: '', baseBranch: '', createdAt: new Date().toISOString() },
        status: 'failed',
        diff: '',
        output: '',
        durationMs: Date.now() - startTime,
        error: `Failed to create isolated worktree: ${errorMsg}`,
      };
    }

    try {
      let output = '';
      if (input.executor) {
        output = await input.executor(worktree.path);
      } else {
        output = `Executed task prompt: "${input.prompt}" in ${worktree.path}`;
      }

      let diff = '';
      try {
        diff = await this.manager.getWorktreeDiff(worktree.id);
      } catch (diffErr: unknown) {
        logger.warn(`[WorktreeRunner] Could not get diff: ${diffErr instanceof Error ? diffErr.message : String(diffErr)}`);
      }

      let commitHash: string | undefined;
      if (input.autoCommit && diff) {
        const msg = input.commitMessage || `feat(subagent): ${input.taskName}`;
        const commitResult = await this.manager.commitWorktree(worktree.id, msg);
        commitHash = commitResult.commitHash;
      }

      const durationMs = Date.now() - startTime;

      if (input.cleanupOnSuccess) {
        await this.manager.cleanupWorktree(worktree.id);
      }

      return {
        taskId: input.taskId,
        worktree,
        status: 'success',
        diff,
        output,
        commitHash,
        durationMs,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`[WorktreeRunner] Task execution failed: ${errorMsg}`);

      return {
        taskId: input.taskId,
        worktree,
        status: 'failed',
        diff: '',
        output: '',
        durationMs,
        error: errorMsg,
      };
    }
  }

  public getManager(): GitWorktreeManager {
    return this.manager;
  }
}
