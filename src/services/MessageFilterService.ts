import { Database } from '../storage/Database.js';

export type FilterableMessageType =
  | 'sticker'
  | 'gif'
  | 'audio'
  | 'voice'
  | 'video_note'
  | 'document'
  | 'photo'
  | 'forward'
  | 'contact'
  | 'location';

const ALL_FILTERABLE_TYPES: FilterableMessageType[] = [
  'sticker', 'gif', 'audio', 'voice', 'video_note',
  'document', 'photo', 'forward', 'contact', 'location',
];

interface MessageFilterConfig {
  chat_id: string;
  blocked_types: string; // JSON array of FilterableMessageType
  updated_at: string;
}

/**
 * MessageFilterService filters specific message types in groups.
 * Permite bloquear stickers, GIFs, audios, documentos, forwards, etc.
 */
export class MessageFilterService {
  private db!: Database;
  private initialized = false;

  public async init(): Promise<void> {
    if (this.initialized) return;
    this.db = await Database.getInstance();
    this.db.run(`
      CREATE TABLE IF NOT EXISTS group_message_filter (
        chat_id TEXT PRIMARY KEY,
        blocked_types TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    this.initialized = true;
  }

  public async setFilter(chatId: string, type: FilterableMessageType, blocked: boolean): Promise<void> {
    await this.init();
    if (!ALL_FILTERABLE_TYPES.includes(type)) return;

    const config = await this.getConfig(chatId);
    const types: FilterableMessageType[] = config ? JSON.parse(config.blocked_types) : [];

    if (blocked && !types.includes(type)) {
      types.push(type);
    } else if (!blocked) {
      const idx = types.indexOf(type);
      if (idx >= 0) types.splice(idx, 1);
    }

    this.upsert(chatId, JSON.stringify(types));
  }

  public async getBlockedTypes(chatId: string): Promise<FilterableMessageType[]> {
    await this.init();
    const config = await this.getConfig(chatId);
    return config ? JSON.parse(config.blocked_types) : [];
  }

  public async isBlocked(chatId: string, type: FilterableMessageType): Promise<boolean> {
    const blocked = await this.getBlockedTypes(chatId);
    return blocked.includes(type);
  }

  public async clearFilters(chatId: string): Promise<void> {
    await this.init();
    this.upsert(chatId, '[]');
  }

  public static getAllFilterableTypes(): FilterableMessageType[] {
    return [...ALL_FILTERABLE_TYPES];
  }

  private async getConfig(chatId: string): Promise<MessageFilterConfig | null> {
    return this.db.get<MessageFilterConfig>(
      'SELECT * FROM group_message_filter WHERE chat_id = ...',
      [chatId],
    ) || null;
  }

  private upsert(chatId: string, blockedTypesJson: string): void {
    const existing = this.db.get<MessageFilterConfig>(
      'SELECT * FROM group_message_filter WHERE chat_id = ...',
      [chatId],
    );

    const now = new Date().toISOString();
    if (existing) {
      this.db.run(
        'UPDATE group_message_filter SET blocked_types = ..., updated_at = - WHERE chat_id = ...',
        [blockedTypesJson, now, chatId],
      );
    } else {
      this.db.run(
        'INSERT INTO group_message_filter (chat_id, blocked_types, updated_at) VALUES (..., ..., ...)',
        [chatId, blockedTypesJson, now],
      );
    }
  }
}
