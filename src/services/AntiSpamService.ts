import { Database } from '../storage/Database.js';

export type AntiSpamAction = 'delete' | 'warn' | 'mute' | 'ban' | 'none';

interface AntiSpamConfig {
  chat_id: string;
  antilink_enabled: number;
  flood_enabled: number;
  flood_max_msgs: number;
  flood_window_seconds: number;
  banned_words: string; // JSON array
  updated_at: string;
}

interface FloodTracker {
  timestamps: number[];
}

/**
 * AntiSpamService — detecta e sugere actions sobre spam em grupos.
 * Features: anti-link, flood detection, forbidden terms.
 * Does not execute actions directly — returns the suggested action for the controller to decide.
 */
export class AntiSpamService {
  private db!: Database;
  private initialized = false;
  private floodTrackers = new Map<string, FloodTracker>();

  public async init(): Promise<void> {
    if (this.initialized) return;
    this.db = await Database.getInstance();
    this.db.run(`
      CREATE TABLE IF NOT EXISTS group_antispam (
        chat_id TEXT PRIMARY KEY,
        antilink_enabled INTEGER NOT NULL DEFAULT 0,
        flood_enabled INTEGER NOT NULL DEFAULT 0,
        flood_max_msgs INTEGER NOT NULL DEFAULT 5,
        flood_window_seconds INTEGER NOT NULL DEFAULT 10,
        banned_words TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    this.initialized = true;
  }

  public async getConfig(chatId: string): Promise<AntiSpamConfig | null> {
    await this.init();
    return this.db.get<AntiSpamConfig>(
      'SELECT * FROM group_antispam WHERE chat_id = ?',
      [chatId],
    ) || null;
  }

  public async enableAntiLink(chatId: string, enabled: boolean): Promise<void> {
    await this.init();
    this.upsert(chatId, { antilink_enabled: enabled ? 1 : 0 });
  }

  public async enableFloodProtection(chatId: string, enabled: boolean): Promise<void> {
    await this.init();
    this.upsert(chatId, { flood_enabled: enabled ? 1 : 0 });
  }

  public async setFloodLimit(chatId: string, maxMsgs: number, windowSeconds: number = 10): Promise<void> {
    await this.init();
    this.upsert(chatId, {
      flood_enabled: 1,
      flood_max_msgs: Math.max(2, Math.min(maxMsgs, 50)),
      flood_window_seconds: Math.max(5, Math.min(windowSeconds, 120)),
    });
  }

  public async addBannedWord(chatId: string, word: string): Promise<void> {
    await this.init();
    const config = await this.getConfig(chatId);
    const words: string[] = config ? JSON.parse(config.banned_words) : [];
    const normalized = word.trim().toLowerCase();
    if (!normalized || words.includes(normalized)) return;
    words.push(normalized);
    this.upsert(chatId, { banned_words: JSON.stringify(words) });
  }

  public async removeBannedWord(chatId: string, word: string): Promise<boolean> {
    await this.init();
    const config = await this.getConfig(chatId);
    if (!config) return false;
    const words: string[] = JSON.parse(config.banned_words);
    const normalized = word.trim().toLowerCase();
    const index = words.indexOf(normalized);
    if (index === -1) return false;
    words.splice(index, 1);
    this.upsert(chatId, { banned_words: JSON.stringify(words) });
    return true;
  }

  public async getBannedWords(chatId: string): Promise<string[]> {
    await this.init();
    const config = await this.getConfig(chatId);
    return config ? JSON.parse(config.banned_words) : [];
  }

  /**
   * Analyzes a text message and returns the suggested action.
   */
  public async analyzeMessage(chatId: string, userId: string, text: string): Promise<{ action: AntiSpamAction; reason: string }> {
    await this.init();
    const config = await this.getConfig(chatId);
    if (!config) return { action: 'none', reason: '' };

    // 1. Antilink
    if (config.antilink_enabled) {
      const linkRegex = /https?:\/\/[^\s]+|t\.me\/[^\s]+|wa\.me\/[^\s]+|bit\.ly\/[^\s]+/i;
      if (linkRegex.test(text)) {
        return { action: 'delete', reason: 'Link detectado (antilink active)' };
      }
    }

    // 2. Forbidden terms
    const bannedWords: string[] = JSON.parse(config.banned_words);
    if (bannedWords.length > 0) {
      const lowerText = text.toLowerCase();
      const found = bannedWords.find((w) => lowerText.includes(w));
      if (found) {
        return { action: 'warn', reason: `Palavra proibida detectada: "${found}"` };
      }
    }

    // 3. Flood
    if (config.flood_enabled) {
      const key = `${chatId}:${userId}`;
      const now = Date.now();
      const tracker = this.floodTrackers.get(key) || { timestamps: [] };
      const windowMs = config.flood_window_seconds * 1000;

      tracker.timestamps = tracker.timestamps.filter((t) => now - t < windowMs);
      tracker.timestamps.push(now);
      this.floodTrackers.set(key, tracker);

      if (tracker.timestamps.length > config.flood_max_msgs) {
        return { action: 'mute', reason: `Flood detectado: ${tracker.timestamps.length} msgs em ${config.flood_window_seconds}s` };
      }
    }

    return { action: 'none', reason: '' };
  }

  private upsert(chatId: string, fields: Partial<AntiSpamConfig>): void {
    const existing = this.db.get<AntiSpamConfig>(
      'SELECT * FROM group_antispam WHERE chat_id = ?',
      [chatId],
    );

    if (existing) {
      const sets: string[] = [];
      const params: any[] = [];
      for (const [key, value] of Object.entries(fields)) {
        sets.push(`${key} = ?`);
        params.push(value);
      }
      sets.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(chatId);
      this.db.run(`UPDATE group_antispam SET ${sets.join(', ')} WHERE chat_id = ?`, params);
    } else {
      const all: any = {
        chat_id: chatId,
        antilink_enabled: 0,
        flood_enabled: 0,
        flood_max_msgs: 5,
        flood_window_seconds: 10,
        banned_words: '[]',
        updated_at: new Date().toISOString(),
        ...fields,
      };
      this.db.run(
        `INSERT INTO group_antispam (chat_id, antilink_enabled, flood_enabled, flood_max_msgs, flood_window_seconds, banned_words, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [all.chat_id, all.antilink_enabled, all.flood_enabled, all.flood_max_msgs,
         all.flood_window_seconds, all.banned_words, all.updated_at],
      );
    }
  }
}
