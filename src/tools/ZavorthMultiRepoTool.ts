import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

export interface RepoConfig {
  name: string;
  path: string;
  remote: string;
  branch: string;
  last_sync: string | null;
}

export class ZavorthMultiRepoTool extends BaseTool {
  public readonly name = 'zavorth_multi_repo';

  public readonly description =
    'Multi-repo operations — clone, sync, diff, and manage pull requests across multiple Git repositories simultaneously.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'register', 'list', 'sync', 'status', 'diff', 'branch_create', 'pr_create', 'remove'.",
      },
      repo_name: {
        type: 'string',
        description: 'Repository name.',
      },
      repo_path: {
        type: 'string',
        description: 'Local path to repository.',
      },
      remote_url: {
        type: 'string',
        description: 'Remote URL for cloning.',
      },
      branch: {
        type: 'string',
        description: 'Branch name.',
      },
      message: {
        type: 'string',
        description: 'Commit message for sync.',
      },
      all_repos: {
        type: 'boolean',
        description: 'Apply action to all registered repos. Default: false.',
      },
    },
    required: ['action'],
  };

  private readonly storageDir: string;
  private repos: Map<string, RepoConfig> = new Map();

  constructor(options?: { storageDir?: string }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'multi-repo');
    this.ensureDir();
    this.loadRepos();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
  }

  private loadRepos(): void {
    const configPath = path.join(this.storageDir, 'repos.json');
    if (!fs.existsSync(configPath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      this.repos = new Map(Object.entries(data));
    } catch (error: unknown) {/* ignore */ logger.warn('[Zavorth Multi Repo] JSON parse failed', error); }
  }

  private saveRepos(): void {
    fs.writeFileSync(path.join(this.storageDir, 'repos.json'), JSON.stringify(Object.fromEntries(this.repos), null, 2), 'utf-8');
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'register': return this.registerRepo(args);
      case 'list': return this.listRepos();
      case 'sync': return await this.syncRepo(args);
      case 'status': return await this.repoStatus(args);
      case 'diff': return await this.repoDiff(args);
      case 'branch_create': return await this.createBranch(args);
      case 'pr_create': return await this.createPR(args);
      case 'remove': return this.removeRepo(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private registerRepo(args: Record<string, unknown>): string {
    const name = String(args.repo_name || '');
    const repoPath = String(args.repo_path || '');
    if (!name || !repoPath) return 'Error: "repo_name" and "repo_path" are required.';

    const resolved = path.resolve(repoPath);
    if (!fs.existsSync(resolved)) return `Error: path "${repoPath}" not found.`;

    this.repos.set(name, {
      name,
      path: resolved,
      remote: String(args.remote_url || ''),
      branch: String(args.branch || 'main'),
      last_sync: null,
    });
    this.saveRepos();

    return `Repository "${name}" registered at ${resolved}.`;
  }

  private listRepos(): string {
    if (this.repos.size === 0) return 'No repositories registered.';

    const lines: string[] = ['Registered Repositories:'];
    for (const [, repo] of this.repos) {
      lines.push(`  ${repo.name}: ${repo.path} [${repo.branch}] last_sync: ${repo.last_sync || 'never'}`);
    }
    return lines.join('\n');
  }

  private async syncRepo(args: Record<string, unknown>): Promise<string> {
    const name = String(args.repo_name || '');
    if (!name) return 'Error: "repo_name" is required.';

    const repo = this.repos.get(name);
    if (!repo) return `Error: repository "${name}" not found.`;

    try {
      const { execFileSync } = await import('child_process');
      const message = String(args.message || 'Auto-sync via Zavorth Multi-Repo');

      execFileSync('git', ['add', '-A'], { cwd: repo.path, timeout: 30000 });
      try {
        execFileSync('git', ['commit', '-m', message], { cwd: repo.path, timeout: 30000 });
      } catch (error: unknown) {/* no changes to commit */ logger.warn('[Zavorth Multi Repo] process execution failed', error); }

      if (repo.remote) {
        execFileSync('git', ['push', 'origin', repo.branch], { cwd: repo.path, timeout: 60000 });
      }

      repo.last_sync = new Date().toISOString();
      this.saveRepos();

      return `Repository "${name}" synced. Branch: ${repo.branch}${repo.remote ? ', pushed to remote.' : ''}`;
    } catch (error: unknown) {logger.warn('[Zavorth Multi Repo] process execution failed', error); return ''; }
  }

  private async repoStatus(args: Record<string, unknown>): Promise<string> {
    const name = String(args.repo_name || '');
    if (!name) return 'Error: "repo_name" is required.';

    const repo = this.repos.get(name);
    if (!repo) return `Error: repository "${name}" not found.`;

    try {
      const { execFileSync } = await import('child_process');
      const status = execFileSync('git', ['status', '--short'], { cwd: repo.path, timeout: 10000 }).toString();
      const branch = execFileSync('git', ['branch', '--show-current'], { cwd: repo.path, timeout: 5000 }).toString().trim();

      return `Repository "${name}" (${branch}):\n${status || '  Clean working tree.'}`;
    } catch (error: unknown) {logger.warn('[Zavorth Multi Repo] process execution failed', error); return ''; }
  }

  private async repoDiff(args: Record<string, unknown>): Promise<string> {
    const name = String(args.repo_name || '');
    if (!name) return 'Error: "repo_name" is required.';

    const repo = this.repos.get(name);
    if (!repo) return `Error: repository "${name}" not found.`;

    try {
      const { execFileSync } = await import('child_process');
      const diff = execFileSync('git', ['diff', '--stat'], { cwd: repo.path, timeout: 10000 }).toString();
      return `Diff for "${name}":\n${diff || '  No changes.'}`;
    } catch (error: unknown) {logger.warn('[Zavorth Multi Repo] process execution failed', error); return ''; }
  }

  private async createBranch(args: Record<string, unknown>): Promise<string> {
    const name = String(args.repo_name || '');
    const branch = String(args.branch || '');
    if (!name || !branch) return 'Error: "repo_name" and "branch" are required.';

    const repo = this.repos.get(name);
    if (!repo) return `Error: repository "${name}" not found.`;

    try {
      const { execFileSync } = await import('child_process');
      execFileSync('git', ['checkout', '-b', branch], { cwd: repo.path, timeout: 10000 });
      repo.branch = branch;
      this.saveRepos();
      return `Branch "${branch}" created and checked out in "${name}".`;
    } catch (error: unknown) {logger.warn('[Zavorth Multi Repo] process execution failed', error); return ''; }
  }

  private async createPR(args: Record<string, unknown>): Promise<string> {
    const name = String(args.repo_name || '');
    if (!name) return 'Error: "repo_name" is required.';

    const repo = this.repos.get(name);
    if (!repo) return `Error: repository "${name}" not found.`;

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('gh', ['pr', 'create', '--fill'], { cwd: repo.path, timeout: 60000 }).toString();
      return `PR created for "${name}":\n${result}`;
    } catch (error: unknown) {logger.warn('[Zavorth Multi Repo] process execution failed', error); return ''; }
  }

  private removeRepo(args: Record<string, unknown>): string {
    const name = String(args.repo_name || '');
    if (!name) return 'Error: "repo_name" is required.';

    if (!this.repos.has(name)) return `Error: repository "${name}" not found.`;
    this.repos.delete(name);
    this.saveRepos();
    return `Repository "${name}" removed from tracking.`;
  }
}
