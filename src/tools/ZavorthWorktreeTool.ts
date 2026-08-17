/**
 * Zavorth Worktree Tool.
 * Exposes isolated Git worktree creation, diff inspection, atomic commits,
 * and workspace cleanup via ToolRegistry and Cognitive Firewall.
 */

import { BaseTool } from './BaseTool.js';
import { GitWorktreeManager } from '../agents/worktree/GitWorktreeManager.js';

export interface ZavorthWorktreeInput {
  action: 'create' | 'list' | 'diff' | 'commit' | 'cleanup';
  worktreeId?: string;
  baseBranch?: string;
  commitMessage?: string;
}

export class ZavorthWorktreeTool extends BaseTool {
  public static readonly name = 'zavorth_worktree';
  public static readonly description =
    'Creates and manages isolated Git worktrees for subagents, allowing background code edits and test runs without affecting the user working tree.';

  public static readonly schema = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'list', 'diff', 'commit', 'cleanup'],
        description: 'Action to perform on isolated git worktrees.',
      },
      worktreeId: {
        type: 'string',
        description: 'Unique worktree ID or task name.',
      },
      baseBranch: {
        type: 'string',
        description: 'Optional base branch to branch off from (default: current branch).',
      },
      commitMessage: {
        type: 'string',
        description: 'Commit message when action is commit.',
      },
    },
    required: ['action'] as string[],
  };

  private static globalManager: GitWorktreeManager | null = null;

  public static getManager(): GitWorktreeManager {
    if (!this.globalManager) {
      this.globalManager = new GitWorktreeManager();
    }
    return this.globalManager;
  }

  readonly name = ZavorthWorktreeTool.name;
  readonly description = ZavorthWorktreeTool.description;
  readonly parameters = ZavorthWorktreeTool.schema;

  public async execute(args: Record<string, unknown>): Promise<string> {
    return ZavorthWorktreeTool.execute(args as unknown as ZavorthWorktreeInput);
  }

  public static async execute(input: ZavorthWorktreeInput): Promise<string> {
    const manager = this.getManager();

    switch (input.action) {
      case 'create': {
        if (!input.worktreeId) {
          return JSON.stringify({
            status: 'error',
            message: 'worktreeId is required to create an isolated worktree.',
          });
        }
        try {
          const info = await manager.createWorktree(input.worktreeId, input.baseBranch);
          return JSON.stringify({
            status: 'success',
            action: 'create',
            worktree: info,
            message: `Isolated worktree "${info.id}" created at "${info.path}" on branch "${info.branch}".`,
          });
        } catch (err: unknown) {
          return JSON.stringify({
            status: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }

      case 'list': {
        const active = manager.listActiveWorktrees();
        return JSON.stringify({
          status: 'success',
          action: 'list',
          total: active.length,
          worktrees: active,
        });
      }

      case 'diff': {
        if (!input.worktreeId) {
          return JSON.stringify({
            status: 'error',
            message: 'worktreeId is required to inspect diff.',
          });
        }
        try {
          const diff = await manager.getWorktreeDiff(input.worktreeId);
          return JSON.stringify({
            status: 'success',
            action: 'diff',
            worktreeId: input.worktreeId,
            hasChanges: diff.length > 0,
            diff,
          });
        } catch (err: unknown) {
          return JSON.stringify({
            status: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }

      case 'commit': {
        if (!input.worktreeId || !input.commitMessage) {
          return JSON.stringify({
            status: 'error',
            message: 'worktreeId and commitMessage are required to commit changes in worktree.',
          });
        }
        try {
          const result = await manager.commitWorktree(input.worktreeId, input.commitMessage);
          return JSON.stringify({
            status: 'success',
            action: 'commit',
            worktreeId: input.worktreeId,
            commitHash: result.commitHash,
            branch: result.branch,
          });
        } catch (err: unknown) {
          return JSON.stringify({
            status: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }

      case 'cleanup': {
        if (!input.worktreeId) {
          return JSON.stringify({
            status: 'error',
            message: 'worktreeId is required to cleanup a worktree.',
          });
        }
        const cleaned = await manager.cleanupWorktree(input.worktreeId);
        return JSON.stringify({
          status: cleaned ? 'success' : 'failed',
          action: 'cleanup',
          worktreeId: input.worktreeId,
          message: cleaned ? `Worktree "${input.worktreeId}" successfully cleaned up.` : `Failed to cleanup "${input.worktreeId}".`,
        });
      }

      default:
        return JSON.stringify({
          status: 'error',
          message: `Unknown action: ${String(input.action)}`,
        });
    }
  }
}
