import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { Database } from '../storage/Database.js';
import { executionContextScope } from '../runtime/context/ExecutionContextScope.js';
import { WorkspaceFsPolicy } from './workspace/WorkspaceFsPolicy.js';
import path from 'path';

export interface GitFileLock {
  filepath: string;
  subagent_id: string;
  locked_at: number;
}

export class ZavorthGitLockTool extends BaseTool {
  public readonly name = 'zavorth_git_lock';
  public readonly description = 'Manage git file locks to prevent conflicts between concurrent subagents.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['acquire', 'release'],
        description: 'Action to perform: acquire or release a lock.',
      },
      filepath: {
        type: 'string',
        description: 'Relative path of the file to lock or unlock.',
      },
      subagentId: {
        type: 'string',
        description: 'Optional subagent ID. If not provided, it resolves from context.',
      },
    },
    required: ['action', 'filepath'],
  };

  private static async getDb(): Promise<Database> {
    const db = await Database.getInstance();
    db.run(`
      CREATE TABLE IF NOT EXISTS git_file_locks (
        filepath TEXT PRIMARY KEY,
        subagent_id TEXT,
        locked_at INTEGER,
        expires_at INTEGER
      )
    `);
    return db;
  }

  private static getCanonicalPath(filepath: string): string {
    const policy = new WorkspaceFsPolicy();
    try {
      return policy.resolveWritePath(filepath).absolutePath;
    } catch {
      try {
        return policy.resolveEditPath(filepath).absolutePath;
      } catch {
        throw new Error(`Path "${filepath}" is outside the workspace boundary.`);
      }
    }
  }

  private static TTL_MS = 5 * 60 * 1000;

  private static getCurrentSubagentId(args: Record<string, unknown>): string {
    if (process.env.NODE_ENV === 'test' && typeof args.subagentId === 'string' && args.subagentId) {
      return args.subagentId;
    }
    return executionContextScope.current()?.sessionId || 'main';
  }

  public static async checkLock(filepath: string, currentSubagentId: string | null): Promise<void> {
    const db = await this.getDb();
    const canonicalPath = this.getCanonicalPath(filepath);

    this.cleanupExpiredLocks(db);

    const lock = db.get<GitFileLock>(
      'SELECT filepath, subagent_id, locked_at FROM git_file_locks WHERE filepath = ?',
      [canonicalPath]
    );

    if (lock && lock.subagent_id !== currentSubagentId) {
      throw new Error(`File is locked by another subagent.`);
    }
  }

  private static cleanupExpiredLocks(db: Database): void {
    db.run('DELETE FROM git_file_locks WHERE expires_at IS NOT NULL AND expires_at < ?', [Date.now()]);
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    const filepath = String(args.filepath || '');
    if (!action || !filepath) {
      return JSON.stringify({ error: 'Parameters "action" and "filepath" are required.' });
    }

    const currentSubagentId = ZavorthGitLockTool.getCurrentSubagentId(args);
    const canonicalPath = ZavorthGitLockTool.getCanonicalPath(filepath);
    const db = await ZavorthGitLockTool.getDb();

    ZavorthGitLockTool.cleanupExpiredLocks(db);

    if (action === 'acquire') {
      const existingLock = db.get<GitFileLock>(
        'SELECT filepath, subagent_id, locked_at FROM git_file_locks WHERE filepath = ?',
        [canonicalPath]
      );

      if (existingLock && existingLock.subagent_id === currentSubagentId) {
        return JSON.stringify({
          success: true,
          message: `Lock already held by you for path: ${canonicalPath}`,
          lock: existingLock,
        });
      }

      if (existingLock) {
        return JSON.stringify({
          success: false,
          error: `File is locked by another subagent.`,
          lock: { filepath: canonicalPath, locked_at: existingLock.locked_at },
        });
      }

      const lockedAt = Date.now();
      const expiresAt = lockedAt + ZavorthGitLockTool.TTL_MS;
      db.run(
        'INSERT OR IGNORE INTO git_file_locks (filepath, subagent_id, locked_at, expires_at) VALUES (?, ?, ?, ?)',
        [canonicalPath, currentSubagentId, lockedAt, expiresAt]
      );

      const acquired = db.get<GitFileLock>(
        'SELECT filepath, subagent_id, locked_at FROM git_file_locks WHERE filepath = ?',
        [canonicalPath]
      );

      if (acquired && acquired.subagent_id === currentSubagentId) {
        return JSON.stringify({
          success: true,
          message: `Lock acquired successfully.`,
          lock: acquired,
        });
      }

      return JSON.stringify({
        success: false,
        error: `Lock acquisition failed (race condition detected).`,
      });

    } else if (action === 'release') {
      const lock = db.get<GitFileLock>(
        'SELECT filepath, subagent_id, locked_at FROM git_file_locks WHERE filepath = ?',
        [canonicalPath]
      );

      if (!lock) {
        return JSON.stringify({
          success: true,
          message: `No active lock found.`,
        });
      }

      if (lock.subagent_id !== currentSubagentId) {
        return JSON.stringify({
          success: false,
          error: `Cannot release lock owned by subagent.`,
        });
      }

      db.run('DELETE FROM git_file_locks WHERE filepath = ? AND subagent_id = ?', [canonicalPath, currentSubagentId]);

      return JSON.stringify({
        success: true,
        message: `Lock released successfully.`,
      });
    }

    return JSON.stringify({ error: `Invalid action: ${action}` });
  }
}
