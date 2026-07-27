import { Database } from '../storage/Database.js';

export interface WarnEntry {
  id: number;
  chat_id: string;
  user_id: string;
  reason: string;
  warned_by: string;
  created_at: string;
}

interface WarnLimitConfig {
  chat_id: string;
  max_warns: number;
  action_on_limit: string; // 'ban' | 'mute' | 'kick'
}

export type WarnLimitAction = 'ban' | 'mute' | 'kick';

/**
 * WarnService - warning system for group members.
 * When the configurable limit is reached, suggests an automatic action (ban/mute/kick).
 */
export class WarnService {
  private db!: Database;
  private initialized = false;

  public async init(): Promise<void> {
    if (this.initialized) return;
    this.db = await Database.getInstance();
    this.db.run(`
      CREATE TABLE IF NOT EXISTS group_warns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT 'Sem motivo especificado',
        warned_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_warns_chat_user ON group_warns(chat_id, user_id)`);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS group_warn_config (
        chat_id TEXT PRIMARY KEY,
        max_warns INTEGER NOT NULL DEFAULT 3,
        action_on_limit TEXT NOT NULL DEFAULT 'ban'
      )
    `);
    this.initialized = true;
  }

  public async warn(chatId: string, userId: string, reason: string, warnedBy: string): Promise<{ warnCount: number; limitReached: boolean; limitAction: WarnLimitAction }> {
    await this.init();
    this.db.run(
      'INSERT INTO group_warns (chat_id, user_id, reason, warned_by, created_at) VALUES (?, ?, ?, ?, ?)',
      [chatId, userId, reason || 'Sem motivo especificado', warnedBy, new Date().toISOString()],
    );

    const warnCount = await this.getWarnCount(chatId, userId);
    const config = await this.getLimitConfig(chatId);
    const limitReached = warnCount >= config.max_warns;

    return {
      warnCount,
      limitReached,
      limitAction: config.action_on_limit as WarnLimitAction,
    };
  }

  public async getWarns(chatId: string, userId: string): Promise<WarnEntry[]> {
    await this.init();
    return this.db.all<WarnEntry>(
      'SELECT * FROM group_warns WHERE chat_id = ? AND user_id = ? ORDER BY created_at DESC',
      [chatId, userId],
    );
  }

  public async getWarnCount(chatId: string, userId: string): Promise<number> {
    await this.init();
    const result = this.db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM group_warns WHERE chat_id = ? AND user_id = ?',
      [chatId, userId],
    );
    return result?.count || 0;
  }

  public async removeWarn(chatId: string, warnId: number): Promise<boolean> {
    await this.init();
    const existing = this.db.get<WarnEntry>(
      'SELECT * FROM group_warns WHERE id = ? AND chat_id = ?',
      [warnId, chatId],
    );
    if (!existing) return false;
    this.db.run('DELETE FROM group_warns WHERE id = ?', [warnId]);
    return true;
  }

  public async clearWarns(chatId: string, userId: string): Promise<number> {
    await this.init();
    const count = await this.getWarnCount(chatId, userId);
    this.db.run('DELETE FROM group_warns WHERE chat_id = ? AND user_id = ?', [chatId, userId]);
    return count;
  }

  public async setLimitConfig(chatId: string, maxWarns: number, action: WarnLimitAction = 'ban'): Promise<void> {
    await this.init();
    const existing = this.db.get<WarnLimitConfig>(
      'SELECT * FROM group_warn_config WHERE chat_id = ?',
      [chatId],
    );

    const safeMax = Math.max(1, Math.min(maxWarns, 20));
    if (existing) {
      this.db.run(
        'UPDATE group_warn_config SET max_warns = ?, action_on_limit = ? WHERE chat_id = ?',
        [safeMax, action, chatId],
      );
    } else {
      this.db.run(
        'INSERT INTO group_warn_config (chat_id, max_warns, action_on_limit) VALUES (?, ?, ?)',
        [chatId, safeMax, action],
      );
    }
  }

  public async getLimitConfig(chatId: string): Promise<{ max_warns: number; action_on_limit: WarnLimitAction }> {
    await this.init();
    const config = this.db.get<WarnLimitConfig>(
      'SELECT * FROM group_warn_config WHERE chat_id = ?',
      [chatId],
    );
    return {
      max_warns: config?.max_warns || 3,
      action_on_limit: (config?.action_on_limit as WarnLimitAction) || 'ban',
    };
  }
}
