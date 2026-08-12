import { Database } from '../storage/Database.js';

interface MessageStatRow {
  user_id: string;
  message_count: number;
  last_message_at: string;
}

interface DailyStatRow {
  date: string;
  message_count: number;
}

/**
 * GroupStatsService tracks and displays message statistics by member/group.
 */
export class GroupStatsService {
  private db!: Database;
  private initialized = false;

  public async init(): Promise<void> {
    if (this.initialized) return;
    this.db = await Database.getInstance();
    this.db.run(`
      CREATE TABLE IF NOT EXISTS group_message_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        message_date TEXT NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 1,
        UNIQUE(chat_id, user_id, message_date)
      )
    `);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_gms_chat_date ON group_message_stats(chat_id, message_date)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_gms_chat_user ON group_message_stats(chat_id, user_id)`);
    this.initialized = true;
  }

  public async trackMessage(chatId: string, userId: string): Promise<void> {
    await this.init();
    const today = this.getLocalDateString();

    const existing = this.db.get<{ id: number; message_count: number }>(
      'SELECT id, message_count FROM group_message_stats WHERE chat_id = ? AND user_id = ? AND message_date = ?',
      [chatId, userId, today],
    );

    if (existing) {
      this.db.run(
        'UPDATE group_message_stats SET message_count = message_count + 1 WHERE id = ?',
        [existing.id],
      );
    } else {
      this.db.run(
        'INSERT INTO group_message_stats (chat_id, user_id, message_date, message_count) VALUES (?, ?, ?, 1)',
        [chatId, userId, today],
      );
    }
  }

  public async getTopMembers(chatId: string, days: number = 7, limit: number = 10): Promise<MessageStatRow[]> {
    await this.init();
    const since = this.daysAgo(days);
    return this.db.all<MessageStatRow>(
      `SELECT user_id, SUM(message_count) as message_count, MAX(message_date) as last_message_at
       FROM group_message_stats
       WHERE chat_id = ? AND message_date >= ?
       GROUP BY user_id
       ORDER BY message_count DESC
       LIMIT ?`,
      [chatId, since, limit],
    );
  }

  public async getDailyStats(chatId: string, days: number = 7): Promise<DailyStatRow[]> {
    await this.init();
    const since = this.daysAgo(days);
    return this.db.all<DailyStatRow>(
      `SELECT message_date as date, SUM(message_count) as message_count
       FROM group_message_stats
       WHERE chat_id = ? AND message_date >= ?
       GROUP BY message_date
       ORDER BY message_date ASC`,
      [chatId, since],
    );
  }

  public async getTotalMessages(chatId: string, days: number = 30): Promise<number> {
    await this.init();
    const since = this.daysAgo(days);
    const result = this.db.get<{ total: number }>(
      'SELECT SUM(message_count) as total FROM group_message_stats WHERE chat_id = ? AND message_date >= ?',
      [chatId, since],
    );
    return result?.total || 0;
  }

  public async getUserMessageCount(chatId: string, userId: string, days: number = 30): Promise<number> {
    await this.init();
    const since = this.daysAgo(days);
    const result = this.db.get<{ total: number }>(
      'SELECT SUM(message_count) as total FROM group_message_stats WHERE chat_id = ? AND user_id = ? AND message_date >= ?',
      [chatId, userId, since],
    );
    return result?.total || 0;
  }

  private daysAgo(days: number): string {
    return this.getLocalDateString(Math.max(0, days - 1));
  }

  private getLocalDateString(daysOffset: number = 0): string {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - daysOffset);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
