import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

export class ZavorthGitAdvancedTool extends BaseTool {
  public readonly name = 'zavorth_git_advanced';

  public readonly description =
    'Advanced Git operations — bisect, blame, stash, cherry-pick, rebase, reflog, worktree, submodules, hooks management, and detailed log analysis.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'bisect_start', 'bisect_good', 'bisect_bad', 'bisect_reset', 'blame', 'stash', 'stash_pop', 'stash_list', 'cherry_pick', 'rebase', 'reflog', 'worktree_add', 'worktree_list', 'worktree_remove', 'submodule_update', 'submodule_status', 'hooks_list', 'log_advanced', 'search', 'sparse_checkout'.",
      },
      repo_path: {
        type: 'string',
        description: 'Path to git repository. Default: current directory.',
      },
      commit: {
        type: 'string',
        description: 'Commit hash for blame, cherry-pick, bisect operations.',
      },
      file_path: {
        type: 'string',
        description: 'File path for blame, search operations.',
      },
      branch: {
        type: 'string',
        description: 'Branch name for rebase, worktree operations.',
      },
      target_branch: {
        type: 'string',
        description: 'Target branch for rebase onto.',
      },
      stash_message: {
        type: 'string',
        description: 'Stash message.',
      },
      search_pattern: {
        type: 'string',
        description: 'Pattern for git log search (pickaxe).',
      },
      author: {
        type: 'string',
        description: 'Author filter for log.',
      },
      since: {
        type: 'string',
        description: "Date filter for log (e.g., '2 weeks ago', '2024-01-01').",
      },
      until: {
        type: 'string',
        description: 'End date filter for log.',
      },
      max_count: {
        type: 'number',
        description: 'Max number of log entries. Default: 20.',
      },
      worktree_path: {
        type: 'string',
        description: 'Path for worktree add/remove.',
      },
      force: {
        type: 'boolean',
        description: 'Force operation (e.g., worktree remove --force).',
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    const repoPath = String(args.repo_path || '.');

    switch (action) {
      case 'bisect_start': return await this.gitCmd(repoPath, ['bisect', 'start']);
      case 'bisect_good': return await this.gitCmd(repoPath, ['bisect', 'good', String(args.commit || '')]);
      case 'bisect_bad': return await this.gitCmd(repoPath, ['bisect', 'bad', String(args.commit || '')]);
      case 'bisect_reset': return await this.gitCmd(repoPath, ['bisect', 'reset']);
      case 'blame': return await this.blame(repoPath, args);
      case 'stash': return await this.stash(repoPath, args);
      case 'stash_pop': return await this.gitCmd(repoPath, ['stash', 'pop']);
      case 'stash_list': return await this.gitCmd(repoPath, ['stash', 'list', '--oneline']);
      case 'cherry_pick': return await this.cherryPick(repoPath, args);
      case 'rebase': return await this.rebase(repoPath, args);
      case 'reflog': return await this.reflog(repoPath, args);
      case 'worktree_add': return await this.worktreeAdd(repoPath, args);
      case 'worktree_list': return await this.gitCmd(repoPath, ['worktree', 'list']);
      case 'worktree_remove': return await this.worktreeRemove(repoPath, args);
      case 'submodule_update': return await this.gitCmd(repoPath, ['submodule', 'update', '--init', '--recursive']);
      case 'submodule_status': return await this.gitCmd(repoPath, ['submodule', 'status']);
      case 'hooks_list': return await this.hooksList(repoPath);
      case 'log_advanced': return await this.logAdvanced(repoPath, args);
      case 'search': return await this.search(repoPath, args);
      case 'sparse_checkout': return await this.sparseCheckout(repoPath, args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async gitCmd(repoPath: string, gitArgs: string[], timeout = 30000): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('git', gitArgs, { cwd: repoPath, timeout, maxBuffer: 10 * 1024 * 1024 }).toString();
      return result.trim() || '(no output)';
    } catch (error: unknown) {logger.warn('[Zavorth Git Advanced] process execution failed', error); return ''; }
  }

  private async blame(repoPath: string, args: Record<string, unknown>): Promise<string> {
    const filePath = String(args.file_path || '');
    if (!filePath) return 'Error: "file_path" is required for blame.';

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('git', ['blame', '--line-porcelain', filePath], {
        cwd: repoPath,
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      }).toString();

      const lines = result.split('\n');
      const authors: Record<string, number> = {};
      for (const line of lines) {
        if (line.startsWith('author ')) {
          const author = line.slice(7);
          authors[author] = (authors[author] || 0) + 1;
        }
      }

      const summary = Object.entries(authors)
        .sort((a, b) => b[1] - a[1])
        .map(([author, count]) => `  ${author}: ${count} lines`)
        .join('\n');

      return `Blame for ${filePath}:\n${summary}`;
    } catch (error: unknown) {logger.warn('[Zavorth Git Advanced] lifecycle operation failed', error); return ''; }
  }

  private async stash(repoPath: string, args: Record<string, unknown>): Promise<string> {
    const message = String(args.stash_message || '');
    const gitArgs = ['stash', 'push'];
    if (message) gitArgs.push('-m', message);
    return await this.gitCmd(repoPath, gitArgs);
  }

  private async cherryPick(repoPath: string, args: Record<string, unknown>): Promise<string> {
    const commit = String(args.commit || '');
    if (!commit) return 'Error: "commit" is required for cherry-pick.';

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('git', ['cherry-pick', commit], { cwd: repoPath, timeout: 30000 }).toString();
      return `Cherry-pick ${commit}:\n${result.trim() || 'Applied successfully'}`;
    } catch (error: unknown) {logger.warn('[Zavorth Git Advanced] process execution failed', error); return ''; }
  }

  private async rebase(repoPath: string, args: Record<string, unknown>): Promise<string> {
    const targetBranch = String(args.target_branch || '');
    const branch = String(args.branch || '');

    const gitArgs = ['rebase'];
    if (targetBranch) {
      gitArgs.push(targetBranch);
    } else if (branch) {
      gitArgs.push(branch);
    } else {
      return 'Error: "target_branch" or "branch" is required for rebase.';
    }

    return await this.gitCmd(repoPath, gitArgs, 60000);
  }

  private async reflog(repoPath: string, args: Record<string, unknown>): Promise<string> {
    const maxCount = Number(args.max_count || 20);
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('git', ['reflog', `--max-count=${maxCount}`, '--format=%h %gd %gs (%cr)'], {
        cwd: repoPath,
        timeout: 15000,
      }).toString();
      return `Reflog (last ${maxCount} entries):\n${result.trim()}`;
    } catch (error: unknown) {logger.warn('[Zavorth Git Advanced] process execution failed', error); return ''; }
  }

  private async worktreeAdd(repoPath: string, args: Record<string, unknown>): Promise<string> {
    const worktreePath = String(args.worktree_path || '');
    const branch = String(args.branch || '');
    if (!worktreePath) return 'Error: "worktree_path" is required.';

    const gitArgs = ['worktree', 'add', worktreePath];
    if (branch) gitArgs.push(branch);
    return await this.gitCmd(repoPath, gitArgs);
  }

  private async worktreeRemove(repoPath: string, args: Record<string, unknown>): Promise<string> {
    const worktreePath = String(args.worktree_path || '');
    if (!worktreePath) return 'Error: "worktree_path" is required.';

    const gitArgs = ['worktree', 'remove', worktreePath];
    if (args.force) gitArgs.push('--force');
    return await this.gitCmd(repoPath, gitArgs);
  }

  private async hooksList(repoPath: string): Promise<string> {
    const hooksDir = path.join(repoPath, '.git', 'hooks');
    if (!fs.existsSync(hooksDir)) return 'No hooks directory found.';

    const files = fs.readdirSync(hooksDir).filter(f => !f.endsWith('.sample'));
    const samples = fs.readdirSync(hooksDir).filter(f => f.endsWith('.sample')).map(f => f.replace('.sample', ''));

    return [
      `Active hooks (${files.length}):`,
      ...files.map(f => `  ✓ ${f}`),
      '',
      `Available hooks (${samples.length}):`,
      ...samples.map(f => `  ○ ${f}`),
    ].join('\n');
  }

  private async logAdvanced(repoPath: string, args: Record<string, unknown>): Promise<string> {
    const maxCount = Number(args.max_count || 20);
    const author = String(args.author || '');
    const since = String(args.since || '');
    const until = String(args.until || '');

    const gitArgs = ['log', `--max-count=${maxCount}`, '--format=%h %an %cr %s'];
    if (author) gitArgs.push(`--author=${author}`);
    if (since) gitArgs.push(`--since=${since}`);
    if (until) gitArgs.push(`--until=${until}`);

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('git', gitArgs, { cwd: repoPath, timeout: 15000 }).toString();
      return `Git log:\n${result.trim() || 'No commits found.'}`;
    } catch (error: unknown) {logger.warn('[Zavorth Git Advanced] process execution failed', error); return ''; }
  }

  private async search(repoPath: string, args: Record<string, unknown>): Promise<string> {
    const pattern = String(args.search_pattern || '');
    if (!pattern) return 'Error: "search_pattern" is required for search.';

    const filePath = String(args.file_path || '');
    const gitArgs = ['log', '-S', pattern, '--oneline', '--max-count=50'];
    if (filePath) gitArgs.push('--', filePath);

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('git', gitArgs, { cwd: repoPath, timeout: 30000 }).toString();
      return `Search for "${pattern}":\n${result.trim() || 'No matches found.'}`;
    } catch (error: unknown) {logger.warn('[Zavorth Git Advanced] process execution failed', error); return ''; }
  }

  private async sparseCheckout(repoPath: string, args: Record<string, unknown>): Promise<string> {
    const filePath = String(args.file_path || '');
    if (!filePath) return 'Error: "file_path" is required for sparse_checkout.';

    try {
      const { execFileSync } = await import('child_process');
      execFileSync('git', ['sparse-checkout', 'init', '--cone'], { cwd: repoPath, timeout: 15000 }).toString();
      execFileSync('git', ['sparse-checkout', 'set', filePath], { cwd: repoPath, timeout: 15000 }).toString();
      return `Sparse checkout set to: ${filePath}`;
    } catch (error: unknown) {logger.warn('[Zavorth Git Advanced] process execution failed', error); return ''; }
  }
}
