import fs from 'fs';
import path from 'path';
import { SpawnSyncReturns, spawnSync } from 'child_process';
import { config } from '../config/index.js';
import { SecureStorageService } from './SecureStorageService.js';
import { Database } from '../storage/Database.js';

export class ConfigVersioningService {
  private static readonly GIT_TIMEOUT_MS = 8_000;
  private secureStorage = new SecureStorageService();

  public async snapshot(reason: string): Promise<void> {
    if (!config.configGitEnabled || (process.env.JEST_WORKER_ID && process.env.ZAVORTH_CONFIG_GIT_TEST !== 'true')) {
      return;
    }

    const repoDir = config.configGitRepoDir;
    fs.mkdirSync(repoDir, { recursive: true });
    this.ensureGitRepo(repoDir);
    await this.syncTrackedFiles(repoDir);

    const status = this.runGit(['status', '--porcelain'], repoDir);
    if (status.status !== 0 || status.error || !String(status.stdout || '').trim()) {
      return;
    }

    const addResult = this.runGit(['add', '-A'], repoDir);
    if (addResult.status !== 0 || addResult.error) {
      return;
    }

    this.runGit(['commit', '-m', reason], repoDir, {
      cwd: repoDir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Zavorth',
        GIT_AUTHOR_EMAIL: 'zavorth@localhost',
        GIT_COMMITTER_NAME: 'Zavorth',
        GIT_COMMITTER_EMAIL: 'zavorth@localhost',
      },
    });
  }

  private ensureGitRepo(repoDir: string): void {
    if (fs.existsSync(path.join(repoDir, '.git'))) {
      return;
    }

    this.runGit(['init'], repoDir);
  }

  private async syncTrackedFiles(repoDir: string): Promise<void> {
    const trackedFiles = [
      path.resolve(process.cwd(), 'config', 'security-policy.json'),
      path.resolve(process.cwd(), 'MEMORY.md'),
      path.resolve(process.cwd(), 'IDENTITY.md'),
      path.resolve(process.cwd(), 'SOUL.md'),
      path.resolve(process.cwd(), 'TOOLS.md'),
      path.resolve(process.cwd(), 'USER.md'),
    ];

    for (const filePath of trackedFiles) {
      if (!fs.existsSync(filePath)) {
        continue;
      }

      const relative = path.relative(process.cwd(), filePath);
      const target = path.join(repoDir, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(filePath, target);
    }

    const db = await Database.getInstance();
    const exportsDir = path.join(repoDir, 'exports');
    fs.mkdirSync(exportsDir, { recursive: true });

    const snippets = this.safeQuery(db, 'SELECT user_id, name, content, created_at FROM snippets ORDER BY created_at DESC')
      .map((row: any) => ({
        ...row,
        content: this.secureStorage.decryptString(row.content) || '',
      }));
    const permissions = this.safeQuery(
      db,
      'SELECT permission_id, executor, kind, status, scope, workspace, requested_value, resolved_value, reason, created_at, updated_at, metadata FROM permission_requests ORDER BY updated_at DESC',
    );
    const memory = this.safeQuery(
      db,
      'SELECT user_id, key, value, category, updated_at FROM user_memory ORDER BY updated_at DESC LIMIT 200',
    ).map((row: any) => ({
      ...row,
      value: this.secureStorage.decryptString(row.value) || '',
    }));

    fs.writeFileSync(path.join(exportsDir, 'snippets.json'), JSON.stringify(snippets, null, 2), 'utf8');
    fs.writeFileSync(path.join(exportsDir, 'permissions.json'), JSON.stringify(permissions, null, 2), 'utf8');
    fs.writeFileSync(path.join(exportsDir, 'memory.json'), JSON.stringify(memory, null, 2), 'utf8');
  }

  private safeQuery(db: Database, sql: string): any[] {
    try {
      return db.all(sql);
    } catch {
      return [];
    }
  }

  private runGit(
    args: string[],
    cwd: string,
    overrides: Record<string, unknown> = {},
  ): SpawnSyncReturns<string> {
    return spawnSync('git', args, {
      cwd,
      windowsHide: true,
      encoding: 'utf8',
      timeout: ConfigVersioningService.GIT_TIMEOUT_MS,
      ...overrides,
    });
  }
}
